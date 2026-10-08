/* ============================================================
   CDAD :: faculty.js
   Drives everything on faculty.html — full CRUD surface.
   ============================================================ */

let FAC = null;

document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireRole('faculty');
  if (!user) return;
  FAC = await currentFacultyRecord();
  if (!FAC) { logout(); return; }

  wireSidebarNav();
  wireLogout();
  wireStaticButtons();
  await renderAll();
  startLiveSync();
});

/* ================= Live sync (polling) =================
   Replaces the old same-browser-only LocalStorage 'storage' event:
   re-check the session and re-render on an interval, and immediately
   on tab focus. If the session was invalidated elsewhere (reseed,
   logout), redirect to login instead of leaving FAC stale. */
function startLiveSync() {
  const tick = async () => {
    const updated = await currentFacultyRecord();
    if (!updated) { logout(); return; }
    FAC = updated;
    await renderAll();
  };
  setInterval(tick, 15000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tick();
  });
}

function wireSidebarNav() {
  document.querySelectorAll('.nav-link[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });
}
function wireLogout() {
  const btn = document.getElementById('logoutBtn');
  if (btn) btn.addEventListener('click', logout);
}
function showView(name) {
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  document.querySelectorAll('.nav-link[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

let studentsPage = 1;
const STUDENTS_PAGE_SIZE = 5;

function wireStaticButtons() {
  const map = {
    addStudentBtn: openAddStudentModal,
    importStudentsBtn: openImportStudentsModal,
    deleteAllStudentsBtn: confirmDeleteAllStudents,
    addGroupBtn: openAddGroupModal,
    addProjectBtn: openAddProjectModal,
    addPresentationBtn: openAddPresentationModal,
    addAnnouncementBtn: openAddAnnouncementModal,
    addNotificationBtn: openAddNotificationModal,
    editFacultyProfileBtn: openEditFacultyProfileModal,
    exportStudentsBtn: exportStudentsCsv,
    clearActivityBtn: () => confirmDelete('Clear the entire activity history?', async () => { await clearActivityLog(); showToast('Activity history cleared', 'info'); await renderAll(); })
  };
  Object.entries(map).forEach(([id, handler]) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
  });
  const studentSearch = document.getElementById('studentSearch');
  if (studentSearch) studentSearch.addEventListener('input', () => { studentsPage = 1; renderStudents(); });
  const studentGroupFilter = document.getElementById('studentGroupFilter');
  if (studentGroupFilter) studentGroupFilter.addEventListener('change', () => { studentsPage = 1; renderStudents(); });
  const studentStatusFilter = document.getElementById('studentStatusFilter');
  if (studentStatusFilter) studentStatusFilter.addEventListener('change', () => { studentsPage = 1; renderStudents(); });
}

async function exportStudentsCsv() {
  const students = await getData(CDAD_KEYS.STUDENTS);
  const header = ['Student ID', 'Name', 'Email', 'Group', 'Course', 'Year', 'Status'];
  const rows = students.map((s) => [s.displayId, s.name, s.email, s.group, s.course, s.year, s.status]);
  const csv = [header, ...rows].map((r) => r.map((v) => `"${String(v || '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'cdad-students.csv';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
  showToast('Students exported', 'success');
}

/** Wipes every student record. Groups' member lists/leaders fall out
    automatically (students.group_id disappears with the row; the
    team_leader_id FK is ON DELETE SET NULL) — see server/db.js. */
async function confirmDeleteAllStudents() {
  const students = await getData(CDAD_KEYS.STUDENTS);
  const count = students.length;
  if (count === 0) { showToast('There are no students to delete.', 'info'); return; }
  confirmDelete(`Delete all ${count} students? Every group's member list and leader will also be cleared. This cannot be undone.`, async () => {
    await fetch('/api/students', { method: 'DELETE', credentials: 'include' });
    showToast(`Deleted ${count} students`, 'success');
    await renderAll();
  });
}

async function renderAll() {
  await renderTopbar();
  renderSidebarUser();
  await renderOverview();
  await renderStudents();
  await renderGroups();
  await renderProjects();
  await renderMarksTable();
  await renderPresentations();
  await renderSubmissionsHub();
  await renderRequests();
  await renderNotifications();
  await renderAnnouncements();
  renderFacultyProfile();
  await renderActivity();
}

/* ================= Sidebar / Topbar ================= */
function renderSidebarUser() { /* sidebar shows nav only in this theme; user lives in the topbar */ }

async function renderTopbar() {
  const welcome = document.getElementById('welcomeMsg');
  if (welcome) welcome.textContent = `Welcome back, ${FAC.name.split(' ')[0]} 👋`;
  const topbarUser = document.getElementById('topbarUser');
  if (topbarUser) {
    topbarUser.innerHTML = `
      <div class="avatar">${FAC.avatar ? `<img src="${escapeHtml(FAC.avatar)}">` : initials(FAC.name)}</div>
      <div class="topbar-user__text">
        <div class="topbar-user__name">${escapeHtml(FAC.displayId)}</div>
        <div class="topbar-user__role">${escapeHtml(FAC.name)}</div>
      </div>`;
  }
  const unread = await unreadCount({ type: 'faculty', displayId: FAC.displayId });
  const requests = await allRequests();
  const count = unread + requests.filter((r) => r.status === 'Pending').length;
  const bellBadge = document.getElementById('notifBadge');
  if (bellBadge) { bellBadge.textContent = count; bellBadge.style.display = count > 0 ? 'flex' : 'none'; }
  const sideBadge = document.getElementById('sidebarNotifBadge');
  if (sideBadge) { sideBadge.textContent = count; sideBadge.style.display = count > 0 ? 'inline-flex' : 'none'; }
}

/* ================= Overview: dashboard cards + charts (Sections 13/14) ================= */
async function renderOverview() {
  const host = document.getElementById('overviewStats');
  if (!host) return;
  const students = await getData(CDAD_KEYS.STUDENTS);
  const groups = await getData(CDAD_KEYS.GROUPS);
  const projects = await getData(CDAD_KEYS.PROJECTS);
  const requests = await getData(CDAD_KEYS.REQUESTS);
  const peerRequests = await allStudentRequests();
  const activeProjects = projects.filter((p) => p.status !== 'Completed').length;
  const completedProjects = projects.filter((p) => p.status === 'Completed').length;
  const pendingRequests = requests.filter((r) => r.status === 'Pending').length + peerRequests.filter((r) => r.status === 'Pending').length;

  host.innerHTML = `
    <div class="stat-tile"><div class="stat-tile__label">Total Students</div><div class="stat-tile__value">${students.length}</div><div class="stat-tile__sub">${students.filter(s=>s.status==='Active').length} active</div></div>
    <div class="stat-tile stat-tile--blue"><div class="stat-tile__label">Total Groups</div><div class="stat-tile__value">${groups.length}</div><div class="stat-tile__sub">${groups.filter(g=>g.status==='Active').length} active</div></div>
    <div class="stat-tile stat-tile--teal"><div class="stat-tile__label">Active Projects</div><div class="stat-tile__value">${activeProjects}</div><div class="stat-tile__sub">${completedProjects} completed</div></div>
    <div class="stat-tile stat-tile--rose"><div class="stat-tile__label">Pending Requests</div><div class="stat-tile__value">${pendingRequests}</div><div class="stat-tile__sub">across all types</div></div>`;

  // Group progress chart
  const chartHost = document.getElementById('groupProgressChart');
  if (chartHost) {
    chartHost.innerHTML = groups.length ? groups.map((g) => `
      <div class="bar-row">
        <div class="bar-row__label">${escapeHtml(g.displayId)} &middot; ${escapeHtml(g.name)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${g.progress || 0}%"></div></div>
        <div class="bar-row__value">${g.progress || 0}%</div>
      </div>`).join('') : emptyState('No groups yet.');
  }

  // Project status donut-ish legend (css bars as substitute)
  const statusHost = document.getElementById('projectStatusChart');
  if (statusHost) {
    const byStatus = {};
    projects.forEach((p) => { byStatus[p.status] = (byStatus[p.status] || 0) + 1; });
    const total = projects.length || 1;
    statusHost.innerHTML = Object.keys(byStatus).length ? Object.entries(byStatus).map(([status, count]) => `
      <div class="bar-row">
        <div class="bar-row__label">${escapeHtml(status)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round((count/total)*100)}%"></div></div>
        <div class="bar-row__value">${count}</div>
      </div>`).join('') : emptyState('No projects yet.');
  }
}

/* ================= Students (Section 1) ================= */
async function renderStudents() {
  const host = document.getElementById('studentsTableBody');
  if (!host) return;
  const groups = await getData(CDAD_KEYS.GROUPS);
  const groupFilterEl = document.getElementById('studentGroupFilter');
  if (groupFilterEl && groupFilterEl.dataset.built !== '1') {
    groupFilterEl.innerHTML = `<option value="">All Groups</option>` + groups.map((g) => `<option value="${g.displayId}">${g.displayId}</option>`).join('');
    groupFilterEl.dataset.built = '1';
  }
  const search = (document.getElementById('studentSearch')?.value || '').toLowerCase();
  const groupFilter = document.getElementById('studentGroupFilter')?.value || '';
  const statusFilter = document.getElementById('studentStatusFilter')?.value || '';

  let students = await getData(CDAD_KEYS.STUDENTS);
  if (search) students = students.filter((s) => (s.name + s.email + s.displayId).toLowerCase().includes(search));
  if (groupFilter) students = students.filter((s) => s.group === groupFilter);
  if (statusFilter) students = students.filter((s) => s.status === statusFilter);

  const totalPages = Math.max(1, Math.ceil(students.length / STUDENTS_PAGE_SIZE));
  if (studentsPage > totalPages) studentsPage = totalPages;
  const pageStudents = students.slice((studentsPage - 1) * STUDENTS_PAGE_SIZE, studentsPage * STUDENTS_PAGE_SIZE);

  const projects = await getData(CDAD_KEYS.PROJECTS);
  const marks = await getData(CDAD_KEYS.MARKS);

  host.innerHTML = pageStudents.length ? pageStudents.map((s) => {
    const group = groups.find((g) => g.displayId === s.group);
    const project = group ? projects.find((p) => p.displayId === group.project) : null;
    const marksRec = marks.find((m) => m.studentId === s.displayId);
    const totals = marksRec ? deriveMarkTotals(marksRec) : null;
    return `
    <tr>
      <td class="mono">${escapeHtml(s.displayId)}</td>
      <td>
        <div class="row-name">
          <div class="avatar" style="width:32px;height:32px;font-size:11px;">${s.avatar ? `<img src="${escapeHtml(s.avatar)}">` : initials(s.name)}</div>
          <div class="row-name__text"><strong>${escapeHtml(s.name)}</strong><span>${escapeHtml(s.email)}</span></div>
        </div>
      </td>
      <td>${escapeHtml(s.group || '—')}</td>
      <td>${project ? escapeHtml(project.title) : '—'}</td>
      <td>
        <div class="progress-cell">
          <div class="bar-track"><div class="bar-fill" style="width:${project ? project.progress : 0}%"></div></div>
          <span>${project ? project.progress : 0}%</span>
        </div>
      </td>
      <td>${totals ? totals.total + ' / ' + totals.max : '—'}</td>
      <td><span class="badge ${statusBadgeClass(s.status)}">${escapeHtml(s.status)}</span></td>
      <td class="table-actions">
        <button class="btn btn--ghost btn--sm" data-edit-student="${s.id}">Edit ✎</button>
        <button class="btn btn--danger btn--sm" data-del-student="${s.id}">Delete</button>
      </td>
    </tr>`;
  }).join('') : `<tr class="empty-row"><td colspan="8">No students match your filters.</td></tr>`;

  host.querySelectorAll('[data-edit-student]').forEach((b) => b.addEventListener('click', () => openEditStudentModal(b.dataset.editStudent)));
  host.querySelectorAll('[data-del-student]').forEach((b) => b.addEventListener('click', async () => {
    const s = await findData(CDAD_KEYS.STUDENTS, b.dataset.delStudent);
    confirmDelete(`Delete student ${s.name} (${s.displayId})? Group membership and marks will be cleaned up.`, async () => {
      if (s.group) {
        const group = await getGroup(s.group);
        if (group) await removeMember(group.id, s.displayId);
      }
      await deleteData(CDAD_KEYS.STUDENTS, s.id);
      showToast('Student deleted', 'success');
      await renderAll();
    });
  }));

  renderStudentsPagination(students.length, totalPages);
}

function renderStudentsPagination(total, totalPages) {
  const host = document.getElementById('studentsPagination');
  if (!host) return;
  const start = total === 0 ? 0 : (studentsPage - 1) * STUDENTS_PAGE_SIZE + 1;
  const end = Math.min(studentsPage * STUDENTS_PAGE_SIZE, total);

  const pageButtons = [];
  const maxButtons = 5;
  let from = Math.max(1, studentsPage - Math.floor(maxButtons / 2));
  let to = Math.min(totalPages, from + maxButtons - 1);
  from = Math.max(1, to - maxButtons + 1);
  for (let p = from; p <= to; p++) {
    pageButtons.push(`<button class="page-btn ${p === studentsPage ? 'active' : ''}" data-page="${p}">${p}</button>`);
  }

  host.innerHTML = `
    <div class="pagination__info">Showing ${start} to ${end} of ${total} students</div>
    <div class="pagination__pages">
      <button class="page-btn" id="pagePrev" ${studentsPage === 1 ? 'disabled' : ''}>‹</button>
      ${pageButtons.join('')}
      <button class="page-btn" id="pageNext" ${studentsPage === totalPages ? 'disabled' : ''}>›</button>
    </div>`;

  host.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => { studentsPage = Number(b.dataset.page); renderStudents(); }));
  const prev = document.getElementById('pagePrev');
  const next = document.getElementById('pageNext');
  if (prev) prev.addEventListener('click', () => { if (studentsPage > 1) { studentsPage--; renderStudents(); } });
  if (next) next.addEventListener('click', () => { if (studentsPage < totalPages) { studentsPage++; renderStudents(); } });
}

