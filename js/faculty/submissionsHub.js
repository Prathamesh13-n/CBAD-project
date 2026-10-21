/* ================= Submissions Hub — every submission, one place ================= */
async function renderSubmissionsHub() {
  const host = document.getElementById('submissionsTableBody');
  if (!host) return;

  const statusFilterEl = document.getElementById('submissionStatusFilter');
  if (statusFilterEl && !statusFilterEl.dataset.wired) {
    statusFilterEl.addEventListener('change', renderSubmissionsHub);
    statusFilterEl.dataset.wired = '1';
  }
  const statusFilter = statusFilterEl?.value || '';

  let submissions = await allSubmissions();
  if (statusFilter) submissions = submissions.filter((p) => p.submission.status === statusFilter);

  const countLabel = document.getElementById('submissionCountLabel');
  if (countLabel) countLabel.textContent = `${submissions.length} submission(s)`;

  // allSubmissions() is already sorted newest-first server-side, so grouping
  // by calendar day while preserving iteration order keeps days newest-first too.
  const dayGroups = [];
  const dayIndex = new Map();
  submissions.forEach((p) => {
    const dayKey = new Date(p.submission.submittedAt).toDateString();
    if (!dayIndex.has(dayKey)) {
      dayIndex.set(dayKey, dayGroups.length);
      dayGroups.push({ label: formatDate(p.submission.submittedAt), items: [] });
    }
    dayGroups[dayIndex.get(dayKey)].items.push(p);
  });

  host.innerHTML = submissions.length ? dayGroups.map((g) => `
    <tr class="day-group-row"><td colspan="6" style="background:var(--bg-soft); font-weight:700; font-size:12.5px; padding:8px 10px;">${escapeHtml(g.label)} <span class="faint" style="font-weight:400;">(${g.items.length})</span></td></tr>
    ${g.items.map(submissionHubRow).join('')}
  `).join('') : `<tr class="empty-row"><td colspan="6">No submissions yet.</td></tr>`;

  host.querySelectorAll('[data-review-hub]').forEach((b) => b.addEventListener('click', () => openReviewSubmissionModal(b.dataset.reviewHub)));
}

/* ----- Exam submissions (TA1 / TA2 / EndSem) ----- */
let currentExam = 'TA1';

