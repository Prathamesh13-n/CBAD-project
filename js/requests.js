/* ============================================================
   CDAD :: requests.js
   Two distinct request systems:
   1) Academic requests students send to FACULTY
      (Join Group / Leave Group / Change Group / Project / General)
   2) Peer requests students send to OTHER STUDENTS
      ("connection" requests — send, accept, reject).
   ============================================================ */

/* ================= 1. Faculty-facing academic requests ================= */

function allRequests() {
  return getData(CDAD_KEYS.REQUESTS);
}

function requestsForStudent(studentDisplayId) {
  return allRequests().filter((r) => r.student === studentDisplayId);
}

function createRequest({ student, type, group, message }) {
  const displayId = nextSequentialId(CDAD_KEYS.REQUESTS, 'REQ', 3);
  const req = {
    id: generateId('REQ'),
    displayId,
    student,
    type,
    group: group || '',
    message: message || '',
    date: new Date().toISOString(),
    status: 'Pending',
    response: ''
  };
  addData(CDAD_KEYS.REQUESTS, req);
  createNotification({
    title: 'New Request Submitted',
    message: `${student} submitted a "${type}" request.`,
    type: 'request',
    recipient: 'all-faculty'
  });
  logActivity(`Request ${displayId} (${type}) submitted by ${student}`);
  return req;
}

function editRequest(id, updates) {
  const updated = updateData(CDAD_KEYS.REQUESTS, id, updates);
  if (updated) logActivity(`Request ${updated.displayId} updated`);
  return updated;
}

function respondToRequest(id, status, response) {
  const updated = updateData(CDAD_KEYS.REQUESTS, id, { status, response: response || '' });
  if (!updated) return null;
  createNotification({
    title: `Request ${status}`,
    message: `Your "${updated.type}" request has been ${status.toLowerCase()}.${response ? ' Note: ' + response : ''}`,
    type: 'request',
    recipient: updated.student
  });
  logActivity(`Request ${updated.displayId} ${status.toLowerCase()}`);
  return updated;
}

function deleteRequest(id) {
  const r = findData(CDAD_KEYS.REQUESTS, id);
  if (!r) return false;
  deleteData(CDAD_KEYS.REQUESTS, id);
  logActivity(`Request ${r.displayId} deleted`);
  return true;
}

/* ================= 2. Student-to-student peer requests ================= */
/* Lets one student send a connection/teamwork request to another student.
   The receiving student can Accept or Reject it. On accept, both students'
   `connections` arrays are updated so they show up as connected. */

function allStudentRequests() {
  return getData(CDAD_KEYS.STUDENT_REQUESTS);
}

function peerRequestsReceivedBy(studentDisplayId) {
  return allStudentRequests().filter((r) => r.to === studentDisplayId);
}

function peerRequestsSentBy(studentDisplayId) {
  return allStudentRequests().filter((r) => r.from === studentDisplayId);
}

function connectionsOf(studentDisplayId) {
  const s = getData(CDAD_KEYS.STUDENTS).find((x) => x.displayId === studentDisplayId);
  return (s && s.connections) || [];
}

function areConnected(a, b) {
  return connectionsOf(a).includes(b);
}

function hasPendingPeerRequest(from, to) {
  return allStudentRequests().some(
    (r) => r.status === 'Pending' && ((r.from === from && r.to === to) || (r.from === to && r.to === from))
  );
}

function sendPeerRequest(from, to, message) {
  if (from === to) return { ok: false, error: "You can't send a request to yourself." };
  if (areConnected(from, to)) return { ok: false, error: 'You are already connected with this student.' };
  if (hasPendingPeerRequest(from, to)) return { ok: false, error: 'A pending request already exists between you two.' };
  const req = {
    id: generateId('SREQ'),
    from, to,
    message: message || '',
    date: new Date().toISOString(),
    status: 'Pending'
  };
  addData(CDAD_KEYS.STUDENT_REQUESTS, req);
  createNotification({
    title: 'New Connection Request',
    message: `${from} sent you a request${message ? ': "' + message + '"' : '.'}`,
    type: 'peer-request',
    recipient: to
  });
  logActivity(`${from} sent a connection request to ${to}`);
  return { ok: true, request: req };
}

function respondToPeerRequest(id, accept) {
  const req = findData(CDAD_KEYS.STUDENT_REQUESTS, id);
  if (!req) return { ok: false, error: 'Request not found.' };
  const status = accept ? 'Accepted' : 'Rejected';
  updateData(CDAD_KEYS.STUDENT_REQUESTS, id, { status });

  if (accept) {
    const students = getData(CDAD_KEYS.STUDENTS).map((s) => {
      if (s.displayId === req.from && !((s.connections || []).includes(req.to))) {
        return Object.assign({}, s, { connections: [...(s.connections || []), req.to] });
      }
      if (s.displayId === req.to && !((s.connections || []).includes(req.from))) {
        return Object.assign({}, s, { connections: [...(s.connections || []), req.from] });
      }
      return s;
    });
    saveData(CDAD_KEYS.STUDENTS, students);
  }

  createNotification({
    title: `Connection Request ${status}`,
    message: `${req.to} ${status.toLowerCase()} your connection request.`,
    type: 'peer-request',
    recipient: req.from
  });
  logActivity(`Connection request from ${req.from} to ${req.to} ${status.toLowerCase()}`);
  return { ok: true };
}

function deletePeerRequest(id) {
  const r = findData(CDAD_KEYS.STUDENT_REQUESTS, id);
  if (!r) return false;
  deleteData(CDAD_KEYS.STUDENT_REQUESTS, id);
  logActivity(`Connection request ${id} removed`);
  return true;
}

function removeConnection(a, b) {
  const students = getData(CDAD_KEYS.STUDENTS).map((s) => {
    if (s.displayId === a) return Object.assign({}, s, { connections: (s.connections || []).filter((c) => c !== b) });
    if (s.displayId === b) return Object.assign({}, s, { connections: (s.connections || []).filter((c) => c !== a) });
    return s;
  });
  saveData(CDAD_KEYS.STUDENTS, students);
  logActivity(`Connection between ${a} and ${b} removed`);
}
