/* ============================================================
   CDAD server :: routes/groups.js
   Ports js/groups.js. Membership is now derived from
   students.group_id (a real FK) instead of a hand-synced
   members[] array, so there's no syncStudentsGroupField anymore.
   ============================================================ */
const express = require('express');
const { db, nextSequentialId, logActivity } = require('../db');
const { serializeGroup, studentIdByDisplayId } = require('../serializers');
const { requireRole } = require('../sessions');
const { addMember, removeMember, deleteGroup } = require('../groupOps');

const router = express.Router();

function getRow(id) { return db.prepare('SELECT * FROM student_groups WHERE id = ?').get(id); }

router.get('/', requireRole(), (req, res) => {
  res.json(db.prepare('SELECT * FROM student_groups').all().map(serializeGroup));
});

/** Both faculty and students can create a group (the creating student becomes leader). */
router.post('/', requireRole(), (req, res) => {
  const f = req.body || {};
  const displayId = nextSequentialId('student_groups', 'G', 2);
  const leaderId = f.teamLeader ? studentIdByDisplayId(f.teamLeader) : null;
  const info = db.prepare(`
    INSERT INTO student_groups (display_id, name, team_leader_id, status) VALUES (?, ?, ?, ?)
  `).run(displayId, f.name, leaderId, f.status || 'Active');
  const groupId = info.lastInsertRowid;
  if (leaderId) db.prepare('UPDATE students SET group_id = ? WHERE id = ?').run(groupId, leaderId);
  (f.members || []).forEach((memberDisplayId) => {
    const sid = studentIdByDisplayId(memberDisplayId);
    if (sid) db.prepare('UPDATE students SET group_id = ? WHERE id = ?').run(groupId, sid);
  });
  logActivity(`Group ${displayId} created`);
  res.status(201).json(serializeGroup(getRow(groupId)));
});

router.put('/:id', requireRole(), (req, res) => {
  const row = getRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const f = req.body || {};
  const leaderId = f.teamLeader !== undefined ? (f.teamLeader ? studentIdByDisplayId(f.teamLeader) : null) : row.team_leader_id;
  db.prepare('UPDATE student_groups SET name=?, team_leader_id=?, status=? WHERE id=?')
    .run(f.name !== undefined ? f.name : row.name, leaderId, f.status !== undefined ? f.status : row.status, row.id);

  if (f.members !== undefined) {
    const wantIds = new Set((f.members || []).map(studentIdByDisplayId).filter(Boolean));
    const current = db.prepare('SELECT id FROM students WHERE group_id = ?').all(row.id).map((r) => r.id);
    current.forEach((sid) => { if (!wantIds.has(sid)) db.prepare('UPDATE students SET group_id = NULL WHERE id = ?').run(sid); });
    wantIds.forEach((sid) => db.prepare('UPDATE students SET group_id = ? WHERE id = ?').run(row.id, sid));
  }

  logActivity(`Group ${row.display_id} updated`);
  res.json(serializeGroup(getRow(row.id)));
});

router.delete('/:id', requireRole('faculty'), (req, res) => {
  const ok = deleteGroup(Number(req.params.id));
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

router.post('/:id/members', requireRole(), (req, res) => {
  const group = getRow(req.params.id);
  const sid = studentIdByDisplayId((req.body || {}).studentDisplayId);
  if (!group || !sid) return res.status(404).json({ error: 'Not found' });
  addMember(group.id, sid);
  logActivity(`${req.body.studentDisplayId} added to group ${group.display_id}`);
  res.json(serializeGroup(getRow(group.id)));
});

router.delete('/:id/members/:studentId', requireRole(), (req, res) => {
  const group = getRow(req.params.id);
  if (!group) return res.status(404).json({ error: 'Not found' });
  removeMember(group.id, Number(req.params.studentId));
  logActivity(`Member removed from group ${group.display_id}`);
  res.json(serializeGroup(getRow(group.id)));
});

router.post('/:id/leave', requireRole('student'), (req, res) => {
  const group = getRow(req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found.' });
  const memberCount = db.prepare('SELECT COUNT(*) AS c FROM students WHERE group_id = ?').get(group.id).c;
  if (memberCount <= 1) {
    deleteGroup(group.id);
    logActivity(`${req.user.displayId} left and disbanded group ${group.display_id} (last member)`);
    return res.json({ ok: true, disbanded: true, groupDisplayId: group.display_id });
  }
  removeMember(group.id, req.user.id);
  logActivity(`${req.user.displayId} left group ${group.display_id}`);
  res.json({ ok: true, disbanded: false, groupDisplayId: group.display_id });
});

module.exports = router;
