# Restore procedure

Planning package §M. **A backup that has never been restored is not a backup** —
run this against a scratch database before you need it, not during an incident.

## What the dumps are

`GET /api/cron` writes a gzipped logical dump to `$BACKUP_DIR` (default
`$UPLOAD_DIR/backups`) at most once every 20 hours, keeping the newest 14.

    orchid-2026-09-04T11-30-00.sql.gz

Plain SQL: `SHOW CREATE TABLE` for the schema, batched `INSERT`s for the rows,
wrapped in `SET FOREIGN_KEY_CHECKS = 0` so table order cannot matter. It is
written by the application rather than by `mysqldump`, because §A never
established that the host has a shell or that binary — see `src/lib/backup.ts`.

Force one outside the schedule (this is the pre-migration dump in §E's deploy
sequence):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://YOUR_DOMAIN/api/cron?backup=force"
```

## Restoring

**The dump begins with `DROP TABLE IF EXISTS` for every table.** Restoring into
a database overwrites it completely. Check the target twice.

```bash
# 1. Confirm which database you are about to overwrite.
echo "$DB_NAME"

# 2. Take a dump of the CURRENT state first, even if you believe it is broken.
#    A bad restore over an un-dumped database is how one incident becomes two.
curl -H "Authorization: Bearer $CRON_SECRET" "https://YOUR_DOMAIN/api/cron?backup=force"

# 3. Restore.
gunzip -c orchid-2026-09-04T11-30-00.sql.gz | mysql -h 127.0.0.1 -u "$DB_USER" -p "$DB_NAME"

# 4. Bring the schema up to the current migration state. The dump restores the
#    schema as it was WHEN TAKEN; if you have deployed migrations since, they
#    have to be applied again.
node --env-file=.env scripts/migrate.mjs
```

Without a shell on the host, step 3 needs the control panel's SQL import
(phpMyAdmin and Adminer both accept a `.sql.gz` directly).

## Rehearsing it — do this before launch

```bash
# A scratch database, never the real one.
mysql -e "CREATE DATABASE orchid_restore_drill CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
gunzip -c BACKUP.sql.gz | mysql -u "$DB_USER" -p orchid_restore_drill

# Then check it is actually a shop and not an empty schema.
mysql -u "$DB_USER" -p orchid_restore_drill -e "
  SELECT (SELECT COUNT(*) FROM products)  AS products,
         (SELECT COUNT(*) FROM orders)    AS orders,
         (SELECT COUNT(*) FROM users)     AS users,
         (SELECT COUNT(*) FROM settings)  AS settings;"

mysql -e "DROP DATABASE orchid_restore_drill"
```

Row counts matching the live shop is the pass condition. An empty table set
means the dump was taken against the wrong database or truncated mid-write.

## Uploaded media

Archived by the same cron route, weekly, as `orchid-media-<timestamp>.tar.gz`
beside the database dumps. Four are kept. It is a plain gzipped tar written by
the application rather than by a `tar` binary — same reasoning as the database
dump — and it excludes `backups/` and `logs/` so an archive never contains the
previous archive.

A database restored without its media renders every product with a broken
image, so restore both:

```bash
# Into the live upload directory. Check the path twice; this overwrites.
tar -xzf orchid-media-2026-09-05T02-00-00.tar.gz -C "$UPLOAD_DIR"
```

On Windows, GNU tar needs `--force-local` — it reads the colon in `C:\…` as a
remote host spec.

Verify before trusting it:

```bash
tar -tzf orchid-media-<stamp>.tar.gz | wc -l   # entry count
tar -tzf orchid-media-<stamp>.tar.gz | head    # paths look like products/…, homepage/…
```

## What is NOT in either archive
- **`.env`.** Copy it somewhere secure separately.
- **`ENCRYPTION_KEY` in particular.** Provider credentials in `settings` are
  AES-256-GCM ciphertext; restoring the database without that key leaves them
  undecryptable and every integration has to be re-entered. §F says to back it
  up separately from the database, and this is why.
