/* ================= Projects (Section 3 + 4) ================= */
async function renderProjects() {
  const host = document.getElementById('projectsGrid');
  if (!host) return;
  const projects = await allProjects();
  host.innerHTML = projects.length ? projects.map((p) => `
    <div class="card">
      <div class="card__top">
        <div><div class="card__title">${escapeHtml(p.title)}</div><div class="card__meta mono">${escapeHtml(p.displayId)} &middot; ${escapeHtml(p.group || 'Unassigned')}</div></div>
        <span class="badge ${statusBadgeClass(p.status)}">${escapeHtml(p.status)}</span>
      </div>
      <div class="card__meta">Deadline ${formatDate(p.deadline)}</div>
      <div>
        <div class="card__progress-label"><span>Progress</span><span>${p.progress}%</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${p.progress}%"></div></div>
      </div>
      ${p.submission ? `<div class="card__meta">Submission: <span class="badge ${p.submission.status === 'Approved' ? 'badge--good' : p.submission.status === 'Rejected' ? 'badge--bad' : 'badge--warn'}">${escapeHtml(p.submission.status)}</span></div>` : ''}
      <div class="card__actions">
        <button class="btn btn--ghost btn--sm" data-edit-project="${p.id}">Edit ✎</button>
        <button class="btn btn--ghost btn--sm" data-stage-project="${p.id}">Stages</button>
        ${p.submission && p.submission.status === 'Pending Review' ? `<button class="btn btn--primary btn--sm" data-review-submission="${p.id}">Review Submission</button>` : ''}
        ${(!p.submission || p.submission.status === 'Rejected') && p.group ? `<button class="btn btn--ghost btn--sm" data-request-submission="${p.id}">Request Submission</button>` : ''}
        <button class="btn btn--danger btn--sm" data-del-project="${p.id}">Delete</button>
      </div>
    </div>`).join('') : emptyState('No projects yet.');

  host.querySelectorAll('[data-edit-project]').forEach((b) => b.addEventListener('click', () => openEditProjectModal(b.dataset.editProject)));
  host.querySelectorAll('[data-stage-project]').forEach((b) => b.addEventListener('click', () => openStagesModal(b.dataset.stageProject)));
  host.querySelectorAll('[data-review-submission]').forEach((b) => b.addEventListener('click', () => openReviewSubmissionModal(b.dataset.reviewSubmission)));
  host.querySelectorAll('[data-request-submission]').forEach((b) => b.addEventListener('click', () => openRequestSubmissionModal(b.dataset.requestSubmission)));
  host.querySelectorAll('[data-del-project]').forEach((b) => b.addEventListener('click', async () => {
    const p = await findData(CDAD_KEYS.PROJECTS, b.dataset.delProject);
    confirmDelete(`Delete project ${p.title} (${p.displayId})?`, async () => { await deleteProject(p.id); showToast('Project deleted', 'success'); await renderAll(); });
  }));
}

async function openRequestSubmissionModal(projectId) {
  const project = await findData(CDAD_KEYS.PROJECTS, projectId);
  openModal(`Request Submission — ${project.displayId}`, `
    <p class="field-hint" style="margin-bottom:14px;">This sends a notification straight to group ${escapeHtml(project.group)} asking them to submit their work.</p>
    <form id="requestSubmissionForm">
      <div class="field full"><label>Message (optional — a default reminder is used if left blank)</label><textarea name="message" placeholder="e.g. Please submit before Friday's review..."></textarea></div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="cancelRequestSubmission">Cancel</button>
        <button type="submit" class="btn btn--primary">Send Request</button>
      </div>
    </form>
  `, {
    onMount: () => {
      document.getElementById('cancelRequestSubmission').addEventListener('click', closeModal);
      document.getElementById('requestSubmissionForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        await requestSubmission(projectId, fd.get('message'));
        closeModal();
        showToast('Submission request sent', 'success');
        await renderAll();
      });
    }
  });
}

async function openReviewSubmissionModal(projectId) {
  const project = await findData(CDAD_KEYS.PROJECTS, projectId);
  const sub = project.submission;
  if (!sub) return;
  openModal(`Review Submission — ${project.displayId}`, `
    <div class="list-item" style="margin-bottom:16px;">
      ${sub.link ? `<div class="list-item__body"><strong>Link:</strong> <a href="${escapeHtml(sub.link)}" target="_blank" rel="noopener">${escapeHtml(sub.link)}</a></div>` : ''}
      ${sub.fileName ? `<div class="list-item__body"><strong>File:</strong> <a href="/api/projects/${project.id}/submission/file" target="_blank">${escapeHtml(sub.fileName)}</a> <span class="faint">(${formatFileSize(sub.fileSize)})</span></div>` : ''}
      ${sub.note ? `<div class="list-item__body"><strong>Note:</strong> ${escapeHtml(sub.note)}</div>` : ''}
      <div class="list-item__body faint">Submitted by ${escapeHtml(sub.submittedBy)} on ${formatDateTime(sub.submittedAt)}</div>
    </div>
    <form id="reviewSubmissionForm">
      <div class="field full"><label>Feedback (optional, sent to the student)</label><textarea name="facultyNote" placeholder="Add feedback or reasons for your decision..."></textarea></div>
      <div class="form-actions">
        <button type="button" class="btn btn--danger" id="rejectSubmissionBtn">Reject</button>
        <button type="submit" class="btn btn--primary">Approve</button>
      </div>
    </form>
  `, {
    onMount: () => {
      const form = document.getElementById('reviewSubmissionForm');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const note = new FormData(form).get('facultyNote').trim();
        await reviewProjectSubmission(projectId, 'Approved', note);
        closeModal();
        showToast('Submission approved', 'success');
        await renderAll();
      });
      document.getElementById('rejectSubmissionBtn').addEventListener('click', async () => {
        const note = new FormData(form).get('facultyNote').trim();
        await reviewProjectSubmission(projectId, 'Rejected', note);
        closeModal();
        showToast('Submission rejected', 'info');
        await renderAll();
      });
    }
  });
}

