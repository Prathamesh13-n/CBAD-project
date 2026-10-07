/* ============================================================
   CDAD server :: notify.js
   Ports js/common.js's createNotification. recipient is still the
   single polymorphic string the frontend already uses: 'all-students',
   'all-faculty', a student displayId, a faculty displayId, or a
   group displayId — this function figures out which and stores the
   typed columns the notifications table expects.
   ============================================================ */
const { db } = require('./db');
const { studentIdByDisplayId, groupIdByDisplayId } = require('./serializers');

function facultyIdByDisplayId(displayId) {
  const row = db.prepare('SELECT id FROM faculty WHERE display_id = ?').get(displayId);
  return row ? row.id : null;
}

function createNotification({ title, message, type, recipient }) {
  let kind = recipient;
  let studentId = null;
  let facultyId = null;
  let groupId = null;

  if (recipient !== 'all-students' && recipient !== 'all-faculty') {
    const sid = studentIdByDisplayId(recipient);
    const fid = facultyIdByDisplayId(recipient);
    const gid = groupIdByDisplayId(recipient);
    if (sid) { kind = 'student'; studentId = sid; }
    else if (fid) { kind = 'faculty'; facultyId = fid; }
    else if (gid) { kind = 'group'; groupId = gid; }
  }

  db.prepare(`
    INSERT INTO notifications (title, message, type, recipient_kind, recipient_student_id, recipient_faculty_id, recipient_group_id, date, read)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(title, message, type || 'info', kind, studentId, facultyId, groupId, new Date().toISOString());
}

module.exports = { createNotification, facultyIdByDisplayId };
