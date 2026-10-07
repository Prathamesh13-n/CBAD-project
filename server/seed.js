/* ============================================================
   CDAD server :: seed.js
   Ports js/data.js's seedIfEmpty(). Same idempotency concept: a
   seed_meta row holds SEED_VERSION; bump it to force a clean reset
   for a demo (same workflow the frontend used to use). The one
   required behavior change: passwords are bcrypt-hashed before
   insertion instead of stored in plaintext.
   ============================================================ */
const bcrypt = require('bcryptjs');
const { db, computeProgressFromStages } = require('./db');

const SEED_VERSION = 'roster-2026-08-hanfa-parth-prathamesh-v2';

function seedIfEmpty() {
  const row = db.prepare('SELECT value FROM seed_meta WHERE key = ?').get('seed_version');
  if (row && row.value === SEED_VERSION) {
    console.log(`Already seeded at version ${SEED_VERSION} — leaving live data alone.`);
    return;
  }

  const tables = [
    'submissions', 'marks', 'presentations', 'requests', 'group_join_requests', 'student_requests',
    'student_connections', 'notifications', 'announcements', 'activity', 'projects', 'students',
    'student_groups', 'faculty'
  ];
  tables.forEach((t) => db.prepare(`DELETE FROM ${t}`).run());

  const now = Date.now();
  const iso = (daysFromNow) => new Date(now + daysFromNow * 86400000).toISOString();

  const facId = db.prepare(`
    INSERT INTO faculty (display_id, name, email, password_hash, phone, department, designation, avatar, session)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run('FAC001', ' Prof. Vilas Khedekar ', 'faculty@cdad.edu', bcrypt.hashSync('faculty123', 10),
    '9812345670', 'Computer Engineering', 'Associate Professor', '', '2025-2026').lastInsertRowid;

  const roster = [
    { displayId: 'ADT24SOCB0001', name: 'Hanfa', email: 'hanfa@cdad.edu', role: 'Team Leader', inGroup: true },
    { displayId: 'ADT24SOCB0002', name: 'Parth', email: 'parth@cdad.edu', role: 'Member', inGroup: true },
    { displayId: 'ADT24SOCB0820', name: 'Prathamesh', email: 'prathamesh@cdad.edu', role: 'Member', inGroup: true },
    { displayId: 'ADT24SOCB0020', name: 'Prince', email: 'prince@cdad.edu', role: 'Member', inGroup: false }
  ];
  const studentIds = {};
  roster.forEach((s) => {
    const id = db.prepare(`
      INSERT INTO students (display_id, name, email, password_hash, phone, course, year, department, role, status, avatar)
      VALUES (?, ?, ?, ?, '', 'Computer Engineering', '3rd Year', 'Computer Engineering', ?, 'Active', '')
    `).run(s.displayId, s.name, s.email, bcrypt.hashSync('PASS123', 10), s.role).lastInsertRowid;
    studentIds[s.displayId] = id;
  });

  const groupId = db.prepare(`
    INSERT INTO student_groups (display_id, name, team_leader_id, status) VALUES (?, ?, ?, 'Active')
  `).run('G01', 'Group Alpha', studentIds['ADT24SOCB0001']).lastInsertRowid;
  roster.filter((s) => s.inGroup).forEach((s) => {
    db.prepare('UPDATE students SET group_id = ? WHERE id = ?').run(groupId, studentIds[s.displayId]);
  });

  const stagesA = {
    Planning: 'Completed', 'Requirement Analysis': 'Completed', Design: 'In Progress',
    Development: 'Pending', Testing: 'Pending', Presentation: 'Pending', Submission: 'Pending'
  };
  const progress = computeProgressFromStages(stagesA);
  const projectId = db.prepare(`
    INSERT INTO projects (display_id, title, description, tech_stack, group_id, team_leader_display_id,
      start_date, deadline, progress, status, github_url, repo_name, branch, stages)
    VALUES (?, ?, ?, '', ?, ?, ?, ?, ?, 'Active', ?, ?, 'main', ?)
  `).run('P01', 'Smart Campus Attendance System', 'A facial-recognition based attendance tracker for classrooms.',
    groupId, 'ADT24SOCB0001', iso(-20), iso(40), progress,
    'https://github.com/cdad-group-01/smart-attendance', 'smart-attendance', JSON.stringify(stagesA)).lastInsertRowid;

  const marksSeed = [
    { displayId: 'ADT24SOCB0001', internal: 18, project: 35, presentation: 16, viva: 8 },
    { displayId: 'ADT24SOCB0002', internal: 16, project: 32, presentation: 15, viva: 7 },
    { displayId: 'ADT24SOCB0820', internal: 17, project: 34, presentation: 17, viva: 9 }
  ];
  marksSeed.forEach((m) => {
    db.prepare(`
      INSERT INTO marks (student_id, internal, internal_max, project, project_max, presentation, presentation_max, viva, viva_max)
      VALUES (?, ?, 20, ?, 40, ?, 20, ?, 10)
    `).run(studentIds[m.displayId], m.internal, m.project, m.presentation, m.viva);
  });

  const presDate = iso(15);
  db.prepare(`
    INSERT INTO presentations (display_id, group_id, project_id, date, time, venue, faculty_id, status, notes)
    VALUES ('PRE001', ?, ?, ?, '10:00', 'Seminar Hall 1', ?, 'Scheduled', 'Bring live demo on laptop.')
  `).run(groupId, projectId, presDate, facId);

  db.prepare(`
    INSERT INTO requests (display_id, student_id, type, group_id, message, date, status, response)
    VALUES ('REQ001', ?, 'General Request', ?, 'Requesting an extension for the design phase deliverable.', ?, 'Pending', '')
  `).run(studentIds['ADT24SOCB0002'], groupId, iso(-2));

  db.prepare(`
    INSERT INTO student_requests (from_student_id, to_student_id, message, date, status)
    VALUES (?, ?, 'Hey, can we sync on the backend module this week?', ?, 'Pending')
  `).run(studentIds['ADT24SOCB0820'], studentIds['ADT24SOCB0001'], iso(-1));

  db.prepare(`
    INSERT INTO notifications (title, message, type, recipient_kind, recipient_student_id, recipient_faculty_id, recipient_group_id, date, read)
    VALUES ('Welcome to CDAD', 'Your dashboard is ready.', 'info', 'all-students', NULL, NULL, NULL, ?, 0)
  `).run(iso(-5));
  const presDateLabel = new Date(presDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  db.prepare(`
    INSERT INTO notifications (title, message, type, recipient_kind, recipient_student_id, recipient_faculty_id, recipient_group_id, date, read)
    VALUES ('Presentation Scheduled', ?, 'info', 'group', NULL, NULL, ?, ?, 0)
  `).run(`Group Alpha presentation set for ${presDateLabel}.`, groupId, iso(-4));

  db.prepare(`
    INSERT INTO announcements (title, message, author, date, priority, status)
    VALUES ('Mid-term project reviews next week', 'All groups must submit a progress report before the review.', ' Prof. Vilas Khedekar ', ?, 'Important', 'Active')
  `).run(iso(-1));

  db.prepare('INSERT INTO activity (text, date) VALUES (?, ?)')
    .run('Student roster initialized', new Date(now - 5 * 86400000).toISOString());

  db.prepare(`
    INSERT INTO seed_meta (key, value) VALUES ('seed_version', ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(SEED_VERSION);

  console.log(`Seeded database at version ${SEED_VERSION}`);
}

if (require.main === module) seedIfEmpty();
module.exports = { seedIfEmpty, SEED_VERSION };
