# LWP CRM

Outreach and partner management for Leading with People. Same stack as Stacks: Node.js + Express, Postgres via Supabase, hosted on Render, installable on your phone as a PWA.

## What this is

A single-user web app to manage your outreach to institutions and partners. You can:

- **Dashboard** — see your tier 1 not-started list, next actions due this week, stale conversations (30+ days no contact), and stats across tier and status.
- **Organisations** — filterable table of every organisation. Click a row to edit any field, add notes, change status, log interactions.
- **Draft emails** — click "Draft email" on any organisation. Pick a purpose (cold outreach, warm intro, follow-up, thank you, propose a call, quarterly check-in, referral request), choose PT or EN. The tool fills in the template with the org's data. Copy to clipboard or open in your email client.
- **Bulk email** — pick several organisations at once, generate all drafts, step through each.
- **Find new** — search Wikipedia and DuckDuckGo for candidate organisations to add.
- **Outreach log** — chronological feed of every logged interaction. Auto-populated when you draft an email.
- **Backup** — download Excel or JSON at any time. Weekly reminder shows if you have not backed up in 7+ days.

The tool drafts. You send. Nothing is emailed automatically.

---

## Deployment (first time)

This is the same three-step deployment you used for Stacks: Supabase for the database, GitHub for the code, Render for hosting. All free. Total time: about 20 minutes.

### Step 1 — Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and sign in.
2. Click **New project**.
3. Name it `lwp-crm`. Pick a strong database password (save it somewhere safe, you will need it in step 3).
4. Choose the region closest to you (probably West EU (London) or Central EU (Frankfurt) for Portugal).
5. Wait 2–3 minutes for the project to spin up.
6. Once ready, go to **Project Settings → Database → Connection string → Session pooler** and copy the full connection string. It looks like:

   ```
   postgresql://postgres.xxxxxxxxxx:[YOUR-PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:5432/postgres
   ```

7. Replace `[YOUR-PASSWORD]` with the actual database password you set in step 3. Keep this string ready.

### Step 2 — Create the GitHub repository