function openAddStudentModal() { studentFormModal('Add Student', null); }
async function openEditStudentModal(id) { studentFormModal('Edit Student', await findData(CDAD_KEYS.STUDENTS, id)); }

/* ================= Bulk import students from CSV ================= */
/** Minimal dependency-free CSV parser. Handles quoted fields and commas inside quotes. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') pushField();
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') pushRow();
      else field += c;
    }
  }
  if (field.length || row.length) pushRow();
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/** Finds the column index whose header loosely matches any of the given aliases. */
function findColumn(headers, aliases) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normHeaders = headers.map(norm);
  for (const alias of aliases) {
    const idx = normHeaders.indexOf(norm(alias));
    if (idx !== -1) return idx;
  }
  return -1;
}

function openImportStudentsModal() {
  openModal('Import Students from CSV', `
    <p class="field-hint" style="margin-bottom:14px;">Upload a CSV with columns for Enrollment No. and Name (matches the roster template — Email, Phone, Group, and Password columns are optional). Existing Student IDs are skipped, not overwritten.</p>
    <div class="field full" style="margin-bottom:14px;">
      <label>CSV File</label>
      <input type="file" id="csvFileInput" accept=".csv,text/csv">
    </div>
    <div id="importPreview" style="margin-bottom:14px;"></div>
    <div class="form-actions">
      <button type="button" class="btn btn--ghost" id="cancelImport">Cancel</button>
      <button type="button" class="btn btn--primary" id="confirmImportBtn" disabled>Import Students</button>
    </div>
  `, {
    onMount: () => {
      let parsedRows = [];
      document.getElementById('cancelImport').addEventListener('click', closeModal);

      document.getElementById('csvFileInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
          const rows = parseCsv(evt.target.result);
          if (rows.length < 2) {
            document.getElementById('importPreview').innerHTML = `<div class="login-error show" style="display:block;">No data rows found in this file.</div>`;
            return;
          }
          const headers = rows[0];
          const idCol = findColumn(headers, ['ENROLLMENT NO.', 'ENROLLMENT NO', 'ENROLLMENTNO', 'STUDENT ID', 'ID']);
          const nameCol = findColumn(headers, ['NAME OF STUDENT', 'NAME', 'STUDENT NAME']);
          const emailCol = findColumn(headers, ['EMAIL (optional)', 'EMAIL']);
          const phoneCol = findColumn(headers, ['PHONE (optional)', 'PHONE', 'PHONE NUMBER']);
          const groupCol = findColumn(headers, ['GROUP (optional)', 'GROUP']);
          const passCol = findColumn(headers, ['PASSWORD (optional)', 'PASSWORD']);

          if (idCol === -1 || nameCol === -1) {
            document.getElementById('importPreview').innerHTML = `<div class="login-error show" style="display:block;">Couldn't find "Enrollment No." and "Name" columns in the header row. Check your CSV matches the template.</div>`;
            document.getElementById('confirmImportBtn').disabled = true;
            return;
          }

          const existingIds = new Set((await getData(CDAD_KEYS.STUDENTS)).map((s) => s.displayId.toLowerCase()));
          const dataRows = rows.slice(1);
          const totalDataRows = dataRows.length;

          const invalidRows = []; // rows missing ID or Name
          const rawParsed = dataRows.map((r, idx) => {
            const displayId = (r[idCol] || '').trim();
            const name = (r[nameCol] || '').trim();
            if (!displayId || !name) invalidRows.push({ line: idx + 2, displayId, name }); // +2: header is line 1, data starts at line 2
            return {
              displayId,
              name,
              email: emailCol !== -1 ? (r[emailCol] || '').trim() : '',
              phone: phoneCol !== -1 ? (r[phoneCol] || '').trim() : '',
              group: groupCol !== -1 ? (r[groupCol] || '').trim() : '',
              password: passCol !== -1 ? (r[passCol] || '').trim() : ''
            };
          });

          const validRows = rawParsed.filter((r) => r.displayId && r.name);
          const duplicateRows = validRows.filter((r) => existingIds.has(r.displayId.toLowerCase()));
          parsedRows = validRows.filter((r) => !existingIds.has(r.displayId.toLowerCase()));

          document.getElementById('importPreview').innerHTML = `
            <div class="list-item">
              <div class="list-item__body"><strong>${totalDataRows}</strong> data row(s) found in the file.</div>
              <div class="list-item__body"><strong>${parsedRows.length}</strong> will be imported.</div>
              ${invalidRows.length ? `<div class="list-item__body" style="color:var(--red);">${invalidRows.length} row(s) skipped — missing Enrollment No. or Name (line ${invalidRows.slice(0, 8).map((r) => r.line).join(', ')}${invalidRows.length > 8 ? ', …' : ''}).</div>` : ''}
              ${duplicateRows.length ? `<div class="list-item__body" style="color:var(--orange);">${duplicateRows.length} row(s) skipped — Student ID already exists (${duplicateRows.slice(0, 8).map((r) => escapeHtml(r.displayId)).join(', ')}${duplicateRows.length > 8 ? ', …' : ''}).</div>` : ''}
              <div class="list-item__body faint">First row to import: ${parsedRows[0] ? escapeHtml(parsedRows[0].displayId) + ' — ' + escapeHtml(parsedRows[0].name) : '—'}</div>
            </div>`;
          document.getElementById('confirmImportBtn').disabled = parsedRows.length === 0;
        };
        reader.readAsText(file);
      });

      document.getElementById('confirmImportBtn').addEventListener('click', async () => {
        const existingIds = new Set((await getData(CDAD_KEYS.STUDENTS)).map((s) => s.displayId.toLowerCase()));
        let imported = 0;
        for (const r of parsedRows) {
          if (existingIds.has(r.displayId.toLowerCase())) continue;
          const newStudent = {
            displayId: r.displayId,
            name: r.name,
            email: r.email || '',
            password: r.password || 'PASS123',
            phone: r.phone || '',
            course: '', year: '', department: '',
            group: r.group || '',
            role: 'Member',
            status: 'Active',
            avatar: ''
          };
          await addData(CDAD_KEYS.STUDENTS, newStudent);
          existingIds.add(r.displayId.toLowerCase());
          imported++;
        }
        closeModal();
        showToast(`Imported ${imported} student(s)`, 'success');
        await renderAll();
      });
    }
  });
}

