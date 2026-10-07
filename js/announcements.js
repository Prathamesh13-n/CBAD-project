/* ============================================================
   CDAD :: announcements.js
   Thin CRUD wrapper on top of /api/announcements, visible to all
   students. Sorting and notification creation happen server-side.
   ============================================================ */

async function allAnnouncements() {
  return getData(CDAD_KEYS.ANNOUNCEMENTS);
}

async function createAnnouncement({ title, message, author, priority }) {
  return addData(CDAD_KEYS.ANNOUNCEMENTS, { title, message, author, priority });
}

async function editAnnouncement(id, updates) {
  return updateData(CDAD_KEYS.ANNOUNCEMENTS, id, updates);
}

async function deleteAnnouncement(id) {
  return deleteData(CDAD_KEYS.ANNOUNCEMENTS, id);
}
