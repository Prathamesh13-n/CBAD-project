/* ============================================================
   CDAD server :: routes/presentations.js
   Ports js/presentations.js.
   ============================================================ */
const express = require('express');
const { db, nextSequentialId, logActivity } = require('../db');
const { serializePresentation, groupIdByDisplayId, groupDisplayId } = require('../serializers');
const { requireRole } = require('../sessions');
const { createNotification, facultyIdByDisplayId } = require('../notify');
const { formatDate } = require('../format');

const router = express.Router();

function getRow(id) { return db.prepare('SELECT * FROM presentations WHERE id = ?').get(id); }

router.get('/', requireRole(), (req, res) => {
  res.json(db.prepare('SELECT * FROM presentations').all().map(serializePresentation));
});

router.post('/', requireRole('faculty'), (req, res) => {
  const d = req.body || {};
  const displayId = nextSequentialId('presentations', 'PRE', 3);
  const groupId = groupIdByDisplayId(d.group);
  const explicitProject = d.project ? db.prepare('SELECT id FROM projects WHERE display_id = ?').get(d.project) : null;
  const groupProject = !explicitProject && groupId ? db.prepare('SELECT id FROM projects WHERE group_id = ?').get(groupId) : null;
  const projectId = explicitProject ? explicitProject.id : (groupProject ? groupProject.id : null);
  const facultyId = d.faculty ? facultyIdByDisplayId(d.faculty) : null;

  const info = db.prepare(`
    INSERT INTO presentations (display_id, group_id, project_id, date, time, venue, faculty_id, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(displayId, groupId, projectId, d.date, d.time, d.venue, facultyId, d.status || 'Scheduled', d.notes || '');

  createNotification({
    title: 'Presentation Scheduled',
    message: `A presentation for ${d.group} has been scheduled on ${formatDate(d.date)} at ${d.time}.`,
    type: 'presentation', recipient: d.group
  });
  logActivity(`Presentation ${displayId} scheduled for group ${d.group}`);
  res.status(201).json(serializePresentation(getRow(info.lastInsertRowid)));
});

router.put('/:id', requireRole('faculty'), (req, res) => {
  const row = getRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const d = req.body || {};
  const groupId = d.group !== undefined ? groupIdByDisplayId(d.group) : row.group_id;
  const facultyId = d.faculty !== undefined ? (d.faculty ? facultyIdByDisplayId(d.faculty) : null) : row.faculty_id;
  db.prepare(`
    UPDATE presentations SET group_id=?, date=?, time=?, venue=?, faculty_id=?, status=?, notes=?
    WHERE id=?
  `).run(groupId, d.date ?? row.date, d.time ?? row.time, d.venue ?? row.venue, facultyId,
    d.status ?? row.status, d.notes ?? row.notes, row.id);
  logActivity(`Presentation ${row.display_id} updated`);
  res.json(serializePresentation(getRow(row.id)));
});

router.put('/:id/reschedule', requireRole('faculty'), (req, res) => {
  const row = getRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const { date, time } = req.body || {};
  db.prepare('UPDATE presentations SET date=?, time=?, status=? WHERE id=?').run(date, time, 'Rescheduled', row.id);
  const groupDispId = groupDisplayId(row.group_id);
  createNotification({
    title: 'Presentation Rescheduled',
    message: `Presentation for ${groupDispId} moved to ${formatDate(date)} at ${time}.`,
    type: 'presentation', recipient: groupDispId
  });
  logActivity(`Presentation ${row.display_id} rescheduled`);
  res.json(serializePresentation(getRow(row.id)));
});

router.put('/:id/cancel', requireRole('faculty'), (req, res) => {
  const row = getRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE presentations SET status=? WHERE id=?').run('Cancelled', row.id);
  logActivity(`Presentation ${row.display_id} cancelled`);
  res.json(serializePresentation(getRow(row.id)));
});

router.put('/:id/complete', requireRole('faculty'), (req, res) => {
  const row = getRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.prepare('UPDATE presentations SET status=? WHERE id=?').run('Completed', row.id);
  logActivity(`Presentation ${row.display_id} marked completed`);
  res.json(serializePresentation(getRow(row.id)));
});

router.delete('/:id', requireRole('faculty'), (req, res) => {
  const row = getRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM presentations WHERE id=?').run(row.id);
  logActivity(`Presentation ${row.display_id} deleted`);
  res.json({ ok: true });
});

module.exports = router;
