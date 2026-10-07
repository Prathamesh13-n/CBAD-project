/* ============================================================
   CDAD :: presentations.js
   Thin wrappers over /api/presentations. Notification creation
   and activity logging happen server-side now.
   ============================================================ */

async function allPresentations() {
  return getData(CDAD_KEYS.PRESENTATIONS);
}

async function presentationsForGroup(groupDisplayId) {
  const all = await allPresentations();
  return all.filter((p) => p.group === groupDisplayId);
}

async function createPresentation(data) {
  return addData(CDAD_KEYS.PRESENTATIONS, data);
}

async function editPresentation(id, updates) {
  return updateData(CDAD_KEYS.PRESENTATIONS, id, updates);
}

async function reschedulePresentation(id, date, time) {
  const res = await fetch(`/api/presentations/${id}/reschedule`, {
    method: 'PUT', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, time })
  });
  return res.ok ? res.json() : null;
}

async function cancelPresentation(id) {
  const res = await fetch(`/api/presentations/${id}/cancel`, { method: 'PUT', credentials: 'include' });
  return res.ok ? res.json() : null;
}

async function completePresentation(id) {
  const res = await fetch(`/api/presentations/${id}/complete`, { method: 'PUT', credentials: 'include' });
  return res.ok ? res.json() : null;
}

async function deletePresentation(id) {
  return deleteData(CDAD_KEYS.PRESENTATIONS, id);
}
