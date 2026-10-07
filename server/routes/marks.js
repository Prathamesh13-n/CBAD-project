/* ============================================================
   CDAD server :: routes/marks.js
   Ports js/marks.js. Total/percentage/grade stay derived
   client-side (deriveMarkTotals) — the server only stores raw fields.
   ============================================================ */
const express = require('express');
const { db, logActivity } = require('../db');
const { serializeMarks, studentIdByDisplayId } = require('../serializers');
const { requireRole } = require('../sessions');

const router = express.Router();

router.get('/', requireRole(), (req, res) => {
  res.json(db.prepare('SELECT * FROM marks').all().map(serializeMarks));
});

router.put('/student/:studentDisplayId', requireRole('faculty'), (req, res) => {
  const sid = studentIdByDisplayId(req.params.studentDisplayId);
  if (!sid) return res.status(404).json({ error: 'Student not found' });
  const f = req.body || {};
  const existing = db.prepare('SELECT * FROM marks WHERE student_id = ?').get(sid);

  if (existing) {
    db.prepare(`
      UPDATE marks SET internal=?, internal_max=?, project=?, project_max=?, presentation=?, presentation_max=?, viva=?, viva_max=?
      WHERE id=?
    `).run(
      f.internal ?? existing.internal, f.internalMax ?? existing.internal_max,
      f.project ?? existing.project, f.projectMax ?? existing.project_max,
      f.presentation ?? existing.presentation, f.presentationMax ?? existing.presentation_max,
      f.viva ?? existing.viva, f.vivaMax ?? existing.viva_max, existing.id
    );
    logActivity(`Marks updated for ${req.params.studentDisplayId}`);
    return res.json(serializeMarks(db.prepare('SELECT * FROM marks WHERE id = ?').get(existing.id)));
  }

  const info = db.prepare(`
    INSERT INTO marks (student_id, internal, internal_max, project, project_max, presentation, presentation_max, viva, viva_max)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(sid, f.internal ?? 0, f.internalMax ?? 20, f.project ?? 0, f.projectMax ?? 40,
    f.presentation ?? 0, f.presentationMax ?? 20, f.viva ?? 0, f.vivaMax ?? 10);
  logActivity(`Marks added for ${req.params.studentDisplayId}`);
  res.status(201).json(serializeMarks(db.prepare('SELECT * FROM marks WHERE id = ?').get(info.lastInsertRowid)));
});

router.delete('/:id', requireRole('faculty'), (req, res) => {
  const row = db.prepare('SELECT * FROM marks WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM marks WHERE id = ?').run(row.id);
  logActivity(`Marks deleted for student id ${row.student_id}`);
  res.json({ ok: true });
});

router.post('/:id/reset', requireRole('faculty'), (req, res) => {
  const row = db.prepare('SELECT * FROM marks WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE marks SET internal=0, project=0, presentation=0, viva=0 WHERE id=?').run(row.id);
  logActivity(`Marks reset for student id ${row.student_id}`);
  res.json(serializeMarks(db.prepare('SELECT * FROM marks WHERE id = ?').get(row.id)));
});

module.exports = router;
