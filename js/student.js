/* ============================================================
   CDAD :: student.js
   Drives everything on student.html.
   ============================================================ */

let ME = null;

function refreshMe() {
  ME = currentStudentRecord();
  return ME;
}

document.addEventListener('DOMContentLoaded', () => {
  const user = requireRole('student');
  if (!user) return;
  refreshMe();
  if (!ME) { logout(); return; }

  wireSidebarNav();
  wireLogout();
  renderAll();
  enforceProfileCompletion();
});

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

function renderAll() {
  refreshMe();
  updateGroupLockState();
  renderTopbar();
  renderOverview();
  renderProfile();
  renderGroupPanel();
  renderCreateGroupTab();
  renderProjectPanel();
  renderProgressPanel();
  renderGithub();
  renderMarksPage();
  renderPresentation();
  renderPeers();
  renderRequests();
  renderNotifications();
  renderAnnouncements();
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
      document.getElementById('completeProfileForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const phone = fd.get('phone').trim();
        if (!phone) { showToast('Phone number is required', 'error'); return; }
        updateData(CDAD_KEYS.STUDENTS, ME.id, {
          name: fd.get('name').trim(),
          email: fd.get('email').trim(),
          phone
        });
        logActivity(`Student ${ME.displayId} completed their profile`);
        closeModal();
        showToast('Profile completed', 'success');
        renderAll();
      });
    }
  });
}

/* ================= Topbar ================= */
function renderTopbar() {
  const welcome = document.getElementById('welcomeMsg');
  if (welcome) welcome.textContent = `Welcome back, ${ME.name.split(' ')[0]} 👋`;

  const topbarUser = document.getElementById('topbarUser');
  if (topbarUser) {
    topbarUser.innerHTML = `
      <div class="avatar">${avatarHtml(ME)}</div>
      <div class="topbar-user__text">
        <div class="topbar-user__name">${escapeHtml(ME.displayId)}</div>
        <div class="topbar-user__role">${escapeHtml(ME.name)}</div>
      </div>`;
  }

  const count = unreadCount({ type: 'student', displayId: ME.displayId });
  const bellBadge = document.getElementById('notifBadge');
  if (bellBadge) { bellBadge.textContent = count; bellBadge.style.display = count > 0 ? 'flex' : 'none'; }
  const sideBadge = document.getElementById('sidebarNotifBadge');
  if (sideBadge) { sideBadge.textContent = count; sideBadge.style.display = count > 0 ? 'inline-flex' : 'none'; }
}

/* ================= Overview (Dashboard) ================= */
function renderOverview() {
  const statsHost = document.getElementById('overviewStats');
  const gridHost = document.getElementById('overviewMainGrid');
  if (!statsHost || !gridHost) return;

  const group = getGroup(ME.group);
  const project = group ? getProject(group.project) : null;
  const marksRec = marksForStudent(ME.displayId);
  const totals = marksRec ? deriveMarkTotals(marksRec) : null;
  const pres = group ? presentationsForGroup(group.displayId)[0] : null;

  statsHost.innerHTML = `
    <div class="stat-card stat-card--blue">
      <div class="stat-card__icon">▦</div>
      <div class="stat-card__label">My Group</div>
      <div class="stat-card__value">${group ? escapeHtml(group.displayId) : '—'}</div>
      <div class="stat-card__sub stat-card__sub--muted">${group ? `Team Members: ${memberCount(group)}` : 'Not assigned'}</div>
    </div>
    <div class="stat-card stat-card--green">
      <div class="stat-card__icon">◔</div>
      <div class="stat-card__label">Project Progress</div>
      <div class="stat-card__value">${project ? project.progress : 0}%</div>
      <div class="stat-card__sub stat-card__sub--good">${project ? escapeHtml(project.status) : 'No project'}</div>
      <div class="stat-card__bar"><div class="bar-track"><div class="bar-fill" style="width:${project ? project.progress : 0}%"></div></div></div>
    </div>
    <div class="stat-card stat-card--purple">
      <div class="stat-card__icon">▤</div>
      <div class="stat-card__label">Current Marks</div>
      <div class="stat-card__value">${totals ? totals.total + ' / ' + totals.max : '—'}</div>
      <div class="stat-card__sub stat-card__sub--good">${totals ? (totals.percentage >= 60 ? 'Good' : 'Needs Improvement') : 'Not entered'}</div>
    </div>
    <div class="stat-card stat-card--orange">
      <div class="stat-card__icon">◈</div>
      <div class="stat-card__label">Presentation</div>
      <div class="stat-card__value" style="font-size:16px;">${pres ? formatDate(pres.date) : 'Pending'}</div>
      <div class="stat-card__sub stat-card__sub--warn">${pres ? escapeHtml(pres.status) : 'Not Scheduled'}</div>
    </div>`;

  const leftCol = `
    <div class="section">
      <div class="section__head"><h3>Project Overview</h3></div>
      ${project ? `
        <div style="font-weight:700; font-size:14.5px; margin-bottom:6px;">${escapeHtml(project.title)}</div>
        <p class="muted" style="font-size:12.5px; margin-bottom:14px;">${escapeHtml(project.description)}</p>
        <div class="form-grid" style="margin-bottom:14px;">
          <div><div class="faint" style="font-size:11px; text-transform:uppercase;">Start Date</div><div style="font-size:13px;">${formatDate(project.startDate)}</div></div>
          <div><div class="faint" style="font-size:11px; text-transform:uppercase;">Deadline</div><div style="font-size:13px;">${formatDate(project.deadline)}</div></div>
          <div><div class="faint" style="font-size:11px; text-transform:uppercase;">Status</div><div style="font-size:13px;">${escapeHtml(project.status)}</div></div>
        </div>
        <button class="btn btn--primary btn--sm" onclick="showView('project')">View Project Details</button>
      ` : emptyState('No project assigned yet.')}
    </div>
    <div class="section">
      <div class="section__head"><h3>GitHub Repository</h3></div>
      ${project ? `
        <div style="font-weight:700; font-size:14px;" class="mono">${escapeHtml(project.repoName || '—')}</div>
        <a href="${escapeHtml(project.githubUrl || '#')}" target="_blank" rel="noopener" style="font-size:12.5px; word-break:break-all;">${escapeHtml(project.githubUrl || 'No URL set')}</a>
        <div class="faint" style="font-size:11.5px; margin:10px 0 14px;">Last Updated: ${formatDate(project.deadline)}</div>
        <a class="btn btn--primary btn--sm" href="${escapeHtml(project.githubUrl || '#')}" target="_blank" rel="noopener">Open Repository</a>
      ` : emptyState('No repository linked.')}
    </div>`;

  const midCol = `
    <div class="section">
      <div class="section__head"><h3>Project Progress</h3></div>
      ${project ? `
        <div style="font-size:26px; font-weight:800; margin-bottom:14px;">${project.progress}%</div>
        <div class="bar-track" style="margin-bottom:16px;"><div class="bar-fill" style="width:${project.progress}%"></div></div>
        <div class="checklist">
          ${PROJECT_STAGES.map((s) => stageChecklistRow(s, project.stages[s])).join('')}
        </div>
      ` : emptyState('No project assigned yet.')}
    </div>`;

  const notifs = notificationsFor({ type: 'student', displayId: ME.displayId }).sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const rightCol = `
    <div class="section">
      <div class="section__head"><h3>Recent Notifications</h3><a class="section__link" href="javascript:void(0)" onclick="showView('notifications')">View All</a></div>
      <div class="notif-mini-list">
        ${notifs.length ? notifs.map((n) => `
          <div class="notif-mini">
            <div class="notif-mini__icon">${notifIcon(n.type)}</div>
            <div>
              <div class="notif-mini__title">${escapeHtml(n.title)}</div>
              <div class="notif-mini__time">${timeAgo(n.date)}</div>
            </div>
          </div>`).join('') : '<p class="faint" style="font-size:12.5px;">No notifications yet.</p>'}
      </div>
      <div class="notif-mini-foot">You have ${unreadCount({ type: 'student', displayId: ME.displayId })} unread notifications</div>
    </div>`;

  gridHost.innerHTML = `<div style="display:flex; flex-direction:column;">${leftCol}</div><div>${midCol}</div><div>${rightCol}</div>`;
}