1. Go to [github.com/new](https://github.com/new).
2. Repository name: `lwp-crm`.
3. Private repository (recommended — it is a CRM with your contacts).
4. Do NOT initialise with a README, .gitignore, or license (the project already has them).
5. Click **Create repository**.
6. On the empty repo page, click **uploading an existing file** (the link in the text on the page).
7. Drag the entire contents of the `lwp-crm` folder (all files and subfolders) into the browser. Wait for the upload to finish.
8. Scroll down, add a commit message like "Initial commit", click **Commit changes**.

### Step 3 — Deploy on Render

1. Go to [render.com](https://render.com) and sign in with your GitHub account.
2. Click **New → Web Service**.
3. Connect the `lwp-crm` GitHub repository.
4. Configure the service:
   - **Name:** `lwp-crm` (or whatever you like — this becomes the URL)
   - **Region:** Frankfurt (or wherever you chose for Supabase)
   - **Branch:** `main`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Instance Type:** Free
5. Click **Advanced** and add these **Environment Variables**:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Supabase connection string from step 1 |
   | `ADMIN_PASSWORD` | a strong password of your choice (you will use this to sign in) |
   | `SESSION_SECRET` | a long random string, e.g. paste 40+ random characters |
   | `LWP_SENDER_NAME` | `Lara` |
   | `LWP_SENDER_ROLE` | `Head of Business Development` |
   | `LWP_SENDER_EMAIL` | `info@leadingwithppl.com` |
   | `NODE_ENV` | `production` |

6. Click **Create Web Service**. Render will build and start the app. First build takes 3–5 minutes. Watch the logs; when you see `LWP CRM listening on port 10000` you are live.

### Step 4 — Initialise the database

Two commands to run once, from Render's Shell tab:

1. In the Render dashboard, open your `lwp-crm` service, click **Shell** in the left menu.
2. Run:

   ```bash
   node scripts/init-db.js
   ```

   You should see `Schema applied.`

3. Then run:

   ```bash
   node scripts/seed-templates.js
   ```

   You should see `Templates seeded.`

### Step 5 — First sign-in and Excel import

1. Open the URL Render gave you (something like `https://lwp-crm.onrender.com`).
2. Sign in with the `ADMIN_PASSWORD` you set.
3. First visit shows an empty dashboard. Click **Backup** in the sidebar.
4. In the "Import your Excel CRM" section, upload `LWP_Outreach_CRM.xlsx` (the spreadsheet we built earlier).
5. You should see: `Imported 50 organisations. Skipped 0 duplicates and 7 placeholder rows.`
6. Click **Dashboard**. You now see your 14 tier-1 organisations, with 11 waiting for outreach.

### Step 6 — Add to iPhone home screen (PWA)

1. On your iPhone, open the Render URL in **Safari** (must be Safari; Chrome iOS cannot install full-screen PWAs).
2. Tap the Share icon.
3. Tap **Add to Home Screen**.
4. Name it "LWP CRM". Done. The app opens full-screen like a native app.

---

## Ongoing use

**Sign in.** Password is whatever you set as `ADMIN_PASSWORD` on Render. Sessions last 30 days.

**Free-tier constraints.**
- Render sleeps the app after 15 minutes of inactivity. Your first request after that takes 30–50 seconds while it wakes up. Subsequent requests are fast.
- Supabase free tier gives you 500MB of database storage. You will not come close for a CRM.

**Backups.**
- Click **Backup** in the sidebar at least once a week. The tool shows a warning banner when your last backup is 7+ days old.
- **JSON backup** — full snapshot including templates and settings. Use this to restore or move to a different database.
- **Excel backup** — human-readable spreadsheet, one sheet per category plus outreach log.

**Editing email templates.** The 14 seeded templates (7 purposes × 2 languages) live in the database. If you want to reword them:
- Currently editable only via SQL in the Supabase dashboard (Table Editor → email_templates).
- Or via API: `PUT /api/templates/:id` with `{"subject": "...", "body": "..."}`.

**Adding a new organisation.**
- **Manually:** click **+ New** on the Organisations page. Fill in the fields.
- **From the search helper:** click **Find new**, type a name or sector, click **Add to CRM** on any result.

**Logging interactions.**
- Every time you click "Open in email client" from the email drafter, a log entry is created automatically.
- You can also add a log entry manually inside the org detail panel.
- The org's `last_contact` field updates automatically.

**Filtering the organisations list.** Any combination of:
- Category dropdown
- Priority tier (1, 2, 3)
- Status (9 options)
- Country
- Free-text search across name, contact name, notes, why_relevant, city

---

## Troubleshooting

**"Sign in failed" but the password is correct.**
The rate-limiter locks you out for 15 minutes after 5 failed attempts from the same IP. Wait it out.

**Blank dashboard after login.**
Either the DB isn't initialised yet (rerun `node scripts/init-db.js` from Render Shell) or the templates aren't seeded (rerun `node scripts/seed-templates.js`).

**"Connect ECONNREFUSED" errors in the log.**
Your `DATABASE_URL` is wrong or Supabase is down. Double-check the env var on Render.

**Search returns nothing.**
Sometimes Wikipedia's opensearch API rate-limits. Try a shorter or more specific query. DuckDuckGo's Instant Answer API only returns entities it knows well.

**PWA not installing on iOS.**
Must be Safari, not Chrome. Must be HTTPS (Render provides this automatically).

---

## Local development

If you want to make changes and test locally before pushing:

1. Install Node.js 18+ and PostgreSQL 14+.
2. Clone the repo.
3. `cp .env.example .env` and fill in your local Postgres details.
4. `npm install`
5. `node scripts/init-db.js`
6. `node scripts/seed-templates.js`
7. `node server.js`
8. Open http://localhost:3000

---

## Tech stack

- Node.js 18+ · Express 4
- PostgreSQL 14+ · Supabase (managed)
- Vanilla HTML/CSS/JS frontend, no framework
- Multer for file uploads, XLSX + ExcelJS for spreadsheet I/O
- bcryptjs + express-session for auth
- Hosted on Render free tier
- Installable as PWA on iOS/Android

## File tree

```
lwp-crm/
├── package.json
├── server.js               # Express entry
├── .env.example
├── .gitignore
├── README.md               # this file
├── db/
│   ├── schema.sql          # database schema
│   └── pool.js             # pg connection pool
├── scripts/
│   ├── init-db.js          # apply schema
│   └── seed-templates.js   # seed 14 email templates
├── routes/
│   ├── organisations.js    # CRUD + facets
│   ├── log.js              # outreach log
│   ├── templates.js        # email templates
│   ├── dashboard.js        # aggregated stats
│   ├── settings.js         # key/value settings
│   ├── search.js           # Wikipedia + DuckDuckGo helper
│   ├── backup.js           # Excel + JSON export/import
│   └── import.js           # Excel CRM import
└── public/
    ├── index.html          # app shell
    ├── login.html          # password page
    ├── style.css           # LWP brand system
    ├── app.js              # SPA frontend
    ├── mark.svg            # LWP logo
    ├── manifest.webmanifest # PWA manifest
    └── sw.js               # service worker
```
