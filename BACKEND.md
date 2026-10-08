# Backend Migration — What Changed & How to Run It

This branch replaces CDAD's old LocalStorage-only frontend with a real
backend: a Node/Express REST API backed by SQLite. If you're pulling this
branch to try it out, this doc is the one to read — `README.md` has also
been updated for the new setup, but this is the shorter "what changed and
how do I run it" version.

## Why

The old app stored everything in the browser's LocalStorage. That meant:
- Two people on two different devices each saw an empty, independent copy
  of the app — nothing was actually shared.
- Passwords were stored and checked in **plaintext**, readable by anyone
  via browser DevTools.

Neither of those is acceptable for something meant to be used by a real
class, so this branch adds a proper backend.

## What changed

- **New `server/` folder**: a Node/Express app with a SQLite database
  (`server/db.js`), one route file per resource (`server/routes/*.js`), a
  seed script (`server/seed.js`) with the same demo roster as before, and
  session-cookie-based auth (`server/sessions.js`) with bcrypt-hashed
  passwords.
- **Every frontend JS file was updated** to call the new API instead of
  `localStorage` — but the six helper function names in `js/storage.js`
  (`getData`, `addData`, `updateData`, `deleteData`, `findData`, `saveData`)
  stayed the same, so the overall structure of the app didn't change, just
  how it talks to the data layer.
- **`js/data.js` is gone** — seeding now happens server-side once, in
  `server/seed.js`, instead of re-running in every browser tab.
- **Live updates are now polling-based** (every 15 seconds, and
  immediately when you switch back to the tab) instead of the old
  same-browser-only LocalStorage event. A change someone else makes may
  take a few seconds to show up for you — that's expected, not a bug.
- **Dockerfile updated** to run the new Node server instead of a static
  nginx container (see "Running with Docker" below).
- **New: self-service "Forgot Password"** on the login page (it was a
  dead link before), now a real two-step flow: enter your ID + email on
  file → a 6-digit code is emailed to you (via Gmail SMTP, see
  `server/.env.example`) → enter the code + new password. The code
  expires in 10 minutes and is single-use. **Requires one-time setup**
  (see "Setting up email" below) — without it, this feature returns a
  clear error instead of crashing, but it can't actually send anything.
- **New: file attachments on the Submission tab.** Students can now
  attach a PDF, PPT/PPTX, CSV, or DOC/DOCX file (max 10MB) alongside or
  instead of a link. Files live under `server/data/uploads/` — already
  covered by the existing Docker volume, no extra setup needed. Faculty
  can download the attached file from the Review modal or the
  Submissions Hub.
- **New: only a group's team leader can submit a project** (server
  enforces this; everyone else still sees the submission's status).
  Faculty's Submissions Hub now groups entries under a day header,
  newest day first.

Nothing else about the UI or workflows changed — group creation/joining,
marks, notifications, etc. all work exactly the same from a user's point
of view. Login credentials are unchanged too (`FAC001` / `faculty123`,
`ADT24SOCB0001` / `PASS123`, etc.).

Two small behavior fixes came along with the migration (not new features,
just bugs the old version had):
- Group-targeted notifications (e.g. "Presentation Scheduled") now
  actually show up for students in that group — the old code only ever
  matched `all-students` or your exact ID, so group notifications were
  silently invisible before.
- Deleting a student who led a group now correctly promotes another
  member to leader, instead of leaving the group leaderless.

## Getting the code

```bash
git fetch origin
git checkout backend-migration
git pull
```

(If you don't have the repo cloned yet: `git clone
https://github.com/Prathamesh13-n/CBAD-project.git && cd CBAD-project &&
git checkout backend-migration`)

## Setting up email (for Forgot Password)

This is optional — everything else works without it. Skip it and Forgot
Password will just return a clear error instead of sending anything.

1. Turn on 2-Step Verification on the Google account you want to send
   from, if it isn't already: https://myaccount.google.com/security
2. Generate an App Password (choose "Mail" as the app):
   https://myaccount.google.com/apppasswords — Google gives you a
   16-character code. This is NOT your real Gmail password; use the App
   Password.
3. **Plain Node**: copy `server/.env.example` to `server/.env` and fill
   in `GMAIL_USER` (your Gmail address) and `GMAIL_APP_PASSWORD` (the
   16-character code). `server/.env` is gitignored — never commit it.
4. **Docker**: pass them as `-e` flags on `docker run` instead of a
   `.env` file:
   ```bash
   docker run -d -p 3000:3000 -v cdad-data:/app/server/data \
     -e GMAIL_USER=youraddress@gmail.com -e GMAIL_APP_PASSWORD=your16charcode \
     --name cdad-container cdad
   ```

## How to run it

### Option A — Docker (recommended, avoids Node version issues)

The database driver (`node:sqlite`) needs **Node 22 or newer**. If you're
not sure what Node version you have installed, Docker sidesteps the
question entirely — the container always uses the right version.

```bash
docker build -t cdad .
docker volume create cdad-data
docker run -d -p 3000:3000 -v cdad-data:/app/server/data --name cdad-container cdad
```

Open **http://localhost:3000**.

If port 3000 is already taken on your machine, map a different host port,
e.g. `-p 4000:3000`, and open that port instead.

To stop it: `docker stop cdad-container`. To remove it (data stays safe in
the `cdad-data` volume): `docker rm cdad-container`.

### Option B — Plain Node (no Docker)

Check your Node version first:

```bash
node --version
```

If it's below `v22.5.0`, either install a newer Node or use Docker instead
(Option A) — the backend won't start otherwise.

```bash
cd server
npm install
npm start
```

Open **http://localhost:3000** (or whatever port you set via `PORT=...`
before `npm start`).

## Login

Same as before — by ID, never by email:

| Role    | Login ID        | Password     |
|---------|------------------|--------------|
| Faculty | `FAC001`         | `faculty123` |
| Student | `ADT24SOCB0001`, `ADT24SOCB0002`, `ADT24SOCB0820`, `ADT24SOCB0020` | `PASS123` |

To try the new **Forgot Password** link (once email is set up — see
above): on the login page, enter `ADT24SOCB0001` + `hanfa@cdad.edu` (the
email on file for that student), check that inbox for the 6-digit code,
then enter the code + a new password.

## If something doesn't work

- **"No such built-in module: node:sqlite"** — your Node is too old. Use
  Docker, or install Node 22+.
- **Port already in use** — something else on your machine is using 3000.
  Pick a different port (`-p 4000:3000` for Docker, or `PORT=4000 npm
  start` for plain Node).
- **Login fails with "Invalid ID or password"** — the database may not
  have seeded yet. Check the server's startup logs for a line like
  `Seeded database at version ...`; if it says nothing at all, something
  crashed on startup — check the fuller error above that line.
- Full details on the database schema and API routes are in the updated
  `README.md`.
