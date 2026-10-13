/* ============================================================
   CDAD :: admin.js
   Admin panel: create / edit / delete students and faculty, bulk-import
   students from CSV, and jump to the faculty dashboard for everything else.
   ============================================================ */

let ADMIN = null;
let adminStudents = [];
let adminFaculty = [];

async function api(method, url, body) {
  const res = await fetch(url, {
    method, credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return res.ok ? { ok: true, data } : { ok: false, error: data.error || 'Request failed.' };
}

document.addEventListener('DOMContentLoaded', async () => {
  ADMIN = await getCurrentUser();
  if (!ADMIN || ADMIN.type !== 'admin') { window.location.href = 'index.html'; return; }
  document.getElementById('adminWelcome').textContent = `Signed in as ${ADMIN.name} (${ADMIN.displayId})`;

  document.querySelectorAll('.nav-link[data-view]').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${b.dataset.view}`));
    document.querySelectorAll('.nav-link[data-view]').forEach((x) => x.classList.toggle('active', x === b));
  }));
  document.getElementById('logoutBtn').addEventListener('click', logout);
  document.getElementById('addStudentBtn').addEventListener('click', () => studentModal(null));
  document.getElementById('importStudentsBtn').addEventListener('click', importModal);
  document.getElementById('addFacultyBtn').addEventListener('click', () => facultyModal(null));
  document.getElementById('studentSearch').addEventListener('input', renderStudents);
  await refresh();
});

async function refresh() {
  const [ov, st, fa] = await Promise.all([api('GET', '/api/admin/overview'), api('GET', '/api/admin/students'), api('GET', '/api/admin/faculty')]);
  adminStudents = st.ok ? st.data : [];
  adminFaculty = fa.ok ? fa.data : [];
  if (ov.ok) {
    const stat = (label, n) => `<div class="card"><div class="card__title" style="font-size:26px;">${n}</div><div class="card__meta">${label}</div></div>`;
    document.getElementById('adminStats').innerHTML =
      stat('Students', ov.data.students) + stat('Faculty', ov.data.faculty) + stat('Sections', ov.data.sections) +
      stat('Groups', ov.data.groups) + stat('Projects', ov.data.projects) + stat('Presentations', ov.data.presentations);
  }
  renderStudents();
  renderFaculty();
}

/* ---------------- Students ---------------- */
function renderStudents() {
  const q = document.getElementById('studentSearch').value.trim().toLowerCase();
  const list = adminStudents.filter((s) => !q || `${s.displayId} ${s.name} ${s.section} ${s.email}`.toLowerCase().includes(q));
  document.getElementById('studentCount').textContent = `${list.length} of ${adminStudents.length}`;
  const host = document.getElementById('studentsBody');
  host.innerHTML = list.length ? list.slice(0, 300).map((s) => `
    <tr>
      <td class="mono">${escapeHtml(s.displayId)}</td>
      <td><strong>${escapeHtml(s.name)}</strong></td>
      <td>${escapeHtml(s.email || '—')}</td>
      <td>${s.section ? `<span class="badge badge--info">${escapeHtml(s.section)}</span>` : '—'}</td>
      <td>${escapeHtml(s.group || '—')}</td>
      <td><span class="badge ${statusBadgeClass(s.status)}">${escapeHtml(s.status)}</span></td>
      <td class="table-actions">
        <button class="btn btn--ghost btn--sm" data-edit-student="${s.id}">Edit ✎</button>
        <button class="btn btn--danger btn--sm" data-del-student="${s.id}">Delete</button>
      </td>
    </tr>`).join('') : '<tr class="empty-row"><td colspan="7">No students found.</td></tr>';
  host.querySelectorAll('[data-edit-student]').forEach((b) => b.addEventListener('click', () => studentModal(adminStudents.find((s) => String(s.id) === b.dataset.editStudent))));
  host.querySelectorAll('[data-del-student]').forEach((b) => b.addEventListener('click', () => {
    const s = adminStudents.find((x) => String(x.id) === b.dataset.delStudent);
    confirmDelete(`Delete student ${s.name} (${s.displayId})? Their marks and requests are removed too.`, async () => {
      await api('DELETE', `/api/admin/students/${s.id}`);
      showToast('Student deleted', 'success');
      await refresh();
    });
  }));
}

function studentModal(s) {
  openModal(s ? `Edit Student — ${s.displayId}` : 'Add Student', `
    <form id="adminStudentForm">
      <div class="login-error" id="adminFormError"></div>
      <div class="form-grid">
        <div class="field"><label>Enrollment No. / Student ID</label><input name="displayId" ${s ? 'disabled' : 'required'} value="${escapeHtml(s?.displayId || '')}"></div>
        <div class="field"><label>Name</label><input name="name" required value="${escapeHtml(s?.name || '')}"></div>
        <div class="field"><label>Email</label><input type="email" name="email" value="${escapeHtml(s?.email || '')}"></div>
        <div class="field"><label>Phone</label><input name="phone" value="${escapeHtml(s?.phone || '')}"></div>
        <div class="field"><label>Section</label><input name="section" placeholder="e.g. A" value="${escapeHtml(s?.section || '')}"></div>
        <div class="field"><label>Course</label><input name="course" value="${escapeHtml(s?.course || '')}"></div>
        <div class="field"><label>Year</label><input name="year" value="${escapeHtml(s?.year || '')}"></div>
        <div class="field"><label>Department</label><input name="department" value="${escapeHtml(s?.department || '')}"></div>
        <div class="field"><label>Password</label><input name="password" placeholder="${s ? 'Leave blank to keep current' : 'Default: PASS123'}"></div>
        ${s ? `<div class="field"><label>Status</label><select name="status"><option ${s.status === 'Active' ? 'selected' : ''}>Active</option><option ${s.status === 'Inactive' ? 'selected' : ''}>Inactive</option></select></div>` : ''}
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="adminFormCancel">Cancel</button>
        <button type="submit" class="btn btn--primary">${s ? 'Save' : 'Add Student'}</button>
      </div>
    </form>`, { onMount: () => wireForm('adminStudentForm', s ? `/api/admin/students/${s.id}` : '/api/admin/students', s ? 'PUT' : 'POST', s ? 'Student updated' : 'Student added') });
}

/* ---------------- Faculty ---------------- */
function renderFaculty() {
  const host = document.getElementById('facultyBody');
  host.innerHTML = adminFaculty.length ? adminFaculty.map((f) => `
    <tr>
      <td class="mono">${escapeHtml(f.displayId)}</td>
      <td><strong>${escapeHtml(f.name.trim())}</strong></td>
      <td>${escapeHtml(f.email || '—')}</td>
      <td>${escapeHtml(f.department || '—')}</td>
      <td>${escapeHtml(f.designation || '—')}</td>
      <td class="table-actions">
        <button class="btn btn--ghost btn--sm" data-edit-faculty="${f.id}">Edit ✎</button>
        <button class="btn btn--danger btn--sm" data-del-faculty="${f.id}">Delete</button>
      </td>
    </tr>`).join('') : '<tr class="empty-row"><td colspan="6">No faculty yet.</td></tr>';
  host.querySelectorAll('[data-edit-faculty]').forEach((b) => b.addEventListener('click', () => facultyModal(adminFaculty.find((f) => String(f.id) === b.dataset.editFaculty))));
  host.querySelectorAll('[data-del-faculty]').forEach((b) => b.addEventListener('click', () => {
    const f = adminFaculty.find((x) => String(x.id) === b.dataset.delFaculty);
    confirmDelete(`Delete faculty ${f.name.trim()} (${f.displayId})? They will no longer be able to log in.`, async () => {
      await api('DELETE', `/api/admin/faculty/${f.id}`);
      showToast('Faculty deleted', 'success');
      await refresh();
    });
  }));
}

function facultyModal(f) {
  openModal(f ? `Edit Faculty — ${f.displayId}` : 'Add Faculty', `
    <form id="adminFacultyForm">
      <div class="login-error" id="adminFormError"></div>
      <div class="form-grid">
        <div class="field"><label>Faculty ID</label><input name="displayId" ${f ? 'disabled' : 'required'} placeholder="e.g. FAC002" value="${escapeHtml(f?.displayId || '')}"></div>
        <div class="field"><label>Name</label><input name="name" required value="${escapeHtml(f?.name?.trim() || '')}"></div>
        <div class="field"><label>Email</label><input type="email" name="email" value="${escapeHtml(f?.email || '')}"></div>
        <div class="field"><label>Phone</label><input name="phone" value="${escapeHtml(f?.phone || '')}"></div>
        <div class="field"><label>Department</label><input name="department" value="${escapeHtml(f?.department || '')}"></div>
        <div class="field"><label>Designation</label><input name="designation" value="${escapeHtml(f?.designation || '')}"></div>
        <div class="field full"><label>Password</label><input name="password" placeholder="${f ? 'Leave blank to keep current' : 'Default: faculty123'}"></div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="adminFormCancel">Cancel</button>
        <button type="submit" class="btn btn--primary">${f ? 'Save' : 'Add Faculty'}</button>
      </div>
    </form>`, { onMount: () => wireForm('adminFacultyForm', f ? `/api/admin/faculty/${f.id}` : '/api/admin/faculty', f ? 'PUT' : 'POST', f ? 'Faculty updated' : 'Faculty added') });
}

/** Shared submit handler: sends the non-disabled form fields as JSON, shows server errors inline. */
function wireForm(formId, url, method, successMsg) {
  document.getElementById('adminFormCancel').addEventListener('click', closeModal);
  document.getElementById(formId).addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(e.target).entries());
    const r = await api(method, url, body);
    if (!r.ok) {
      const el = document.getElementById('adminFormError');
      el.textContent = r.error; el.classList.add('show');
      return;
    }
    closeModal();
    showToast(successMsg, 'success');
    await refresh();
  });
}

/* ---------------- CSV import ---------------- */
function parseCsvRows(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim()));
}

function importModal() {
  openModal('Import Students from CSV', `
    <p class="field-hint" style="margin-bottom:14px;">Columns: <strong>Enrollment No.</strong> and <strong>Name</strong> are required; Email, Phone, Section and Password are optional. Existing IDs are skipped.</p>
    <div class="field full" style="margin-bottom:14px;"><label>CSV File</label><input type="file" id="adminCsv" accept=".csv,text/csv"></div>
    <div id="adminCsvPreview" style="margin-bottom:14px;"></div>
    <div class="form-actions">
      <button type="button" class="btn btn--ghost" id="adminCsvCancel">Cancel</button>
      <button type="button" class="btn btn--primary" id="adminCsvGo" disabled>Import</button>
    </div>`, {
    onMount: () => {
      let parsed = [];
      document.getElementById('adminCsvCancel').addEventListener('click', closeModal);
      document.getElementById('adminCsv').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const rows = parseCsvRows(await file.text());
        const find = (names) => rows[0]?.findIndex((h) => names.includes(h.trim().toUpperCase().replace(/\s+/g, ' '))) ?? -1;
        const col = {
          displayId: find(['ENROLLMENT NO.', 'ENROLLMENT NO', 'ENROLLMENT_NO', 'STUDENT ID', 'ID']),
          name: find(['NAME', 'NAME OF STUDENT', 'STUDENT NAME']),
          email: find(['EMAIL', 'EMAIL (OPTIONAL)']), phone: find(['PHONE', 'PHONE (OPTIONAL)']),
          section: find(['SECTION', 'DIVISION', 'DIV']), password: find(['PASSWORD', 'PASSWORD (OPTIONAL)'])
        };
        const out = document.getElementById('adminCsvPreview');
        if (col.displayId < 0 || col.name < 0) {
          out.innerHTML = '<div class="login-error show" style="display:block;">Need "Enrollment No." and "Name" columns in the header row.</div>';
          document.getElementById('adminCsvGo').disabled = true;
          return;
        }
        parsed = rows.slice(1).map((r) => Object.fromEntries(Object.entries(col).map(([k, i]) => [k, i >= 0 ? (r[i] || '').trim() : ''])))
          .filter((r) => r.displayId && r.name);
        out.innerHTML = `<div class="list-item"><div class="list-item__body"><strong>${parsed.length}</strong> student(s) ready to import.</div></div>`;
        document.getElementById('adminCsvGo').disabled = !parsed.length;
      });
      document.getElementById('adminCsvGo').addEventListener('click', async () => {
        const r = await api('POST', '/api/admin/students/import', { students: parsed });
        closeModal();
        if (!r.ok) return showToast(r.error, 'error');
        showToast(`Imported ${r.data.added} student(s)${r.data.skipped.length ? `, skipped ${r.data.skipped.length}` : ''}`, 'success');
        await refresh();
      });
    }
  });
}