function stageChecklistRow(name, status, interactive) {
  const cls = status === 'Completed' ? 'done' : status === 'In Progress' ? 'active' : 'pending';
  const dotContent = status === 'Completed' ? '✓' : status === 'In Progress' ? '' : '';
  return `
    <div class="checklist-row${interactive ? ' checklist-row--clickable' : ''}" ${interactive ? `data-stage="${escapeHtml(name)}"` : ''}>
      <span class="check-dot check-dot--${cls}">${dotContent}</span>
      <span class="checklist-row__name">${escapeHtml(name)}</span>
      <span class="checklist-row__status checklist-row__status--${cls}">${escapeHtml(status)}</span>
    </div>`;
}

function notifIcon(type) {
  const map = { info: 'ℹ', alert: '⚠', reminder: '⏰', request: '✎', 'peer-request': '◎', presentation: '◈', announcement: '✉' };
  return map[type] || '🔔';
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${Math.max(mins, 0)} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
  const days = Math.floor(hrs / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

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
      document.getElementById('profileForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        updateData(CDAD_KEYS.STUDENTS, ME.id, {
          name: fd.get('name').trim(), email: fd.get('email').trim(),
          phone: fd.get('phone').trim(), avatar: fd.get('avatar').trim()
        });
        logActivity(`Student ${ME.displayId} updated their profile`);
        closeModal();
        showToast('Profile updated', 'success');
        renderAll();
      });
    }
  });
}

/* ================= My Group ================= */
function renderGroupPanel() {
  const host = document.getElementById('groupPanel');
  if (!host) return;
  const group = getGroup(ME.group);
  if (!group) {
    host.innerHTML = `
      ${emptyState('You are not assigned to a group yet.')}
      <div style="text-align:center; margin-top:-10px;">
        <button class="btn btn--primary" id="createGroupBtn">+ Create Group</button>
      </div>`;
    document.getElementById('createGroupBtn').addEventListener('click', () => showView('creategroup'));
    return;
  }
  const students = getData(CDAD_KEYS.STUDENTS);
  const members = (group.members || []).map((m) => students.find((s) => s.displayId === m)).filter(Boolean);
  host.innerHTML = `
    <div class="section__head">
      <div><span class="faint mono" style="font-size:11px;">${escapeHtml(group.displayId)}</span><h3>${escapeHtml(group.name)}</h3></div>
      <span class="badge ${statusBadgeClass(group.status)}">${escapeHtml(group.status)}</span>
    </div>
    <div class="form-grid" style="margin-bottom:20px;">
      <div><div class="faint" style="font-size:11px; text-transform:uppercase;">Team Leader</div><div style="font-size:13.5px;">${escapeHtml(group.teamLeader || '—')}</div></div>
      <div><div class="faint" style="font-size:11px; text-transform:uppercase;">Members</div><div style="font-size:13.5px;">${memberCount(group)}</div></div>
      <div><div class="faint" style="font-size:11px; text-transform:uppercase;">Project</div><div style="font-size:13.5px;">${escapeHtml(group.project || '—')}</div></div>
      <div><div class="faint" style="font-size:11px; text-transform:uppercase;">Progress</div><div style="font-size:13.5px;">${group.progress || 0}%</div></div>
    </div>
    <h4 style="font-size:13.5px; margin-bottom:10px;">Members</h4>
    <div class="card-grid">
      ${members.map((s) => `
        <div class="card">
          <div class="card__top">
            <div style="display:flex; gap:10px; align-items:center;">
              <div class="avatar">${avatarHtml(s)}</div>
              <div><div class="card__title">${escapeHtml(s.name)}</div><div class="card__meta">${escapeHtml(s.displayId)}</div></div>
            </div>
            ${s.displayId === group.teamLeader ? '<span class="badge badge--warn">Leader</span>' : ''}
          </div>
        </div>`).join('')}
    </div>`;
}

