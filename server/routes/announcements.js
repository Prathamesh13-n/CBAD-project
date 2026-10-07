/* ============================================================
   CDAD server :: routes/announcements.js
   Ports js/announcements.js. `author` is the faculty's display
   name (free text, same as the original seed data) — not an ID.
   ============================================================ */
const express = require('express');
const { db, logActivity } = require('../db');
const { serializeAnnouncement } = require('../serializers');
const { requireRole } = require('../sessions');
const { createNotification } = require('../notify');

const router = express.Router();

router.get('/', requireRole(), (req, res) => {
  res.json(db.prepare('SELECT * FROM announcements ORDER BY date DESC').all().map(serializeAnnouncement));
});

router.post('/', requireRole('faculty'), (req, res) => {
  const { title, message, author, priority } = req.body || {};
  const date = new Date().toISOString();
  const info = db.prepare(`
    INSERT INTO announcements (title, message, author, date, priority, status) VALUES (?, ?, ?, ?, ?, 'Active')
  `).run(title, message, author || '', date, priority || 'Normal');
  createNotification({ title: `Announcement: ${title}`, message, type: 'announcement', recipient: 'all-students' });
  logActivity(`Announcement "${title}" created`);
  res.status(201).json(serializeAnnouncement(db.prepare('SELECT * FROM announcements WHERE id = ?').get(info.lastInsertRowid)));
});

router.put('/:id', requireRole('faculty'), (req, res) => {
  const row = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const d = req.body || {};
  db.prepare('UPDATE announcements SET title=?, message=?, priority=?, status=? WHERE id=?')
    .run(d.title ?? row.title, d.message ?? row.message, d.priority ?? row.priority, d.status ?? row.status, row.id);
  logActivity(`Announcement "${row.title}" updated`);
  res.json(serializeAnnouncement(db.prepare('SELECT * FROM announcements WHERE id = ?').get(row.id)));
});

router.delete('/:id', requireRole('faculty'), (req, res) => {
  const row = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM announcements WHERE id = ?').run(row.id);
  logActivity(`Announcement "${row.title}" deleted`);
  res.json({ ok: true });
});

module.exports = router;