async function renderExamSubmissions() {
  const host = document.getElementById('examSubmissionsBody');
  if (!host) return;
  const tabs = document.getElementById('examTabs');
  if (!tabs.dataset.wired) {
    tabs.dataset.wired = '1';
    tabs.querySelectorAll('[data-exam]').forEach((b) => b.addEventListener('click', () => { currentExam = b.dataset.exam; renderExamSubmissions(); }));
  }
  tabs.querySelectorAll('[data-exam]').forEach((b) => {
    b.className = 'btn btn--sm ' + (b.dataset.exam === currentExam ? 'btn--primary' : 'btn--ghost');
  });

  const [{ submissions, deadlines }, groups, projects] = await Promise.all([
    fetchExamSubmissions(), getData(CDAD_KEYS.GROUPS), getData(CDAD_KEYS.PROJECTS)
  ]);

  // Deadline bar for the selected exam.
  const dlInput = document.getElementById('examDeadlineInput');
  const dlStatus = document.getElementById('examDeadlineStatus');
  const dl = deadlines[currentExam];
  if (document.activeElement !== dlInput) dlInput.value = isoToLocalInput(dl);
  dlStatus.textContent = dl
    ? (new Date(dl) < new Date() ? '🔒 Closed — students can no longer submit' : `Open until ${formatDateTime(dl)}`)
    : 'No deadline — students can always submit';
  if (!dlInput.dataset.wired) {
    dlInput.dataset.wired = '1';
    document.getElementById('saveExamDeadlineBtn').addEventListener('click', async () => {
      if (!dlInput.value) { showToast('Pick a date and time first', 'error'); return; }
      await setExamDeadline(currentExam, new Date(dlInput.value).toISOString());
      showToast(`${EXAM_LABELS[currentExam]} deadline set`, 'success');
      await renderExamSubmissions();
    });
    document.getElementById('clearExamDeadlineBtn').addEventListener('click', async () => {
      await setExamDeadline(currentExam, '');
      dlInput.value = '';
      showToast(`${EXAM_LABELS[currentExam]} deadline removed`, 'info');
      await renderExamSubmissions();
    });
  }
  const forExam = submissions.filter((s) => s.exam === currentExam);
  const byGroup = new Map(forExam.map((s) => [s.group, s]));
  const rows = groups.filter((g) => (g.members || []).length || byGroup.has(g.displayId));
  document.getElementById('examCountLabel').textContent = `${EXAM_LABELS[currentExam]}: ${forExam.length} of ${rows.length} groups submitted`;

  host.innerHTML = rows.length ? rows.map((g) => {
    const s = byGroup.get(g.displayId);
    const project = projects.find((p) => p.group === g.displayId);
    const head = `<td><div class="row-name__text"><strong>${escapeHtml(g.name)}</strong><span class="mono">${escapeHtml(g.displayId)}</span></div></td>
      <td>${escapeHtml(project ? project.title : '—')}</td>`;
    if (!s) return `<tr>${head}<td colspan="4"><span class="badge badge--warn">Not submitted</span></td><td></td></tr>`;
    return `<tr>${head}
      <td>${escapeHtml(s.submittedByName || s.submittedBy)}<div class="faint mono" style="font-size:11px;">${escapeHtml(s.submittedBy)}</div></td>
      <td>${formatDateTime(s.submittedAt)}</td>
      <td class="table-actions">
        ${s.link ? `<a class="btn btn--ghost btn--sm" href="${escapeHtml(s.link)}" target="_blank" rel="noopener">Open Link ↗</a>` : ''}
        ${s.files.map((f) => `<span class="exam-file" style="display:inline-flex; gap:2px;">${canPreviewExamFile(f) ? `<button class="btn btn--primary btn--sm" data-view-exam-file="${escapeHtml(JSON.stringify(f))}" title="View ${escapeHtml(f.name)} without downloading">👁 ${escapeHtml(f.name.length > 18 ? f.name.slice(0, 16) + '…' : f.name)}</button>` : ''}<a class="btn btn--ghost btn--sm" href="/api/exam-submissions/files/${f.id}" target="_blank" title="Download ${escapeHtml(f.name)}">${canPreviewExamFile(f) ? '↓' : escapeHtml(f.name.length > 22 ? f.name.slice(0, 20) + '…' : f.name) + ' ↓'}</a></span>`).join('')}
      </td>
      <td>${escapeHtml(s.note || '—')}</td>
      <td class="table-actions"><button class="btn btn--danger btn--sm" data-del-exam-sub="${s.id}">Remove</button></td>
    </tr>`;
  }).join('') : `<tr class="empty-row"><td colspan="7">No groups yet.</td></tr>`;

  host.querySelectorAll('[data-view-exam-file]').forEach((b) => b.addEventListener('click', () => openExamFilePreview(JSON.parse(b.dataset.viewExamFile))));
  host.querySelectorAll('[data-del-exam-sub]').forEach((b) => b.addEventListener('click', () => {
    confirmDelete(`Remove this ${EXAM_LABELS[currentExam]} submission?`, async () => {
      await deleteExamSubmission(b.dataset.delExamSub);
      showToast('Submission removed', 'success');
      await renderExamSubmissions();
    });
  }));
}

function submissionHubRow(p) {
  const sub = p.submission;
  const badgeClass = sub.status === 'Approved' ? 'badge--good' : sub.status === 'Rejected' ? 'badge--bad' : 'badge--warn';
  return `
    <tr>
      <td>
        <div class="row-name__text"><strong>${escapeHtml(p.title)}</strong><span class="mono">${escapeHtml(p.displayId)}</span></div>
      </td>
      <td>${escapeHtml(p.group || '—')}</td>
      <td>${escapeHtml(sub.submittedBy)}</td>
      <td>${formatDateTime(sub.submittedAt)}</td>
      <td><span class="badge ${badgeClass}">${escapeHtml(sub.status)}</span></td>
      <td class="table-actions">
        ${sub.link ? `<a class="btn btn--ghost btn--sm" href="${escapeHtml(sub.link)}" target="_blank" rel="noopener">View Link ↗</a>` : ''}
        ${sub.fileName ? `<a class="btn btn--ghost btn--sm" href="/api/projects/${p.id}/submission/file" target="_blank">Download File ↗</a>` : ''}
        <button class="btn btn--primary btn--sm" data-review-hub="${p.id}">${sub.status === 'Pending Review' ? 'Review' : 'View / Re-review'}</button>
      </td>
    </tr>`;
}