/* ================= Create Group tab (create OR join by leader's ID) ================= */
function renderCreateGroupTab() {
  const host = document.getElementById('createGroupPanel');
  if (!host) return;
  const myGroup = getGroup(ME.group);
  const amLeader = myGroup && myGroup.teamLeader === ME.displayId;

  let html = '';

  if (!myGroup) {
    html += `
      <div class="section" style="border-left: 3px solid var(--blue);">
        <p style="font-size:13.5px; margin:0;"><strong>You need a group to continue.</strong> Create a new group below, or find a leader by their Student ID and send a join request. The rest of the dashboard unlocks once you're in a group.</p>
      </div>`;
  }

  // If I lead a group, show incoming join requests right here.
  if (amLeader) {
    const received = joinRequestsReceivedBy(ME.displayId);
    html += `
      <div class="section">
        <div class="section__head"><h3>Requests to Join Your Group</h3>${received.length ? `<span class="badge badge--warn">${received.length} pending</span>` : ''}</div>
        ${received.length ? received.map(joinRequestRow).join('') : emptyState('No pending join requests right now.')}
      </div>`;
  }

  if (myGroup) {
    html += `
      <div class="section">
        ${emptyState(`You're already in ${myGroup.displayId} — ${myGroup.name}. Leave from Faculty if you need to switch groups.`)}
      </div>`;
    host.innerHTML = html;
    wireCreateGroupTabEvents(host);
    return;
  }

  // No group yet — show Create + Join by ID + my sent requests.
  const available = getData(CDAD_KEYS.STUDENTS).filter((s) => s.displayId !== ME.displayId && !s.group);
  const sentRequests = joinRequestsSentBy(ME.displayId).sort((a, b) => new Date(b.date) - new Date(a.date));

  html += `
    <div class="dash-grid--2" style="display:grid; grid-template-columns:1fr 1fr; gap:18px;">
      <div class="section">
        <div class="section__head"><h3>Create a New Group</h3></div>
        <form id="createGroupTabForm">
          <div class="field full" style="margin-bottom:14px;">
            <label>Group Name</label>
            <input name="name" required placeholder="e.g. Group Gamma">
          </div>
          <div class="field full">
            <label>Add Members (Enrollment)</label>
            <div class="field-hint" style="margin-bottom:8px;">You'll be the team leader automatically. Pick classmates to enroll right now.</div>
            <div class="checkbox-grid">
              ${available.length ? available.map((s) => `
                <label class="checkbox-row">
                  <input type="checkbox" name="members" value="${s.displayId}">
                  ${escapeHtml(s.displayId)} — ${escapeHtml(s.name)}
                </label>`).join('') : '<span class="faint" style="font-size:12.5px;">No unassigned students available right now.</span>'}
            </div>
          </div>
          <button type="submit" class="btn btn--primary" style="margin-top:14px;">Create Group</button>
        </form>
      </div>

      <div class="section">
        <div class="section__head"><h3>Join a Group by ID</h3></div>
        <p class="field-hint" style="margin-bottom:12px;">Enter the Student ID of a group's leader (e.g. ADT24SOCB0001). If they lead a group, you'll see their name and can send a join request straight to them.</p>
        <div class="field full" style="margin-bottom:10px;">
          <label>Leader's Student ID</label>
          <input type="text" id="joinLookupId" placeholder="ADT24SOCB0001">
        </div>
        <button type="button" class="btn btn--ghost btn--sm" id="joinLookupBtn">Find Group</button>
        <div id="joinLookupResult" style="margin-top:14px;"></div>

        <h4 style="font-size:13px; margin:20px 0 10px;">My Sent Requests</h4>
        <div id="mySentJoinRequests">
          ${sentRequests.length ? sentRequests.map(sentJoinRequestRow).join('') : emptyState('You have not sent any join requests yet.')}
        </div>
      </div>
    </div>`;

  host.innerHTML = html;
  wireCreateGroupTabEvents(host);
}

function wireCreateGroupTabEvents(host) {
  const createForm = host.querySelector('#createGroupTabForm');
  if (createForm) {
    createForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (ME.group) { showToast('You are already in a group.', 'error'); return; }
      const fd = new FormData(e.target);
      const enrolled = fd.getAll('members');
      const group = createGroup({
        name: fd.get('name').trim(),
        teamLeader: ME.displayId,
        members: [ME.displayId, ...enrolled],
        status: 'Active'
      });
      logActivity(`Student ${ME.displayId} created group ${group.displayId} with ${enrolled.length} member(s) enrolled`);
      showToast('Group created — you are the leader', 'success');
      renderAll();
      showView('creategroup');
    });
  }

  const lookupBtn = host.querySelector('#joinLookupBtn');
  if (lookupBtn) {
    lookupBtn.addEventListener('click', () => {
      const id = host.querySelector('#joinLookupId').value.trim();
      const resultHost = host.querySelector('#joinLookupResult');
      const lookup = findLeaderAndGroupById(id);
      if (!lookup.ok) {
        resultHost.innerHTML = `<div class="login-error show" style="display:block;">${escapeHtml(lookup.error)}</div>`;
        return;
      }
      resultHost.innerHTML = `
        <div class="list-item">
          <div class="list-item__top">
            <div style="display:flex; gap:10px; align-items:center;">
              <div class="avatar">${avatarHtml(lookup.leader)}</div>
              <div>
                <div class="list-item__title">${escapeHtml(lookup.leader.name)}</div>
                <div class="faint" style="font-size:12px;">Leads ${escapeHtml(lookup.group.displayId)} — ${escapeHtml(lookup.group.name)} (${memberCount(lookup.group)} members)</div>
              </div>
            </div>
          </div>
          <div class="field full" style="margin-top:10px;"><textarea id="joinRequestMessage" placeholder="Optional message to include..."></textarea></div>
          <button type="button" class="btn btn--primary btn--sm" id="sendJoinRequestBtn" style="margin-top:8px;">Send Join Request</button>
        </div>`;
      resultHost.querySelector('#sendJoinRequestBtn').addEventListener('click', () => {
        const message = resultHost.querySelector('#joinRequestMessage').value.trim();
        const result = sendGroupJoinRequest(ME.displayId, id, message);
        if (!result.ok) { showToast(result.error, 'error'); return; }
        showToast(`Request sent to ${result.leaderName}`, 'success');
        renderAll();
        showView('creategroup');
      });
    });
  }

  host.querySelectorAll('[data-accept-join]').forEach((b) => b.addEventListener('click', () => {
    const result = respondToGroupJoinRequest(b.dataset.acceptJoin, true);
    if (!result.ok) { showToast(result.error, 'error'); return; }
    showToast('Student added to your group', 'success');
    renderAll();
    showView('creategroup');
  }));
  host.querySelectorAll('[data-reject-join]').forEach((b) => b.addEventListener('click', () => {
    respondToGroupJoinRequest(b.dataset.rejectJoin, false);
    showToast('Request rejected', 'info');
    renderAll();
    showView('creategroup');
  }));
}

function joinRequestRow(r) {
  const from = getData(CDAD_KEYS.STUDENTS).find((s) => s.displayId === r.from);
  return `
    <div class="list-item unread">
      <div class="list-item__top">
        <div class="list-item__title">${escapeHtml(from ? from.name : r.from)} <span class="faint mono" style="font-weight:400;">${escapeHtml(r.from)}</span></div>
        <span class="faint" style="font-size:11px;">${formatDate(r.date)}</span>
      </div>
      ${r.message ? `<div class="list-item__body">"${escapeHtml(r.message)}"</div>` : ''}
      <div class="list-item__foot">
        <button class="btn btn--primary btn--sm" data-accept-join="${r.id}">Accept</button>
        <button class="btn btn--ghost btn--sm" data-reject-join="${r.id}">Reject</button>
      </div>
    </div>`;
}

function sentJoinRequestRow(r) {
  return `
    <div class="list-item">
      <div class="list-item__top">
        <div class="list-item__title">${escapeHtml(r.groupDisplayId)} <span class="faint" style="font-weight:400;">(leader ${escapeHtml(r.to)})</span></div>
        <span class="badge ${statusBadgeClass(r.status)}">${escapeHtml(r.status)}</span>
      </div>
      <div class="list-item__body faint">${formatDate(r.date)}</div>
    </div>`;
}

/* ================= My Project ================= */
function renderProjectPanel() {
  const host = document.getElementById('projectPanel');
  if (!host) return;
  const group = getGroup(ME.group);
  const project = group ? getProject(group.project) : null;
  if (!project) { host.innerHTML = emptyState('No project assigned to your group yet.'); return; }
  host.innerHTML = `
    <div class="section__head">
      <div><span class="faint mono" style="font-size:11px;">${escapeHtml(project.displayId)}</span><h3>${escapeHtml(project.title)}</h3></div>
      <span class="badge ${statusBadgeClass(project.status)}">${escapeHtml(project.status)}</span>
    </div>
    <p style="font-size:13.5px; color:var(--ink-soft); margin-bottom:18px;">${escapeHtml(project.description)}</p>
    <div class="form-grid">
      ${profileField('Group', project.group)}
      ${profileField('Team Leader', project.teamLeader)}
      ${profileField('Start Date', formatDate(project.startDate))}
      ${profileField('Deadline', formatDate(project.deadline))}
      ${profileField('Repository', project.repoName)}
      ${profileField('Branch', project.branch)}
    </div>
    <div style="margin-top:10px;">
      <div class="card__progress-label"><span>Overall Progress</span><span>${project.progress}%</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${project.progress}%"></div></div>
    </div>`;
}

/* ================= Progress ================= */
function renderProgressPanel() {
  const host = document.getElementById('progressPanel');
  if (!host) return;
  const group = getGroup(ME.group);
  const project = group ? getProject(group.project) : null;
  if (!project) { host.innerHTML = emptyState('No project assigned yet.'); return; }
  host.innerHTML = `
    <div class="section__head"><h3>${escapeHtml(project.title)}</h3><span style="font-size:22px; font-weight:800;">${project.progress}%</span></div>
    <div class="bar-track" style="margin-bottom:20px;"><div class="bar-fill" style="width:${project.progress}%"></div></div>
    <p class="field-hint" style="margin-bottom:14px;">Click a stage below to mark it Pending → In Progress → Completed as you work through your project.</p>
    <div class="checklist" id="progressChecklist">
      ${PROJECT_STAGES.map((s) => stageChecklistRow(s, project.stages[s], true)).join('')}
    </div>
    <div id="submissionBlock" style="margin-top:22px; padding-top:20px; border-top:1px solid var(--line-soft);"></div>`;

  host.querySelectorAll('#progressChecklist [data-stage]').forEach((row) => {
    row.addEventListener('click', () => {
      const stageName = row.dataset.stage;
      const current = project.stages[stageName];
      const next = current === 'Pending' ? 'In Progress' : current === 'In Progress' ? 'Completed' : 'Pending';
      setProjectStage(project.id, stageName, next);
      showToast(`${stageName} marked ${next}`, 'success');
      renderAll();
    });
  });

  renderSubmissionBlock(project);
}

function renderSubmissionBlock(project) {
  const host = document.getElementById('submissionBlock');
  if (!host) return;
  const sub = project.submission;

  if (!sub) {
    host.innerHTML = `
      <h4 style="font-size:13.5px; margin-bottom:10px;">Final Submission</h4>
      <p class="muted" style="font-size:12.5px; margin-bottom:12px;">Once your project is ready, submit a link (repository, drive folder, etc.) and a short note for faculty to review.</p>
      <button class="btn btn--primary btn--sm" id="submitProjectBtn">Submit Project</button>`;
    document.getElementById('submitProjectBtn').addEventListener('click', () => openSubmitProjectModal(project));
    return;
  }

  const badgeClass = sub.status === 'Approved' ? 'badge--good' : sub.status === 'Rejected' ? 'badge--bad' : 'badge--warn';
  host.innerHTML = `
    <div class="section__head"><h4 style="font-size:13.5px; margin:0;">Final Submission</h4><span class="badge ${badgeClass}">${escapeHtml(sub.status)}</span></div>
    <div class="list-item">
      <div class="list-item__body"><strong>Link:</strong> <a href="${escapeHtml(sub.link)}" target="_blank" rel="noopener">${escapeHtml(sub.link) || '—'}</a></div>
      ${sub.note ? `<div class="list-item__body"><strong>Note:</strong> ${escapeHtml(sub.note)}</div>` : ''}
      <div class="list-item__body faint">Submitted by ${escapeHtml(sub.submittedBy)} on ${formatDateTime(sub.submittedAt)}</div>
      ${sub.facultyNote ? `<div class="list-item__body"><strong>Faculty note:</strong> ${escapeHtml(sub.facultyNote)}</div>` : ''}
    </div>
    ${sub.status !== 'Approved' ? `<button class="btn btn--ghost btn--sm" id="resubmitProjectBtn">${sub.status === 'Rejected' ? 'Resubmit' : 'Update Submission'}</button>` : ''}`;

  const resubmitBtn = document.getElementById('resubmitProjectBtn');
  if (resubmitBtn) resubmitBtn.addEventListener('click', () => openSubmitProjectModal(project));
}

function openSubmitProjectModal(project) {
  const sub = project.submission;
  openModal(sub ? 'Update Submission' : 'Submit Project', `
    <form id="submitProjectForm">
      <div class="field full" style="margin-bottom:14px;">
        <label>Link (repository, drive folder, doc, etc.)</label>
        <input name="link" type="url" required placeholder="https://..." value="${escapeHtml(sub?.link || project.githubUrl || '')}">
      </div>
      <div class="field full">
        <label>Note for faculty (optional)</label>
        <textarea name="note" placeholder="Anything faculty should know before reviewing...">${escapeHtml(sub?.note || '')}</textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="cancelSubmitProject">Cancel</button>
        <button type="submit" class="btn btn--primary">${sub ? 'Resubmit' : 'Submit'}</button>
      </div>
    </form>
  `, {
    onMount: () => {
      document.getElementById('cancelSubmitProject').addEventListener('click', closeModal);
      document.getElementById('submitProjectForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        submitProjectWork(project.id, {
          link: fd.get('link').trim(),
          note: fd.get('note').trim(),
          submittedBy: ME.displayId
        });
        closeModal();
        showToast('Submission sent to faculty for review', 'success');
        renderAll();
      });
    }
  });
}

/* ================= GitHub ================= */
function renderGithub() {
  const host = document.getElementById('githubPanel');
  if (!host) return;
  const group = getGroup(ME.group);
  const project = group ? getProject(group.project) : null;
  if (!project) { host.innerHTML = emptyState('No repository linked yet.'); return; }
  host.innerHTML = `
    <div class="card">
      <div class="card__top">
        <div>
          <div class="card__title mono">${escapeHtml(project.repoName)}</div>
          <div class="card__meta">Branch: <span class="mono">${escapeHtml(project.branch)}</span></div>
        </div>
      </div>
      <p style="font-size:13px; color:var(--ink-soft); word-break:break-all;">${escapeHtml(project.githubUrl) || 'No URL set'}</p>
      <div class="card__actions">
        <a class="btn btn--primary btn--sm" href="${escapeHtml(project.githubUrl || '#')}" target="_blank" rel="noopener">Open Repository ↗</a>
      </div>
    </div>`;
}

/* ================= Marks page (Evaluation Summary + Donut + Trend + Details) ================= */
function renderMarksPage() {
  const host = document.getElementById('marksMainGrid');
  if (!host) return;
  const m = marksForStudent(ME.displayId);
  if (!m) { host.innerHTML = `<div class="section">${emptyState('Marks have not been entered yet.')}</div>`; return; }
  const t = deriveMarkTotals(m);

  const summaryCard = `
    <div class="section">
      <div class="section__head"><h3>Evaluation Summary</h3></div>
      <div class="marks-ledger">
        <table>
          <thead><tr><th>Evaluation</th><th>Marks Obtained</th><th>Maximum Marks</th><th>Percentage</th></tr></thead>
          <tbody>
            <tr><td>Internal Assessment</td><td>${m.internal}</td><td>${m.internalMax}</td><td>${Math.round((m.internal/m.internalMax)*100)}%</td></tr>
            <tr><td>Project</td><td>${m.project}</td><td>${m.projectMax}</td><td>${Math.round((m.project/m.projectMax)*100)}%</td></tr>
            <tr><td>Presentation</td><td>${m.presentation}</td><td>${m.presentationMax}</td><td>${Math.round((m.presentation/m.presentationMax)*100)}%</td></tr>
            <tr><td>Viva</td><td>${m.viva}</td><td>${m.vivaMax}</td><td>${Math.round((m.viva/m.vivaMax)*100)}%</td></tr>
          </tbody>
          <tfoot><tr><td>Total</td><td>${t.total}</td><td>${t.max}</td><td>${t.percentage}%</td></tr></tfoot>
        </table>
      </div>
    </div>`;

  const donutCard = `
    <div class="section">
      <div class="section__head"><h3>Overall Marks</h3></div>
      <div class="donut-wrap">
        <div style="position:relative; width:160px; height:160px;">
          ${buildDonutChart(t.percentage, { size: 160, stroke: 16, color: 'var(--blue)' })}
          <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;">
            <div class="donut-center-value">${t.total} / ${t.max}</div>
            <div class="donut-center-label">${t.percentage}%</div>
          </div>
        </div>
        <div class="donut-stats">
          <div class="donut-stat"><div class="donut-stat__value">${t.grade}</div><div class="donut-stat__label">Grade</div></div>
          <div class="donut-stat"><div class="donut-stat__value donut-stat__value--good">${t.percentage >= 60 ? 'Good' : 'Needs Work'}</div><div class="donut-stat__label">Status</div></div>
        </div>
      </div>
    </div>`;

  const trendPoints = [
    Math.round((m.internal / m.internalMax) * 100),
    Math.round((m.project / m.projectMax) * 100),
    Math.round((m.presentation / m.presentationMax) * 100),
    Math.round((m.viva / m.vivaMax) * 100)
  ];
  const trendLabels = ['Internal Assessment', 'Project', 'Presentation', 'Viva'];
  const trendCard = `
    <div class="section">
      <div class="section__head"><h3>Marks Trend</h3></div>
      <div class="line-chart-wrap">
        ${buildLineChart(trendPoints, trendLabels, { width: 420, height: 160, max: 100, min: 0 })}
        <div class="line-chart-caption">${trendLabels.map((l) => `<span>${l}</span>`).join('')}</div>
      </div>
    </div>`;

  const detailsCard = `
    <div class="section">
      <div class="section__head"><h3>Evaluation Details</h3></div>
      <p class="muted" style="font-size:12.5px;">Note: Marks will be updated by respective faculty members.</p>
      <p class="faint" style="font-size:12px;">Check back regularly for the latest updates.</p>
      <div style="margin-top:18px; text-align:center; opacity:0.5; font-size:38px;">📋</div>
    </div>`;

  host.innerHTML = summaryCard + donutCard + trendCard + detailsCard;
}

/* ================= Presentation ================= */
function renderPresentation() {
  const host = document.getElementById('presentationPanel');
  if (!host) return;
  const group = getGroup(ME.group);
  const list = group ? presentationsForGroup(group.displayId) : [];
  if (!list.length) { host.innerHTML = emptyState('No presentation scheduled for your group.'); return; }
  host.innerHTML = list.map((p) => `
    <div class="list-item">
      <div class="list-item__top">
        <div>
          <div class="list-item__title">${escapeHtml(p.displayId)} &middot; ${escapeHtml(p.venue)}</div>
          <div class="list-item__body">${formatDate(p.date)} at ${escapeHtml(p.time)}</div>
        </div>
        <span class="badge ${statusBadgeClass(p.status)}">${escapeHtml(p.status)}</span>
      </div>
      ${p.notes ? `<div class="list-item__body">Note: ${escapeHtml(p.notes)}</div>` : ''}
    </div>`).join('');
}

/* ================= Peer connections ================= */
function renderPeers() {
  const host = document.getElementById('peersPanel');
  if (!host) return;
  const students = getData(CDAD_KEYS.STUDENTS).filter((s) => s.displayId !== ME.displayId);
  const received = peerRequestsReceivedBy(ME.displayId).filter((r) => r.status === 'Pending');
  const sent = peerRequestsSentBy(ME.displayId);
  const connections = connectionsOf(ME.displayId);

  host.innerHTML = `
    <div class="tabbar">
      <button class="tab-btn active" data-peer-tab="directory">Directory</button>
      <button class="tab-btn" data-peer-tab="received">Received ${received.length ? `<span class="badge badge--warn">${received.length}</span>` : ''}</button>
      <button class="tab-btn" data-peer-tab="sent">Sent</button>
      <button class="tab-btn" data-peer-tab="connections">My Connections ${connections.length ? `<span class="badge badge--good">${connections.length}</span>` : ''}</button>
    </div>
    <div id="peerTab-directory" class="peer-tab-panel">
      <div class="card-grid">
        ${students.map((s) => peerDirectoryCard(s, connections, sent)).join('') || emptyState('No other students found.')}
      </div>
    </div>
    <div id="peerTab-received" class="peer-tab-panel" style="display:none;">
      ${received.length ? received.map(receivedPeerRow).join('') : emptyState('No pending requests received.')}
    </div>
    <div id="peerTab-sent" class="peer-tab-panel" style="display:none;">
      ${sent.length ? sent.map(sentPeerRow).join('') : emptyState("You haven't sent any requests yet.")}
    </div>
    <div id="peerTab-connections" class="peer-tab-panel" style="display:none;">
      ${connections.length ? connections.map((c) => connectionRow(c)).join('') : emptyState('No connections yet. Send a request from the Directory tab.')}
    </div>`;

  host.querySelectorAll('[data-peer-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      host.querySelectorAll('[data-peer-tab]').forEach((b) => b.classList.toggle('active', b === btn));
      host.querySelectorAll('.peer-tab-panel').forEach((p) => { p.style.display = 'none'; });
      host.querySelector(`#peerTab-${btn.dataset.peerTab}`).style.display = 'block';
    });
  });
  host.querySelectorAll('[data-send-peer]').forEach((btn) => btn.addEventListener('click', () => openSendPeerRequestModal(btn.dataset.sendPeer)));
  host.querySelectorAll('[data-accept-peer]').forEach((btn) => btn.addEventListener('click', () => { respondToPeerRequest(btn.dataset.acceptPeer, true); showToast('Request accepted', 'success'); renderAll(); }));
  host.querySelectorAll('[data-reject-peer]').forEach((btn) => btn.addEventListener('click', () => { respondToPeerRequest(btn.dataset.rejectPeer, false); showToast('Request rejected', 'info'); renderAll(); }));
  host.querySelectorAll('[data-remove-connection]').forEach((btn) => btn.addEventListener('click', () => {
    confirmDelete(`Remove connection with ${btn.dataset.removeConnection}?`, () => { removeConnection(ME.displayId, btn.dataset.removeConnection); showToast('Connection removed', 'info'); renderAll(); });
  }));
  host.querySelectorAll('[data-invite-group]').forEach((btn) => btn.addEventListener('click', () => {
    const myGroup = getGroup(ME.group);
    if (!myGroup) { showToast('You are not in a group.', 'error'); return; }
    addMember(myGroup.id, btn.dataset.inviteGroup);
    logActivity(`${ME.displayId} invited ${btn.dataset.inviteGroup} to group ${myGroup.displayId}`);
    showToast('Student added to your group', 'success');
    renderAll();
  }));
}