function studentFormModal(title, student) {
  getData(CDAD_KEYS.GROUPS).then((groups) => {
    openModal(title, `
      <form id="studentForm">
        <div class="form-grid">
          <div class="field full"><label>Name</label><input name="name" required value="${escapeHtml(student?.name || '')}"></div>
          <div class="field"><label>Email</label><input type="email" name="email" required value="${escapeHtml(student?.email || '')}"></div>
          <div class="field"><label>Password</label><input name="password" ${student ? '' : 'required'} placeholder="${student ? 'Leave blank to keep current' : ''}" value="${student ? '' : 'PASS123'}"></div>
          <div class="field"><label>Phone</label><input name="phone" value="${escapeHtml(student?.phone || '')}"></div>
          <div class="field">
            <label>Course</label>
            <select name="course">
              ${['Computer Engineering','Information Technology','AI & Data Science','Electronics Engineering'].map((c) => `<option ${student?.course===c?'selected':''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Year</label><input name="year" value="${escapeHtml(student?.year || '1st Year')}"></div>
          <div class="field"><label>Department</label><input name="department" value="${escapeHtml(student?.department || 'Computer Engineering')}"></div>
          <div class="field">
            <label>Group</label>
            <select name="group">
              <option value="">— None —</option>
              ${groups.map((g) => `<option value="${g.displayId}" ${student?.group===g.displayId?'selected':''}>${g.displayId} — ${escapeHtml(g.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Role</label>
            <select name="role"><option ${student?.role==='Member'?'selected':''}>Member</option><option ${student?.role==='Team Leader'?'selected':''}>Team Leader</option></select>
          </div>
          <div class="field">
            <label>Status</label>
            <select name="status"><option ${student?.status==='Active'?'selected':''}>Active</option><option ${student?.status==='Inactive'?'selected':''}>Inactive</option></select>
          </div>
          <div class="field full"><label>Profile Image URL</label><input name="avatar" value="${escapeHtml(student?.avatar || '')}"></div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn--ghost" id="cancelStudentForm">Cancel</button>
          <button type="submit" class="btn btn--primary">Save Changes</button>
        </div>
      </form>
    `, {
      onMount: () => {
        document.getElementById('cancelStudentForm').addEventListener('click', closeModal);
        document.getElementById('studentForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const fields = {
            name: fd.get('name').trim(), email: fd.get('email').trim(),
            phone: fd.get('phone').trim(), course: fd.get('course'), year: fd.get('year').trim(),
            department: fd.get('department').trim(), group: fd.get('group'), role: fd.get('role'),
            status: fd.get('status'), avatar: fd.get('avatar').trim()
          };
          const password = fd.get('password');
          if (password) fields.password = password;

          if (student) {
            await updateData(CDAD_KEYS.STUDENTS, student.id, fields);
            showToast('Student updated', 'success');
          } else {
            await addData(CDAD_KEYS.STUDENTS, fields);
            showToast('Student added', 'success');
          }
          closeModal();
          await renderAll();
        });
      }
    });
  });
}

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

/* ================= Marks (Section 5) ================= */
async function renderMarksTable() {
  const host = document.getElementById('marksTableBody');
  if (!host) return;
  const students = await getData(CDAD_KEYS.STUDENTS);
  const marks = await allMarks();
  host.innerHTML = students.length ? students.map((s) => {
    const m = marks.find((x) => x.studentId === s.displayId);
    const t = m ? deriveMarkTotals(m) : null;
    return `
      <tr>
        <td><div class="row-name__text"><strong>${escapeHtml(s.name)}</strong><span class="mono">${escapeHtml(s.displayId)}</span></div></td>
        <td>${m ? m.internal + '/' + m.internalMax : '—'}</td>
        <td>${m ? m.project + '/' + m.projectMax : '—'}</td>
        <td>${m ? m.presentation + '/' + m.presentationMax : '—'}</td>
        <td>${m ? m.viva + '/' + m.vivaMax : '—'}</td>
        <td>${t ? t.total + '/' + t.max : '—'}</td>
        <td>${t ? t.percentage + '%' : '—'}</td>
        <td>${t ? `<span class="badge badge--info">${t.grade}</span>` : '—'}</td>
        <td class="table-actions">
          <button class="btn btn--ghost btn--sm" data-edit-marks="${s.displayId}">Edit ✎</button>
          ${m ? `<button class="btn btn--ghost btn--sm" data-reset-marks="${m.id}">Reset</button><button class="btn btn--danger btn--sm" data-del-marks="${m.id}">Delete</button>` : ''}
        </td>
      </tr>`;
  }).join('') : `<tr class="empty-row"><td colspan="9">No students yet.</td></tr>`;

  host.querySelectorAll('[data-edit-marks]').forEach((b) => b.addEventListener('click', () => openMarksModal(b.dataset.editMarks)));
  host.querySelectorAll('[data-reset-marks]').forEach((b) => b.addEventListener('click', () => {
    confirmDelete('Reset all marks for this student to zero?', async () => { await resetMarks(b.dataset.resetMarks); showToast('Marks reset', 'info'); await renderAll(); });
  }));
  host.querySelectorAll('[data-del-marks]').forEach((b) => b.addEventListener('click', () => {
    confirmDelete("Delete this student's marks record?", async () => { await deleteMarks(b.dataset.delMarks); showToast('Marks deleted', 'success'); await renderAll(); });
  }));
}

async function openMarksModal(studentDisplayId) {
  const m = (await marksForStudent(studentDisplayId)) || { internal: 0, internalMax: 20, project: 0, projectMax: 40, presentation: 0, presentationMax: 20, viva: 0, vivaMax: 10 };
  openModal(`Edit Marks — ${studentDisplayId}`, `
    <form id="marksForm">
      <div class="form-grid">
        <div class="field"><label>Internal (/${m.internalMax})</label><input type="number" name="internal" min="0" max="${m.internalMax}" value="${m.internal}"></div>
        <div class="field"><label>Project (/${m.projectMax})</label><input type="number" name="project" min="0" max="${m.projectMax}" value="${m.project}"></div>
        <div class="field"><label>Presentation (/${m.presentationMax})</label><input type="number" name="presentation" min="0" max="${m.presentationMax}" value="${m.presentation}"></div>
        <div class="field"><label>Viva (/${m.vivaMax})</label><input type="number" name="viva" min="0" max="${m.vivaMax}" value="${m.viva}"></div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="cancelMarksForm">Cancel</button>
        <button type="submit" class="btn btn--primary">Save Marks</button>
      </div>
    </form>
  `, {
    onMount: () => {
      document.getElementById('cancelMarksForm').addEventListener('click', closeModal);
      document.getElementById('marksForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        await upsertMarks(studentDisplayId, {
          internal: Number(fd.get('internal')) || 0,
          project: Number(fd.get('project')) || 0,
          presentation: Number(fd.get('presentation')) || 0,
          viva: Number(fd.get('viva')) || 0
        });
        closeModal();
        showToast('Marks saved', 'success');
        await renderAll();
      });
    }
  });
}

