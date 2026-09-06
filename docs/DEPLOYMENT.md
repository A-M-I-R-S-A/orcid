# Deploying Orchid to `orchidbra.ir`

Operator's guide. Follow it top to bottom for a first deployment; for a routine
release, jump to [Routine release](#8-routine-release).

Everything here was verified against this repository on 2026-09-06: production
build, 270 tests, a live boot of the standalone server, and the startup guard
that refuses a misconfigured deployment. Where something could **not** be
verified — anything that depends on the host — it is marked
**HOST-SPECIFIC** rather than guessed.

---

## 0. What you need before you start

| Thing | Requirement | Notes |
|---|---|---|
| Node (build machine) | 22 or 24 | `.nvmrc` pins 22. Node 20 is end-of-life. |
| Node (host) | 22 or 24 | Must match the build machine's major version. |
| MariaDB / MySQL | MariaDB 10.6+ | Verified on MariaDB 12.3.3. |
| TLS certificate | Valid for `orchidbra.ir` | **Not optional** — see §5. |
| Shell on host | Strongly preferred | Panel-only deploys are possible; see §4.3. |
| Disk | ~500 MB app + uploads + 14 DB dumps | Dumps are gzipped. |

Domain: **`orchidbra.ir`**. Set everywhere via `APP_URL`; nothing hardcodes it.

---

## 1. Prepare the database

On the host, as a user that can create databases:

```sql
CREATE DATABASE orchid CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'orchid'@'127.0.0.1' IDENTIFIED BY 'A_LONG_RANDOM_PASSWORD';
GRANT ALL PRIVILEGES ON orchid.* TO 'orchid'@'127.0.0.1';
FLUSH PRIVILEGES;
```

The charset is not cosmetic. The whole catalogue is Persian, and a database
created with the server's default (often `latin1`) mangles it on write, which
is not recoverable by changing the charset afterwards.

Then find the connection ceiling, because §L's warning about `DB_POOL_SIZE`
depends on it:

```sql
SHOW VARIABLES LIKE 'max_user_connections';
SHOW VARIABLES LIKE 'max_connections';
```

---

## 2. Create the storage directory

**Outside the deploy directory.** This is the single most destructive thing to
get wrong: if uploads live inside a release folder, every product image is
deleted by the next release.

```bash
mkdir -p /home/USER/orchid-storage
chmod 700 /home/USER/orchid-storage
```

Backups (`backups/`) and logs (`logs/`) are created inside it automatically.

---

## 3. Write the `.env`

Copy `.env.example` to `.env` on the host and fill it in. Never commit it;
`chmod 600 .env`.

Generate each secret **separately** — four distinct values:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

```ini
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=orchid
DB_USER=orchid
DB_PASSWORD=<the password from §1>

# PER NODE WORKER. Multiply by your worker count and compare to §1's ceiling.
DB_POOL_SIZE=4

APP_URL=https://orchidbra.ir
NODE_ENV=production
TZ=Asia/Tehran
PORT=3000

SESSION_SECRET=<32 random bytes, hex>
OTP_PEPPER=<32 random bytes, hex>
ENCRYPTION_KEY=<32 random bytes, hex — exactly 64 hex chars>
CRON_SECRET=<32 random bytes, hex>

UPLOAD_DIR=/home/USER/orchid-storage
```

Four things to get right:

1. **`APP_URL` must be `https://` and have no trailing slash.** Canonicals, the
   sitemap, Open Graph tags and JSON-LD all derive from it, and the CSP's
   `upgrade-insecure-requests` rewrites the absolute URLs it produces. An
   `http://` value here makes the app refuse to boot (verified in §7.1).

2. **`UPLOAD_DIR` must be absolute.** The standalone entrypoint calls
   `process.chdir(__dirname)`, so a relative path resolves to
   `.next/standalone/storage` — media 404s and uploads die on the next deploy.
   The app refuses to boot on a relative path.

3. **`SMS_DRIVER` must NOT be set.** It is commented out in `.env.example` and
   must stay that way. Set to `null` it swallows every message while reporting
   success — a shop with no working registration and a panel that says
   everything is fine. The app refuses to boot with it set on a non-localhost
   `APP_URL`.

4. **`ENCRYPTION_KEY` must be backed up separately from your database dumps.**
   It decrypts the SMS.ir and payment credentials stored in the `settings`
   table. Stored next to the dump, it defeats the encryption; lost, you
   re-enter every integration credential by hand.

> There is no `AUTH_SECRET`. Older notes listed one as signing admin sessions;
> no code ever read it. Both session tables hold opaque random tokens, stored
> hashed and revocable server-side, so there is no signing key in either path.

---

## 4. Build and upload

### 4.1 Build off-host

The build does **not** need a database, so build on your machine or in CI:

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run build
```

All five must pass.

**Run the end-to-end suite over https at least once before launch.**
`npm run test:e2e` against the default `http://localhost:3000` *skips* the
assertions that matter most for §5 — a browser will not send a `Secure` cookie
over plain http, so the cart-persistence checks quietly opt out rather than
fail. `scripts/https-proxy.mjs` exists to close that gap:

```bash
npm start &                       # app on :3000
node scripts/https-proxy.mjs      # TLS front on :3100, self-signed
E2E_BASE_URL=https://localhost:3100 npm run test:e2e
```

`npm run build` runs `next build` and then
`scripts/bundle-standalone.mjs`, which copies `.next/static` and `public/` into
`.next/standalone`. Without that copy the site serves with no CSS and no
images, on a build that reported success — which is why it is part of the build
script rather than a step in a document.

The finished artifact is the whole `.next/standalone` directory. It contains
`server.js`, its traced `node_modules`, `.next/static` and `public`.

### 4.2 Release layout

```
/home/USER/orchid/
├── releases/
│   ├── 2026-09-06T14-30-00/     ← contents of .next/standalone
│   ├── 2026-09-05T09-12-00/
│   └── 2026-09-03T18-40-00/
├── current -> releases/2026-09-06T14-30-00
└── .env                          ← lives OUTSIDE releases; symlink it in
```

```bash
TS=$(date -u +%Y-%m-%dT%H-%M-%S)
mkdir -p /home/USER/orchid/releases/$TS
# upload .next/standalone/* into that directory, then:
ln -sfn /home/USER/orchid/.env /home/USER/orchid/releases/$TS/.env
```

Keep the last three releases. Rollback is repointing `current` and restarting.

### 4.3 If the host has no shell

Upload `.next/standalone` as a zip through the file manager and extract it
there. Migrations then have to run through the panel's SQL tool: get the
statements with `npm run db:migrate -- --dry-run` locally against a copy, or
paste the `drizzle/*.sql` files in filename order and record them yourself in
`__orchid_migrations`.

---

## 5. TLS and the reverse proxy — **HOST-SPECIFIC**

**HTTPS is not optional, and not only for the usual reasons.** Session and cart
cookies use the `__Host-` prefix, which browsers only accept on a `Secure`
cookie. Safari will not send a `Secure` cookie over plain `http` at all
(Chromium makes a localhost exception; WebKit does not). Served over `http`,
**the cart silently reads back empty on every Apple device** — no error, no
warning, just an empty basket.

Before launch, verify:

- [ ] The certificate is valid for `orchidbra.ir` (and `www.orchidbra.ir` if you serve it).
- [ ] `http://` redirects to `https://` with a 301.
- [ ] `www` redirects to the apex, or the apex to `www` — pick one and make `APP_URL` match it exactly.
- [ ] The proxy sets `X-Forwarded-Proto: https`.

That last one matters more than it looks. The app sits behind the terminator
and only ever sees `http`; it reads `x-forwarded-proto` to decide whether to
emit `upgrade-insecure-requests` in the CSP. Get it wrong and either the
directive is missing on a real https site, or it is emitted on a plain-http
origin — the second of which once took the whole site down, rewriting every
stylesheet and script URL to a port serving no TLS.

Nginx sketch (adapt to the host's actual layer):

```nginx
location / {
    proxy_pass         http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header   Host              $host;
    proxy_set_header   X-Forwarded-Proto $scheme;   # required
    proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
    proxy_set_header   X-Real-IP         $remote_addr;
    proxy_set_header   Upgrade           $http_upgrade;
    proxy_set_header   Connection        "upgrade";
    client_max_body_size 8m;                        # matches serverActions limit
}
```

Do **not** add security headers at the proxy. All six ship from the application
(`next.config.ts` plus the per-request CSP in `src/middleware.ts`), on the
assumption that custom web-server config is unavailable. Adding them again
produces duplicates, and a duplicated CSP is intersected — usually breaking the
page.

---

## 6. Migrate, then start

```bash
cd /home/USER/orchid/current

# 1. See what will apply. Always.
node --env-file=.env scripts/migrate.mjs --dry-run

# 2. Apply.
node --env-file=.env scripts/migrate.mjs
```

A fresh database applies four migrations. The runner sorts by filename, tracks
each file's SHA-256 in `__orchid_migrations`, takes a named lock so two deploys
cannot race, and applies statement-by-statement — MySQL DDL is not
transactional, so a failure names the exact statement it died on. It refuses to
continue if a migration it already applied has since been edited.

First deployment only — create the administrator:

```bash
npm run db:seed            # add ` -- --demo` for demo catalogue data
```

The seed prints a generated admin password **once**. Store it in a password
manager; it cannot be recovered. The seed creates no customer accounts.

Start the app — **HOST-SPECIFIC**:

```bash
node /home/USER/orchid/current/server.js
```

Under Passenger, a panel's Node-app manager, systemd or pm2 the invocation
differs; the entrypoint is always `current/server.js` with the `.env` loaded
and `PORT` matching the proxy. The process model was never verified on this
host — establish the restart command before you need it in a hurry.

---

## 7. Smoke test

### 7.1 The startup guard (verified behaviour)

The app refuses to boot when a development setting is live on a real
deployment. This is what a bad `.env` looks like — it is loud on purpose:

```
Failed to prepare server Error: An error occurred while loading instrumentation hook:
Refusing to start with development settings on a deployment:
  · SMS_DRIVER: SMS_DRIVER=null discards every message while reporting success …
```

If the app starts, `SMS_DRIVER`, `APP_URL` and `UPLOAD_DIR` are all sane.

### 7.2 Checks to run against `https://orchidbra.ir`

```bash
curl -I https://orchidbra.ir/                      # 200, and check headers below
curl -I http://orchidbra.ir/                       # 301 → https
curl -s  https://orchidbra.ir/robots.txt           # Sitemap: https://orchidbra.ir/sitemap.xml
curl -s  https://orchidbra.ir/sitemap.xml | head   # <loc>https://orchidbra.ir/…
```

Headers that must be present on `/`:

- `content-security-policy` with a `nonce-…` (per request — request twice, expect two different values)
- `strict-transport-security: max-age=63072000; includeSubDomains; preload`
- `x-content-type-options: nosniff`
- `x-frame-options: SAMEORIGIN`
- `referrer-policy: strict-origin-when-cross-origin`
- no `x-powered-by`

If `robots.txt` or `sitemap.xml` shows the wrong host, `APP_URL` is wrong —
fix it and restart rather than editing anything in code.

### 7.3 By hand, in a browser

- [ ] Home page renders **with CSS and images** (no styling ⇒ the `.next/static` copy is missing)
- [ ] A product page loads and its images resolve from `/api/media/…`
- [ ] **Add to cart, then reload — the item is still there. Do this on an iPhone**, which is what §5 protects.
- [ ] Register with a real phone; the OTP arrives (⇒ SMS.ir is configured and the template is enabled)
- [ ] Admin login at `/admin` with the seeded password
- [ ] Upload an image in the admin panel, then **deploy again** and confirm it survives (⇒ `UPLOAD_DIR` is outside the release)

### 7.4 Cron

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://orchidbra.ir/api/cron
```

Expect JSON with `"ok": true`. An unauthorised call returns **404**, not 401 —
deliberate, so a scanner does not learn the endpoint exists.

Schedule it every 5 minutes — **HOST-SPECIFIC**:

```cron
*/5 * * * * curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" https://orchidbra.ir/api/cron > /dev/null
```

One endpoint, several jobs, all idempotent — a missed run catches up:

| Job | Cadence |
|---|---|
| SMS queue dispatch | every call |
| Prune sessions, OTPs, rate-limit windows, abandoned carts | every call |
| Gzipped database dump (14 kept) | once per ~20 h |
| Media archive | once per ~6 days |

If the host has no cron, the admin SMS screen has a manual dispatch button and
the dashboard shows queue depth, so a stall stays visible. Use an external
uptime pinger instead of relying on that.

---

## 8. Routine release

```bash
# On the build machine
npm ci && npm run typecheck && npm run lint && npm test && npm run build

# On the host
curl -H "Authorization: Bearer $CRON_SECRET" \
     "https://orchidbra.ir/api/cron?backup=force"          # 1. pre-deploy dump
TS=$(date -u +%Y-%m-%dT%H-%M-%S)
mkdir -p releases/$TS                                      # 2. upload standalone here
ln -sfn /home/USER/orchid/.env releases/$TS/.env
cd releases/$TS && node --env-file=.env scripts/migrate.mjs   # 3. migrate
ln -sfn /home/USER/orchid/releases/$TS /home/USER/orchid/current  # 4. flip
# 5. restart the app (HOST-SPECIFIC)
# 6. smoke test §7.2 — if red, roll back
```

**Rollback** is the symlink and a restart:

```bash
ln -sfn /home/USER/orchid/releases/<PREVIOUS_TS> /home/USER/orchid/current
# restart
```

Rolling back **code** is safe. Rolling back the **database** is not — migrations
are forward-only. All four current migrations are additive, so an old release
runs against the new schema, but check any new migration for that property
before you rely on it.

---

## 9. Before launch — configured in the admin panel, not in code

- [ ] **Bank details** (Settings → card-to-card). Checkout does not offer the method until the card number and account holder are set.
- [ ] **SMS.ir** API key and a template id per event. **Templates ship disabled — OTP login does not work until the OTP template is enabled.**
- [ ] **Enamad** badge code. Start early: approval needs a verified domain and registered business details.
- [ ] Contact details, social links, shipping and returns text
- [ ] Logo and favicon (`logo.png` is in place as the default)
- [ ] Products — the demo seed creates variants but **no images**
- [ ] Rehearse a restore (`docs/RESTORE.md`, `npm run db:restore-drill`). A backup never restored is not a backup.
- [ ] Store `ENCRYPTION_KEY` somewhere that is *not* where the dumps go

Known gaps, so they are not discovered as surprises:

- **Torob Pay is not implemented.** The adapter throws rather than returning a plausible redirect, and the method stays hidden at checkout. Card-to-card is the working payment path.
- **SMS.ir request shapes are unverified** against the live API — the one place correctness depends on a third-party contract. Confirm before go-live; a mismatch costs one file.
- **Archived products return 404, not 410.** Google treats them nearly identically and `shouldIndex` keeps them out of the sitemap and metadata either way.

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Site renders unstyled, no images | `.next/static` / `public` missing from the release | Rebuild with `npm run build` (not `next build` alone) and re-upload |
| **Cart empties on reload, iPhone only** | Served over `http`, or `X-Forwarded-Proto` not set | Fix TLS / proxy header — §5 |
| App will not start, "Refusing to start with development settings" | `SMS_DRIVER=null`, `APP_URL` not https, or relative `UPLOAD_DIR` | Read the message; it names the variable |
| Images 404 after a deploy | `UPLOAD_DIR` inside the release directory | Move it out — §2. Files in the old release are already gone |
| `ER_CON_COUNT_ERROR` / connection limit | `DB_POOL_SIZE` × workers over the ceiling | Lower to 3–4; check §1's `max_user_connections` |
| Persian text shows as `?????` | Database not `utf8mb4` | Recreate per §1 and restore; changing it after the fact does not repair written rows |
| OTP never arrives | SMS.ir template disabled, or key wrong | Admin → SMS. Templates ship disabled |
| Migration: "has been modified since it was applied" | A shipped migration was edited | Never edit an applied migration — add a new one. See `drizzle/README.md` |
| Blank page, console CSP errors | A second CSP added at the proxy | Remove it — the app emits its own with a per-request nonce (§5) |
| `npm ci` fails `EBADENGINE` | Host Node outside `>=22.11.0 <25` | Install Node 22 or 24 |

Application logs rotate in `$UPLOAD_DIR/logs` — outside the deploy directory on
purpose, since the log you most want after a bad release is the one a rollback
would otherwise delete.

---

## Appendix — command reference

| Command | Purpose |
|---|---|
| `npm run build` | Production build **and** the standalone asset copy |
| `npm start` | Run the built server (`node .next/standalone/server.js`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | `eslint .` |
| `npm test` | Unit tests (253) |
| `npm run test:integration` | Integration tests against a scratch DB (17) |
| `npm run test:e2e` | Playwright, desktop + mobile + tablet |
| `npm run db:migrate` | Apply migrations (`-- --dry-run` to preview) |
| `npm run db:seed` | Create the administrator (`-- --demo` for catalogue data) |
| `npm run db:restore-drill` | Rehearse a restore into a scratch database |
| `npm run dev:otp <phone>` | Read a dev OTP from the DB (local only) |
