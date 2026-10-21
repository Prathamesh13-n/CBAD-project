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

