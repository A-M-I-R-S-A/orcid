# ارکید — Orchid

Persian, RTL, database-driven storefront for a women's lingerie brand.
Next.js 15 · MariaDB · Drizzle ORM · Tailwind v4.

Domain: `orchidbra.ir`

---

## Status

Implementation stages 1–23 of the Phase 0 plan are complete: foundation,
database, authentication, catalogue, cart, checkout, card-to-card payment,
SMS architecture, reviews, admin panel, theming, CMS, blog, SEO, security
hardening and tests.

**Deployment (stages 24–25) has not been performed.** The target host was never
reachable, so nothing here has touched a production system.

Verified locally against MariaDB 12.3: migrations apply, the seed runs, 196
unit and integration tests pass, and 139 end-to-end checks pass across
Chromium, WebKit and tablet viewports.

---

## Quick start (local)

Requires Node 22 or 24 (Node 20 is end-of-life) and a MariaDB 10.6+ instance.
`.nvmrc` pins 22, the version this project is verified against; 24 is also
verified and is what `engines` permits.

```bash
cp .env.example .env
# fill in DB_* and generate the four secrets — see below
npm install
npm run db:migrate
npm run db:seed -- --demo
npm run dev
```

Generate each secret separately:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

`SESSION_SECRET`, `OTP_PEPPER`, `ENCRYPTION_KEY` and `CRON_SECRET` all need
their own value. `ENCRYPTION_KEY` must be exactly 64 hex characters.

`AUTH_SECRET` is gone. It was listed here as signing admin session tokens and
was never read by any code: both session tables hold opaque random tokens,
stored hashed and revocable server-side, which is why no signing key appears
in either path.

The seed prints a generated administrator password **once**. Store it in a
password manager; there is no way to recover it afterwards — a default password
in a repository is a default password in production, so the seed will not
invent one you could look up later.

The seed creates **no customer accounts**. A customer is a phone number that
has passed an OTP, and seeding verified phone numbers would fake the one fact
registration exists to establish. Make one to develop against:

```bash
npm run dev:account -- customer 09121112233 'a-password' 'شیرین محمدی'
npm run dev:account -- admin admin 'a-password'      # lost the seed output
```

Both refuse to run unless `APP_URL` points at localhost.

Storefront: `http://localhost:3100` · Admin: `http://localhost:3100/admin`

(Port 3100, not 3000 — Windows reserves the range 2947–3046 on some machines.
See `.claude/launch.json`.)

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build (needs no database) |
| `npm start` | Run the built server locally |
| `npm run typecheck` | TypeScript, no emit |
| `npm test` | 197 unit tests + 11 integration tests |
| `npm run test:e2e` | 144 Playwright checks × desktop/mobile/tablet |
| `npm run db:generate` | Generate a migration from schema changes |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:seed` | Bootstrap permissions, roles, admin, settings |
| `npm run db:seed -- --demo` | …plus demo categories and products |
| `npm run dev:otp -- <phone>` | Recover the current OTP locally (§24 keeps it out of the logs) |
| `npm run dev:account -- ...` | Set a known password on a local admin or customer |

Integration tests need a scratch database and are skipped without one:

```bash
TEST_DB_NAME=orchid_test npm test
```

The name must contain `test` — the harness refuses to run otherwise, because
those tests truncate every table.

---

## Architecture

Modular monolith. One deployable, one database, boundaries enforced by
structure rather than network hops.

```
route / server action  →  service  →  repository  →  MariaDB
   (parse + shape)      (authorize +   (Drizzle,      (constraints,
                         business       no logic)      transactions)
                         rules)
