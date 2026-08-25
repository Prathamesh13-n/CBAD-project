/* ============================================================
   CDAD :: storage.js
   Single source of truth for all LocalStorage access.
   Every other file MUST go through these functions —
   never call localStorage.getItem/setItem directly elsewhere.
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
  ACTIVITY: 'cdad_activity',
  CURRENT_USER: 'cdad_current_user',
  SEEDED: 'cdad_seeded'
};

/** Read an array (or object) from LocalStorage. Returns [] if missing/invalid. */
function getData(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return parsed === null || parsed === undefined ? [] : parsed;
  } catch (e) {
    console.error('getData parse error for', key, e);
    return [];
  }
}

/** Overwrite the entire array/object stored at key. */
function saveData(key, data) {
  localStorage.setItem(key, JSON.stringify(data));
  return data;
}

/** Push a new item into an array collection and persist it. */
function addData(key, item) {
  const arr = getData(key);
  arr.push(item);
  saveData(key, arr);
  return item;
}

/** Merge `updates` into the item whose id matches, persist, return updated item. */
function updateData(key, id, updates) {
  const arr = getData(key);
  const idx = arr.findIndex((x) => x.id === id);
  if (idx === -1) return null;
  arr[idx] = Object.assign({}, arr[idx], updates);
  saveData(key, arr);
  return arr[idx];
}

/** Remove the item whose id matches. Returns true if something was removed. */
function deleteData(key, id) {
  const arr = getData(key);
  const next = arr.filter((x) => x.id !== id);
  const removed = next.length !== arr.length;
  saveData(key, next);
  return removed;
}

/** Find a single item by id. */
function findData(key, id) {
  return getData(key).find((x) => x.id === id) || null;
}

/** Find items matching a predicate function. */
function queryData(key, predicate) {
  return getData(key).filter(predicate);
}

/** Generate a short unique id, optionally prefixed (e.g. generateId('ST') -> 'ST17x...'). */
function generateId(prefix) {
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  const time = Date.now().toString(36).slice(-4).toUpperCase();
  return `${prefix || 'ID'}-${time}${rand}`;
}

/** Produce the next sequential display id like ST001, GRP005, PRJ012, PRE003... */
function nextSequentialId(key, prefix, pad) {
  const arr = getData(key);
  let max = 0;
  arr.forEach((item) => {
    const idField = item.displayId || '';
    const match = idField.match(/(\d+)$/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  });
  const num = String(max + 1).padStart(pad || 3, '0');
  return `${prefix}${num}`;
}
