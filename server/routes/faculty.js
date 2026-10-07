/* ============================================================
   CDAD server :: routes/faculty.js
   Only a self-profile-update endpoint — faculty.js:1271 is the only
   place the frontend writes to the faculty collection (login lives
   in routes/auth.js instead).
   ============================================================ */
const express = require('express');
const bcrypt = require('bcryptjs');
const { db, logActivity } = require('../db');
const { serializeFaculty } = require('../serializers');
const { requireRole } = require('../sessions');

const router = express.Router();

router.put('/:id', requireRole('faculty'), (req, res) => {
  if (req.user.id !== Number(req.params.id)) return res.status(403).json({ error: 'Forbidden' });
  const row = db.prepare('SELECT * FROM faculty WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const f = req.body || {};
  const passwordHash = f.password ? bcrypt.hashSync(f.password, 10) : row.password_hash;
  db.prepare(`
    UPDATE faculty SET name=?, email=?, phone=?, department=?, designation=?, avatar=?, password_hash=?
    WHERE id=?
  `).run(
    f.name !== undefined ? f.name : row.name,
    f.email !== undefined ? f.email : row.email,
    f.phone !== undefined ? f.phone : row.phone,
    f.department !== undefined ? f.department : row.department,
    f.designation !== undefined ? f.designation : row.designation,
    f.avatar !== undefined ? f.avatar : row.avatar,
    passwordHash, row.id
  );
  logActivity(`Faculty ${row.display_id} updated profile`);
  res.json(serializeFaculty(db.prepare('SELECT * FROM faculty WHERE id = ?').get(row.id)));
});

module.exports = router;
