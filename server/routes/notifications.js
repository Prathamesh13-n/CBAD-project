/* ============================================================
   CDAD server :: routes/notifications.js
   Ports js/common.js's notificationsFor + js/notifications.js's
   thin CRUD. GET is scoped server-side to the caller's own session
   (students no longer need to filter the full collection client-side).

   Note: the original frontend's notificationsFor() only matched
   'all-students' or an exact student displayId — group-targeted
   notifications (e.g. "Presentation Scheduled" sent to a group) were
   silently never shown to any student. Since the normalized schema
   already tracks recipient_group_id as a real column, this scoping
   also matches group-targeted notifications for the caller's group —
   a one-line fix that falls out of the migration rather than a
   separate behavior change.
   ============================================================ */
const express = require('express');
const { db, logActivity } = require('../db');
const { serializeNotification } = require('../serializers');
const { requireRole } = require('../sessions');
const { createNotification } = require('../notify');

const router = express.Router();

function notificationsForUser(user) {
  if (user.type === 'student') {
    const student = db.prepare('SELECT group_id FROM students WHERE id = ?').get(user.id);
    return db.prepare(`
      SELECT * FROM notifications WHERE recipient_kind = 'all-students'
        OR (recipient_kind = 'student' AND recipient_student_id = ?)
        OR (recipient_kind = 'group' AND recipient_group_id = ?)
      ORDER BY date DESC
    `).all(user.id, student ? student.group_id : null);
  }
  return db.prepare(`
    SELECT * FROM notifications WHERE recipient_kind = 'all-faculty'
      OR (recipient_kind = 'faculty' AND recipient_faculty_id = ?)
    ORDER BY date DESC
  `).all(user.id);
}

router.get('/', requireRole(), (req, res) => {
  res.json(notificationsForUser(req.user).map(serializeNotification));
});

router.get('/unread-count', requireRole(), (req, res) => {
  res.json({ count: notificationsForUser(req.user).filter((n) => !n.read).length });
});

/** Faculty admin oversight: every notification ever created, not just ones addressed to faculty. */
router.get('/all', requireRole('faculty'), (req, res) => {
  const rows = db.prepare('SELECT * FROM notifications ORDER BY date DESC').all();
  res.json(rows.map(serializeNotification));
});

router.post('/', requireRole('faculty'), (req, res) => {
  const d = req.body || {};
  createNotification({ title: d.title, message: d.message, type: d.type, recipient: d.recipient });
  logActivity(`Notification "${d.title}" sent to ${d.recipient}`);
  res.status(201).json({ ok: true });
});

router.put('/:id/read', requireRole(), (req, res) => {
  const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const read = (req.body || {}).read !== false;
  db.prepare('UPDATE notifications SET read = ? WHERE id = ?').run(read ? 1 : 0, row.id);
  res.json(serializeNotification(db.prepare('SELECT * FROM notifications WHERE id = ?').get(row.id)));
});

router.put('/:id', requireRole('faculty'), (req, res) => {
  const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const d = req.body || {};
  db.prepare('UPDATE notifications SET title=?, message=?, type=? WHERE id=?')
    .run(d.title ?? row.title, d.message ?? row.message, d.type ?? row.type, row.id);
  res.json(serializeNotification(db.prepare('SELECT * FROM notifications WHERE id = ?').get(row.id)));
});

router.delete('/:id', requireRole('faculty'), (req, res) => {
  const row = db.prepare('SELECT * FROM notifications WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM notifications WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

module.exports = router;
