/* ================= Faculty Profile (Section 8) ================= */
function renderFacultyProfile() {
  const host = document.getElementById('facultyProfileCard');
  if (!host) return;
  host.innerHTML = `
    <div style="display:flex; gap:18px; align-items:center; margin-bottom:16px;">
      <div class="avatar avatar--lg">${FAC.avatar ? `<img src="${escapeHtml(FAC.avatar)}">` : initials(FAC.name)}</div>
      <div>
        <div style="font-family:var(--font-display); font-size:19px;">${escapeHtml(FAC.name)}</div>
        <div class="muted mono" style="font-size:12.5px;">${escapeHtml(FAC.displayId)}</div>
      </div>
    </div>
    <div class="form-grid">
      ${['Email:'+FAC.email,'Phone:'+FAC.phone,'Department:'+FAC.department,'Designation:'+FAC.designation,'Academic Session:'+FAC.session].map((pair) => {
        const [label, value] = pair.split(':');
        return `<div class="field"><label>${label}</label><div style="font-size:13.5px; padding:9px 0;">${escapeHtml(value || '—')}</div></div>`;
      }).join('')}
    </div>`;
}

/** PUT /api/faculty/:id — the only write faculty.js makes to its own record. */
async function updateFacultyProfile(id, fields) {
  const res = await fetch(`/api/faculty/${id}`, {
    method: 'PUT', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields)
  });
  return res.ok ? res.json() : null;
}

function openEditFacultyProfileModal() {
  openModal('Edit Faculty Profile', `
    <form id="facProfileForm">
      <div class="form-grid">
        <div class="field full"><label>Name</label><input name="name" required value="${escapeHtml(FAC.name)}"></div>
        <div class="field"><label>Email</label><input type="email" name="email" required value="${escapeHtml(FAC.email)}"></div>
        <div class="field"><label>Phone</label><input name="phone" value="${escapeHtml(FAC.phone)}"></div>
        <div class="field"><label>Department</label><input name="department" value="${escapeHtml(FAC.department)}"></div>
        <div class="field"><label>Designation</label><input name="designation" value="${escapeHtml(FAC.designation)}"></div>
        <div class="field"><label>Academic Session</label><input name="session" value="${escapeHtml(FAC.session)}"></div>
        <div class="field full"><label>Profile Image URL</label><input name="avatar" value="${escapeHtml(FAC.avatar || '')}"></div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="cancelFacProfile">Cancel</button>
        <button type="submit" class="btn btn--primary">Save Changes</button>
      </div>
    </form>
  `, {
    onMount: () => {
      document.getElementById('cancelFacProfile').addEventListener('click', closeModal);
      document.getElementById('facProfileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        await updateFacultyProfile(FAC.id, {
          name: fd.get('name').trim(), email: fd.get('email').trim(), phone: fd.get('phone').trim(),
          department: fd.get('department').trim(), designation: fd.get('designation').trim(),
          session: fd.get('session').trim(), avatar: fd.get('avatar').trim()
        });
        FAC = await currentFacultyRecord();
        closeModal();
        showToast('Profile updated', 'success');
        await renderAll();
      });
    }
  });
}