/* ================= Presentations (Section 6) ================= */
async function renderPresentations() {
  const host = document.getElementById('presentationsTableBody');
  if (!host) return;
  const list = await allPresentations();
  host.innerHTML = list.length ? list.map((p) => `
    <tr>
      <td class="mono">${escapeHtml(p.displayId)}</td>
      <td>${escapeHtml(p.group)}</td>
      <td>${escapeHtml(p.project)}</td>
      <td>${formatDate(p.date)} ${escapeHtml(p.time)}</td>
      <td>${escapeHtml(p.venue)}</td>
      <td><span class="badge ${statusBadgeClass(p.status)}">${escapeHtml(p.status)}</span></td>
      <td class="table-actions">
        <button class="btn btn--ghost btn--sm" data-edit-pres="${p.id}">Edit ✎</button>
        <button class="btn btn--ghost btn--sm" data-complete-pres="${p.id}">Complete</button>
        <button class="btn btn--ghost btn--sm" data-cancel-pres="${p.id}">Cancel</button>
        <button class="btn btn--danger btn--sm" data-del-pres="${p.id}">Delete</button>
      </td>
    </tr>`).join('') : `<tr class="empty-row"><td colspan="7">No presentations scheduled.</td></tr>`;

  host.querySelectorAll('[data-edit-pres]').forEach((b) => b.addEventListener('click', async () => openPresentationModal(await findData(CDAD_KEYS.PRESENTATIONS, b.dataset.editPres))));
  host.querySelectorAll('[data-complete-pres]').forEach((b) => b.addEventListener('click', async () => { await completePresentation(b.dataset.completePres); showToast('Marked completed', 'success'); await renderAll(); }));
  host.querySelectorAll('[data-cancel-pres]').forEach((b) => b.addEventListener('click', async () => { await cancelPresentation(b.dataset.cancelPres); showToast('Presentation cancelled', 'info'); await renderAll(); }));
  host.querySelectorAll('[data-del-pres]').forEach((b) => b.addEventListener('click', () => {
    confirmDelete('Delete this presentation?', async () => { await deletePresentation(b.dataset.delPres); showToast('Deleted', 'success'); await renderAll(); });
  }));
}

