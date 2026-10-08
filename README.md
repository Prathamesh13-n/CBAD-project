# CDAD — College Digital Academic Dashboard

A fully editable academic dashboard for managing students, groups, projects,
marks, presentations, and submissions. A Node/Express REST API backed by
SQLite is the single source of truth — every student and faculty session
reads and writes the same server-side data, so an edit made on the Faculty
Dashboard is immediately visible on the Student Dashboard (and vice versa
where students are allowed to edit their own data), across devices, not just
across browser tabs. Sessions are server-side, authenticated via an
HttpOnly cookie, and passwords are bcrypt-hashed — never stored or compared
in plaintext.

> **Note on "live" updates:** the frontend polls the server every 15 seconds
> (and immediately on tab focus) rather than pushing updates over a
> WebSocket, so a change made by someone else may take a few seconds to
> appear — this was a deliberate simplicity tradeoff for a project at this
> scale.

## Tech Stack

- HTML5, CSS3, Vanilla JavaScript on the frontend (no frameworks, no build step)
- Node.js + Express REST API (`server/`)
- SQLite (via Node's built-in `node:sqlite`) as the only data store — requires Node 22+ (the Dockerfile uses `node:22-alpine`)
- `bcryptjs` for password hashing, HttpOnly session cookies for auth
- Docker (single Node container, no separate reverse proxy needed)

## Quick Start (Docker)

```bash
docker build -t cdad .
docker volume create cdad-data
docker run -d -p 3000:3000 -v cdad-data:/app/server/data --name cdad-container cdad
```

Open **http://localhost:3000**

The `-v cdad-data:/app/server/data` volume is what makes the SQLite database
survive beyond the container itself — without it, removing the container
(`docker rm`, not just `docker stop`) wipes all data and the next run starts
from a fresh seed. With the volume, `docker rm` + `docker run` again reuses
the same data (confirmed: the server logs "Already seeded" instead of
reseeding).

To stop/remove (data is preserved in the volume either way):

```bash
docker stop cdad-container && docker rm cdad-container
```

To wipe the demo data and start over, also remove the volume:

```bash
docker volume rm cdad-data
```

## Quick Start (no Docker)

```bash
cd server
npm install
npm start
```

Open **http://localhost:3000** (or set `PORT=...` before `npm start` to use a
different port). The server seeds demo data into `server/data/cdad.db`
automatically on first run.

## Login

**Login is always by ID — never by email.** Email is stored on each record
for reference only.

| Role    | Login ID        | Password     |
|---------|------------------|--------------|
| Faculty | `FAC001`         | `faculty123` |
| Student | Enrollment No. (e.g. `ADT24SOCB0001`) | `PASS123` (default) |

Faculty adds real students one at a time (Faculty → Students → **Add
Student**) or in bulk via **Import CSV** (a file with Enrollment No. + Name
columns, matching the roster template — Email/Phone/Group/Password columns
are optional). Every imported student defaults to password `PASS123` unless
the CSV specifies one.

Faculty can change any student's login ID or password any time from Faculty
→ Students → **Edit ✎**.

Anyone can also reset their own password from the login page's **Forgot
Password?** link: enter your ID and the email on file for your account,
and a real 6-digit confirmation code is emailed to you (via Gmail SMTP —
see `server/.env.example` for the one-time setup). Enter that code plus
your new password to finish. The code expires after 10 minutes and can
only be used once.

### First login for a new student

The app walks a brand-new student through setup automatically:

1. **Log in** with their Student ID + password.
2. **Complete profile** — a phone number is required before anything else
   unlocks (a blocking modal appears until this is filled in).
3. **Join or create a group** — every other tab is locked until the student
   either creates a new group (they become team leader) or sends a join
   request to an existing group's leader (found by that leader's Student ID)
   and gets accepted.
4. Once in a group, the rest of the dashboard opens up — My Project,
   Progress, Submission, GitHub, Marks, Presentation, Connect, Requests,
   Announcements, Notifications.

## Feature Overview

### Students
- Full CRUD by faculty; bulk **Import CSV** with a detailed skip-reason
  report (missing fields / duplicate IDs, listed by line number); **Export**
  to CSV; **Delete All** (with confirmation) for clearing a bad import.
- Search, filter by group/status, paginated table.
- Students edit their own name/email/phone/avatar; faculty can edit
  everything.

### Groups
- **Faculty** can create/edit/delete any group, manage members and leader.
- **Students** can also create their own group (become leader automatically,
  with a member picker to enroll classmates immediately), or find another
  group's leader by their Student ID and send a join request directly to
  them — the leader accepts/rejects from their own **Create Group** tab.
- **Leave Group** is self-service: leadership auto-transfers to another
  member if the leader leaves, or the group is disbanded if the last member
  leaves.
- Member count and progress always calculated live, never hardcoded.

### Projects
- **Faculty** can create/assign/edit any project.
- **Students** (team leader) can also create their own group's project if
  one doesn't exist yet, and any member can edit title/description/tools
  used — group, leader, and deadline stay faculty-controlled.
- 7-stage progress tracker (Planning → Requirement Analysis → Design →
  Development → Testing → Presentation → Submission). Students click through
  each stage themselves (Pending → In Progress → Completed) on the
  **Progress** page; overall percentage recalculates automatically and
  cascades up to the owning group.

### Submissions
- Dedicated **Submission** tab for students: submit a link, attach a file
  (PDF, PPT/PPTX, CSV, or DOC/DOCX, max 10MB), and/or a note for faculty to
  review — at least a link or a file is required, not both. Resubmit any
  time before approval; a resubmission that doesn't attach a new file
  keeps whatever file was already on record. Faculty can download the
  attached file directly from the Review modal or the Submissions Hub.
