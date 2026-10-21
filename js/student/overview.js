/* ================= Overview (Dashboard) ================= */
async function renderOverview() {
  const statsHost = document.getElementById('overviewStats');
  const gridHost = document.getElementById('overviewMainGrid');
  if (!statsHost || !gridHost) return;

  const group = await getGroup(ME.group);
  const project = group ? await getProject(group.project) : null;
  const marksRec = await marksForStudent(ME.displayId);
  const totals = marksRec ? deriveMarkTotals(marksRec) : null;
  const groupPres = group ? await presentationsForGroup(group.displayId) : [];
  const pres = groupPres[0] || null;

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

  const allNotifs = await notificationsFor({ type: 'student', displayId: ME.displayId });
  const notifs = allNotifs.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const unread = await unreadCount({ type: 'student', displayId: ME.displayId });
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
      <div class="notif-mini-foot">You have ${unread} unread notifications</div>
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