function peerDirectoryCard(s, connections, sent) {
  const isConnected = connections.includes(s.displayId);
  const pendingSent = sent.find((r) => r.to === s.displayId && r.status === 'Pending');
  let actionHtml;
  if (isConnected) actionHtml = `<span class="badge badge--good">Connected</span>`;
  else if (pendingSent) actionHtml = `<span class="badge badge--warn">Request Pending</span>`;
  else actionHtml = `<button class="btn btn--ghost btn--sm" data-send-peer="${s.displayId}">Send Request</button>`;

  const myGroup = getGroup(ME.group);
  const iAmLeader = myGroup && myGroup.teamLeader === ME.displayId;
  const canInvite = iAmLeader && isConnected && !s.group;
  const inviteHtml = canInvite ? `<button class="btn btn--primary btn--sm" data-invite-group="${s.displayId}">Invite to Group</button>` : '';

  return `
    <div class="card">
      <div class="card__top">
        <div style="display:flex; gap:10px; align-items:center;">
          <div class="avatar">${avatarHtml(s)}</div>
          <div><div class="card__title">${escapeHtml(s.name)}</div><div class="card__meta">${escapeHtml(s.displayId)} &middot; ${escapeHtml(s.group || 'No group')}</div></div>
        </div>
      </div>
      <div class="card__meta">${escapeHtml(s.course)}</div>
      <div class="card__actions">${actionHtml}${inviteHtml}</div>
    </div>`;
}

