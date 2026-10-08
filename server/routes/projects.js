/* ============================================================
   CDAD server :: routes/projects.js
   Ports js/projects.js. group.progress is no longer a stored
   mirror (syncGroupProgressFromProject is gone) — groups.js's
   serializeGroup reads progress straight off the linked project
   at request time, so it can't desync.
   ============================================================ */
const path = require('node:path');
const express = require('express');
const { db, nextSequentialId, computeProgressFromStages, PROJECT_STAGES, logActivity } = require('../db');
const { serializeProject, groupIdByDisplayId, groupDisplayId, studentDisplayId } = require('../serializers');
const { requireRole } = require('../sessions');
const { createNotification } = require('../notify');
const { upload, UPLOAD_DIR, deleteUploadedFile } = require('../upload');

const router = express.Router();

function getRow(id) { return db.prepare('SELECT * FROM projects WHERE id = ?').get(id); }

router.get('/', requireRole(), (req, res) => {
  res.json(db.prepare('SELECT * FROM projects').all().map(serializeProject));
});

/** Faculty Submissions Hub: every project with a submission attached, newest first. */
router.get('/submissions', requireRole('faculty'), (req, res) => {
  const rows = db.prepare(`
    SELECT p.* FROM projects p JOIN submissions s ON s.project_id = p.id ORDER BY s.submitted_at DESC
  `).all();
  res.json(rows.map(serializeProject));
});