```

**Authorization lives in the service layer.** A check written in a page
protects one page; the same check in `orderService.updateStatus()` protects
every present and future caller.

```
src/
├── app/              routes — (store) storefront, admin panel, api
├── components/       UI; admin/ is separate from storefront
├── db/schema/        37 tables across five files
├── lib/              cross-cutting: crypto, money, persian, seo, theme…
└── modules/          business logic by domain
```

### Where the non-obvious decisions live

| Decision | File | Why |
| --- | --- | --- |
| Persian search normalisation | `lib/persian.ts` | One function normalises both the stored index and the query, so they cannot drift |
| Money is integer Toman | `lib/money.ts` | No floats anywhere; one unit, fixed once |
| Order state machine | `lib/order-status.ts` | Customers cannot reach `paid` because the transition does not exist |
| Cache without Redis | `lib/cache.ts`, `lib/settings.ts` | Per-process TTL plus a version row; see the comments |
| Colour maths vs theme loading | `lib/color.ts` vs `lib/theme.ts` | Split so the admin editor can compute contrast client-side |
| Media URLs vs file I/O | `lib/media-url.ts` vs `lib/images.ts` | Split so client components never pull in sharp |

---

## Security notes

- **OTP codes are never stored.** Only `HMAC-SHA256(phone:code, OTP_PEPPER)`.
  They are never logged, never returned to the client, and there is no admin
  screen that could display one.
- **Provider credentials are encrypted at rest** with AES-256-GCM. Only the
  master key lives in the environment, so credentials stay admin-editable
  without sitting in the database as plaintext.
- **Uploads are validated by decoding**, not by extension or declared MIME.
  Files are re-encoded (stripping EXIF and any appended payload), given random
  names, stored outside the webroot, and served with a fixed `Content-Type`.
- **Rate limiting is MariaDB-backed**, so it is correct across worker
  processes. An in-memory limiter would only guard one of them.
- **Sessions are opaque tokens stored hashed**, and revocable server-side —
  disabling an account ends its live sessions immediately.

### Back up `ENCRYPTION_KEY` separately from database dumps

Storing them together defeats the point of encrypting. Losing it means
re-entering every integration credential.

---

## Deployment

> **Full step-by-step guide: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).**
> The summary below is the shape of it; that document is what to follow when
> actually deploying, including TLS, the release layout, cron, smoke tests,
> rollback and troubleshooting.

The host is cPanel with Phusion Passenger and **no SSH**. `server.js` at the
repository root is the Passenger entrypoint; cPanel's "Setup Node.js App" loads
it, ignores the port it asks for, and hands it a socket.

```
Your computer                       Host (cPanel, no SSH)
─────────────                       ─────────────────────
npm ci
npm run build          ────────►    upload the project (File Manager or Git)
                                         │
                                         ├─ Setup Node.js App → NPM Install
                                         ├─ Application mode = Production
                                         ├─ Run JS script → db:migrate
                                         ├─ Restart (or touch tmp/restart.txt)
                                         └─ smoke test
```

The build does **not** require a database.

### Four things that must be right

1. **Application mode must be Production.** cPanel's dropdown sets `NODE_ENV`,
   and a non-production value ships `unsafe-eval` in the CSP and drops HSTS.
   `server.js` refuses to start rather than serve the weaker policy.

2. **`UPLOAD_DIR` must be absolute and outside the application directory.**
   `server.js` calls `process.chdir(__dirname)`, so a relative path lands
   inside the app and every product image dies on the next deploy.

3. **HTTPS is not optional — the cart depends on it.** Session and cart
   cookies are `Secure`, and Safari will not send a `Secure` cookie over plain
   `http` (Chromium makes a localhost exception; WebKit does not). Served over
   `http`, the cart silently reads back empty on every Apple device. Use
   cPanel's AutoSSL and force the redirect before launch.

4. **`DB_POOL_SIZE` is per worker.** A default of 10 across four workers is 40
   connections — past the `max_user_connections` ceiling common on shared
   plans. Keep it at 3–5 and confirm the host's real limit in cPanel.

### Restarting

Passenger has no service to stop. Either press **Restart** in Setup Node.js App,
or touch the file it watches:

```
tmp/restart.txt
```

### Scheduled work

`/api/cron` drains the SMS queue, prunes expired sessions, OTPs, rate-limit
windows and abandoned carts, and returns inventory from orders left unpaid for
seven days. It is idempotent, so a missed run catches up without restoring an
order twice.

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://orchidbra.ir/api/cron
```

If the host has no cron, the admin SMS screen has a manual dispatch button and
the dashboard surfaces the queue depth — a stalled queue stays visible rather
than silent.

---

## Before launch

Configured through the admin panel, not code:

- [ ] **Bank details** — Settings → card-to-card. Checkout will not offer the
      method until the card number and account holder are set.
- [ ] **SMS.ir** — API key and a template id per event. Templates ship
      **disabled**; OTP login does not work until the OTP template is enabled.
- [ ] **Enamad** — paste the badge code. Allow time: approval requires a
      verified domain and registered business details.
- [ ] **Contact details, social links, shipping and returns text**
- [ ] **Logo and favicon** — `logo.png` is in place as the default.
- [ ] **Products** — the demo seed creates variants but no images.

### Torob Pay

Prepared but **not implemented**. The adapter's `initiate()` throws rather than
returning a plausible-looking redirect, and the method stays hidden at checkout
until it is both enabled and configured. Implementing it means verifying the
provider's API contract, writing `initiate()` and the callback route.

---

## Known gaps

**410 for withdrawn products.** §74 asks for 410; archived products return 404.
An App Router *page* cannot set an arbitrary status — there is no `gone()` —
and a real 410 would need Node-runtime middleware (not stable in this Next
version) or a database lookup in edge middleware on every request. Google
treats the two almost identically, and archived products leave the index either
way via `shouldIndex` excluding them from both the sitemap and the metadata.

**SMS.ir request shapes are unverified.** The adapter follows the documented v1
REST API, but it is the one place where correctness depends on a third-party
contract rather than on this code. Confirm against current documentation before
go-live; a mismatch costs one file.

**Assumptions worth confirming:** prices are stored as `BIGINT` Toman, and
slugs are Persian (percent-encoded). Both are cheap to change now and a
migration later.