function receivedPeerRow(r) {
  const from = getData(CDAD_KEYS.STUDENTS).find((s) => s.displayId === r.from);
  return `
    <div class="list-item unread">
      <div class="list-item__top">
        <div class="list-item__title">${escapeHtml(from ? from.name : r.from)} (${escapeHtml(r.from)})</div>
        <span class="faint" style="font-size:11px;">${formatDate(r.date)}</span>
      </div>
      ${r.message ? `<div class="list-item__body">"${escapeHtml(r.message)}"</div>` : ''}
      <div class="list-item__foot">
        <button class="btn btn--primary btn--sm" data-accept-peer="${r.id}">Accept</button>
        <button class="btn btn--ghost btn--sm" data-reject-peer="${r.id}">Reject</button>
      </div>
    </div>`;
}

function sentPeerRow(r) {
  return `
    <div class="list-item">
      <div class="list-item__top"><div class="list-item__title">To ${escapeHtml(r.to)}</div><span class="badge ${statusBadgeClass(r.status)}">${escapeHtml(r.status)}</span></div>
      ${r.message ? `<div class="list-item__body">"${escapeHtml(r.message)}"</div>` : ''}
      <div class="list-item__body faint">${formatDate(r.date)}</div>
    </div>`;
}

function connectionRow(displayId) {
  const s = getData(CDAD_KEYS.STUDENTS).find((x) => x.displayId === displayId);
  return `
    <div class="list-item">
      <div class="list-item__top">
        <div style="display:flex; gap:10px; align-items:center;">
          <div class="avatar" style="width:30px;height:30px;font-size:11px;">${s ? avatarHtml(s) : '?'}</div>
          <div class="list-item__title">${s ? escapeHtml(s.name) : displayId} <span class="faint mono" style="font-weight:400;">${escapeHtml(displayId)}</span></div>
        </div>
        <button class="btn btn--ghost btn--sm" data-remove-connection="${displayId}">Remove</button>
      </div>
    </div>`;
}

