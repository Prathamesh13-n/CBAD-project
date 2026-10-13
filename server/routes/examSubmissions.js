/* ============================================================
   CDAD server :: routes/examSubmissions.js
   Per-exam submissions (TA1, TA2, EndSem): one record per group per
   exam, holding a link and/or an uploaded file (PPT, doc, ...).
   ============================================================ */
const express = require('express');
const path = require('node:path');
const { db, logActivity } = require('../db');
const { requireRole } = require('../sessions');
const { upload, UPLOAD_DIR, deleteUploadedFile } = require('../upload');
const { createNotification } = require('../notify');

const router = express.Router();
const EXAMS = ['TA1', 'TA2', 'EndSem'];

const MAX_FILES = 5;

function filesOf(submissionId) {
  return db.prepare('SELECT * FROM exam_submission_files WHERE submission_id = ? ORDER BY id').all(submissionId)
    .map((f) => ({ id: f.id, name: f.file_name, type: f.file_type, size: f.file_size }));
}

function serialize(row) {
  const group = db.prepare('SELECT display_id, name FROM student_groups WHERE id = ?').get(row.group_id);
  const by = row.submitted_by_id ? db.prepare('SELECT display_id, name FROM students WHERE id = ?').get(row.submitted_by_id) : null;
  return {
    id: row.id, exam: row.exam,
    group: group ? group.display_id : '', groupName: group ? group.name : '',
    link: row.link, note: row.note,
    submittedBy: by ? by.display_id : '', submittedByName: by ? by.name : '',
    submittedAt: row.submitted_at,
    files: filesOf(row.id)
  };
}

router.get('/', requireRole(), (req, res) => {
  let rows;
  if (req.user.type === 'faculty' || req.user.type === 'admin') {
    rows = db.prepare('SELECT * FROM exam_submissions ORDER BY submitted_at DESC').all();
  } else {
    const me = db.prepare('SELECT group_id FROM students WHERE id = ?').get(req.user.id);
    rows = me?.group_id ? db.prepare('SELECT * FROM exam_submissions WHERE group_id = ?').all(me.group_id) : [];
  }
  res.json({ exams: EXAMS, deadlines: deadlineMap(), submissions: rows.map(serialize) });
});

/** { TA1: '2026-10-20T12:00:00.000Z', ... } — exams without a deadline are absent. */
function deadlineMap() {
  return Object.fromEntries(db.prepare('SELECT exam, deadline FROM exam_deadlines').all().map((r) => [r.exam, r.deadline]));
}

function deadlinePassed(exam) {
  const d = db.prepare('SELECT deadline FROM exam_deadlines WHERE exam = ?').get(exam);
  return !!d && Date.now() > new Date(d.deadline).getTime();
}

/** Faculty sets (ISO date-time) or clears (empty) the submission deadline for an exam. */
router.put('/deadlines/:exam', requireRole('faculty'), (req, res) => {
  if (!EXAMS.includes(req.params.exam)) return res.status(400).json({ error: 'Unknown exam.' });
  const raw = (req.body && req.body.deadline) || '';
  if (!raw) {
    db.prepare('DELETE FROM exam_deadlines WHERE exam = ?').run(req.params.exam);
    logActivity(`${req.params.exam} submission deadline cleared`);
    return res.json({ exam: req.params.exam, deadline: null });
  }
  const t = new Date(raw);
  if (Number.isNaN(t.getTime())) return res.status(400).json({ error: 'Invalid date.' });
  db.prepare('INSERT INTO exam_deadlines (exam, deadline) VALUES (?, ?) ON CONFLICT(exam) DO UPDATE SET deadline = excluded.deadline')
    .run(req.params.exam, t.toISOString());
  createNotification({
    title: `${req.params.exam} Submission Deadline`,
    message: `Submissions for ${req.params.exam} close on ${t.toUTCString()}.`,
    type: 'announcement', recipient: 'all-students'
  });
  logActivity(`${req.params.exam} submission deadline set to ${t.toISOString()}`);
  res.json({ exam: req.params.exam, deadline: t.toISOString() });
});

/** Only the group's team leader may submit — runs before multer so a rejected
    request never writes a file to disk. */
function requireLeaderOfOwnGroup(req, res, next) {
  if (!EXAMS.includes(req.params.exam)) return res.status(400).json({ error: 'Unknown exam.' });
  const me = db.prepare('SELECT group_id FROM students WHERE id = ?').get(req.user.id);
  const group = me?.group_id ? db.prepare('SELECT * FROM student_groups WHERE id = ?').get(me.group_id) : null;
  if (deadlinePassed(req.params.exam)) {
    return res.status(403).json({ error: `The deadline for ${req.params.exam} has passed — submissions are closed.` });
  }
  if (!group) return res.status(403).json({ error: 'You are not in a group.' });
  if (group.team_leader_id !== req.user.id) return res.status(403).json({ error: "Only your group's team leader can submit." });
  req.group = group;
  next();
}