- **Faculty can request a submission** from a group, optionally with a
  **due date/time** — this is stored on the project and shown to students
  before they submit.
- Every submission is **automatically tagged On Time or Late** by comparing
  the submission timestamp to that due date (snapshotted at submit time, so
  a later due-date edit doesn't retroactively change past submissions).
- Faculty **Submissions Hub** — one page listing every submission across
  every project/group, filterable by status, with the timeliness badge
  visible at a glance and one-click Approve/Reject with feedback.

### Marks, Presentations, GitHub
- Faculty edits marks (Internal/Project/Presentation/Viva); Total, %, and
  Grade are always derived, never stored directly.
- Students view marks with a donut chart (overall %) and a trend line chart
  across the four components.
- Presentations scheduled/edited/rescheduled/cancelled/completed by faculty;
  students view their own group's schedule.
- GitHub repo name/URL/branch editable by students (both when creating a
  project and afterward) and by faculty.

### Requests & connections
- **Academic requests** (Join/Leave/Change Group, Project, General) — student
  submits to faculty, faculty accepts/rejects with a response note.
- **Peer connection requests** — any student can browse the student
  directory and send another student a connection request; accepted
  connections show up for both, and a connected student who leads a group
  with an open slot can invite them directly.
- **Group join requests** — separate from the above; a student without a
  group finds a leader by ID and requests to join their specific group.
- Faculty gets read-only oversight monitors for both peer and group-join
  requests on the Requests page.

### Notifications & announcements
- Faculty creates/edits/deletes notifications targeted at all students, a
  specific group, or a specific student; students view/mark read/delete.
- Announcements (Normal/Important/Urgent priority) — faculty CRUD, students
  view.
- Every significant action (request accepted, submission reviewed,
  presentation scheduled, etc.) automatically fires a notification to the
  right person.

### Dashboards
- Every number on every dashboard card and chart — student counts, group
  progress, project status breakdown, marks, everything — is computed live
  from the server, via real SQL joins (e.g. a group's progress is read
  straight off its linked project — there's no stored mirror to desync).
  Nothing is hardcoded.
- Live sync: the page polls the server every 15 seconds and on tab focus, so
  changes made elsewhere (e.g. a classmate accepting your connection
  request) show up without a manual reload. If a session is invalidated
  elsewhere (e.g. a reseed or logout), the next poll redirects to login
  instead of breaking.

### Activity log
- Every create/update/delete action across the whole app is logged with a
  timestamp. Faculty can view or clear the full history.

## Database

SQLite tables (`server/db.js`): `faculty`, `students`, `student_groups`,
`projects`, `submissions`, `marks`, `presentations`, `requests`,
`group_join_requests`, `student_requests`, `student_connections`,
`notifications`, `announcements`, `activity`, `seed_meta`. Real foreign keys
replace what used to be hand-synced LocalStorage arrays — e.g. group
membership is `students.group_id`, not a `members[]` array kept in sync by
hand; group progress is read live off the linked project, never stored
independently.

The REST API (`server/routes/*.js`) reconstructs the same JSON shapes the
frontend has always used (`group.members`, `project.progress`, etc.) from
these normalized tables via joins, so `js/storage.js`'s six helpers
(`getData`, `saveData`, `addData`, `updateData`, `deleteData`, `findData`)
still look the same to every other frontend file — they just `fetch()` the
API now instead of reading `localStorage`.

## File Structure
```
CDAD/
│
├── index.html
├── student.html
├── faculty.html
├── group-details.html
├── Dockerfile
├── README.md
│
├── css/
│   ├── style.css
│   ├── dashboard.css
│   ├── forms.css
│   └── responsive.css
│
├── js/
│   ├── storage.js
│   ├── common.js
│   ├── auth.js
│   ├── groups.js
│   ├── projects.js
│   ├── marks.js
│   ├── presentations.js
│   ├── requests.js
│   ├── notifications.js
│   ├── announcements.js
│   ├── student.js
│   └── faculty.js
│
├── assets/
│   ├── images/
│   └── icons/
│
└── server/
    ├── index.js          (Express app + static file serving)
    ├── db.js              (SQLite schema + helpers)
    ├── seed.js            (demo data, version-gated)
    ├── sessions.js        (cookie sessions + requireRole middleware)
    ├── serializers.js     (DB row -> frontend JSON shape)
    ├── notify.js           (server-side notification creation)
    ├── groupOps.js        (shared group-membership operations)
    ├── data/cdad.db       (SQLite file, created on first run — gitignored)
    └── routes/
        ├── auth.js, students.js, faculty.js, groups.js, groupJoinRequests.js,
        └── projects.js, marks.js, presentations.js, requests.js,
            peerRequests.js, notifications.js, announcements.js, activity.js
```

## Resetting the Demo Data

The seed re-runs automatically whenever `SEED_VERSION` in `server/seed.js` is
bumped to a new string — this is how roster changes propagate to everyone
without needing a manual reset.

**Without Docker** — stop the server and delete the database file:

```bash
rm server/data/cdad.db server/data/cdad.db-shm server/data/cdad.db-wal
npm --prefix server start
```

**With Docker** — remove the volume instead (the file lives inside it, not
on the host):

```bash
docker rm -f cdad-container
docker volume rm cdad-data
docker run -d -p 3000:3000 -v cdad-data:/app/server/data --name cdad-container cdad
```