router.post('/', requireRole(), (req, res) => {
  const d = req.body || {};
  const displayId = nextSequentialId('projects', 'P', 2);
  const stages = d.stages || Object.fromEntries(PROJECT_STAGES.map((s) => [s, 'Pending']));
  const progress = computeProgressFromStages(stages);
  const groupId = d.group ? groupIdByDisplayId(d.group) : null;
  const info = db.prepare(`
    INSERT INTO projects (display_id, title, description, tech_stack, group_id, team_leader_display_id,
      start_date, deadline, progress, status, github_url, repo_name, branch, stages)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(displayId, d.title, d.description || '', d.techStack || '', groupId, d.teamLeader || '',
    d.startDate || new Date().toISOString(), d.deadline || '', progress, d.status || 'Active',
    d.githubUrl || '', d.repoName || '', d.branch || 'main', JSON.stringify(stages));
  logActivity(`Project ${displayId} created`);
  res.status(201).json(serializeProject(getRow(info.lastInsertRowid)));
});

router.put('/:id', requireRole(), (req, res) => {
  const row = getRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const d = req.body || {};
  const stages = d.stages !== undefined ? d.stages : JSON.parse(row.stages);
  const progress = d.stages !== undefined ? computeProgressFromStages(stages) : row.progress;
  const groupId = d.group !== undefined ? (d.group ? groupIdByDisplayId(d.group) : null) : row.group_id;
  db.prepare(`
    UPDATE projects SET title=?, description=?, tech_stack=?, group_id=?, team_leader_display_id=?,
      start_date=?, deadline=?, progress=?, status=?, github_url=?, repo_name=?, branch=?, stages=?
    WHERE id=?
  `).run(
    d.title !== undefined ? d.title : row.title,
    d.description !== undefined ? d.description : row.description,
    d.techStack !== undefined ? d.techStack : row.tech_stack,
    groupId,
    d.teamLeader !== undefined ? d.teamLeader : row.team_leader_display_id,
    d.startDate !== undefined ? d.startDate : row.start_date,
    d.deadline !== undefined ? d.deadline : row.deadline,
    progress,
    d.status !== undefined ? d.status : row.status,
    d.githubUrl !== undefined ? d.githubUrl : row.github_url,
    d.repoName !== undefined ? d.repoName : row.repo_name,
    d.branch !== undefined ? d.branch : row.branch,
    JSON.stringify(stages),
    row.id
  );
  logActivity(`Project ${row.display_id} updated`);
  res.json(serializeProject(getRow(row.id)));
});

router.delete('/:id', requireRole('faculty'), (req, res) => {
  const row = getRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const sub = db.prepare('SELECT file_path FROM submissions WHERE project_id = ?').get(row.id);
  if (sub) deleteUploadedFile(sub.file_path);
  db.prepare('DELETE FROM projects WHERE id = ?').run(row.id);
  logActivity(`Project ${row.display_id} deleted`);
  res.json({ ok: true });
});

router.put('/:id/stages/:stageName', requireRole(), (req, res) => {
  const row = getRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const stages = Object.assign({}, JSON.parse(row.stages), { [req.params.stageName]: req.body.status });
  const progress = computeProgressFromStages(stages);
  const newStatus = progress === 100 ? 'Completed' : (row.status === 'Completed' ? 'Active' : row.status);
  db.prepare('UPDATE projects SET stages=?, progress=?, status=? WHERE id=?')
    .run(JSON.stringify(stages), progress, newStatus, row.id);
  logActivity(`Stage "${req.params.stageName}" of project ${row.display_id} set to ${req.body.status}`);
  res.json(serializeProject(getRow(row.id)));
});

router.put('/:id/group', requireRole('faculty'), (req, res) => {
  const row = getRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const groupId = groupIdByDisplayId(req.body.groupDisplayId);
  db.prepare('UPDATE projects SET group_id = ? WHERE id = ?').run(groupId, row.id);
  logActivity(`Project ${row.display_id} assigned to group ${req.body.groupDisplayId}`);
  res.json(serializeProject(getRow(row.id)));
});

/* ================= Submission workflow ================= */

/** Submission accepts multipart/form-data: `link`, `note` (both optional)
    plus an optional `file` (PDF/PPT/PPTX/CSV/DOC/DOCX, max 10MB) — see
    server/upload.js. At least one of link or file (new or already on
    record) is required; a resubmission that omits a new file keeps
    whatever file was already attached. */
router.post('/:id/submission', requireRole('student'), upload.single('file'), (req, res) => {
  const row = getRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const { link, note } = req.body || {};

  const existing = db.prepare('SELECT * FROM submissions WHERE project_id = ?').get(row.id);
  const hasFile = !!req.file || (existing && !!existing.file_path);
  if (!link && !hasFile) {
    return res.status(400).json({ error: 'Provide a link or attach a file.' });
  }

  if (req.file && existing && existing.file_path) deleteUploadedFile(existing.file_path);

  const fileName = req.file ? req.file.originalname : (existing ? existing.file_name : null);
  const filePath = req.file ? req.file.filename : (existing ? existing.file_path : null);
  const fileType = req.file ? path.extname(req.file.originalname).slice(1).toLowerCase() : (existing ? existing.file_type : null);
  const fileSize = req.file ? req.file.size : (existing ? existing.file_size : null);

  db.prepare(`
    INSERT INTO submissions (project_id, link, note, submitted_by_id, submitted_at, status, faculty_note, reviewed_at,
      file_name, file_path, file_type, file_size)
    VALUES (?, ?, ?, ?, ?, 'Pending Review', '', '', ?, ?, ?, ?)
    ON CONFLICT(project_id) DO UPDATE SET link=excluded.link, note=excluded.note,
      submitted_by_id=excluded.submitted_by_id, submitted_at=excluded.submitted_at,
      status='Pending Review', faculty_note='', reviewed_at='',
      file_name=excluded.file_name, file_path=excluded.file_path, file_type=excluded.file_type, file_size=excluded.file_size
  `).run(row.id, link || '', note || '', req.user.id, new Date().toISOString(), fileName, filePath, fileType, fileSize);

  const stages = Object.assign({}, JSON.parse(row.stages), { Submission: 'In Progress' });
  const progress = computeProgressFromStages(stages);
  db.prepare('UPDATE projects SET stages=?, progress=? WHERE id=?').run(JSON.stringify(stages), progress, row.id);

  createNotification({
    title: 'New Project Submission',
    message: `${req.user.displayId} submitted work for project ${row.display_id} (${row.title}) — awaiting review.`,
    type: 'request', recipient: 'all-faculty'
  });
  logActivity(`${req.user.displayId} submitted work for project ${row.display_id}`);
  res.json(serializeProject(getRow(row.id)));
});

router.post('/:id/submission/request', requireRole('faculty'), (req, res) => {
  const row = getRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const message = (req.body || {}).message;
  const groupDispId = groupDisplayId(row.group_id);
  createNotification({
    title: 'Submission Requested',
    message: message && message.trim() ? message.trim()
      : `Faculty has requested your final submission for ${row.title} (${row.display_id}). Please submit as soon as your work is ready.`,
    type: 'request', recipient: groupDispId || 'all-students'
  });
  logActivity(`Submission requested from group ${groupDispId} for project ${row.display_id}`);
  res.json(serializeProject(getRow(row.id)));
});

router.put('/:id/submission/review', requireRole('faculty'), (req, res) => {
  const row = getRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const sub = db.prepare('SELECT * FROM submissions WHERE project_id = ?').get(row.id);
  if (!sub) return res.status(404).json({ error: 'No submission to review' });
  const { decision, facultyNote } = req.body || {}; // 'Approved' | 'Rejected'

  db.prepare('UPDATE submissions SET status=?, faculty_note=?, reviewed_at=? WHERE project_id=?')
    .run(decision, facultyNote || '', new Date().toISOString(), row.id);

  const stageStatus = decision === 'Approved' ? 'Completed' : 'Pending';
  const stages = Object.assign({}, JSON.parse(row.stages), { Submission: stageStatus });
  const progress = computeProgressFromStages(stages);
  const newStatus = progress === 100 ? 'Completed' : (row.status === 'Completed' ? 'Active' : row.status);
  db.prepare('UPDATE projects SET stages=?, progress=?, status=? WHERE id=?')
    .run(JSON.stringify(stages), progress, newStatus, row.id);

  const recipient = studentDisplayId(sub.submitted_by_id) || groupDisplayId(row.group_id);
  createNotification({
    title: `Submission ${decision}`,
    message: decision === 'Approved'
      ? `Your submission for ${row.title} (${row.display_id}) was approved.`
      : `Your submission for ${row.title} (${row.display_id}) was rejected.${facultyNote ? ' Note: ' + facultyNote : ' Please review and resubmit.'}`,
    type: 'request', recipient
  });
  logActivity(`Submission for project ${row.display_id} ${decision.toLowerCase()}`);
  res.json(serializeProject(getRow(row.id)));
});

/** Streams the attached submission file as a download — faculty reviewing it,
    or the submitting group checking their own upload. */
router.get('/:id/submission/file', requireRole(), (req, res) => {
  const row = getRow(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const sub = db.prepare('SELECT file_name, file_path FROM submissions WHERE project_id = ?').get(row.id);
  if (!sub || !sub.file_path) return res.status(404).json({ error: 'No file attached to this submission.' });
  res.download(path.join(UPLOAD_DIR, sub.file_path), sub.file_name);
});

module.exports = router;
