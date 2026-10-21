/* ================= GitHub ================= */
async function renderGithub() {
  const host = document.getElementById('githubPanel');
  if (!host) return;
  const group = await getGroup(ME.group);
  const project = group ? await getProject(group.project) : null;
  if (!project) { host.innerHTML = emptyState('No repository linked yet.'); return; }
  host.innerHTML = `
    <div class="card">
      <div class="card__top">
        <div>
          <div class="card__title mono">${escapeHtml(project.repoName) || 'No repository name set'}</div>
          <div class="card__meta">Branch: <span class="mono">${escapeHtml(project.branch)}</span></div>
        </div>
        <button class="btn btn--ghost btn--sm" id="editGithubBtn">Edit ✎</button>
      </div>
      <p style="font-size:13px; color:var(--ink-soft); word-break:break-all;">${escapeHtml(project.githubUrl) || 'No URL set'}</p>
      <div class="card__actions">
        <a class="btn btn--primary btn--sm" href="${escapeHtml(project.githubUrl || '#')}" target="_blank" rel="noopener">Open Repository ↗</a>
      </div>
    </div>`;

  document.getElementById('editGithubBtn').addEventListener('click', () => openEditGithubModal(project));
}

function openEditGithubModal(project) {
  openModal('Edit GitHub Repository', `
    <form id="editGithubForm">
      <div class="field full" style="margin-bottom:14px;">
        <label>Repository Name</label>
        <input name="repoName" placeholder="e.g. smart-attendance" value="${escapeHtml(project.repoName || '')}">
      </div>
      <div class="field full" style="margin-bottom:14px;">
        <label>GitHub URL</label>
        <input name="githubUrl" type="url" placeholder="https://github.com/your-org/your-repo" value="${escapeHtml(project.githubUrl || '')}">
      </div>
      <div class="field full">
        <label>Branch</label>
        <input name="branch" placeholder="main" value="${escapeHtml(project.branch || 'main')}">
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="cancelEditGithub">Cancel</button>
        <button type="submit" class="btn btn--primary">Save Changes</button>
      </div>
    </form>
  `, {
    onMount: () => {
      document.getElementById('cancelEditGithub').addEventListener('click', closeModal);
      document.getElementById('editGithubForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        await editProject(project.id, {
          repoName: fd.get('repoName').trim(),
          githubUrl: fd.get('githubUrl').trim(),
          branch: fd.get('branch').trim() || 'main'
        });
        closeModal();
        showToast('GitHub repository updated', 'success');
        await renderAll();
      });
    }
  });
}

