/* ============================================================
   CDAD :: student.js
   Drives everything on student.html.
   ============================================================ */

let ME = null;

async function refreshMe() {
  ME = await currentStudentRecord();
  return ME;
}

document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireRole('student');
  if (!user) return;
  await refreshMe();
  if (!ME) { logout(); return; }

  wireSidebarNav();
  wireLogout();
  await renderAll();
  enforceProfileCompletion();
  startLiveSync();
});

/* ================= Live sync (polling) =================
   Replaces the old same-browser-only LocalStorage 'storage' event:
   re-fetch and re-render on an interval, and immediately on tab focus. */
function startLiveSync() {
  setInterval(() => { renderAll(); }, 15000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') renderAll();
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
  if (GROUP_LOCKED && name !== 'creategroup') name = 'creategroup';
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  document.querySelectorAll('.nav-link[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ================= Mandatory group membership ================= */
/** Once profile is complete, a student must have a group before they can use anything else. */
let GROUP_LOCKED = false;

function updateGroupLockState() {
  GROUP_LOCKED = isProfileComplete(ME) && !ME.group;
  document.querySelectorAll('.nav-link[data-view]').forEach((btn) => {
    const allowed = btn.dataset.view === 'creategroup';
    if (GROUP_LOCKED && !allowed) btn.setAttribute('disabled', 'disabled');
    else btn.removeAttribute('disabled');
  });
  if (GROUP_LOCKED) showView('creategroup');
}

async function renderAll() {
  await refreshMe();
  updateGroupLockState();
  await renderTopbar();
  await renderOverview();
  renderProfile();
  await renderGroupPanel();
  await renderCreateGroupTab();
  await renderProjectPanel();
  await renderProgressPanel();
  await renderSubmissionTab();
  await renderGithub();
  await renderMarksPage();
  await renderPresentation();
  await renderPeers();
  await renderRequests();
  await renderNotifications();
  await renderAnnouncements();
}

function avatarHtml(person) {
  return person.avatar ? `<img src="${escapeHtml(person.avatar)}" alt="">` : initials(person.name);
}

/* ================= Mandatory profile completion ================= */
/** A student must have a phone number on file before they can use the rest of the app. */
function isProfileComplete(student) {
  return Boolean(student && student.phone && student.phone.trim().length > 0);
}

function enforceProfileCompletion() {
  if (isProfileComplete(ME)) return;
  showView('profile');
  openModal('Complete Your Profile', `
    <p class="field-hint" style="margin-bottom:14px;">Please add your phone number to finish setting up your account. You won't be able to use the rest of the dashboard until this is done.</p>
    <form id="completeProfileForm">
      <div class="form-grid">
        <div class="field full"><label>Name</label><input name="name" value="${escapeHtml(ME.name)}" required></div>
        <div class="field full"><label>Email</label><input type="email" name="email" value="${escapeHtml(ME.email)}" required></div>
        <div class="field full"><label>Phone Number</label><input name="phone" required placeholder="e.g. 9876543210" value="${escapeHtml(ME.phone || '')}"></div>
      </div>
      <div class="form-actions">
        <button type="submit" class="btn btn--primary">Save &amp; Continue</button>
      </div>
    </form>
  `, {
    blocking: true,
    onMount: () => {
      document.getElementById('completeProfileForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const phone = fd.get('phone').trim();
        if (!phone) { showToast('Phone number is required', 'error'); return; }
        await updateData(CDAD_KEYS.STUDENTS, ME.id, {
          name: fd.get('name').trim(),
          email: fd.get('email').trim(),
          phone
        });
        closeModal();
        showToast('Profile completed', 'success');
        await renderAll();
      });
    }
  });
}

/* ================= Topbar ================= */
async function renderTopbar() {
  const welcome = document.getElementById('welcomeMsg');
  if (welcome) welcome.textContent = `Welcome back, ${ME.name.trim().split(' ')[0]} 👋`;

  const topbarUser = document.getElementById('topbarUser');
  if (topbarUser) {
    topbarUser.innerHTML = `
      <div class="avatar">${avatarHtml(ME)}</div>
      <div class="topbar-user__text">
        <div class="topbar-user__name">${escapeHtml(ME.displayId)}</div>
        <div class="topbar-user__role">${escapeHtml(ME.name)}</div>
      </div>`;
  }

  const count = await unreadCount({ type: 'student', displayId: ME.displayId });
  const bellBadge = document.getElementById('notifBadge');
  if (bellBadge) { bellBadge.textContent = count; bellBadge.style.display = count > 0 ? 'flex' : 'none'; }
  const sideBadge = document.getElementById('sidebarNotifBadge');
  if (sideBadge) { sideBadge.textContent = count; sideBadge.style.display = count > 0 ? 'inline-flex' : 'none'; }
}