function openSendPeerRequestModal(toDisplayId) {
  const to = getData(CDAD_KEYS.STUDENTS).find((s) => s.displayId === toDisplayId);
  openModal(`Send Request to ${to ? to.name : toDisplayId}`, `
    <form id="peerRequestForm">
      <div class="field full"><label>Message (optional)</label><textarea name="message" placeholder="Say why you'd like to connect..."></textarea></div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="cancelPeerReq">Cancel</button>
        <button type="submit" class="btn btn--primary">Send Request</button>
      </div>
    </form>
  `, {
    onMount: () => {
      document.getElementById('cancelPeerReq').addEventListener('click', closeModal);
      document.getElementById('peerRequestForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const result = sendPeerRequest(ME.displayId, toDisplayId, fd.get('message').trim());
        closeModal();
        if (result.ok) { showToast('Request sent', 'success'); renderAll(); }
        else showToast(result.error, 'error');
      });
    }
  });
}

/* ================= Academic requests (to faculty) ================= */
function renderRequests() {
  const host = document.getElementById('requestsPanel');
  if (!host) return;
  const mine = requestsForStudent(ME.displayId).sort((a, b) => new Date(b.date) - new Date(a.date));
  host.innerHTML = `
    <div class="section__head">
      <h3>My Requests to Faculty</h3>
      <button class="btn btn--primary btn--sm" id="newRequestBtn">+ New Request</button>
    </div>
    ${mine.length ? mine.map(academicRequestRow).join('') : emptyState('You have not submitted any requests.')}`;
  document.getElementById('newRequestBtn').addEventListener('click', openNewRequestModal);
}

