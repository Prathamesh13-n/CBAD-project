/* ================= My Project ================= */
async function renderProjectPanel() {
  const host = document.getElementById('projectPanel');
  if (!host) return;
  const group = await getGroup(ME.group);
  const project = group ? await getProject(group.project) : null;
  const amLeader = group && group.teamLeader === ME.displayId;

  if (!project) {
    if (!group) { host.innerHTML = emptyState('You need a group before you can create or view a project.'); return; }
    if (amLeader) {
      host.innerHTML = `
        ${emptyState('Your group has no project yet. As team leader, you can create one.')}
        <div style="text-align:center; margin-top:-10px;">
          <button class="btn btn--primary" id="createMyProjectBtn">+ Create Project</button>
        </div>`;
      document.getElementById('createMyProjectBtn').addEventListener('click', () => openCreateMyProjectModal(group));
    } else {
      host.innerHTML = emptyState(`Your group has no project yet. Your team leader (${escapeHtml(group.teamLeader || 'not set')}) can create one, or faculty can assign one.`);
    }
    return;
  }

  host.innerHTML = `
    <div class="section__head">
      <div><span class="faint mono" style="font-size:11px;">${escapeHtml(project.displayId)}</span><h3>${escapeHtml(project.title)}</h3></div>
      <div style="display:flex; gap:8px; align-items:center;">
        <span class="badge ${statusBadgeClass(project.status)}">${escapeHtml(project.status)}</span>
        <button class="btn btn--ghost btn--sm" id="editMyProjectBtn">Edit ✎</button>
      </div>
    </div>
    <p style="font-size:13.5px; color:var(--ink-soft); margin-bottom:18px;">${escapeHtml(project.description) || 'No description yet.'}</p>
    <div class="form-grid">
      ${profileField('Group', project.group)}
      ${profileField('Team Leader', project.teamLeader)}
      ${profileField('Start Date', formatDate(project.startDate))}
      ${profileField('Deadline', formatDate(project.deadline))}
      ${profileField('Tools / Tech Stack', project.techStack || '—')}
      ${profileField('Repository', project.repoName)}
    </div>
    <div style="margin-top:10px;">
      <div class="card__progress-label"><span>Overall Progress</span><span>${project.progress}%</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${project.progress}%"></div></div>
    </div>
    <p class="field-hint" style="margin-top:14px;">Group, leader, and deadline are set by faculty. You can edit the title, description, and tools used.</p>`;

  document.getElementById('editMyProjectBtn').addEventListener('click', () => openEditMyProjectModal(project));
}

function openCreateMyProjectModal(group) {
  openModal('Create Project', `
    <form id="createMyProjectForm">
      <div class="field full" style="margin-bottom:14px;">
        <label>Project Title</label>
        <input name="title" required placeholder="e.g. Smart Campus Attendance System">
      </div>
      <div class="field full" style="margin-bottom:14px;">
        <label>Description</label>
        <textarea name="description" placeholder="What is this project about?"></textarea>
      </div>
      <div class="field full" style="margin-bottom:14px;">
        <label>Tools / Tech Stack</label>
        <input name="techStack" placeholder="e.g. React, Node.js, MongoDB">
      </div>
      <div class="field full" style="margin-bottom:14px;">
        <label>GitHub URL</label>
        <input name="githubUrl" type="url" placeholder="https://github.com/your-org/your-repo">
      </div>
      <div class="form-grid" style="margin-bottom:14px;">
        <div class="field">
          <label>Repository Name</label>
          <input name="repoName" placeholder="e.g. smart-attendance">
        </div>
        <div class="field">
          <label>Branch</label>
          <input name="branch" placeholder="main">
        </div>
      </div>
      <div class="field full">
        <label>Expected Deadline (optional)</label>
        <input type="date" name="deadline">
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="cancelCreateMyProject">Cancel</button>
        <button type="submit" class="btn btn--primary">Create Project</button>
      </div>
    </form>
  `, {
    onMount: () => {
      document.getElementById('cancelCreateMyProject').addEventListener('click', closeModal);
      document.getElementById('createMyProjectForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (group.project) { showToast('This group already has a project.', 'error'); closeModal(); return; }
        const fd = new FormData(e.target);
        await createProject({
          title: fd.get('title').trim(),
          description: fd.get('description').trim(),
          techStack: fd.get('techStack').trim(),
          githubUrl: fd.get('githubUrl').trim(),
          repoName: fd.get('repoName').trim(),
          branch: fd.get('branch').trim() || 'main',
          group: group.displayId,
          teamLeader: group.teamLeader,
          deadline: fd.get('deadline') ? new Date(fd.get('deadline')).toISOString() : '',
          status: 'Active'
        });
        closeModal();
        showToast('Project created', 'success');
        await renderAll();
      });
    }
  });
}

