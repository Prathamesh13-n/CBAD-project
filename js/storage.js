/* ============================================================
   CDAD :: storage.js
   Single source of truth for all server access. Same six function
   names as the old LocalStorage version, now async and backed by
   fetch() against the Express/SQLite backend — every other file
   still calls these and nothing else, just with `await` added.
   ============================================================ */

const CDAD_KEYS = {
  STUDENTS: 'cdad_students',
  GROUPS: 'cdad_groups',
  PROJECTS: 'cdad_projects',
  MARKS: 'cdad_marks',
  PRESENTATIONS: 'cdad_presentations',
  REQUESTS: 'cdad_requests',
  STUDENT_REQUESTS: 'cdad_student_requests', // peer-to-peer student requests
  GROUP_JOIN_REQUESTS: 'cdad_group_join_requests', // requests to join a group, sent directly to that group's leader
  NOTIFICATIONS: 'cdad_notifications',
  ANNOUNCEMENTS: 'cdad_announcements',
  FACULTY: 'cdad_faculty',
  ACTIVITY: 'cdad_activity'
};

const CDAD_ENDPOINTS = {
  [CDAD_KEYS.STUDENTS]: '/api/students',
  [CDAD_KEYS.GROUPS]: '/api/groups',
  [CDAD_KEYS.PROJECTS]: '/api/projects',
  [CDAD_KEYS.MARKS]: '/api/marks',
  [CDAD_KEYS.PRESENTATIONS]: '/api/presentations',
  [CDAD_KEYS.REQUESTS]: '/api/requests',
  [CDAD_KEYS.STUDENT_REQUESTS]: '/api/peer-requests',
  [CDAD_KEYS.GROUP_JOIN_REQUESTS]: '/api/group-join-requests',
  [CDAD_KEYS.NOTIFICATIONS]: '/api/notifications',
  [CDAD_KEYS.ANNOUNCEMENTS]: '/api/announcements',
  [CDAD_KEYS.ACTIVITY]: '/api/activity'
};

/** Read the whole collection from the server. Returns [] on failure. */
async function getData(key) {
  const res = await fetch(CDAD_ENDPOINTS[key], { credentials: 'include' });
  if (!res.ok) {
    console.error('getData failed for', key, res.status);
    return [];
  }
  return res.json();
}

/** POST a new item into the collection, return the server's version of it (with its real id). */
async function addData(key, item) {
  const res = await fetch(CDAD_ENDPOINTS[key], {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(item)
  });
  if (!res.ok) {
    console.error('addData failed for', key, res.status);
    return null;
  }
  return res.json();
}

/** PUT a merge-style update onto the item with this id. Returns the updated item, or null. */
async function updateData(key, id, updates) {
  const res = await fetch(`${CDAD_ENDPOINTS[key]}/${id}`, {
    method: 'PUT', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates)
  });
  if (!res.ok) {
    console.error('updateData failed for', key, id, res.status);
    return null;
  }
  return res.json();
}

/** DELETE the item with this id. Returns true if removed. */
async function deleteData(key, id) {
  const res = await fetch(`${CDAD_ENDPOINTS[key]}/${id}`, { method: 'DELETE', credentials: 'include' });
  return res.ok;
}

/** Find a single item by id out of the full collection. */
async function findData(key, id) {
  const arr = await getData(key);
  return arr.find((x) => String(x.id) === String(id)) || null;
}