/** multipart: `link`, `note`, up to 5 `files`, and optional `removeFileIds` (JSON array
    of existing file ids to drop). Existing files are kept unless removed; the total
    after the change may not exceed ${MAX_FILES}. */
router.post('/:exam', requireRole('student'), requireLeaderOfOwnGroup, upload.array('files', MAX_FILES), (req, res) => {
  const { link, note } = req.body || {};
  const newFiles = req.files || [];
  const discardNew = () => newFiles.forEach((f) => deleteUploadedFile(f.filename));

  const existing = db.prepare('SELECT * FROM exam_submissions WHERE group_id = ? AND exam = ?').get(req.group.id, req.params.exam);
  let removeIds = [];
  try { removeIds = JSON.parse(req.body.removeFileIds || '[]').map(Number); } catch { /* ignore bad input */ }
  const oldFiles = existing ? db.prepare('SELECT * FROM exam_submission_files WHERE submission_id = ?').all(existing.id) : [];
  const toRemove = oldFiles.filter((f) => removeIds.includes(f.id));
  const kept = oldFiles.length - toRemove.length;

  if (kept + newFiles.length > MAX_FILES) {
    discardNew();
    return res.status(400).json({ error: `You can attach at most ${MAX_FILES} files (you already have ${kept}).` });
  }
  if (!link && kept + newFiles.length === 0) {
    discardNew();
    return res.status(400).json({ error: 'Provide a link or attach at least one file.' });
  }

  db.prepare(`
    INSERT INTO exam_submissions (group_id, exam, link, note, submitted_by_id, submitted_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(group_id, exam) DO UPDATE SET link=excluded.link, note=excluded.note,
      submitted_by_id=excluded.submitted_by_id, submitted_at=excluded.submitted_at
  `).run(req.group.id, req.params.exam, link || '', note || '', req.user.id, new Date().toISOString());
  const row = db.prepare('SELECT * FROM exam_submissions WHERE group_id = ? AND exam = ?').get(req.group.id, req.params.exam);

  for (const f of toRemove) {
    deleteUploadedFile(f.file_path);
    db.prepare('DELETE FROM exam_submission_files WHERE id = ?').run(f.id);
  }
  const ins = db.prepare('INSERT INTO exam_submission_files (submission_id, file_name, file_path, file_type, file_size) VALUES (?, ?, ?, ?, ?)');
  for (const f of newFiles) ins.run(row.id, f.originalname, f.filename, path.extname(f.originalname).slice(1).toLowerCase(), f.size);

  createNotification({
    title: `${req.params.exam} Submission`,
    message: `${req.user.displayId} submitted ${req.params.exam} work for group ${req.group.display_id}.`,
    type: 'request', recipient: 'all-faculty'
  });
  logActivity(`${req.user.displayId} submitted ${req.params.exam} for ${req.group.display_id}`);
  res.json(serialize(row));
});

router.get('/files/:fileId', requireRole(), (req, res) => {
  const f = db.prepare(`
    SELECT f.*, s.group_id FROM exam_submission_files f JOIN exam_submissions s ON s.id = f.submission_id WHERE f.id = ?
  `).get(req.params.fileId);
  if (!f) return res.status(404).json({ error: 'File not found.' });
  if (req.user.type === 'student') {
    const me = db.prepare('SELECT group_id FROM students WHERE id = ?').get(req.user.id);
    if (!me || me.group_id !== f.group_id) return res.status(403).json({ error: 'Forbidden' });
  }
  if (req.query.inline === '1') {
    // View in the browser instead of downloading. Only types a browser/preview can show.
    const types = { pdf: 'application/pdf', csv: 'text/plain; charset=utf-8', docx: 'application/octet-stream' };
    const type = types[(f.file_type || '').toLowerCase()];
    if (!type) return res.status(415).json({ error: 'This file type cannot be previewed. Download it instead.' });
    res.setHeader('Content-Type', type);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.sendFile(path.join(UPLOAD_DIR, f.file_path));
  }
  res.download(path.join(UPLOAD_DIR, f.file_path), f.file_name);
});

router.delete('/:id', requireRole('faculty'), (req, res) => {
  const row = db.prepare('SELECT * FROM exam_submissions WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.prepare('SELECT file_path FROM exam_submission_files WHERE submission_id = ?').all(row.id).forEach((f) => deleteUploadedFile(f.file_path));
  db.prepare('DELETE FROM exam_submissions WHERE id = ?').run(row.id); // cascades to its file rows
  logActivity(`${row.exam} submission removed for group id ${row.group_id}`);
  res.json({ ok: true });
});

module.exports = router;
