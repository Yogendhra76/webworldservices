# Web World Services — Website + Database + Admin Dashboard

This is your original site, now wired up to a real backend:

- **Contact form** → saves every submission into a real database file
  (`data/messages.json`) on the server.
- **Admin dashboard** (`/admin.html`) → logs in against a password checked
  on the *server* (not hidden in the page source anymore), then shows the
  live list of messages, lets you mark them as read, and delete them.
- **WhatsApp button** → a floating chat button on every page, plus the
  WhatsApp icon in the footer, both linking straight to a WhatsApp chat.

No paid database service is required — the server that runs your site
*is* the thing that stores your data. There's nothing extra to sign up
for besides hosting.

## 1. Before you do anything: set your WhatsApp number

Open these two files and replace `911234567890` with your real WhatsApp
number (country code + number, no `+`, no spaces or dashes):

- `js` isn't needed — it's plain HTML, search for `911234567890` in:
  - `index.html`
  - `about.html`
  - `services.html`
  - `contact.html`

Each spot is marked with a `📱` comment so it's easy to find.

## 2. Set your admin password

Don't ship the default password. Either:

- Set an environment variable called `ADMIN_PASSWORD` on your hosting
  provider (recommended — see step 4), **or**
- Edit the fallback value directly in `server.js` (search for
  `ADMIN_PASSWORD`).

## 3. Run it on your own computer first (optional but recommended)

You need [Node.js](https://nodejs.org) installed (version 18 or newer).
No other install step is required — this project has zero external
dependencies.

```bash
node server.js
```

Then open:

- **http://localhost:3000** — your website
- **http://localhost:3000/admin.html** — your admin dashboard

Submit the contact form, then log into the admin dashboard and you'll see
the message appear.

## 4. Put it live on the internet

I can't publish this to a URL for you directly from here, but deploying
it yourself takes about five minutes. Any of these free/cheap hosts work
well because this project needs nothing but Node.js:

### Option A — Render.com (easiest, free tier available)
1. Create a free account at render.com and connect your GitHub account.
2. Push this folder to a new GitHub repository.
3. In Render, click **New → Web Service**, pick that repository.
4. Build command: (leave blank) — Start command: `node server.js`
5. Under **Environment**, add `ADMIN_PASSWORD` with your real password.
6. Click **Create Web Service**. Render gives you a live `.onrender.com`
   URL a minute or two later.

### Option B — Railway.app
1. Create a project, choose **Deploy from GitHub repo**.
2. Railway auto-detects Node.js and runs `node server.js`.
3. Add the `ADMIN_PASSWORD` environment variable in the Railway dashboard.
4. Railway gives you a live URL under **Settings → Networking**.

### Option C — Your own VPS / cPanel Node hosting
Copy the project folder to the server, run `node server.js` (ideally
under a process manager like `pm2` so it restarts automatically), and
point your domain at that server.

⚠️ **One important note about the free tiers of Render/Railway/etc.:**
some free plans use a temporary filesystem, meaning `data/messages.json`
can be wiped when the server restarts or redeploys. For a small business
site this is usually fine day-to-day, but if you want guaranteed
permanent storage, look for a host with a "persistent disk" / "volume"
option (Render's paid plans and Railway both offer this), or let me know
and I can wire the same backend up to a proper hosted database (like
Postgres on Supabase or Neon, both free to start) instead of the JSON
file.

## 5. Where your data lives

Every contact form submission is stored in `data/messages.json`. It's a
plain text file you can open, back up, or import into a spreadsheet at
any time — it's a genuine database, just a simple file-based one rather
than something like MySQL. If your site grows a lot, that's the point
where it's worth moving to a real database server; just say the word and
I can set that up too.

## What changed from the original files

- `server.js` — **new**. A small Node.js server (no external packages)
  that serves your site and provides the `/api/contact` and
  `/api/admin/...` endpoints.
- `data/messages.json` — **new**. Your message database, starts empty.
- `js/script.js` — the admin login and contact form now talk to the
  server instead of faking success in the browser.
- `admin.html` — the sample rows and fake stats are gone; the dashboard
  now renders whatever is really in your database.
- `index.html`, `about.html`, `services.html`, `contact.html` — added the
  floating WhatsApp button and linked the footer WhatsApp icon.
- `css/style.css` — styles for the WhatsApp button and the dashboard's
  new "mark read" / "delete" buttons.
