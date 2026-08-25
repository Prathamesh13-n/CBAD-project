/* ============================================================
   CDAD :: announcements.js
   CRUD for faculty announcements, visible to all students.
   ============================================================ */

function allAnnouncements() {
  return getData(CDAD_KEYS.ANNOUNCEMENTS).sort((a, b) => new Date(b.date) - new Date(a.date));
}

function createAnnouncement({ title, message, author, priority }) {
  const ann = {
    id: generateId('ANN'),
    title,
    message,
    author: author || '',
    date: new Date().toISOString(),
    priority: priority || 'Normal',
    status: 'Active'
  };
  addData(CDAD_KEYS.ANNOUNCEMENTS, ann);
  createNotification({
    title: `Announcement: ${title}`,
    message,
    type: 'announcement',
    recipient: 'all-students'
  });
  logActivity(`Announcement "${title}" created`);
  return ann;
}

function editAnnouncement(id, updates) {
  const updated = updateData(CDAD_KEYS.ANNOUNCEMENTS, id, updates);
  if (updated) logActivity(`Announcement "${updated.title}" updated`);
  return updated;
}

function deleteAnnouncement(id) {
  const a = findData(CDAD_KEYS.ANNOUNCEMENTS, id);
  if (!a) return false;
  deleteData(CDAD_KEYS.ANNOUNCEMENTS, id);
  logActivity(`Announcement "${a.title}" deleted`);
  return true;
}
