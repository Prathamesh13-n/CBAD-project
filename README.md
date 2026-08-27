# CDAD — College Digital Academic Dashboard

A fully editable, frontend-only academic dashboard for managing students,
groups, projects, marks, presentations, and submissions. No backend, no
database — everything is read from and written to the browser's
**LocalStorage**. An edit made on the Faculty Dashboard is immediately
visible on the Student Dashboard, and vice versa where students are allowed
to edit their own data.

> **Important limitation:** because everything lives in LocalStorage, data is
> **per-browser, per-device only** — it is not synced to a server. Two
> students logging in from two different phones/laptops will each see an
> empty, independent copy of the app. This build is a fully working
> prototype/demo; publishing it for a real class across many devices would
> require replacing the LocalStorage layer (`js/storage.js`) with real API
> calls to a backend + database. Everything else (UI, workflows, validation)
> would carry over unchanged.

## Tech Stack

- HTML5, CSS3, Vanilla JavaScript (no frameworks, no build step)
- Browser `LocalStorage` as the only data layer
- Docker + Nginx (Alpine) for serving the static files

## Quick Start (Docker)

```bash
docker build -t cdad .
docker run -d -p 8080:80 --name cdad-container cdad
```

Open **http://localhost:8080**

To stop/remove:

```bash
docker stop cdad-container && docker rm cdad-container
```

## Quick Start (no Docker)

Open `index.html` directly in a browser, or serve the folder with any static
file server, e.g. `npx serve .` or Python's `python3 -m http.server`.

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

Change any login ID or password any time from Faculty → Students → **Edit ✎**
(students cannot change their own password in this build — only faculty can).

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
- Dedicated **Submission** tab for students: submit a link + note for
  faculty to review, resubmit any time before approval.
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
  from LocalStorage. Nothing is hardcoded.
- Live cross-tab sync: if LocalStorage changes in another tab (e.g. a
  classmate accepts your connection request), this tab picks it up and
  refreshes automatically. If a session is invalidated elsewhere (e.g. a
  data reseed), the tab redirects to login instead of breaking.

### Activity log
- Every create/update/delete action across the whole app is logged with a
  timestamp. Faculty can view or clear the full history.

## LocalStorage Keys

cdad_students
cdad_groups
cdad_projects
cdad_marks
cdad_presentations
cdad_requests
cdad_student_requests
cdad_group_join_requests
cdad_notifications
cdad_announcements
cdad_faculty
cdad_activity
cdad_current_user
cdad_seeded


All access goes through the shared helpers in `js/storage.js`
(`getData`, `saveData`, `addData`, `updateData`, `deleteData`, `findData`) —
no other file talks to `localStorage` directly.

## File Structure

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
│   ├── data.js
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
└── assets/
    ├── images/
    └── icons/

## Resetting the Demo Data

The seed re-runs automatically whenever `SEED_VERSION` in `js/data.js` is
bumped to a new string — this is how roster changes propagate to everyone
without needing a manual reset. To force a clean reset yourself at any time,
open DevTools on any CDAD page and run:

```js
localStorage.clear();
location.reload()
