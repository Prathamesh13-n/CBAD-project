/* ============================================================
   CDAD :: projects.js
   CRUD for projects, stage editing, progress auto-calculation,
   and propagation of progress to the owning group.
   ============================================================ */

function allProjects() {
  return getData(CDAD_KEYS.PROJECTS);
}

function getProject(displayId) {
  return allProjects().find((p) => p.displayId === displayId) || null;
}

function projectForGroup(groupDisplayId) {
  return allProjects().find((p) => p.group === groupDisplayId) || null;
}

function createProject(data) {
  const displayId = nextSequentialId(CDAD_KEYS.PROJECTS, 'P', 2);
  const stages = data.stages || Object.fromEntries(PROJECT_STAGES.map((s) => [s, 'Pending']));
  const project = {
    id: generateId('PRJ'),
    displayId,
    title: data.title,
    description: data.description || '',
    group: data.group || '',
    teamLeader: data.teamLeader || '',
    startDate: data.startDate || new Date().toISOString(),
    deadline: data.deadline || '',
    progress: computeProgressFromStages(stages),
    status: data.status || 'Active',
    githubUrl: data.githubUrl || '',
    repoName: data.repoName || '',
    branch: data.branch || 'main',
    stages
  };
  addData(CDAD_KEYS.PROJECTS, project);
  if (project.group) editGroup(getGroup(project.group)?.id, { project: displayId });
  syncGroupProgressFromProject(project);
  logActivity(`Project ${displayId} created`);
  return project;
}

function editProject(id, updates) {
  const updated = updateData(CDAD_KEYS.PROJECTS, id, updates);
  if (updated) {
    syncGroupProgressFromProject(updated);
    logActivity(`Project ${updated.displayId} updated`);
  }
  return updated;
}

function deleteProject(id) {
  const project = findData(CDAD_KEYS.PROJECTS, id);
  if (!project) return false;
  deleteData(CDAD_KEYS.PROJECTS, id);
  const group = getGroup(project.group);
  if (group) editGroup(group.id, { project: '', progress: 0 });
  logActivity(`Project ${project.displayId} deleted`);
  return true;
}

/** Update one stage's status, recompute overall progress, and cascade to the group. */
function setProjectStage(projectId, stageName, status) {
  const project = findData(CDAD_KEYS.PROJECTS, projectId);
  if (!project) return null;
  const stages = Object.assign({}, project.stages, { [stageName]: status });
  const progress = computeProgressFromStages(stages);
  const newStatus = progress === 100 ? 'Completed' : project.status === 'Completed' ? 'Active' : project.status;
  const updated = updateData(CDAD_KEYS.PROJECTS, projectId, { stages, progress, status: newStatus });
  syncGroupProgressFromProject(updated);
  logActivity(`Stage "${stageName}" of project ${updated.displayId} set to ${status}`);
  return updated;
}

function assignProjectToGroup(projectId, groupDisplayId) {
  const project = findData(CDAD_KEYS.PROJECTS, projectId);
  if (!project) return null;
  // clear old group's project pointer
  if (project.group) {
    const oldGroup = getGroup(project.group);
    if (oldGroup && oldGroup.displayId !== groupDisplayId) editGroup(oldGroup.id, { project: '' });
  }
  const updated = updateData(CDAD_KEYS.PROJECTS, projectId, { group: groupDisplayId });
  const newGroup = getGroup(groupDisplayId);
  if (newGroup) editGroup(newGroup.id, { project: updated.displayId, progress: updated.progress });
  logActivity(`Project ${updated.displayId} assigned to group ${groupDisplayId}`);
  return updated;
}

/* ================= Submission workflow =================
   project.submission shape:
   { link, note, submittedBy, submittedAt, status: 'Pending Review' | 'Approved' | 'Rejected', facultyNote, reviewedAt }
   Student submits -> status 'Pending Review', stage "Submission" moves to In Progress.
   Faculty approves -> stage "Submission" becomes Completed (progress recalculates).
   Faculty rejects  -> stage "Submission" reverts to Pending so the student can resubmit.
*/

/** Student submits (or resubmits) their work for a project. */
function submitProjectWork(projectId, { link, note, submittedBy }) {
  const project = findData(CDAD_KEYS.PROJECTS, projectId);
  if (!project) return null;
  const submission = {
    link: link || '',
    note: note || '',
    submittedBy,
    submittedAt: new Date().toISOString(),
    status: 'Pending Review',
    facultyNote: '',
    reviewedAt: ''
  };
  updateData(CDAD_KEYS.PROJECTS, projectId, { submission });
  // Reaching the Submission stage counts as "In Progress" until faculty reviews it.
  setProjectStage(projectId, 'Submission', 'In Progress');
  createNotification({
    title: 'New Project Submission',
    message: `${submittedBy} submitted work for project ${project.displayId} (${project.title}) — awaiting review.`,
    type: 'request',
    recipient: 'all-faculty'
  });
  logActivity(`${submittedBy} submitted work for project ${project.displayId}`);
  return findData(CDAD_KEYS.PROJECTS, projectId);
}

/** Faculty approves or rejects a pending submission. */
function reviewProjectSubmission(projectId, decision, facultyNote) {
  const project = findData(CDAD_KEYS.PROJECTS, projectId);
  if (!project || !project.submission) return null;
  const submission = Object.assign({}, project.submission, {
    status: decision, // 'Approved' | 'Rejected'
    facultyNote: facultyNote || '',
    reviewedAt: new Date().toISOString()
  });
  updateData(CDAD_KEYS.PROJECTS, projectId, { submission });

  if (decision === 'Approved') {
    setProjectStage(projectId, 'Submission', 'Completed');
  } else {
    setProjectStage(projectId, 'Submission', 'Pending');
  }

  const recipient = submission.submittedBy || project.group;
  createNotification({
    title: `Submission ${decision}`,
    message: decision === 'Approved'
      ? `Your submission for ${project.title} (${project.displayId}) was approved.`
      : `Your submission for ${project.title} (${project.displayId}) was rejected.${facultyNote ? ' Note: ' + facultyNote : ' Please review and resubmit.'}`,
    type: 'request',
    recipient
  });
  logActivity(`Submission for project ${project.displayId} ${decision.toLowerCase()}`);
  return findData(CDAD_KEYS.PROJECTS, projectId);
}