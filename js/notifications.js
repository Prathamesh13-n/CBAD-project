/* ============================================================
   CDAD :: notifications.js
   Thin CRUD wrapper on top of /api/notifications.
   ============================================================ */

async function editNotification(id, updates) {
  return updateData(CDAD_KEYS.NOTIFICATIONS, id, updates);
}

async function deleteNotification(id) {
  return deleteData(CDAD_KEYS.NOTIFICATIONS, id);
}

async function markNotificationRead(id, read) {
  const res = await fetch(`/api/notifications/${id}/read`, {
    method: 'PUT', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ read: read !== false })
  });
  return res.ok ? res.json() : null;
}

/** Scoped server-side to whoever's logged in (see routes/notifications.js). */
async function unreadCount(user) {
  const res = await fetch('/api/notifications/unread-count', { credentials: 'include' });
  if (!res.ok) return 0;
  const data = await res.json();
  return data.count;
}

/** Faculty-only admin view: every notification in the system, not just ones addressed to faculty. */
async function allNotificationsAdmin() {
  const res = await fetch('/api/notifications/all', { credentials: 'include' });
  if (!res.ok) return [];
  return res.json();
}
