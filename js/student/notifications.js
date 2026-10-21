/* ================= Notifications ================= */
async function renderNotifications() {
  const host = document.getElementById('notificationsPanel');
  if (!host) return;
  const raw = await notificationsFor({ type: 'student', displayId: ME.displayId });
  const list = raw.sort((a, b) => new Date(b.date) - new Date(a.date));
  host.innerHTML = list.length ? list.map(notifRow).join('') : emptyState('No notifications.');
  host.querySelectorAll('[data-mark-read]').forEach((b) => b.addEventListener('click', async () => { await markNotificationRead(b.dataset.markRead, true); await renderAll(); }));
  host.querySelectorAll('[data-del-notif]').forEach((b) => b.addEventListener('click', async () => { await deleteNotification(b.dataset.delNotif); showToast('Notification removed', 'info'); await renderAll(); }));
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
async function renderAnnouncements() {
  const host = document.getElementById('announcementsPanel');
  if (!host) return;
  const list = await allAnnouncements();
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

