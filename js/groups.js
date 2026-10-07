/* ============================================================
   CDAD :: groups.js
   Thin wrappers over /api/groups + /api/group-join-requests.
   Membership sync, leader reassignment, progress mirroring,
   notification creation and activity logging all happen
   server-side now (see server/routes/groups.js and groupOps.js).
   ============================================================ */

async function allGroups() {
  return getData(CDAD_KEYS.GROUPS);
}

async function getGroup(displayId) {
  const groups = await allGroups();
  return groups.find((g) => g.displayId === displayId) || null;
}

function memberCount(group) {
  return (group.members || []).length;
}

async function createGroup({ name, teamLeader, members, status }) {
  return addData(CDAD_KEYS.GROUPS, { name, teamLeader: teamLeader || '', members: members || [], status: status || 'Active' });
}

async function editGroup(id, updates) {
  return updateData(CDAD_KEYS.GROUPS, id, updates);
}

async function deleteGroup(id) {
  return deleteData(CDAD_KEYS.GROUPS, id);
}

async function addMember(groupId, studentDisplayId) {
  const res = await fetch(`/api/groups/${groupId}/members`, {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentDisplayId })
  });
  return res.ok ? res.json() : null;
}

async function removeMember(groupId, studentDisplayId) {
  const students = await getData(CDAD_KEYS.STUDENTS);
  const student = students.find((s) => s.displayId === studentDisplayId);
  if (!student) return null;
  const res = await fetch(`/api/groups/${groupId}/members/${student.id}`, { method: 'DELETE', credentials: 'include' });
  return res.ok ? res.json() : null;
}

/** Self-service leave — always leaves the caller's own group (server reads this from the session). */
async function leaveGroup(studentDisplayId) {
  const me = await getCurrentUser();
  if (!me || me.type !== 'student' || !me.group) return { ok: false, error: 'You are not in a group.' };
  const group = await getGroup(me.group);
  if (!group) return { ok: false, error: 'Group not found.' };
  const res = await fetch(`/api/groups/${group.id}/leave`, { method: 'POST', credentials: 'include' });
  return res.json();
}

/* ================= Join-by-ID requests (student -> group leader) ================= */

async function allGroupJoinRequests() {
  return getData(CDAD_KEYS.GROUP_JOIN_REQUESTS);
}

async function joinRequestsReceivedBy(leaderDisplayId) {
  const all = await allGroupJoinRequests();
  return all.filter((r) => r.to === leaderDisplayId && r.status === 'Pending');
}

async function joinRequestsSentBy(studentDisplayId) {
  const all = await allGroupJoinRequests();
  return all.filter((r) => r.from === studentDisplayId);
}

/** Look up a student by ID and, if they lead a group, return that group. Used to preview before sending. */
async function findLeaderAndGroupById(targetId) {
  const res = await fetch(`/api/group-join-requests/lookup?targetId=${encodeURIComponent(targetId)}`, { credentials: 'include' });
  const data = await res.json();
  if (!data.ok) return { ok: false, error: data.error };
  const groups = await allGroups();
  const group = groups.find((g) => g.displayId === data.groupDisplayId);
  return { ok: true, leader: { displayId: data.leaderDisplayId, name: data.leaderName }, group };
}

async function sendGroupJoinRequest(fromDisplayId, targetLeaderId, message) {
  const res = await fetch('/api/group-join-requests', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetLeaderId, message })
  });
  const data = await res.json();
  if (!data.ok) return data;
  return { ok: true, request: data.request, leaderName: data.leaderName, groupName: data.groupName };
}

async function respondToGroupJoinRequest(requestId, accept) {
  const res = await fetch(`/api/group-join-requests/${requestId}/respond`, {
    method: 'PUT', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ accept })
  });
  return res.json();
}
