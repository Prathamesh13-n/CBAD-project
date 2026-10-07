/* ============================================================
   CDAD :: projects.js
   Thin wrappers over /api/projects. Progress derivation, group
   progress mirroring, notification creation and activity logging
   all happen server-side now (see server/routes/projects.js).
   ============================================================ */

async function allProjects() {
  return getData(CDAD_KEYS.PROJECTS);
}

async function getProject(displayId) {
  const projects = await allProjects();
  return projects.find((p) => p.displayId === displayId) || null;
}

async function projectForGroup(groupDisplayId) {
  const projects = await allProjects();
  return projects.find((p) => p.group === groupDisplayId) || null;
}

/** Faculty Submissions Hub: every project with a submission attached, newest first. */
async function allSubmissions() {
  const res = await fetch('/api/projects/submissions', { credentials: 'include' });
  if (!res.ok) return [];
  return res.json();
}

async function createProject(data) {
  return addData(CDAD_KEYS.PROJECTS, data);
}

async function editProject(id, updates) {
  return updateData(CDAD_KEYS.PROJECTS, id, updates);
}

async function deleteProject(id) {
  return deleteData(CDAD_KEYS.PROJECTS, id);
}

/** Update one stage's status, recompute overall progress, and cascade to the group. */
async function setProjectStage(projectId, stageName, status) {
  const res = await fetch(`/api/projects/${projectId}/stages/${encodeURIComponent(stageName)}`, {
    method: 'PUT', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status })
  });
  return res.ok ? res.json() : null;
}

async function assignProjectToGroup(projectId, groupDisplayId) {
  const res = await fetch(`/api/projects/${projectId}/group`, {
    method: 'PUT', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupDisplayId })
  });
  return res.ok ? res.json() : null;
}

/* ================= Submission workflow ================= */

/** Student submits (or resubmits) their work for a project. submittedBy is implicit (the logged-in session). */
async function submitProjectWork(projectId, { link, note }) {
  const res = await fetch(`/api/projects/${projectId}/submission`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ link, note })
  });
  return res.ok ? res.json() : null;
}

/** Faculty asks a group to submit their project, with an optional custom message. */
async function requestSubmission(projectId, message) {
  const res = await fetch(`/api/projects/${projectId}/submission/request`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message })
  });
  return res.ok ? res.json() : null;
}

/** Faculty approves or rejects a pending submission. */
async function reviewProjectSubmission(projectId, decision, facultyNote) {
  const res = await fetch(`/api/projects/${projectId}/submission/review`, {
    method: 'PUT', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, facultyNote })
  });
  return res.ok ? res.json() : null;
}
