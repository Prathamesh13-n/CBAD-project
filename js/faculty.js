/* ============================================================
   CDAD :: faculty.js
   Drives everything on faculty.html — full CRUD surface.
   ============================================================ */

let FAC = null;

document.addEventListener('DOMContentLoaded', async () => {
  FAC = await currentFacultyRecord();
  if (!FAC) { window.location.href = 'index.html'; return; }
  if (FAC.type === 'admin') {
    // Admins use this dashboard with full faculty access, plus a way back to their panel.
    const nav = document.querySelector('.sidebar .nav-link');
    nav.insertAdjacentHTML('beforebegin', '<a class="nav-link" href="admin.html" style="text-decoration:none;"><span class="nav-link__icon">⚙</span> Admin Panel</a>');
  }

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

let studentSectionTab = '__all'; // '__all' | '' (no section) | section name
let studentsPage = 1;
const STUDENTS_PAGE_SIZE = 5;

function wireStaticButtons() {
  const map = {
    addStudentBtn: openAddStudentModal,
    addGroupMarksBtn: openGroupMarksModal,
    releaseAllMarksBtn: confirmReleaseAllMarks,
    importStudentsBtn: () => openImportStudentsModal(),
    assignSectionBtn: openAssignSectionModal,
    importSectionBtn: () => openImportStudentsModal({ bySection: true }),
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
  await renderExamSubmissions();
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
  if (welcome) welcome.textContent = `Welcome back, ${FAC.name.trim().split(' ')[0]} 👋`;
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

