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

## Backend reference for contributors

Stack: Node 22+/Express, SQLite via `node:sqlite`, bcrypt, cookie sessions,
multer for uploads. Entry point `server/index.js` mounts one router per
resource under `/api/*` and serves the static frontend from the project root.

### Roles and sessions
- Three roles: `student`, `faculty`, `admin`. Login is `POST /api/auth/login`
  with `{ role, id, password }`; the server sets an HttpOnly `cdad_sid` cookie.
  Sessions live **in memory** (a restart logs everyone out).
- `requireRole(role)` in `server/sessions.js` guards routes.
  `requireRole()` = any logged-in user, `requireRole('faculty')` = faculty **or
  admin**, `requireRole('admin')` = admin only, `requireRole('student')` = students.
- Handlers that branch on the caller treat admin like faculty
  (`req.user.type === 'faculty' || 'admin'`).
- The default admin (`ADMIN001` / `admin123`) is created in `db.js` when the
  `admins` table is empty. Change it.

### Schema changes (all additive, applied on startup)
`db.js` uses `CREATE TABLE IF NOT EXISTS` plus `ensureColumn()`, so an existing
database upgrades in place — no reset needed.
- `students.section` — division (A/B/…).
- `marks.released` — 0/1; when the column is first added, existing rows are set
  to released so nobody loses access.
- `exam_submissions` (one row per group per exam, unique on `group_id, exam`),
  `exam_submission_files` (up to 5 per submission; legacy single-file rows are
  migrated automatically), `exam_deadlines` (one optional deadline per exam).
- `admins`.

### Endpoints added in this branch
| Method & path | Who | What |
|---|---|---|
| `PUT /api/marks/group/:groupId` | faculty/admin | Apply marks to every member of a group; only fields sent are overwritten; new marks start **unreleased** |
| `POST /api/marks/release-all` | faculty/admin | `{released: true or false}` for every marks row |
| `POST /api/marks/:id/release` | faculty/admin | Release/withdraw one student's marks |
| `GET /api/marks` | any | Faculty/admin: everything. **Students: only released marks of their own group** |
| `GET /api/exam-submissions` | any | `{exams, deadlines, submissions}` — faculty/admin see all, students their group's |
| `POST /api/exam-submissions/:exam` | student (team leader) | multipart: `link`, `note`, `files` (≤5), `removeFileIds` (JSON array). Rejected after the exam's deadline |
| `GET /api/exam-submissions/files/:fileId[?inline=1]` | faculty/admin, own-group students | Download; `inline=1` serves pdf/csv/docx for in-browser preview |
| `PUT /api/exam-submissions/deadlines/:exam` | faculty/admin | `{deadline: ISO}` sets, empty clears; notifies students |
| `DELETE /api/exam-submissions/:id` | faculty/admin | Remove a submission and its files |
| `GET /api/admin/overview` | admin | Counts |
| `GET/POST/PUT/DELETE /api/admin/students[/:id]` | admin | Student account CRUD |
| `POST /api/admin/students/import` | admin | `{students:[…]}` bulk add; existing IDs skipped and reported |
| `GET/POST/PUT/DELETE /api/admin/faculty[/:id]` | admin | Faculty account CRUD |
| `PUT /api/students/:id` | faculty/admin | Now also accepts `section` |
| `DELETE /api/students` | faculty/admin | Delete all students (detaches `submissions.submitted_by_id` first, otherwise a foreign key blocks it) |

Exam names are fixed in `routes/examSubmissions.js` (`EXAMS = ['TA1','TA2','EndSem']`).
Uploads are stored in `server/data/uploads/` (allowed types/size in `upload.js`).

### Rules the server enforces (don't rely on the UI)
- Deadline and team-leader checks run in middleware **before** multer, so a
  rejected request never writes a file to disk.
- Students never receive unreleased marks, or marks from other groups.
- File downloads check group membership for students.

### Frontend map
`js/examSubmissions.js` (API helpers + preview modal), `js/marks.js` (marks API
helpers), `js/admin.js` + `admin.html` (admin panel). Faculty UI lives in
`js/faculty.js`, student UI in `js/student.js`; the faculty dashboard also
loads for admins (`currentFacultyRecord()` accepts both roles).

### Running a safe test
Copy the project folder, start the copy on another port
(`PORT=3200 node server/index.js`) and test against that — the SQLite file in
`server/data/` is the live data. Back it up (`cdad.db*`) before destructive actions.
