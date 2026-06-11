---
name: deploy-to-pi
description: >-
  Deploy or provision the Taalwiz production server on a Raspberry Pi. Covers
  the routine redeploy (pull, build, restart the systemd service) and the
  full new-Pi provisioning / migration runbook (nginx, Certbot/SSL, MongoDB
  in Docker, router switchover). Use when the user asks to deploy, ship,
  release, redeploy, or set up / migrate the app on a Pi.
---

# Deploy Taalwiz to the Raspberry Pi

The app (NestJS API, serving the built Angular app statically) and MongoDB run
on a Raspberry Pi. App + MongoDB run in **Docker**; **nginx** runs as a system
service and terminates HTTPS, reverse-proxying to the API on `127.0.0.1:3000`.

There are two paths below. Pick the one that matches the request:

- **A. Routine redeploy** — code is already provisioned on the Pi; you just
  want a new version live. This is the common case.
- **B. New-Pi provisioning / migration** — standing up a fresh Pi (e.g. the
  Pi #1 → Pi #2 move) from scratch.

---

## A. Routine redeploy (common case)

### 1. Build and test locally first

```bash
pnpm build                     # all packages, via Turborepo
pnpm --filter api run test     # API unit tests must pass before shipping
```

Do not proceed if the build or tests fail — report the failure instead.

### 2. Update the Pi and restart

The repo lives on the Pi at `/home/jim/taalwiz-mono`, so a redeploy is a pull +
rebuild + restart:

```bash
ssh raspi5x 'cd ~/taalwiz-mono && git pull && pnpm install --frozen-lockfile && pnpm build'
ssh raspi5x 'sudo systemctl daemon-reload && sudo systemctl restart taalwiz.service'
```

Service facts (verified):

- Unit file: `/etc/systemd/system/taalwiz.service`
- `WorkingDirectory=/home/jim/taalwiz-mono/apps/api` (dotenv finds `.env` via `process.cwd()`)
- `Environment=NODE_ENV=production` (suppresses Morgan HTTP logging)

### 3. Verify

```bash
ssh raspi5x 'systemctl is-active taalwiz.service && journalctl -u taalwiz.service -n 30 --no-pager'
```

Then load `https://taalwiz.nl` and confirm a 200 + working login. Report the
actual status — don't assume success.

> Help articles auto-seed on boot from `apps/api/src/content/seeds/*.md`
> (idempotent MD5 check), so a restart picks up edited help content with no
> manual upload.

---

## B. New-Pi provisioning / migration

> Migrating taalwiz.nl from one Pi to another. Do all of section B.1 on the new
> Pi *before* touching the router, so downtime is just the SSL window.

### B.1 — Prepare the new Pi (before switching the router)

#### 1. Install nginx and Certbot

```bash
sudo apt install nginx certbot python3-certbot-nginx
```

#### 2. Copy the global nginx config from the old Pi

Replace the contents of `/etc/nginx/nginx.conf` with the old Pi's version.
Key non-default line it must contain:

```
client_max_body_size 10M;   # required for file uploads
```

#### 3. Create the site config

Create `/etc/nginx/sites-available/taalwiz.nl`:

```nginx
server {
    listen 80;
    server_name taalwiz.nl www.taalwiz.nl;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable it:

```bash
sudo ln -s /etc/nginx/sites-available/taalwiz.nl /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl enable nginx && sudo systemctl start nginx
```

> **`nginx -t` must pass before you proceed — do not ignore a failure.** A
> common cause is a mis-pasted `proxy_pass` carrying markdown angle brackets
> (`proxy_pass <http://127.0.0.1:3000>;` → `invalid URL prefix`). It must be
> bare: `proxy_pass http://127.0.0.1:3000;`. While the config is invalid, nginx
> won't start, and a later `apt` upgrade's nginx step will fail and leave dpkg
> half-configured (blocking further `apt install`s) until it's fixed.

#### 4. Set up MongoDB (Docker, via systemd)

Create `/etc/systemd/system/mongodb.service`:

```ini
[Unit]
Description=MongoDB Docker Container
Requires=docker.service
After=docker.service

[Service]
Restart=always
ExecStart=/usr/bin/docker run --rm --name mongodb -p 27017:27017 -v /data/db:/data/db mongo
ExecStop=/usr/bin/docker stop -t 2 mongodb
ExecStopPost=/usr/bin/docker rm -f mongodb

[Install]
WantedBy=default.target
```

```bash
sudo systemctl enable mongodb.service
sudo systemctl start mongodb.service
sudo systemctl status mongodb.service
```

#### 5. Clone, build, and configure the app

```bash
cd /home/jim
git clone <repo-url> taalwiz-mono
cd taalwiz-mono
pnpm install
pnpm build
```

> **bcrypt (native) under pnpm 10:** `pnpm install` may warn `Ignored build
> scripts: … bcrypt …`. The repo allow-lists bcrypt
> (`pnpm.onlyBuiltDependencies` in the root `package.json`) so it should build
> automatically. If auth still throws on the first login/registration, the
> native addon is missing — run `pnpm rebuild bcrypt` and verify with
> `node -e "console.log(require('bcrypt').hashSync('x',8))"`.

Copy `.env` from your Mac (it is gitignored, so it does not come with the
clone). Run this **from your Mac**:

```bash
scp /Volumes/Crucial2TB/xdev/node/taalwiz-mono/apps/api/.env \
    jim@<pi2-local-ip>:/home/jim/taalwiz-mono/apps/api/.env
```

Contains: `MONGO_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SMTP_*`,
`ADMIN_EMAIL`/`ADMIN_PASSWORD`, `HOST_URL`, `SITE_NAME`, and others.

> **Before copying, verify in the Mac `.env`:**
> - `HOST_URL` is `https://taalwiz.nl` (not `localhost`)
> - `MONGO_URL` points to the production MongoDB (e.g. `mongodb://localhost:27017/taalwiz`)

#### 6. Set up the app's systemd service

Create `/etc/systemd/system/taalwiz.service`:

```ini
[Unit]
Description=Taalwiz API
After=network.target

[Service]
Type=simple
User=jim
WorkingDirectory=/home/jim/taalwiz-mono/apps/api
ExecStart=/usr/local/bin/node dist/main.js
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable taalwiz.service
sudo systemctl start taalwiz.service
systemctl status taalwiz.service
```

#### 7. Migrate the `users` collection from the old Pi

The old app predates this repo and has **no SRS / bookmarks / vocabulary** data —
only `users` needs to come across. Its schema also differs: the old app stores a
**singular `role`** string; the new app uses a **`roles` array** plus `groups`
and `isSuspended`. So this is dump → restore → **transform**, not a raw copy.

Dump (read-only on the old Pi) and transfer:

```bash
ssh raspi5 'docker exec mongodb mongodump --db taalwiz --collection users --archive > /tmp/users.archive'
scp -3 raspi5:/tmp/users.archive raspi5x:/tmp/users.archive
```

Restore, wiping any test/seed users first:

```bash
ssh raspi5x 'docker exec -i mongodb mongorestore --drop --archive < /tmp/users.archive'
```

Transform old `role` → new `roles`/`groups`/`isSuspended`. Put this in a file and
pipe it in (`docker exec -i mongodb mongosh taalwiz < /tmp/transform-users.js`).
Keep `find().forEach()` on **one line** — piped mongosh chokes on leading-dot
line breaks:

```js
db.users.find({}).forEach(function (u) {
  var roles = u.role === 'admin' ? ['admin', 'user'] : u.role === 'demo' ? ['demo'] : ['user'];
  db.users.updateOne({ _id: u._id }, { $set: { roles: roles, groups: u.groups || [], isSuspended: u.isSuspended === true }, $unset: { role: '' } });
});
```

Then assign content groups (**after content is uploaded**, since the group set is
derived from the uploaded articles). Policy: regular users see all groups except
`claude`; demo sees only `claude`; admin bypasses gating so needs none:

```js
var regular = db.articles.distinct('groupName').filter(function (g) { return g !== 'claude' && g !== 'help'; });
db.users.updateMany({ $and: [{ roles: 'user' }, { roles: { $nin: ['admin', 'demo'] } }] }, { $set: { groups: regular } });
db.users.updateMany({ roles: 'demo' }, { $set: { groups: ['claude'] } });
```

> The seed (`AuthService.onApplicationBootstrap`) is insert-if-absent, so once the
> real admin/demo rows exist it won't clobber their passwords.

> **Re-run this whole step at cutover.** The old Pi keeps taking logins/changes
> until the router flip; `mongorestore --drop` + re-transform is idempotent, so a
> final pass right before switching captures last-minute changes with near-zero
> data loss.

### B.2 — Switch the router

> **Do the final `users` re-sync (B.1 step 7) immediately before this step** so
> logins/changes on the old Pi up to the last moment aren't lost.

In the home router, change port forwarding for ports **80** and **443** to the
new Pi's local IP. The old Pi goes dark here; expect ~1–2 minutes of HTTPS
downtime until the cert is issued in the next step.

### B.3 — Obtain the SSL certificate (on the new Pi)

```bash
sudo certbot --nginx -d taalwiz.nl -d www.taalwiz.nl
```

Certbot completes the ACME HTTP-01 challenge over port 80, obtains the Let's
Encrypt cert, and rewrites the nginx config to add HTTPS (443) + HTTP→HTTPS
redirects. Then:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### B.4 — Verify

- `https://taalwiz.nl` loads over HTTPS
- `http://taalwiz.nl` redirects to HTTPS
- Log in and confirm the app works end-to-end
- If anything is off: `sudo journalctl -u nginx`

### Certificate renewal

Certbot installs a systemd timer that auto-renews. Confirm it is active:

```bash
systemctl status certbot.timer
```

---

## Quick reference

### App / MongoDB services

| Action | Command |
| --- | --- |
| Live log tail (app) | `journalctl -fu taalwiz.service` |
| Restart after deploy | `sudo systemctl restart taalwiz.service` |
| Health check | `systemctl status taalwiz.service` |
| MongoDB status | `systemctl status mongodb.service` |

### nginx

| Action | Command |
| --- | --- |
| Start | `sudo systemctl start nginx` |
| Stop | `sudo systemctl stop nginx` |
| Reload (config change) | `sudo systemctl reload nginx` |
| Status | `systemctl status nginx` |
| Test config | `sudo nginx -t` |
| Enable at startup | `sudo systemctl enable nginx` |

Config file locations:

- Global: `/etc/nginx/nginx.conf`
- Site: `/etc/nginx/sites-available/taalwiz.nl`
- Enabled symlink: `/etc/nginx/sites-enabled/taalwiz.nl`
- SSL certs (after certbot): `/etc/letsencrypt/live/taalwiz.nl/`

---

## Gotcha: unit-file `WorkingDirectory` after the repo rename

If you ever **reuse an existing** `taalwiz.service` from before the
`taalwiz-api → api` rename, its `WorkingDirectory` may still point at the dead
`apps/taalwiz-api` path, and the service crash-loops on `CHDIR` ("Changing to the
requested working directory failed: No such file or directory",
`status=200/CHDIR`). Fix it to `/home/jim/taalwiz-mono/apps/api`, then reload:

```bash
sudo systemctl daemon-reload && sudo systemctl restart taalwiz.service
```

(`sudo systemctl edit taalwiz.service`, or edit
`/etc/systemd/system/taalwiz.service` directly.)

> Resolved on **raspi5x** as of 2026-06-11 — its fresh clone and the unit file in
> B.1 step 6 already use the correct `apps/api` path. This note is kept only for
> the case of reusing an old unit file.