function openAddPresentationModal() { openPresentationModal(null); }

function openPresentationModal(pres) {
  allGroups().then((groups) => {
    const isoDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
    openModal(pres ? 'Edit Presentation' : 'Schedule Presentation', `
      <form id="presForm">
        <div class="form-grid">
          <div class="field full">
            <label>Group</label>
            <select name="group" required>${groups.map((g) => `<option value="${g.displayId}" ${pres?.group===g.displayId?'selected':''}>${g.displayId} — ${escapeHtml(g.name)}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Date</label><input type="date" name="date" required value="${isoDate(pres?.date)}"></div>
          <div class="field"><label>Time</label><input type="time" name="time" required value="${escapeHtml(pres?.time || '10:00')}"></div>
          <div class="field full"><label>Venue</label><input name="venue" required value="${escapeHtml(pres?.venue || '')}"></div>
          <div class="field">
            <label>Status</label>
            <select name="status">${['Pending','Scheduled','Completed','Cancelled','Rescheduled'].map((s) => `<option ${pres?.status===s?'selected':''}>${s}</option>`).join('')}</select>
          </div>
          <div class="field full"><label>Notes</label><textarea name="notes">${escapeHtml(pres?.notes || '')}</textarea></div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn--ghost" id="cancelPresForm">Cancel</button>
          <button type="submit" class="btn btn--primary">Save</button>
        </div>
      </form>
    `, {
      onMount: () => {
        document.getElementById('cancelPresForm').addEventListener('click', closeModal);
        document.getElementById('presForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const fields = { group: fd.get('group'), date: new Date(fd.get('date')).toISOString(), time: fd.get('time'), venue: fd.get('venue').trim(), status: fd.get('status'), notes: fd.get('notes').trim(), faculty: FAC.displayId };
          if (pres) await editPresentation(pres.id, fields);
          else await createPresentation(fields);
          closeModal();
          showToast('Presentation saved', 'success');
          await renderAll();
        });
      }
    });
  });
}

/* ================= Requests (Section 10) ================= */
async function renderRequests() {
  const host = document.getElementById('requestsList');
  if (!host) return;
  const listRaw = await allRequests();
  const list = listRaw.sort((a, b) => new Date(b.date) - new Date(a.date));
  host.innerHTML = list.length ? list.map((r) => `
    <div class="list-item ${r.status === 'Pending' ? 'unread' : ''}">
      <div class="list-item__top">
        <div class="list-item__title">${escapeHtml(r.student)} — ${escapeHtml(r.type)} <span class="faint mono" style="font-weight:400;">${escapeHtml(r.displayId)}</span></div>
        <span class="badge ${statusBadgeClass(r.status)}">${escapeHtml(r.status)}</span>
      </div>
      <div class="list-item__body">${escapeHtml(r.message)}</div>
      ${r.response ? `<div class="list-item__body"><strong>Response:</strong> ${escapeHtml(r.response)}</div>` : ''}
      <div class="list-item__foot">
        ${r.status === 'Pending' ? `
          <button class="btn btn--primary btn--sm" data-accept-req="${r.id}">Accept</button>
          <button class="btn btn--ghost btn--sm" data-reject-req="${r.id}">Reject</button>` : '<span></span>'}
        <button class="btn btn--danger btn--sm" data-del-req="${r.id}">Delete</button>
      </div>
    </div>`).join('') : emptyState('No requests submitted yet.');

  host.querySelectorAll('[data-accept-req]').forEach((b) => b.addEventListener('click', () => openRespondModal(b.dataset.acceptReq, 'Accepted')));
  host.querySelectorAll('[data-reject-req]').forEach((b) => b.addEventListener('click', () => openRespondModal(b.dataset.rejectReq, 'Rejected')));
  host.querySelectorAll('[data-del-req]').forEach((b) => b.addEventListener('click', () => {
    confirmDelete('Delete this request?', async () => { await deleteRequest(b.dataset.delReq); showToast('Deleted', 'success'); await renderAll(); });
  }));

  // Peer (student-to-student) requests — read-only oversight list
  const peerHost = document.getElementById('peerRequestsMonitor');
  if (peerHost) {
    const peersRaw = await allStudentRequests();
    const peers = peersRaw.sort((a, b) => new Date(b.date) - new Date(a.date));
    peerHost.innerHTML = peers.length ? peers.map((r) => `
      <div class="list-item">
        <div class="list-item__top">
          <div class="list-item__title">${escapeHtml(r.from)} → ${escapeHtml(r.to)}</div>
          <span class="badge ${statusBadgeClass(r.status)}">${escapeHtml(r.status)}</span>
        </div>
        ${r.message ? `<div class="list-item__body">"${escapeHtml(r.message)}"</div>` : ''}
        <div class="list-item__body faint">${formatDate(r.date)}</div>
      </div>`).join('') : emptyState('No student-to-student requests yet.');
  }

  // Group join requests (student -> group leader) — read-only oversight list
  const groupJoinHost = document.getElementById('groupJoinRequestsMonitor');
  if (groupJoinHost) {
    const joinReqsRaw = await allGroupJoinRequests();
    const joinReqs = joinReqsRaw.sort((a, b) => new Date(b.date) - new Date(a.date));
    groupJoinHost.innerHTML = joinReqs.length ? joinReqs.map((r) => `
      <div class="list-item">
        <div class="list-item__top">
          <div class="list-item__title">${escapeHtml(r.from)} → ${escapeHtml(r.groupDisplayId)} <span class="faint" style="font-weight:400;">(leader ${escapeHtml(r.to)})</span></div>
          <span class="badge ${statusBadgeClass(r.status)}">${escapeHtml(r.status)}</span>
        </div>
        ${r.message ? `<div class="list-item__body">"${escapeHtml(r.message)}"</div>` : ''}
        <div class="list-item__body faint">${formatDate(r.date)}</div>
      </div>`).join('') : emptyState('No group join requests yet.');
  }
}

function openRespondModal(id, status) {
  openModal(`Mark Request as ${status}`, `
    <form id="respondForm">
      <div class="field full"><label>Response Message (optional)</label><textarea name="response" placeholder="Add a note for the student..."></textarea></div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="cancelRespond">Cancel</button>
        <button type="submit" class="btn btn--primary">Confirm ${status}</button>
      </div>
    </form>
  `, {
    onMount: () => {
      document.getElementById('cancelRespond').addEventListener('click', closeModal);
      document.getElementById('respondForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        await respondToRequest(id, status, fd.get('response').trim());
        closeModal();
        showToast(`Request ${status.toLowerCase()}`, 'success');
        await renderAll();
      });
    }
  });
}

/* ================= Notifications (Section 11) =================
   This admin view shows EVERY notification in the system (not just
   ones addressed to faculty), so it uses the dedicated unscoped
   /api/notifications/all endpoint instead of the session-scoped
   getData(CDAD_KEYS.NOTIFICATIONS). */
async function renderNotifications() {
  const host = document.getElementById('notificationsList');
  if (!host) return;
  const listRaw = await allNotificationsAdmin();
  const list = listRaw.sort((a, b) => new Date(b.date) - new Date(a.date));
  host.innerHTML = list.length ? list.map((n) => `
    <div class="list-item ${n.read ? '' : 'unread'}">
      <div class="list-item__top">
        <div class="list-item__title">${escapeHtml(n.title)} <span class="faint" style="font-weight:400;">→ ${escapeHtml(n.recipient)}</span></div>
        <span class="faint" style="font-size:11px;">${formatDateTime(n.date)}</span>
      </div>
      <div class="list-item__body">${escapeHtml(n.message)}</div>
      <div class="list-item__foot">
        <button class="btn btn--ghost btn--sm" data-toggle-read="${n.id}" data-current-read="${n.read ? '1' : '0'}">${n.read ? 'Mark unread' : 'Mark read'}</button>
        <button class="btn btn--danger btn--sm" data-del-notif="${n.id}">Delete</button>
      </div>
    </div>`).join('') : emptyState('No notifications yet.');

  host.querySelectorAll('[data-toggle-read]').forEach((b) => b.addEventListener('click', async () => {
    await markNotificationRead(b.dataset.toggleRead, b.dataset.currentRead !== '1');
    await renderAll();
  }));
  host.querySelectorAll('[data-del-notif]').forEach((b) => b.addEventListener('click', async () => { await deleteNotification(b.dataset.delNotif); showToast('Deleted', 'success'); await renderAll(); }));
}

function openAddNotificationModal() {
  Promise.all([allGroups(), getData(CDAD_KEYS.STUDENTS)]).then(([groups, students]) => {
    openModal('Create Notification', `
      <form id="notifForm">
        <div class="form-grid">
          <div class="field full"><label>Title</label><input name="title" required></div>
          <div class="field full"><label>Message</label><textarea name="message" required></textarea></div>
          <div class="field">
            <label>Recipient</label>
            <select name="recipient">
              <option value="all-students">All Students</option>
              ${groups.map((g) => `<option value="${g.displayId}">${g.displayId} — ${escapeHtml(g.name)}</option>`).join('')}
              ${students.map((s) => `<option value="${s.displayId}">${s.displayId} — ${escapeHtml(s.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Type</label>
            <select name="type"><option>info</option><option>alert</option><option>reminder</option></select>
          </div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn--ghost" id="cancelNotifForm">Cancel</button>
          <button type="submit" class="btn btn--primary">Create</button>
        </div>
      </form>
    `, {
      onMount: () => {
        document.getElementById('cancelNotifForm').addEventListener('click', closeModal);
        document.getElementById('notifForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          await createNotification({ title: fd.get('title').trim(), message: fd.get('message').trim(), recipient: fd.get('recipient'), type: fd.get('type') });
          closeModal();
          showToast('Notification created', 'success');
          await renderAll();
        });
      }
    });
  });
}

/* ================= Announcements (Section 12) ================= */
async function renderAnnouncements() {
  const host = document.getElementById('announcementsList');
  if (!host) return;
  const list = await allAnnouncements();
  host.innerHTML = list.length ? list.map((a) => `
    <div class="list-item">
      <div class="list-item__top">
        <div class="list-item__title">${escapeHtml(a.title)}</div>
        <span class="badge ${statusBadgeClass(a.priority)}">${escapeHtml(a.priority)}</span>
      </div>
      <div class="list-item__body">${escapeHtml(a.message)}</div>
      <div class="list-item__body faint">${escapeHtml(a.author)} &middot; ${formatDate(a.date)}</div>
      <div class="list-item__foot">
        <button class="btn btn--ghost btn--sm" data-edit-ann="${a.id}">Edit ✎</button>
        <button class="btn btn--danger btn--sm" data-del-ann="${a.id}">Delete</button>
      </div>
    </div>`).join('') : emptyState('No announcements yet.');

  host.querySelectorAll('[data-edit-ann]').forEach((b) => b.addEventListener('click', async () => openAnnouncementModal(await findData(CDAD_KEYS.ANNOUNCEMENTS, b.dataset.editAnn))));
  host.querySelectorAll('[data-del-ann]').forEach((b) => b.addEventListener('click', () => {
    confirmDelete('Delete this announcement?', async () => { await deleteAnnouncement(b.dataset.delAnn); showToast('Deleted', 'success'); await renderAll(); });
  }));
}

function openAddAnnouncementModal() { openAnnouncementModal(null); }

function openAnnouncementModal(ann) {
  openModal(ann ? 'Edit Announcement' : 'Create Announcement', `
    <form id="annForm">
      <div class="form-grid">
        <div class="field full"><label>Title</label><input name="title" required value="${escapeHtml(ann?.title || '')}"></div>
        <div class="field full"><label>Message</label><textarea name="message" required>${escapeHtml(ann?.message || '')}</textarea></div>
        <div class="field">
          <label>Priority</label>
          <select name="priority">${['Normal','Important','Urgent'].map((p) => `<option ${ann?.priority===p?'selected':''}>${p}</option>`).join('')}</select>
        </div>
        <div class="field">
          <label>Status</label>
          <select name="status">${['Active','Archived'].map((s) => `<option ${ann?.status===s?'selected':''}>${s}</option>`).join('')}</select>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="cancelAnnForm">Cancel</button>
        <button type="submit" class="btn btn--primary">Save</button>
      </div>
    </form>
  `, {
    onMount: () => {
      document.getElementById('cancelAnnForm').addEventListener('click', closeModal);
      document.getElementById('annForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const fields = { title: fd.get('title').trim(), message: fd.get('message').trim(), priority: fd.get('priority'), status: fd.get('status'), author: FAC.name };
        if (ann) await editAnnouncement(ann.id, fields);
        else await createAnnouncement(fields);
        closeModal();
        showToast('Announcement saved', 'success');
        await renderAll();
      });
    }
  });
}

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

/* ================= Activity Log (Section 15) ================= */
async function renderActivity() {
  const host = document.getElementById('activityList');
  if (!host) return;
  const list = await getData(CDAD_KEYS.ACTIVITY);
  host.innerHTML = list.length ? list.map((a) => `
    <div class="activity-item">
      <div class="activity-dot"></div>
      <div>
        <div>${escapeHtml(a.text)}</div>
        <div class="activity-item__time">${formatDateTime(a.date)}</div>
      </div>
    </div>`).join('') : emptyState('No activity recorded yet.');
}

/* ================= Utility ================= */
function emptyState(msg) {
  return `<div class="empty-state"><div class="empty-state__icon">—</div><p>${escapeHtml(msg)}</p></div>`;
}
