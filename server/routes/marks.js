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
  // Students only receive marks for themselves and their own group's members.
  if (req.user.type === 'student') {
    const me = db.prepare('SELECT group_id FROM students WHERE id = ?').get(req.user.id);
    const rows = db.prepare(`
      SELECT m.* FROM marks m JOIN students s ON s.id = m.student_id
      WHERE m.released = 1 AND (s.id = ? OR (? IS NOT NULL AND s.group_id = ?))
    `).all(req.user.id, me?.group_id ?? null, me?.group_id ?? null);
    return res.json(rows.map(serializeMarks));
  }
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

// Apply one set of marks to every member of a group. Only the fields sent are overwritten.
router.put('/group/:groupDisplayId', requireRole('faculty'), (req, res) => {
  const group = db.prepare('SELECT id FROM student_groups WHERE display_id = ?').get(req.params.groupDisplayId);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  const members = db.prepare('SELECT id FROM students WHERE group_id = ?').all(group.id);
  if (!members.length) return res.status(400).json({ error: 'Group has no members' });
  const f = req.body || {};
  const upsert = db.prepare(`
    INSERT INTO marks (student_id, internal, project, presentation, viva) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(student_id) DO UPDATE SET
      internal = COALESCE(?, internal), project = COALESCE(?, project),
      presentation = COALESCE(?, presentation), viva = COALESCE(?, viva)
  `);
  const val = (k) => (f[k] === undefined || f[k] === null || f[k] === '' ? null : Number(f[k]) || 0);
  const [i, p, pr, v] = ['internal', 'project', 'presentation', 'viva'].map(val);
  db.exec('BEGIN');
  try {
    for (const m of members) upsert.run(m.id, i ?? 0, p ?? 0, pr ?? 0, v ?? 0, i, p, pr, v);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  logActivity(`Group marks applied to ${req.params.groupDisplayId} (${members.length} members)`);
  res.json({ ok: true, updated: members.length });
});

// Release (or withdraw) marks for every student that has a marks record.
router.post('/release-all', requireRole('faculty'), (req, res) => {
  const released = req.body?.released === false ? 0 : 1;
  const info = db.prepare('UPDATE marks SET released = ?').run(released);
  logActivity(`Marks ${released ? 'released' : 'withdrawn'} for all students (${info.changes})`);
  res.json({ ok: true, released: !!released, updated: Number(info.changes) });
});

router.post('/:id/release', requireRole('faculty'), (req, res) => {
  const row = db.prepare('SELECT * FROM marks WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const released = req.body?.released === undefined ? (row.released ? 0 : 1) : (req.body.released ? 1 : 0);
  db.prepare('UPDATE marks SET released = ? WHERE id = ?').run(released, row.id);
  logActivity(`Marks ${released ? 'released' : 'withdrawn'} for student id ${row.student_id}`);
  res.json(serializeMarks(db.prepare('SELECT * FROM marks WHERE id = ?').get(row.id)));
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
