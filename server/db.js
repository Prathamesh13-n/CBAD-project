/* ============================================================
   CDAD server :: db.js
   SQLite schema (via Node's built-in node:sqlite) + small helpers
   ported from the frontend's js/common.js / js/storage.js.
   ============================================================ */
const path = require('node:path');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'cdad.db'));
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS faculty (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  phone TEXT, department TEXT, designation TEXT, avatar TEXT, session TEXT
);

CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  password_hash TEXT NOT NULL,
  phone TEXT, course TEXT, year TEXT, department TEXT,
  group_id INTEGER REFERENCES student_groups(id) ON DELETE SET NULL,
  role TEXT, status TEXT DEFAULT 'Active', avatar TEXT
);
CREATE INDEX IF NOT EXISTS idx_students_group ON students(group_id);

CREATE TABLE IF NOT EXISTS student_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  team_leader_id INTEGER REFERENCES students(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'Active'
);

CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_id TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL, description TEXT, tech_stack TEXT,
  group_id INTEGER UNIQUE REFERENCES student_groups(id) ON DELETE SET NULL,
  team_leader_display_id TEXT,
  start_date TEXT, deadline TEXT,
  progress INTEGER DEFAULT 0,
  status TEXT DEFAULT 'Active',
  github_url TEXT, repo_name TEXT, branch TEXT DEFAULT 'main',
  stages TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_group ON projects(group_id);

CREATE TABLE IF NOT EXISTS submissions (
  project_id INTEGER PRIMARY KEY REFERENCES projects(id) ON DELETE CASCADE,
  link TEXT, note TEXT,
  submitted_by_id INTEGER REFERENCES students(id),
  submitted_at TEXT,
  status TEXT,
  faculty_note TEXT, reviewed_at TEXT
);

CREATE TABLE IF NOT EXISTS marks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER UNIQUE NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  internal INTEGER DEFAULT 0, internal_max INTEGER DEFAULT 20,
  project INTEGER DEFAULT 0, project_max INTEGER DEFAULT 40,
  presentation INTEGER DEFAULT 0, presentation_max INTEGER DEFAULT 20,
  viva INTEGER DEFAULT 0, viva_max INTEGER DEFAULT 10
);

CREATE TABLE IF NOT EXISTS presentations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_id TEXT UNIQUE NOT NULL,
  group_id INTEGER REFERENCES student_groups(id) ON DELETE SET NULL,
  project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
  date TEXT, time TEXT, venue TEXT,
  faculty_id INTEGER REFERENCES faculty(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'Scheduled', notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_presentations_group ON presentations(group_id);

CREATE TABLE IF NOT EXISTS requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_id TEXT UNIQUE NOT NULL,
  student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  type TEXT, group_id INTEGER REFERENCES student_groups(id) ON DELETE SET NULL,
  message TEXT, date TEXT, status TEXT DEFAULT 'Pending', response TEXT
);
CREATE INDEX IF NOT EXISTS idx_requests_student ON requests(student_id);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);

CREATE TABLE IF NOT EXISTS group_join_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  to_student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  group_id INTEGER REFERENCES student_groups(id) ON DELETE CASCADE,
  message TEXT, date TEXT, status TEXT DEFAULT 'Pending'
);

CREATE TABLE IF NOT EXISTS student_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  to_student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  message TEXT, date TEXT, status TEXT DEFAULT 'Pending'
);

CREATE TABLE IF NOT EXISTS student_connections (
  student_a_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  student_b_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  created_at TEXT,
  PRIMARY KEY (student_a_id, student_b_id),
  CHECK (student_a_id < student_b_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT, message TEXT, type TEXT,
  recipient_kind TEXT CHECK(recipient_kind IN
    ('all-students','all-faculty','student','faculty','group')),
  recipient_student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
  recipient_faculty_id INTEGER REFERENCES faculty(id) ON DELETE CASCADE,
  recipient_group_id INTEGER REFERENCES student_groups(id) ON DELETE CASCADE,
  date TEXT, read INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_notif_recipient
  ON notifications(recipient_kind, recipient_student_id, recipient_faculty_id, recipient_group_id);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT, message TEXT,
  author TEXT,
  date TEXT, priority TEXT DEFAULT 'Normal', status TEXT DEFAULT 'Active'
);

CREATE TABLE IF NOT EXISTS activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  text TEXT, date TEXT
);

CREATE TABLE IF NOT EXISTS seed_meta (key TEXT PRIMARY KEY, value TEXT);
`);

const PROJECT_STAGES = ['Planning', 'Requirement Analysis', 'Design', 'Development', 'Testing', 'Presentation', 'Submission'];

function computeProgressFromStages(stages) {
  if (!stages) return 0;
  const total = PROJECT_STAGES.length;
  let score = 0;
  PROJECT_STAGES.forEach((s) => {
    const v = stages[s];
    if (v === 'Completed') score += 1;
    else if (v === 'In Progress') score += 0.5;
  });
  return Math.round((score / total) * 100);
}

/** Mirrors the frontend's nextSequentialId: next ST001/G01/P01/PRE001/REQ001-style id. */
function nextSequentialId(table, prefix, pad) {
  const rows = db.prepare(`SELECT display_id FROM ${table}`).all();
  let max = 0;
  rows.forEach((r) => {
    const m = String(r.display_id || '').match(/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  });
  return `${prefix}${String(max + 1).padStart(pad, '0')}`;
}

function logActivity(text) {
  db.prepare('INSERT INTO activity (text, date) VALUES (?, ?)').run(text, new Date().toISOString());
}

module.exports = { db, PROJECT_STAGES, computeProgressFromStages, nextSequentialId, logActivity };