function openEditMyProjectModal(project) {
  openModal('Edit Project Details', `
    <form id="editMyProjectForm">
      <div class="field full" style="margin-bottom:14px;">
        <label>Project Title</label>
        <input name="title" required value="${escapeHtml(project.title)}">
      </div>
      <div class="field full" style="margin-bottom:14px;">
        <label>Description</label>
        <textarea name="description" placeholder="What is this project about?">${escapeHtml(project.description || '')}</textarea>
      </div>
      <div class="field full" style="margin-bottom:14px;">
        <label>Tools / Tech Stack Used</label>
        <input name="techStack" placeholder="e.g. React, Node.js, MongoDB, Python" value="${escapeHtml(project.techStack || '')}">
      </div>
      <div class="field full" style="margin-bottom:14px;">
        <label>GitHub URL</label>
        <input name="githubUrl" type="url" placeholder="https://github.com/your-org/your-repo" value="${escapeHtml(project.githubUrl || '')}">
      </div>
      <div class="form-grid">
        <div class="field">
          <label>Repository Name</label>
          <input name="repoName" placeholder="e.g. smart-attendance" value="${escapeHtml(project.repoName || '')}">
        </div>
        <div class="field">
          <label>Branch</label>
          <input name="branch" placeholder="main" value="${escapeHtml(project.branch || 'main')}">
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="cancelEditMyProject">Cancel</button>
        <button type="submit" class="btn btn--primary">Save Changes</button>
      </div>
    </form>
  `, {
    onMount: () => {
      document.getElementById('cancelEditMyProject').addEventListener('click', closeModal);
      document.getElementById('editMyProjectForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        await editProject(project.id, {
          title: fd.get('title').trim(),
          description: fd.get('description').trim(),
          techStack: fd.get('techStack').trim(),
          githubUrl: fd.get('githubUrl').trim(),
          repoName: fd.get('repoName').trim(),
          branch: fd.get('branch').trim() || 'main'
        });
        closeModal();
        showToast('Project details updated', 'success');
        await renderAll();
      });
    }
  });
}

/* ================= Progress ================= */
async function renderProgressPanel() {
  const host = document.getElementById('progressPanel');
  if (!host) return;
  const group = await getGroup(ME.group);
  const project = group ? await getProject(group.project) : null;
  if (!project) { host.innerHTML = emptyState('No project assigned yet.'); return; }
  host.innerHTML = `
    <div class="section__head"><h3>${escapeHtml(project.title)}</h3><span style="font-size:22px; font-weight:800;">${project.progress}%</span></div>
    <div class="bar-track" style="margin-bottom:20px;"><div class="bar-fill" style="width:${project.progress}%"></div></div>
    <p class="field-hint" style="margin-bottom:14px;">Click a stage below to mark it Pending → In Progress → Completed as you work through your project.</p>
    <div class="checklist" id="progressChecklist">
      ${PROJECT_STAGES.map((s) => stageChecklistRow(s, project.stages[s], true)).join('')}
    </div>
    <div id="submissionBlock" style="margin-top:22px; padding-top:20px; border-top:1px solid var(--line-soft);"></div>`;

  host.querySelectorAll('#progressChecklist [data-stage]').forEach((row) => {
    row.addEventListener('click', async () => {
      const stageName = row.dataset.stage;
      const current = project.stages[stageName];
      const next = current === 'Pending' ? 'In Progress' : current === 'In Progress' ? 'Completed' : 'Pending';
      await setProjectStage(project.id, stageName, next);
      showToast(`${stageName} marked ${next}`, 'success');
      await renderAll();
    });
  });

  renderSubmissionBlock(project, undefined, group.teamLeader === ME.displayId);
}
