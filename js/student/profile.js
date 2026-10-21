/* ================= Profile ================= */
function renderProfile() {
  const host = document.getElementById('profileCard');
  if (!host) return;
  host.innerHTML = `
    <div class="section__head">
      <h3>My Profile</h3>
      <button class="btn btn--ghost btn--sm" id="editProfileBtn">Edit ✎</button>
    </div>
    <div style="display:flex; gap:18px; align-items:center; margin-bottom:16px;">
      <div class="avatar avatar--lg">${avatarHtml(ME)}</div>
      <div>
        <div style="font-size:19px; font-weight:800;">${escapeHtml(ME.name)}</div>
        <div class="muted mono" style="font-size:12.5px;">${escapeHtml(ME.displayId)}</div>
        <span class="badge ${statusBadgeClass(ME.status)}" style="margin-top:6px; display:inline-flex;">${escapeHtml(ME.status)}</span>
      </div>
    </div>
    <div class="form-grid">
      ${profileField('Email', ME.email)}
      ${profileField('Phone', ME.phone)}
      ${profileField('Course', ME.course)}
      ${profileField('Year', ME.year)}
      ${profileField('Department', ME.department)}
      ${profileField('Group', ME.group || '—')}
      ${profileField('Role', ME.role)}
    </div>`;
  document.getElementById('editProfileBtn').addEventListener('click', openEditProfileModal);
}

function profileField(label, value) {
  return `<div class="field"><label>${label}</label><div style="font-size:13.5px; padding:9px 0;">${escapeHtml(value || '—')}</div></div>`;
}

function openEditProfileModal() {
  openModal('Edit My Profile', `
    <form id="profileForm">
      <div class="form-grid">
        <div class="field full"><label>Name</label><input name="name" value="${escapeHtml(ME.name)}" required></div>
        <div class="field full"><label>Email</label><input type="email" name="email" value="${escapeHtml(ME.email)}" required></div>
        <div class="field"><label>Phone</label><input name="phone" value="${escapeHtml(ME.phone)}"></div>
        <div class="field"><label>Profile Image URL</label><input name="avatar" value="${escapeHtml(ME.avatar || '')}" placeholder="https://..."></div>
      </div>
      <p class="field-hint" style="margin-top:8px;">Course, year, department, group and role can only be changed by faculty.</p>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="cancelProfileEdit">Cancel</button>
        <button type="submit" class="btn btn--primary">Save Changes</button>
      </div>
    </form>
  `, {
    onMount: () => {
      document.getElementById('cancelProfileEdit').addEventListener('click', closeModal);
      document.getElementById('profileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        await updateData(CDAD_KEYS.STUDENTS, ME.id, {
          name: fd.get('name').trim(), email: fd.get('email').trim(),
          phone: fd.get('phone').trim(), avatar: fd.get('avatar').trim()
        });
        closeModal();
        showToast('Profile updated', 'success');
        await renderAll();
      });
    }
  });
}

