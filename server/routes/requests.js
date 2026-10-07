/* ============================================================
   CDAD server :: routes/requests.js
   Ports the "faculty-facing academic requests" half of js/requests.js.
   (Peer connection requests live in routes/peerRequests.js.)
   ============================================================ */
const express = require('express');
const { db, nextSequentialId, logActivity } = require('../db');
const { serializeRequest, groupIdByDisplayId, studentDisplayId } = require('../serializers');
const { requireRole } = require('../sessions');
const { createNotification } = require('../notify');

const router = express.Router();

function getRow(id) { return db.prepare('SELECT * FROM requests WHERE id = ?').get(id); }

router.get('/', requireRole(), (req, res) => {
  res.json(db.prepare('SELECT * FROM requests').all().map(serializeRequest));
});

router.post('/', requireRole('student'), (req, res) => {
  const d = req.body || {};
  const displayId = nextSequentialId('requests', 'REQ', 3);
  const groupId = d.group ? groupIdByDisplayId(d.group) : null;
  const info = db.prepare(`
    INSERT INTO requests (display_id, student_id, type, group_id, message, date, status, response)
    VALUES (?, ?, ?, ?, ?, ?, 'Pending', '')
  `).run(displayId, req.user.id, d.type, groupId, d.message || '', new Date().toISOString());
  createNotification({
    title: 'New Request Submitted',
    message: `${req.user.displayId} submitted a "${d.type}" request.`,
    type: 'request', recipient: 'all-faculty'
  });
  logActivity(`Request ${displayId} (${d.type}) submitted by ${req.user.displayId}`);
  res.status(201).json(serializeRequest(getRow(info.lastInsertRowid)));
});

router.put('/:id', requireRole('faculty'), (req, res) => {
  const row = getRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const d = req.body || {};
  const groupId = d.group !== undefined ? (d.group ? groupIdByDisplayId(d.group) : null) : row.group_id;
  db.prepare('UPDATE requests SET type=?, group_id=?, message=?, status=?, response=? WHERE id=?')
    .run(d.type ?? row.type, groupId, d.message ?? row.message, d.status ?? row.status, d.response ?? row.response, row.id);
  logActivity(`Request ${row.display_id} updated`);
  res.json(serializeRequest(getRow(row.id)));
});

router.put('/:id/respond', requireRole('faculty'), (req, res) => {
  const row = getRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const { status, response } = req.body || {};
  db.prepare('UPDATE requests SET status=?, response=? WHERE id=?').run(status, response || '', row.id);
  createNotification({
    title: `Request ${status}`,
    message: `Your "${row.type}" request has been ${status.toLowerCase()}.${response ? ' Note: ' + response : ''}`,
    type: 'request', recipient: studentDisplayId(row.student_id)
  });
  logActivity(`Request ${row.display_id} ${status.toLowerCase()}`);
  res.json(serializeRequest(getRow(row.id)));
});

router.delete('/:id', requireRole('faculty'), (req, res) => {
  const row = getRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM requests WHERE id=?').run(row.id);
  logActivity(`Request ${row.display_id} deleted`);
  res.json({ ok: true });
});

module.exports = router;
