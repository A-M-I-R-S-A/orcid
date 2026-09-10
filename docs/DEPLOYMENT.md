# Deploying Orchid to orchidbra.ir

A complete, step-by-step guide for **cPanel hosting with no SSH access**.

Everything is done through the cPanel web interface and your own terminal at
home. You never log into the server with a command line, because this host does
not allow it.

It assumes you can open a terminal on your own computer and that you have
Node.js there, and **nothing else**. Every term is explained the first time it
appears, every command says what it does and what you should see back.

Read Part 0 and Part 1 before clicking anything. They will save you hours.

---

## Table of contents

- [Part 0 — How to read this guide](#part-0--how-to-read-this-guide)
- [Part 1 — Words you will see](#part-1--words-you-will-see)
- [Part 2 — How this deployment works](#part-2--how-this-deployment-works)
- [Part 3 — What you need before you start](#part-3--what-you-need-before-you-start)
- [Part 4 — Point orchidbra.ir at the host](#part-4--point-orchidbrair-at-the-host)
- [Part 5 — Create the database](#part-5--create-the-database)
- [Part 6 — Create the storage folder](#part-6--create-the-storage-folder)
- [Part 7 — Build on your own computer](#part-7--build-on-your-own-computer)
- [Part 8 — Upload the project](#part-8--upload-the-project)
- [Part 9 — Write the .env file](#part-9--write-the-env-file)
- [Part 10 — Set up the Node.js application](#part-10--set-up-the-nodejs-application)
- [Part 11 — Install the dependencies](#part-11--install-the-dependencies)
- [Part 12 — Create the database tables](#part-12--create-the-database-tables)
- [Part 13 — Create the administrator account](#part-13--create-the-administrator-account)
- [Part 14 — Start the application](#part-14--start-the-application)
- [Part 15 — Turn on HTTPS](#part-15--turn-on-https)
- [Part 16 — Set up the scheduled job](#part-16--set-up-the-scheduled-job)
- [Part 17 — Test everything](#part-17--test-everything)
- [Part 18 — Configure the shop in the admin panel](#part-18--configure-the-shop-in-the-admin-panel)
- [Part 19 — Releasing a new version later](#part-19--releasing-a-new-version-later)
- [Part 20 — Rolling back a bad release](#part-20--rolling-back-a-bad-release)
- [Part 21 — Backups and restoring](#part-21--backups-and-restoring)
- [Part 22 — When something goes wrong](#part-22--when-something-goes-wrong)
- [Appendix A — Command reference](#appendix-a--command-reference)
- [Appendix B — Every setting in .env](#appendix-b--every-setting-in-env)

---

## Part 0 — How to read this guide

### Where you do things

You work in **two places**, and confusing them is the most common mistake. Every
section says which one it means.

| | What it is | How you get there |
|---|---|---|
| **Your computer** | The Windows machine with the project folder | A terminal opened in the project folder |
| **cPanel** | The host's web control panel | A browser, at an address like `https://orchidbra.ir:2083` |

**You never type commands on the server.** Anything that must happen there is
done by clicking in cPanel. Anything that needs a command line happens on your
own computer.

### Reading the command blocks

A grey block is something you type in your terminal **on your own computer** and
press Enter on:

```bash
node -v
```

The terminal prints something back. Where it matters, the guide shows what you
should see:

```
v22.11.0
```

If you get something different — especially `command not found`, `permission
denied`, or `No such file or directory` — **stop and fix that before
continuing.** Later steps assume earlier ones worked. Part 22 lists the common
errors.

### Placeholders

Anything in CAPITALS is a placeholder you replace with your own value. In:

```bash
ssh USER@SERVER
```

`USER` is your username. Do not type the word USER. Where a cPanel account name
appears in a path — like `/home/USER/orchid` — replace it with your real cPanel
username, which is shown in the top-right of cPanel.

---

## Part 1 — Words you will see

Come back here whenever a word puzzles you.

**cPanel.** The web control panel your host gives you. Everything on the server
side of this guide is a page inside it. You reach it at `https://orchidbra.ir:2083`
or through a link from your host, and sign in with the username and password
they sent you.

**File Manager.** The page in cPanel that browses, uploads, unzips and edits
files on the server. It is your replacement for a command line.

**phpMyAdmin.** The page in cPanel that lets you look inside the database and
run database commands.

**Setup Node.js App.** The page in cPanel that runs Node.js applications. It is
where you tell the host where the shop lives, install its dependencies, and
start and restart it.

**Passenger.** The program behind that page which actually runs your app. You
never interact with it directly, but it explains two things: why the shop needs
a file called `server.js`, and why "restarting" means touching a file rather
than stopping a service.

**`server.js`.** The file at the top of the project that Passenger loads to
start the shop. It is written specifically for this kind of hosting.

**Domain.** `orchidbra.ir` — what people type in their browser.

**DNS / nameservers.** The internet's phone book, turning `orchidbra.ir` into
the host's address. If you bought the domain from the same company as the
hosting, this is probably already done.

**Environment variable / `.env`.** Settings the app reads when it starts —
database password, secret keys, your domain. They live in a file called `.env`
which never goes into the code repository, because it holds passwords.

**Database.** Where products, orders and customers are stored. MariaDB, a
version of MySQL. The shop and the database are separate programs that talk to
each other.

**Migration.** A file of database instructions that creates or changes tables.
Running the migrations turns an empty database into one with the right shape.
This project has five.

**Build.** Turning source code into the optimised files that actually run. You
do this on your own computer and upload the result, because shared hosting
usually does not have enough memory to build.

**Remote MySQL.** A cPanel page that lets your home computer connect directly to
the host's database. This is what makes the no-SSH deployment workable — it is
how you run migrations.

---

## Part 2 — How this deployment works

Worth understanding before you start, because it explains why the steps are in
this order.

On a normal server you would upload a compact, self-contained bundle and run it.
**That is not what happens here.** cPanel's Node.js support expects a normal
project directory with a `package.json`, and it installs the dependencies itself.
So:

1. You **build on your computer**, producing a folder called `.next`.
2. You **upload the project** — the source, the `.next` folder, and the
   supporting files — but **not** `node_modules`, which is huge and
   platform-specific.
3. cPanel **installs the dependencies** on the server from `package.json`.
4. cPanel **starts `server.js`** through Passenger.

The database work is the awkward part without SSH, and Part 12 solves it by
letting your own computer talk to the host's database directly.

```
Your computer                         cPanel (no SSH)
─────────────                         ───────────────
npm ci
npm run build        ──── upload ───► /home/USER/orchid
                                           │
                                           ├─ Setup Node.js App
                                           ├─ NPM Install
                                           ├─ Application mode = Production
                                           └─ Restart
                     ◄─ Remote MySQL ──────┤
db:migrate, db:seed                        │
                                           └─ Cron Jobs → /api/cron
```

---

## Part 3 — What you need before you start

Collect all of this first.

**From your hosting company:**

- [ ] **cPanel address, username and password**
- [ ] Confirmation that **Setup Node.js App** exists in your cPanel (search for
      "Node" on the cPanel home page). Without it, this host cannot run the
      shop — ask them before going further.
- [ ] The Node.js versions they offer. You need **22 or 24**.

**On your own computer:**

- [ ] The project folder
- [ ] **Node.js 22 or 24.** Check with `node -v`. Node 20 is end-of-life and no
      longer supported by this project.

**Decisions to make now:**

- [ ] Will the site live at `orchidbra.ir` or `www.orchidbra.ir`? Pick **one**
      as the real address. This guide uses `orchidbra.ir`.

---

## Part 4 — Point orchidbra.ir at the host

If you bought the domain and the hosting from the same company, this is usually
already done — check by opening `http://orchidbra.ir` in a browser. If you see
any page from your host, even a placeholder, skip to Part 5.

Otherwise, in your **domain registrar's** control panel, set the domain's
**nameservers** to the two your host gave you. They look like:

```
ns1.yourhost.com
ns2.yourhost.com
```

Nameserver changes take a few hours to spread. Check progress from your
computer:

```bash
nslookup orchidbra.ir
```

You want an answer with your host's address. Carry on with Parts 5 to 14 while
it settles; you will need it working before Part 15.

Then in **cPanel → Domains**, make sure `orchidbra.ir` is listed and note its
**document root** — usually `/home/USER/public_html`.

---

## Part 5 — Create the database

**In cPanel → MySQL® Databases.**

### 5.1 Create the database

Under "Create New Database", enter `orchid` and press Create Database.

cPanel prefixes it with your account name, so the real name becomes something
like `myuser_orchid`. **Write down the full name including the prefix** — that
is what goes in `.env`, not `orchid`.

### 5.2 Create the user

Scroll to "MySQL Users → Add New User". Enter `orchid` as the username, and use
the password generator. **Copy the generated password somewhere safe before
pressing Create User** — it is not shown again.

Again the real username gets a prefix: `myuser_orchid`. Write down both full
names and the password.

### 5.3 Give the user access to the database

Scroll to "Add User To Database". Pick your user and your database, press Add,
then on the privileges page tick **ALL PRIVILEGES** and press Make Changes.

### 5.4 Check the character set

This matters more than it looks. The whole catalogue is Persian, and a database
created with the wrong character set corrupts every Persian name the moment it
is saved — and changing the setting afterwards does **not** repair rows already
written.

Go to **cPanel → phpMyAdmin**, select your database in the left sidebar, open
the **Operations** tab, and look at "Collation". It must be
`utf8mb4_unicode_ci` (or another `utf8mb4_` value). If it is not, set it to
`utf8mb4_unicode_ci` and press Go **before** creating any tables.

### 5.5 Find the connection limit

Still in phpMyAdmin, open the **SQL** tab and run:

```sql
SHOW VARIABLES LIKE 'max_user_connections';
```

Note the number. Shared hosting often caps this quite low, and Part 9 depends
on it.

---

## Part 6 — Create the storage folder

**In cPanel → File Manager.**

This folder holds uploaded product images, backups and logs. It must sit
**outside** the application folder.

Navigate to your home directory — the one containing `public_html` — and press
**+ Folder**. Name it:

```
orchid-storage
```

Its full path is `/home/USER/orchid-storage`, with your cPanel username in place
of USER. You can confirm the exact path in File Manager's address bar. Write it
down for Part 9.

**Why outside the application folder.** Every deploy replaces the application
files. If uploads lived among them, **every product image would be destroyed by
your next deploy.** Keeping them separate is what makes deploys safe. The
application refuses to start if you give it a relative path here, precisely
because this mistake is so expensive.

The `backups` and `logs` subfolders are created automatically.

---

## Part 7 — Build on your own computer

**On your computer**, in the project folder.

Install the exact dependency versions the project was tested with:

```bash
npm ci
```

Run the four checks. All four must pass before you deploy anything.

```bash
npm run typecheck
```

Silence means success.

```bash
npm run lint
```

Silence means success.

```bash
npm test
```

```
Test Files  13 passed | 2 skipped (15)
     Tests  253 passed | 17 skipped (270)
```

```bash
npm run build
```

The build ends with a table of routes. It does **not** need a database.

You now have a `.next` folder. That is the compiled site, and it is part of what
you upload.

### Optional but strongly recommended: test over HTTPS first

There is one class of bug this project can only catch over HTTPS, and it is
serious — see Part 15. The normal test command runs over plain `http` and
*silently skips* those checks rather than failing them. To actually run them,
open three terminals in the project folder:

```bash
npm start
```

```bash
node scripts/https-proxy.mjs
```

```bash
E2E_BASE_URL=https://localhost:3100 npm run test:e2e
```

Stop the first two with `Ctrl+C` when finished.

---

## Part 8 — Upload the project

### 8.1 What to upload, and what not to

**Upload these:**

```
.next/          the build from Part 7
public/         static files
src/            application source
drizzle/        database migrations
scripts/        the migration tool
server.js       the Passenger entrypoint
package.json
package-lock.json
next.config.mjs
postcss.config.mjs
tsconfig.json
```

**Do not upload:**

- `node_modules` — huge, and built for Windows. cPanel installs its own in Part 11.
- `.env` — you will create it on the server in Part 9. Never upload the one
  holding your local settings.
- `.git`, `tests`, `docs`, `.next/cache`

### 8.2 Make the application folder

**In cPanel → File Manager**, in your home directory (beside `public_html` and
`orchid-storage`), create a folder called:

```
orchid
```

Its full path is `/home/USER/orchid`.

### 8.3 Upload

The reliable way through a browser is a single zip file.

**On your computer**, create a zip containing exactly the items listed in 8.1.
In Windows File Explorer, select them, right-click, then "Send to → Compressed
(zipped) folder". Name it `orchid.zip`.

**In cPanel → File Manager**, open `/home/USER/orchid`, press **Upload**, and
select `orchid.zip`. When it finishes, go back to the folder, right-click the
zip and choose **Extract**.

Then delete `orchid.zip` to save space.

### 8.4 Check the upload

In File Manager, `/home/USER/orchid` must now contain:

```
.next   drizzle   public   scripts   src   server.js
package.json   package-lock.json   next.config.mjs   postcss.config.mjs   tsconfig.json
```

If `.next` is missing, File Manager may be hiding dotted names — use **Settings**
in the top right and tick "Show Hidden Files". If it genuinely is not there, the
zip did not include it; that is easy to do accidentally, and the app cannot
start without it.

### 8.5 The alternative: Git

If your cPanel has **Git™ Version Control** and your project is in a Git
repository, you can clone it there instead and pull each release. Note that
`.next` is normally not committed to Git, so you would need to build on the
server — which shared hosting often cannot do for memory reasons. The zip route
above is the dependable one.

---

## Part 9 — Write the .env file

**In cPanel → File Manager**, inside `/home/USER/orchid`.

### 9.1 Generate the four secret keys

**On your computer**, run this **four separate times** and keep each result:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Each run prints a 64-character line. Do not reuse one value for two settings.

### 9.2 Create the file

In File Manager press **+ File**, name it `.env`, then right-click it and choose
**Edit**. Paste this and fill in the CAPITALISED parts:

```ini
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=MYUSER_orchid
DB_USER=MYUSER_orchid
DB_PASSWORD=THE_PASSWORD_FROM_PART_5

DB_POOL_SIZE=4

APP_URL=https://orchidbra.ir
NODE_ENV=production
TZ=Asia/Tehran
PORT=3000

SESSION_SECRET=FIRST_RANDOM_VALUE
OTP_PEPPER=SECOND_RANDOM_VALUE
ENCRYPTION_KEY=THIRD_RANDOM_VALUE
CRON_SECRET=FOURTH_RANDOM_VALUE

UPLOAD_DIR=/home/USER/orchid-storage
```

`DB_NAME` and `DB_USER` must be the **prefixed** names from Part 5.
`UPLOAD_DIR` must be the exact path from Part 6.

Press Save Changes.

### 9.3 Lock it down

Right-click `.env` → **Change Permissions**, and set it to **600** (tick only
the two "User" boxes for Read and Write). It contains your database password.

### 9.4 Five things that must be right

These are the mistakes that actually happen. Four of them stop the app from
starting, deliberately, because failing loudly beats failing silently.

**1. `APP_URL` must start with `https://` and must not end with `/`.**

Every address the site publishes to Google, every share preview and every
structured-data tag is built from it, and it must match the address people
really use — including the `www` decision from Part 3. **The app will not start
if this begins with `http://`.**

This holds even though the app itself sits behind the host's HTTPS layer and
only ever sees plain `http` internally. You are describing the public address.

**2. `UPLOAD_DIR` must be an absolute path**, beginning with `/`. `server.js`
changes the working directory to the application folder, so a relative path like
`./storage` lands *inside* it — meaning images vanish on your next deploy.
**The app will not start on a relative path.**

**3. `NODE_ENV` must be `production`** — and Part 10 sets the same thing in
cPanel's dropdown. A non-production value weakens the site's security policy.
**`server.js` refuses to start rather than serve that to customers**, and names
the dropdown you need to change.

**4. `SMS_DRIVER` must not appear in the file at all.** It is a development-only
setting. Set to `null` it throws away every text message while the admin panel
reports success — nobody can register, no order confirmations go out, and
nothing looks wrong. **The app will not start with it set.**

**5. `DB_POOL_SIZE` is per worker process.** Compare it against the
`max_user_connections` number from Part 5.5. Keep it between 3 and 5. Raising
it is one of the easiest ways to take a shared-hosting site down.

Also: **back up `ENCRYPTION_KEY` somewhere other than your database backups.**
It decrypts the SMS and payment credentials stored in the database. Kept beside
the backups it defeats the encryption; lost, you re-enter every integration
credential by hand.

There is deliberately **no `AUTH_SECRET`**. Older notes mentioned one; no code
ever used it. Sessions are random tokens stored hashed, so there is no signing
key to set.

---

## Part 10 — Set up the Node.js application

**In cPanel → Setup Node.js App.** Press **Create Application** and fill in:

| Field | Value |
|---|---|
| Node.js version | **22** (or 24) |
| Application mode | **Production** |
| Application root | `orchid` |
| Application URL | `orchidbra.ir` |
| Application startup file | `server.js` |

Notes on each:

- **Application mode must be Production.** This sets `NODE_ENV`. On Development
  the site ships a weaker security policy, so `server.js` refuses to start and
  tells you to come back here.
- **Application root** is relative to your home directory, so `orchid` means
  `/home/USER/orchid`.
- **Application URL** is which domain serves this app. Pick `orchidbra.ir` from
  the dropdown.
- **Startup file** must be exactly `server.js`.

Press **Create**.

cPanel now shows a command at the top of the page beginning `source
/home/USER/nodevenv/...`. You do not need it, but do not delete the application
to get rid of it.

---

## Part 11 — Install the dependencies

Still on the **Setup Node.js App** page, find your application and press
**Run NPM Install**.

This reads `package.json` and installs everything the shop needs, built for the
server. It takes a few minutes.

**If it fails**, the usual causes are:

- `package-lock.json` was not uploaded — check Part 8.4.
- The Node version is outside `22`–`24`; change it at the top of this page.
- The account is out of disk space; check cPanel's home page.

When it completes, File Manager will show a `node_modules` folder inside
`/home/USER/orchid`.

---

## Part 12 — Create the database tables

Your database is empty. This creates its tables.

Without SSH you cannot run the migration tool on the server, so you run it from
**your own computer**, connected directly to the host's database.

### 12.1 Allow your computer to connect

**In cPanel → Remote MySQL®.** Add your home IP address. If you do not know it,
cPanel usually shows it, or visit any "what is my IP" site.

Add it and press Add Host.

**Note:** many home connections change IP periodically. If this stops working
later, come back and add the new address.

### 12.2 Find the database hostname

Your host's documentation will give a database hostname — often
`orchidbra.ir` itself, or something like `sql.yourhost.com`. If in doubt, ask
them, or try your domain first.

### 12.3 Make a temporary settings file

**On your computer**, in the project folder:

```bash
cp .env .env.deploy
```

Open `.env.deploy` in a text editor and set these five lines to the host's
values from Parts 5 and 12.2:

```ini
DB_HOST=THE_DATABASE_HOSTNAME
DB_PORT=3306
DB_NAME=MYUSER_orchid
DB_USER=MYUSER_orchid
DB_PASSWORD=THE_PASSWORD_FROM_PART_5
```

This file is already listed in `.gitignore`, so it will not be committed.

### 12.4 Look before you leap

```bash
node --env-file=.env.deploy scripts/migrate.mjs --dry-run
```

On a fresh database:

```
→ Connected to 10.11.x-MariaDB
  would apply  0000_initial_schema.sql
  would apply  0001_search_and_constraints.sql
  would apply  0002_passwords_and_wishlist.sql
  would apply  0003_page_images.sql
  would apply  0004_nav_links.sql

→ 5 migration(s) pending. Nothing was applied (--dry-run).
```

This changes nothing. If you get a connection error instead, your Remote MySQL
entry, hostname or credentials are wrong — recheck 12.1 to 12.3.

### 12.5 Apply them

```bash
node --env-file=.env.deploy scripts/migrate.mjs
```

```
✓ Applied 5 migration(s).
```

**What this tool does for you.** It records every file it applies with a
fingerprint, so running it twice is harmless — the second run says "Database is
up to date." It takes a lock so two runs cannot collide. It applies one
statement at a time, so a failure names the exact statement that died. And it
refuses to run if a migration that was already applied has since been edited,
because that means your database and your code no longer agree.

**Never edit a migration file that has already been applied.** Add a new one —
see `drizzle/README.md`.

### 12.6 If Remote MySQL is not available

Some hosts disable it. Two fallbacks:

**Setup Node.js App → Run JS script.** Newer cPanel versions have this button on
the application page. Choose `db:migrate` from the list. This runs the same tool
on the server, which is the cleanest alternative.

**phpMyAdmin.** Open your database, go to the **Import** tab, and import each
file from the `drizzle` folder **in filename order** — `0000`, then `0001`, then
`0002`, `0003`, then `0004`. This works, but the migration tool will not know they were
applied, so a later `db:migrate` would try to re-apply `0000` and fail. If you
go this route, stay on it and import future migrations by hand too.

---

## Part 13 — Create the administrator account

You need an admin login to configure the shop. With the tunnel from Part 12
still configured, run the seed **on your computer**, pointed at the host's
database:

```bash
DOTENV_CONFIG_PATH=.env.deploy npm run db:seed
```

On Windows PowerShell, set the variable first:

```bash
$env:DOTENV_CONFIG_PATH=".env.deploy"; npm run db:seed
```

Add `-- --demo` if you want sample products to look at:

```bash
DOTENV_CONFIG_PATH=.env.deploy npm run db:seed -- --demo
```

You will see:

```
  ┌──────────────────────────────────────────────┐
  │  ADMINISTRATOR CREATED — SHOWN ONCE          │
  ├──────────────────────────────────────────────┤
  │  username: admin                             │
  │  password: <a generated password>            │
  ├──────────────────────────────────────────────┤
  │  Store this in a password manager and        │
  │  change it after first sign-in.              │
  └──────────────────────────────────────────────┘
```

**Copy that password into a password manager immediately.** It is shown once and
cannot be recovered. There is no default password to look up — deliberately,
because a default password in a repository is a default password in production.

### Clean up

Now delete the temporary file so your production database password is not
sitting in the project folder:

```bash
rm .env.deploy
```

On Windows PowerShell:

```bash
Remove-Item .env.deploy
```

### What the seed does and does not do

It creates permissions, roles, the administrator, default settings, the SMS
templates (**disabled** until configured) and the homepage layout. It is safe to
run twice — it skips anything that already exists.

It creates **no customer accounts**, because a customer is a phone number that
has passed a verification code, and inventing verified numbers would fake the
one fact the account system exists to establish.

With `--demo` it creates sample products **without images**.

---

## Part 14 — Start the application

**In cPanel → Setup Node.js App**, find your application and press **Restart**.

Then open `http://orchidbra.ir` in a browser. You should see the shop.

### If it does not start

On the Setup Node.js App page, look for the log file path, or check
`/home/USER/logs` in File Manager. The two most likely messages:

```
[orchid] refusing to start: NODE_ENV is "development", expected "production".
[orchid] In cPanel > Setup Node.js App, set Application mode to Production and restart.
```

Fix the Application mode dropdown in Part 10.

```
Refusing to start with development settings on a deployment:
  · UPLOAD_DIR: ... is relative ...
```

That is the settings check. It names the exact variable — go back to Part 9.4.

### How to restart from now on

Either press **Restart** on the Setup Node.js App page, or create an empty file
at `/home/USER/orchid/tmp/restart.txt` in File Manager. Passenger watches that
file and reloads when it changes. Create the `tmp` folder first if it does not
exist.

There is no service to stop and start — Passenger runs the app on demand, which
is why "restart" works this way.

---

## Part 15 — Turn on HTTPS

**This is not optional polish. The shop is broken without it.**

The cart and login are stored in cookies marked `Secure`, and browsers refuse to
send a `Secure` cookie over an unencrypted connection. Safari enforces this
strictly. Served over plain `http`, **the cart appears to accept items and then
reads back empty on every iPhone and iPad** — no error, no warning in any log,
just customers who cannot buy anything. It is invisible from a desktop browser.

**In cPanel → SSL/TLS Status.** Find `orchidbra.ir` and `www.orchidbra.ir`, tick
both, and press **Run AutoSSL**. After a few minutes they should show a valid
certificate.

If AutoSSL is not offered, look for **Let's Encrypt™ SSL** instead, or ask your
host to issue a certificate.

### Force HTTPS

**In cPanel → Domains**, find `orchidbra.ir` and turn on **Force HTTPS
Redirect**.

If your cPanel has no such switch, edit `/home/USER/public_html/.htaccess` in
File Manager and add these lines at the very top:

```apache
RewriteEngine On
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

### Check

**On your computer:**

```bash
curl -I https://orchidbra.ir/
```

You want `HTTP/2 200`.

```bash
curl -I http://orchidbra.ir/
```

You want `301`, with a `location:` line pointing at `https://`.

Then open `https://orchidbra.ir` in a browser and confirm the padlock appears.

**If AutoSSL fails**, DNS from Part 4 has usually not finished spreading. Check
with `nslookup orchidbra.ir`, wait, and try again.

---

## Part 16 — Set up the scheduled job

The shop has background work: sending queued text messages, tidying expired
data, and taking backups. One web address does all of it, and something must
call it regularly.

### Test it first

**On your computer**, with your real `CRON_SECRET`:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://orchidbra.ir/api/cron
```

You should get JSON containing `"ok":true`.

**If you get `Not found`, your secret is wrong.** The address returns 404 rather
than an error to anyone without the right secret, so a scanner never learns it
exists.

### Schedule it

**In cPanel → Cron Jobs.** Under "Add New Cron Job":

- **Common Settings**: choose "Every Five Minutes (*/5 * * * *)"
- **Command**:

```
curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" https://orchidbra.ir/api/cron > /dev/null
```

Press Add New Cron Job.

Make sure the email address at the top of the Cron Jobs page is one you actually
read. Errors are mailed there, and a backup that quietly stops working is how
people discover during an incident that there is nothing to restore from.

**What runs, and how often:**

| Job | How often |
|---|---|
| Send queued text messages | every call |
| Clean up expired sessions, codes, abandoned carts | every call |
| Compressed database backup, keeping the last 14 | about once a day |
| Archive of uploaded images | about once every six days |

Everything is safe to run repeatedly, and a missed run catches up on the next
one. Backups are skipped automatically if a recent one exists, so calling this
often costs nothing.

---

## Part 17 — Test everything

### 17.1 From the terminal

**On your computer:**

```bash
curl -I https://orchidbra.ir/
```

Beyond `HTTP/2 200`, check these headers are present:

- `content-security-policy`, containing `nonce-` followed by random characters.
  Run the command twice — the nonce must differ each time.
- `strict-transport-security`
- `x-content-type-options: nosniff`
- `x-frame-options: SAMEORIGIN`
- `referrer-policy: strict-origin-when-cross-origin`
- **no** `x-powered-by` line

```bash
curl -s https://orchidbra.ir/robots.txt
```

The `Sitemap:` line must read `https://orchidbra.ir/sitemap.xml`.

```bash
curl -s https://orchidbra.ir/sitemap.xml | head -20
```

Addresses must start `https://orchidbra.ir`.

**If either shows the wrong address**, `APP_URL` in `.env` is wrong. Fix it and
restart — never edit the code to change the domain.

### 17.2 In a browser

- [ ] The home page loads **with styling and images**. A plain, unstyled page
      usually means `.next` did not upload completely — see Part 8.4.
- [ ] A product page opens and its photographs appear.
- [ ] **Add something to the cart, then reload. It is still there.** Do this on
      a real iPhone if you possibly can — that is the failure Part 15 protects
      against and it cannot be reproduced on a desktop.
- [ ] `https://orchidbra.ir/admin` shows a login, and your seeded `admin`
      password works.
- [ ] Sign in and change that password immediately.
- [ ] Upload a product image in the admin panel and confirm it displays.

### 17.3 The upload survival test

Worth the effort, because getting it wrong is unrecoverable and you will not
find out for weeks.

1. Upload a product image through the admin panel.
2. Do a complete new release (Part 19), even with unchanged code.
3. Check the image is still there.

If it vanished, `UPLOAD_DIR` is pointing inside the application folder. Fix
Part 9 before you have real products.

---

## Part 18 — Configure the shop in the admin panel

These are settings, not code. Nothing here needs a deploy.

- [ ] **Bank details** — Settings, card-to-card section. **Checkout will not
      offer any payment method until the card number and account holder name
      are filled in.** This is the most common "the shop looks finished but
      nobody can order" cause.
- [ ] **SMS provider** — the SMS.ir API key and a template ID per event.
      **Templates ship switched off. Sign-in codes do not work until you enable
      the OTP template.**
- [ ] **Enamad trust badge** — paste the code they give you. **Start early**;
      approval needs a verified domain and registered business details.
- [ ] Contact details, social links, shipping and returns text.
- [ ] Logo and favicon. A default logo is already in place.
- [ ] **Menu and footer links** — Admin → «منو و فوتر». Until you add links there, the header menu shows your first six top-level categories plus the size guide and the magazine, and the footer columns are derived the same way. Adding links takes over that placement completely.
- [ ] **Announcement bar** — Admin → Settings → «هویت فروشگاه». Text, an optional link, and `نمایش نوار اعلان` set to `0` hides it without losing the text.
- [ ] **Logo** — Admin → «منو و فوتر». Replaces the default `logo.png` everywhere, including structured data.
- [ ] Real products with real photographs. Demo data has no images.
- [ ] Rehearse a backup restore before you have real orders — `docs/RESTORE.md`.

### Things that are deliberately not finished

- **Torob Pay is not implemented.** Card-to-card is the working payment method.
  The Torob option stays hidden at checkout rather than half-working.
- **The SMS provider's exact request format has not been tested against the live
  service.** Confirm it against their current documentation before relying on it.
- **Withdrawn products return 404 rather than 410.** Search engines treat these
  almost identically, and such products leave the sitemap either way.

---

## Part 19 — Releasing a new version later

**On your computer:**

```bash
npm ci
```

```bash
npm run typecheck && npm run lint && npm test && npm run build
```

**Take a backup before touching anything:**

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" "https://orchidbra.ir/api/cron?backup=force"
```

**Keep a copy of the current release.** In cPanel File Manager, right-click the
`orchid` folder, choose **Compress**, and name it `orchid-backup-YYYY-MM-DD.zip`.
This is your rollback (Part 20). Keep the last two or three.

**Upload the new build.** Zip the same items as Part 8.1, upload to
`/home/USER/orchid`, and extract, choosing to overwrite. If a dependency changed
in `package.json`, press **Run NPM Install** again in Setup Node.js App.

**Apply any new migrations** from your computer, as in Part 12 — recreate
`.env.deploy`, run the dry run, then the real thing, then delete the file again.

**If a release adds a new permission, re-run the seed** the same way
(`DOTENV_CONFIG_PATH=.env.deploy npm run db:seed`). It is idempotent — it will
not touch your administrator or your data — but it is what grants a newly added
permission to the existing roles. Skip it and the new admin screen is invisible
to everyone except the superadmin. The `content.navigation` permission behind
Admin → «منو و فوتر» was added this way.

**Restart** in Setup Node.js App.

Then run the Part 17.1 checks. If anything is wrong, roll back.

---

## Part 20 — Rolling back a bad release

**In cPanel → File Manager.**

1. Rename the current `orchid` folder to `orchid-broken`.
2. Upload and extract the backup zip you made in Part 19 into a fresh `orchid`
   folder. (`node_modules` is inside that zip, so no reinstall is needed.)
3. Press **Restart** in Setup Node.js App.
4. Once the site is healthy, delete `orchid-broken`.

**Rolling back the code is safe. Rolling back the database is not.** Migrations
only go forwards. All four current migrations only *add* things, so an older
release runs happily against a newer database. If you add a migration that
removes or renames something, that stops being true — check before relying on it.

---

## Part 21 — Backups and restoring

Once Part 16's cron job is running, backups happen automatically:

- A compressed database dump about once a day, newest 14 kept.
- An archive of uploaded images about once every six days.

Both land in `/home/USER/orchid-storage/backups/`. Check they are appearing in
File Manager.

Force one immediately:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" "https://orchidbra.ir/api/cron?backup=force"
```

**Download them off the server regularly.** In File Manager, select the backup
files and press **Download**. A backup that lives only on the machine it is
backing up is not a backup.

cPanel's own **Backup** page can also take a full account backup, which includes
the database and all files. Use both.

**Rehearse a restore before you need one.** The procedure is in
`docs/RESTORE.md`. Without SSH, the database half is done through phpMyAdmin's
Import tab, which accepts a `.sql.gz` file directly. A backup that has never
been restored is not a backup — it is a hope.

And once more, because it cannot be undone: **store `ENCRYPTION_KEY` somewhere
other than where these dumps live.**

---

## Part 22 — When something goes wrong

**Start here:** Setup Node.js App shows the application's log location, and
`/home/USER/logs` in File Manager holds the host's own error logs. The
application also writes a rotating log to `/home/USER/orchid-storage/logs`,
deliberately outside the application folder — so the log explaining a bad
release is not deleted by rolling that release back.

| What you see | What it means | What to do |
|---|---|---|
| `refusing to start: NODE_ENV is "development"` | cPanel's Application mode is wrong | Set it to Production in Part 10, restart |
| "Refusing to start with development settings" | A dangerous setting is active in `.env` | Read the message — it names the variable. Part 9.4 |
| Site loads but has no styling, no images | `.next` did not upload completely | Re-zip and re-upload. Part 8.4 |
| **Cart empties on reload, only on iPhone** | Site is not on HTTPS | Part 15 |
| `500 Internal Server Error` on every page | App failed to start | Check the logs above; usually `.env` or a missing NPM Install |
| "We're sorry, but something went wrong" from Passenger | The startup file crashed | Same as above. Confirm the startup file is `server.js` |
| `Cannot find module 'next'` | Dependencies not installed | Run NPM Install, Part 11 |
| Images 404 after a deploy | `UPLOAD_DIR` was inside the application folder | Fix Part 9. Images from the replaced folder are gone |
| `ER_CON_COUNT_ERROR`, or errors under load | `DB_POOL_SIZE` too high for the shared plan | Lower to 3. Compare with Part 5.5 |
| Persian text shows as `?????` | Database is not `utf8mb4` | Part 5.4. Changing it later does not repair existing rows |
| Migration tool cannot connect | Remote MySQL not allowing your IP | Part 12.1. Home IPs change — re-add it |
| Sign-in codes never arrive | SMS template disabled, or wrong API key | Admin panel, SMS section. Templates ship disabled |
| No payment method at checkout | Bank details not filled in | Admin panel, Settings, card-to-card |
| `/api/cron` returns `Not found` | Wrong `CRON_SECRET` | Compare with `.env` exactly. 404 is intentional |
| "has been modified since it was applied" | An already-applied migration was edited | Never edit applied migrations — add a new one. `drizzle/README.md` |
| AutoSSL fails | DNS has not spread | `nslookup orchidbra.ir`, wait, retry. Part 4 |
| `npm ci` fails with `EBADENGINE` | Wrong Node version | Install Node 22 or 24 |

---

## Appendix A — Command reference

All of these run on **your own computer**, in the project folder.

| Command | What it does |
|---|---|
| `npm ci` | Install the exact tested dependency versions |
| `npm run typecheck` | Check the code for type errors |
| `npm run lint` | Check the code for mistakes and dead code |
| `npm test` | Run the 253 unit tests |
| `npm run test:integration` | Run 17 tests against a scratch database |
| `npm run test:e2e` | Drive a real browser through the shop |
| `npm run build` | Build the site into `.next` |
| `npm start` | Run the built site locally |
| `npm run dev` | Development mode, with live reload |
| `node --env-file=.env.deploy scripts/migrate.mjs --dry-run` | Show pending migrations on the host, change nothing |
| `node --env-file=.env.deploy scripts/migrate.mjs` | Apply them |
| `DOTENV_CONFIG_PATH=.env.deploy npm run db:seed` | Create the administrator on the host |

Everything on the server is done by clicking in cPanel:

| Task | Where |
|---|---|
| Restart the shop | Setup Node.js App → Restart, or create `tmp/restart.txt` |
| Install dependencies | Setup Node.js App → Run NPM Install |
| Upload or edit files | File Manager |
| Inspect the database | phpMyAdmin |
| Allow your computer to reach the database | Remote MySQL |
| Certificates | SSL/TLS Status → Run AutoSSL |
| Scheduled job | Cron Jobs |

---

## Appendix B — Every setting in .env

| Setting | Example | What it is |
|---|---|---|
| `DB_HOST` | `127.0.0.1` | Where the database is, **from the server's point of view** |
| `DB_PORT` | `3306` | The database's port |
| `DB_NAME` | `myuser_orchid` | The prefixed database name from Part 5 |
| `DB_USER` | `myuser_orchid` | The prefixed user name from Part 5 |
| `DB_PASSWORD` | | That user's password |
| `DB_POOL_SIZE` | `4` | Connections **per worker process**. Keep 3–5 |
| `APP_URL` | `https://orchidbra.ir` | Public address. Must be `https://`, no trailing slash |
| `NODE_ENV` | `production` | Must match cPanel's Application mode |
| `TZ` | `Asia/Tehran` | Time zone for dates and scheduling |
| `PORT` | `3000` | Ignored under Passenger, which supplies its own socket |
| `SESSION_SECRET` | 64 hex chars | Protects form submissions against forgery |
| `OTP_PEPPER` | 64 hex chars | Protects stored sign-in codes |
| `ENCRYPTION_KEY` | 64 hex chars | Encrypts stored provider credentials. **Back up separately** |
| `CRON_SECRET` | 64 hex chars | Password for the scheduled-job address |
| `UPLOAD_DIR` | `/home/USER/orchid-storage` | Uploads, backups, logs. **Absolute, outside the app** |
| `BACKUP_DIR` | optional | Defaults to `UPLOAD_DIR/backups` |
| `LOG_DIR` | optional | Defaults to `UPLOAD_DIR/logs` |
| `SMS_DRIVER` | **never set this** | Development only. Silently discards every message |
