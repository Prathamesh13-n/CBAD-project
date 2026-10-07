/* ============================================================
   CDAD :: requests.js
   Two distinct request systems:
   1) Academic requests students send to FACULTY
      (Join Group / Leave Group / Change Group / Project / General)
      -> /api/requests
   2) Peer requests students send to OTHER STUDENTS
      ("connection" requests — send, accept, reject) -> /api/peer-requests
   Notification creation and activity logging happen server-side now.
   ============================================================ */

/* ================= 1. Faculty-facing academic requests ================= */

async function allRequests() {
  return getData(CDAD_KEYS.REQUESTS);
}

async function requestsForStudent(studentDisplayId) {
  const all = await allRequests();
  return all.filter((r) => r.student === studentDisplayId);
}

async function createRequest({ type, group, message }) {
  return addData(CDAD_KEYS.REQUESTS, { type, group, message });
}

async function editRequest(id, updates) {
  return updateData(CDAD_KEYS.REQUESTS, id, updates);
}

async function respondToRequest(id, status, response) {
  const res = await fetch(`/api/requests/${id}/respond`, {
    method: 'PUT', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, response })
  });
  return res.ok ? res.json() : null;
}

async function deleteRequest(id) {
  return deleteData(CDAD_KEYS.REQUESTS, id);
}

/* ================= 2. Student-to-student peer requests ================= */

async function allStudentRequests() {
  return getData(CDAD_KEYS.STUDENT_REQUESTS);
}

async function peerRequestsReceivedBy(studentDisplayId) {
  const all = await allStudentRequests();
  return all.filter((r) => r.to === studentDisplayId);
}

async function peerRequestsSentBy(studentDisplayId) {
  const all = await allStudentRequests();
  return all.filter((r) => r.from === studentDisplayId);
}

async function connectionsOf(studentDisplayId) {
  const students = await getData(CDAD_KEYS.STUDENTS);
  const s = students.find((x) => x.displayId === studentDisplayId);
  return (s && s.connections) || [];
}

async function areConnected(a, b) {
  return (await connectionsOf(a)).includes(b);
}

async function sendPeerRequest(from, to, message) {
  const res = await fetch('/api/peer-requests', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to, message })
  });
  return res.json();
}

async function respondToPeerRequest(id, accept) {
  const res = await fetch(`/api/peer-requests/${id}/respond`, {
    method: 'PUT', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ accept })
  });
  return res.json();
}

async function deletePeerRequest(id) {
  const res = await fetch(`/api/peer-requests/${id}`, { method: 'DELETE', credentials: 'include' });
  return res.ok;
}

async function removeConnection(a, b) {
  const res = await fetch(`/api/peer-requests/connections/${encodeURIComponent(b)}`, { method: 'DELETE', credentials: 'include' });
  return res.ok;
}