function openAddProjectModal() { projectFormModal('Create Project', null); }
async function openEditProjectModal(id) { projectFormModal('Edit Project', await findData(CDAD_KEYS.PROJECTS, id)); }

function projectFormModal(title, project) {
  allGroups().then((groups) => {
    const isoDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
    openModal(title, `
      <form id="projectForm">
        <div class="form-grid">
          <div class="field full"><label>Project Title</label><input name="title" required value="${escapeHtml(project?.title || '')}"></div>
          <div class="field full"><label>Description</label><textarea name="description">${escapeHtml(project?.description || '')}</textarea></div>
          <div class="field full"><label>Tools / Tech Stack</label><input name="techStack" value="${escapeHtml(project?.techStack || '')}" placeholder="e.g. React, Node.js, MongoDB"></div>
          <div class="field">
            <label>Group</label>
            <select name="group"><option value="">— Unassigned —</option>${groups.map((g) => `<option value="${g.displayId}" ${project?.group===g.displayId?'selected':''}>${g.displayId} — ${escapeHtml(g.name)}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Team Leader</label><input name="teamLeader" value="${escapeHtml(project?.teamLeader || '')}" placeholder="e.g. ST001"></div>
          <div class="field"><label>Start Date</label><input type="date" name="startDate" value="${isoDate(project?.startDate) || isoDate(new Date())}"></div>
          <div class="field"><label>Deadline</label><input type="date" name="deadline" value="${isoDate(project?.deadline)}"></div>
          <div class="field">
            <label>Status</label>
            <select name="status">${['Active','In Progress','Completed','On Hold'].map((s) => `<option ${project?.status===s?'selected':''}>${s}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Branch</label><input name="branch" value="${escapeHtml(project?.branch || 'main')}"></div>
          <div class="field"><label>Repository Name</label><input name="repoName" value="${escapeHtml(project?.repoName || '')}"></div>
          <div class="field full"><label>GitHub URL</label><input name="githubUrl" value="${escapeHtml(project?.githubUrl || '')}" placeholder="https://github.com/..."></div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn--ghost" id="cancelProjectForm">Cancel</button>
          <button type="submit" class="btn btn--primary">Save Changes</button>
        </div>
      </form>
    `, {
      onMount: () => {
        document.getElementById('cancelProjectForm').addEventListener('click', closeModal);
        document.getElementById('projectForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const fields = {
            title: fd.get('title').trim(), description: fd.get('description').trim(),
            techStack: fd.get('techStack').trim(),
            group: fd.get('group'), teamLeader: fd.get('teamLeader').trim(),
            startDate: fd.get('startDate') ? new Date(fd.get('startDate')).toISOString() : '',
            deadline: fd.get('deadline') ? new Date(fd.get('deadline')).toISOString() : '',
            status: fd.get('status'), branch: fd.get('branch').trim(),
            repoName: fd.get('repoName').trim(), githubUrl: fd.get('githubUrl').trim()
          };
          if (project) {
            await editProject(project.id, fields);
            if (fields.group !== project.group) await assignProjectToGroup(project.id, fields.group);
          } else {
            await createProject(fields);
          }
          closeModal();
          showToast('Project saved', 'success');
          await renderAll();
        });
      }
    });
  });
}

async function openStagesModal(projectId) {
  const project = await findData(CDAD_KEYS.PROJECTS, projectId);
  openModal(`${project.title} — Stage Progress`, `
    <div class="stage-list">
      ${PROJECT_STAGES.map((s, i) => `
        <div class="stage-row">
          <span class="stage-row__name"><span class="stage-index">0${i + 1}</span> ${s}</span>
          <select data-stage-select="${s}" style="padding:6px 8px; border-radius:6px; border:1px solid var(--line);">
            ${['Pending','In Progress','Completed'].map((opt) => `<option ${project.stages[s]===opt?'selected':''}>${opt}</option>`).join('')}
          </select>
        </div>`).join('')}
    </div>
    <p class="field-hint" style="margin-top:12px;">Overall progress recalculates automatically as stages change.</p>
  `, {
    onMount: () => {
      document.querySelectorAll('[data-stage-select]').forEach((sel) => {
        sel.addEventListener('change', async () => {
          await setProjectStage(projectId, sel.dataset.stageSelect, sel.value);
          showToast('Stage updated', 'success');
          await renderAll();
        });
      });
    }
  });
}

