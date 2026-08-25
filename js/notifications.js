/* ============================================================
   CDAD :: notifications.js
   Thin CRUD wrapper on top of common.js's createNotification.
   ============================================================ */

function editNotification(id, updates) {
  return updateData(CDAD_KEYS.NOTIFICATIONS, id, updates);
}

function deleteNotification(id) {
  return deleteData(CDAD_KEYS.NOTIFICATIONS, id);
}

function markNotificationRead(id, read) {
  return updateData(CDAD_KEYS.NOTIFICATIONS, id, { read: read !== false });
}

function unreadCount(user) {
  return notificationsFor(user).filter((n) => !n.read).length;
}