function academicRequestRow(r) {
  return `
    <div class="list-item">
      <div class="list-item__top">
        <div class="list-item__title">${escapeHtml(r.type)} <span class="faint mono" style="font-weight:400;">${escapeHtml(r.displayId)}</span></div>
        <span class="badge ${statusBadgeClass(r.status)}">${escapeHtml(r.status)}</span>
      </div>
      <div class="list-item__body">${escapeHtml(r.message)}</div>
      ${r.response ? `<div class="list-item__body"><strong>Faculty response:</strong> ${escapeHtml(r.response)}</div>` : ''}
      <div class="list-item__body faint">${formatDate(r.date)}</div>
    </div>`;
}

function openNewRequestModal() {
  const groups = allGroups();
  openModal('New Request', `
    <form id="newRequestForm">
      <div class="form-grid">
        <div class="field full">
          <label>Request Type</label>
          <select name="type" required>
            <option>Join Group</option><option>Leave Group</option><option>Change Group</option>
            <option>Project Request</option><option>General Request</option>
          </select>
        </div>
        <div class="field full">
          <label>Related Group (optional)</label>
          <select name="group"><option value="">— None —</option>${groups.map((g) => `<option value="${g.displayId}">${g.displayId} — ${escapeHtml(g.name)}</option>`).join('')}</select>
        </div>
        <div class="field full"><label>Message</label><textarea name="message" required placeholder="Describe your request..."></textarea></div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="cancelNewRequest">Cancel</button>
        <button type="submit" class="btn btn--primary">Submit Request</button>
      </div>
    </form>
  `, {
    onMount: () => {
      document.getElementById('cancelNewRequest').addEventListener('click', closeModal);
      document.getElementById('newRequestForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        createRequest({ student: ME.displayId, type: fd.get('type'), group: fd.get('group'), message: fd.get('message').trim() });
        closeModal();
        showToast('Request submitted', 'success');
        renderAll();
      });
    }
  });
}

