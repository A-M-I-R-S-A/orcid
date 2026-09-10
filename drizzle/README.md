# Migrations

Applied by `npm run db:migrate` → `scripts/migrate.mjs`.

That runner reads **this directory**, sorts by filename, and tracks what it has
applied in the `__orchid_migrations` table with a checksum per file. It does not
read `meta/_journal.json` and it does not use `drizzle-kit migrate`.

## `meta/_journal.json` is stale, on purpose

It lists only `0000_initial_schema`. Migrations `0001`–`0004` were hand-written
— for things drizzle-kit cannot emit (fulltext indexes, explicit collations,
generated columns) — and no snapshot was recorded for any of them.

This does not affect deployment: `scripts/migrate.mjs` never consults the
journal, so all five files apply in order on a fresh database.

It does affect **`npm run db:generate`**, so read this before running it:

- drizzle-kit diffs `src/db/schema` against the newest snapshot it knows about,
  which is `0000`. It would therefore re-emit every change that `0001`–`0004`
  already made.
- It would also number the result `0001_*`, colliding with the existing
  `0001_search_and_constraints.sql` in a directory the runner sorts by name.

**Do not run `db:generate` and ship its output unread.** Write the migration by
hand, in the style of `0001`–`0004`:

```
drizzle/0005_short_description.sql
```

Separate statements with `--> statement-breakpoint`. The runner splits on it and
applies each statement individually, because MySQL DDL is not transactional and
a failure needs to name the statement it died on. A single-statement migration
needs no breakpoint (see `0003_page_images.sql`).

## Never edit an applied migration

The runner stores a SHA-256 of each file and refuses to continue if a file it
has already applied has changed. That is deliberate: an edited migration means
the database and the repository disagree about what was applied. Add a new file
instead.
