/* ============================================================
   CDAD server :: routes/students.js
   Students edit their own name/email/phone/avatar; faculty can
   edit everything (matches the README's stated permission split).
   ============================================================ */
const express = require('express');
const bcrypt = require('bcryptjs');
const { db, nextSequentialId, logActivity } = require('../db');
const { serializeStudent, groupIdByDisplayId } = require('../serializers');
const { requireRole } = require('../sessions');

const router = express.Router();

router.get('/', requireRole(), (req, res) => {
  res.json(db.prepare('SELECT * FROM students').all().map(serializeStudent));
});

router.post('/', requireRole('faculty'), (req, res) => {
  const f = req.body || {};
  const displayId = (f.displayId || nextSequentialId('students', 'ST', 3)).trim();
  const passwordHash = bcrypt.hashSync(f.password || 'PASS123', 10);
  const groupId = f.group ? groupIdByDisplayId(f.group) : null;
  const info = db.prepare(`
    INSERT INTO students (display_id, name, email, password_hash, phone, course, year, department, group_id, role, status, avatar)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(displayId, f.name, f.email || '', passwordHash, f.phone || '', f.course || '', f.year || '',
    f.department || '', groupId, f.role || 'Member', f.status || 'Active', f.avatar || '');
  logActivity(`Student ${displayId} added`);
  res.status(201).json(serializeStudent(db.prepare('SELECT * FROM students WHERE id = ?').get(info.lastInsertRowid)));
});

router.put('/:id', requireRole(), (req, res) => {
  const row = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (req.user.type === 'student' && req.user.id !== row.id) return res.status(403).json({ error: 'Forbidden' });

  const f = req.body || {};
  const isFaculty = req.user.type === 'faculty';
  const fields = {
    name: f.name !== undefined ? f.name : row.name,
    email: f.email !== undefined ? f.email : row.email,
    phone: f.phone !== undefined ? f.phone : row.phone,
    avatar: f.avatar !== undefined ? f.avatar : row.avatar,
    course: isFaculty && f.course !== undefined ? f.course : row.course,
    year: isFaculty && f.year !== undefined ? f.year : row.year,
    department: isFaculty && f.department !== undefined ? f.department : row.department,
    role: isFaculty && f.role !== undefined ? f.role : row.role,
    status: isFaculty && f.status !== undefined ? f.status : row.status
  };
  const passwordHash = isFaculty && f.password ? bcrypt.hashSync(f.password, 10) : row.password_hash;

  db.prepare(`
    UPDATE students SET name=?, email=?, phone=?, avatar=?, course=?, year=?, department=?, role=?, status=?, password_hash=?
    WHERE id=?
  `).run(fields.name, fields.email, fields.phone, fields.avatar, fields.course, fields.year,
    fields.department, fields.role, fields.status, passwordHash, row.id);

  if (isFaculty && f.group !== undefined) {
    const newGroupId = f.group ? groupIdByDisplayId(f.group) : null;
    db.prepare('UPDATE students SET group_id = ? WHERE id = ?').run(newGroupId, row.id);
  }

  logActivity(`Student ${row.display_id} updated`);
  res.json(serializeStudent(db.prepare('SELECT * FROM students WHERE id = ?').get(row.id)));
});

router.delete('/:id', requireRole('faculty'), (req, res) => {
  const row = db.prepare('SELECT * FROM students WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM students WHERE id = ?').run(row.id);
  logActivity(`Student ${row.display_id} deleted`);
  res.json({ ok: true });
});

/** "Delete All" — clears a bad CSV import. Groups' team_leader_id/members fall out automatically. */
router.delete('/', requireRole('faculty'), (req, res) => {
  db.prepare('DELETE FROM students').run();
  logActivity('All students deleted');
  res.json({ ok: true });
});

module.exports = router;