/* ================= Notifications ================= */
function renderNotifications() {
  const host = document.getElementById('notificationsPanel');
  if (!host) return;
  const list = notificationsFor({ type: 'student', displayId: ME.displayId }).sort((a, b) => new Date(b.date) - new Date(a.date));
  host.innerHTML = list.length ? list.map(notifRow).join('') : emptyState('No notifications.');
  host.querySelectorAll('[data-mark-read]').forEach((b) => b.addEventListener('click', () => { markNotificationRead(b.dataset.markRead, true); renderAll(); }));
  host.querySelectorAll('[data-del-notif]').forEach((b) => b.addEventListener('click', () => { deleteNotification(b.dataset.delNotif); showToast('Notification removed', 'info'); renderAll(); }));
}

function notifRow(n) {
  return `
    <div class="list-item ${n.read ? '' : 'unread'}">
      <div class="list-item__top">
        <div class="list-item__title">${escapeHtml(n.title)}</div>
        <span class="faint" style="font-size:11px;">${formatDateTime(n.date)}</span>
      </div>
      <div class="list-item__body">${escapeHtml(n.message)}</div>
      <div class="list-item__foot">
        ${!n.read ? `<button class="btn btn--ghost btn--sm" data-mark-read="${n.id}">Mark read</button>` : '<span></span>'}
        <button class="btn btn--ghost btn--sm" data-del-notif="${n.id}">Delete</button>
      </div>
    </div>`;
}

/* ================= Announcements ================= */
function renderAnnouncements() {
  const host = document.getElementById('announcementsPanel');
  if (!host) return;
  const list = allAnnouncements();
  host.innerHTML = list.length ? list.map(announcementRow).join('') : emptyState('No announcements yet.');
}

function announcementRow(a) {
  return `
    <div class="list-item">
      <div class="list-item__top"><div class="list-item__title">${escapeHtml(a.title)}</div><span class="badge ${statusBadgeClass(a.priority)}">${escapeHtml(a.priority)}</span></div>
      <div class="list-item__body">${escapeHtml(a.message)}</div>
      <div class="list-item__body faint">${escapeHtml(a.author)} &middot; ${formatDate(a.date)}</div>
    </div>`;
}

/* ================= Utility ================= */
function emptyState(msg) {
  return `<div class="empty-state"><div class="empty-state__icon">—</div><p>${escapeHtml(msg)}</p></div>`;
}