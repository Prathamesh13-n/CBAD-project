/* ================= Groups (Section 2) ================= */
async function renderGroups() {
  const host = document.getElementById('groupsGrid');
  if (!host) return;
  const groups = await allGroups();
  host.innerHTML = groups.length ? groups.map((g) => `
    <div class="card">
      <div class="card__top">
        <div>
          <div class="card__title">${escapeHtml(g.name)}</div>
          <div class="card__meta mono">${escapeHtml(g.displayId)} &middot; Leader: ${escapeHtml(g.teamLeader || '—')}</div>
        </div>
        <span class="badge ${statusBadgeClass(g.status)}">${escapeHtml(g.status)}</span>
      </div>
      <div class="card__meta">${memberCount(g)} member(s) &middot; Project: ${escapeHtml(g.project || '—')}</div>
      <div>
        <div class="card__progress-label"><span>Progress</span><span>${g.progress || 0}%</span></div>
        <div class="bar-track"><div class="bar-fill" style="width:${g.progress || 0}%"></div></div>
      </div>
      <div class="card__actions">
        <button class="btn btn--ghost btn--sm" data-edit-group="${g.id}">Edit ✎</button>
        <button class="btn btn--ghost btn--sm" data-view-group="${g.displayId}">Members</button>
        <button class="btn btn--danger btn--sm" data-del-group="${g.id}">Delete</button>
      </div>
    </div>`).join('') : emptyState('No groups yet. Add one to get started.');

  host.querySelectorAll('[data-edit-group]').forEach((b) => b.addEventListener('click', () => openEditGroupModal(b.dataset.editGroup)));
  host.querySelectorAll('[data-view-group]').forEach((b) => b.addEventListener('click', () => openGroupMembersModal(b.dataset.viewGroup)));
  host.querySelectorAll('[data-del-group]').forEach((b) => b.addEventListener('click', async () => {
    const g = await findData(CDAD_KEYS.GROUPS, b.dataset.delGroup);
    confirmDelete(`Delete group ${g.name} (${g.displayId})?`, async () => { await deleteGroup(g.id); showToast('Group deleted', 'success'); await renderAll(); });
  }));
}

function openAddGroupModal() { groupFormModal('Add Group', null); }
async function openEditGroupModal(id) { groupFormModal('Edit Group', await findData(CDAD_KEYS.GROUPS, id)); }

function groupFormModal(title, group) {
  Promise.all([getData(CDAD_KEYS.STUDENTS), getData(CDAD_KEYS.PROJECTS)]).then(([students, projects]) => {
    openModal(title, `
      <form id="groupForm">
        <div class="form-grid">
          <div class="field full"><label>Group Name</label><input name="name" required value="${escapeHtml(group?.name || '')}"></div>
          <div class="field">
            <label>Team Leader</label>
            <select name="teamLeader">
              <option value="">— None —</option>
              ${students.map((s) => `<option value="${s.displayId}" ${group?.teamLeader===s.displayId?'selected':''}>${s.displayId} — ${escapeHtml(s.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Status</label>
            <select name="status"><option ${group?.status==='Active'?'selected':''}>Active</option><option ${group?.status==='Inactive'?'selected':''}>Inactive</option><option ${group?.status==='Completed'?'selected':''}>Completed</option></select>
          </div>
          <div class="field full">
            <label>Assigned Project</label>
            <select name="project">
              <option value="">— None —</option>
              ${projects.map((p) => `<option value="${p.displayId}" ${group?.project===p.displayId?'selected':''}>${p.displayId} — ${escapeHtml(p.title)}</option>`).join('')}
            </select>
          </div>
          <div class="field full">
            <label>Members</label>
            <div class="checkbox-grid">
              ${students.map((s) => `
                <label class="checkbox-row">
                  <input type="checkbox" name="members" value="${s.displayId}" ${(group?.members || []).includes(s.displayId)?'checked':''}>
                  ${escapeHtml(s.displayId)} — ${escapeHtml(s.name)}
                </label>`).join('')}
            </div>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn--ghost" id="cancelGroupForm">Cancel</button>
          <button type="submit" class="btn btn--primary">Save Changes</button>
        </div>
      </form>
    `, {
      onMount: () => {
        document.getElementById('cancelGroupForm').addEventListener('click', closeModal);
        document.getElementById('groupForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const members = fd.getAll('members');
          const fields = { name: fd.get('name').trim(), teamLeader: fd.get('teamLeader'), status: fd.get('status'), members };
          const projectDisplayId = fd.get('project');

          const savedGroup = group ? await editGroup(group.id, fields) : await createGroup(fields);

          const oldProjectDisplayId = group?.project || '';
          if (projectDisplayId !== oldProjectDisplayId) {
            if (projectDisplayId) {
              const targetProj = projects.find((p) => p.displayId === projectDisplayId);
              if (targetProj) await assignProjectToGroup(targetProj.id, savedGroup.displayId);
            } else if (oldProjectDisplayId) {
              const oldProj = projects.find((p) => p.displayId === oldProjectDisplayId);
              if (oldProj) await assignProjectToGroup(oldProj.id, '');
            }
          }

          closeModal();
          showToast('Group saved', 'success');
          await renderAll();
        });
      }
    });
  });
}

async function openGroupMembersModal(displayId) {
  const group = await getGroup(displayId);
  const students = await getData(CDAD_KEYS.STUDENTS);
  openModal(`${group.name} — Members`, `
    <div class="list-item" style="margin-bottom:14px;"><strong>${memberCount(group)}</strong> member(s) &middot; Leader: ${escapeHtml(group.teamLeader || '—')}</div>
    ${(group.members || []).map((m) => {
      const s = students.find((x) => x.displayId === m);
      return `<div class="list-item"><div class="list-item__top">
        <span>${s ? escapeHtml(s.name) : m} <span class="mono faint">${escapeHtml(m)}</span></span>
        <button class="btn btn--ghost btn--sm" data-remove-member="${m}">Remove</button>
      </div></div>`;
    }).join('') || emptyState('No members yet.')}
  `, {
    onMount: () => {
      document.querySelectorAll('[data-remove-member]').forEach((b) => b.addEventListener('click', async () => {
        await removeMember(group.id, b.dataset.removeMember);
        closeModal();
        showToast('Member removed', 'info');
        await renderAll();
      }));
    }
  });
}

