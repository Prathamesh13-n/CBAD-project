/* ============================================================
   CDAD :: groups.js
   CRUD for groups. Keeps member counts, student.group fields,
   and group.progress (mirrored from its project) in sync.
   ============================================================ */

function allGroups() {
  return getData(CDAD_KEYS.GROUPS);
}

function getGroup(displayId) {
  return allGroups().find((g) => g.displayId === displayId) || null;
}

function memberCount(group) {
  return (group.members || []).length;
}

function createGroup({ name, teamLeader, members, project, status }) {
  const displayId = nextSequentialId(CDAD_KEYS.GROUPS, 'G', 2);
  const group = {
    id: generateId('GRP'),
    displayId,
    name,
    teamLeader: teamLeader || '',
    members: members || [],
    project: project || '',
    status: status || 'Active',
    progress: 0
  };
  addData(CDAD_KEYS.GROUPS, group);
  syncStudentsGroupField(group);
  logActivity(`Group ${displayId} created`);
  return group;
}

function editGroup(id, updates) {
  const updated = updateData(CDAD_KEYS.GROUPS, id, updates);
  if (updated) {
    syncStudentsGroupField(updated);
    logActivity(`Group ${updated.displayId} updated`);
  }
  return updated;
}

function deleteGroup(id) {
  const group = findData(CDAD_KEYS.GROUPS, id);
  if (!group) return false;
  deleteData(CDAD_KEYS.GROUPS, id);
  // clear group reference on member students
  const students = getData(CDAD_KEYS.STUDENTS).map((s) =>
    s.group === group.displayId ? Object.assign({}, s, { group: '' }) : s
  );
  saveData(CDAD_KEYS.STUDENTS, students);
  logActivity(`Group ${group.displayId} deleted`);
  return true;
}

/** Ensures every member's student.group matches this group, and non-members are cleared. */
function syncStudentsGroupField(group) {
  const students = getData(CDAD_KEYS.STUDENTS).map((s) => {
    const isMember = (group.members || []).includes(s.displayId);
    if (isMember && s.group !== group.displayId) return Object.assign({}, s, { group: group.displayId });
    if (!isMember && s.group === group.displayId) return Object.assign({}, s, { group: '' });
    return s;
  });
  saveData(CDAD_KEYS.STUDENTS, students);
}

function addMember(groupId, studentDisplayId) {
  const group = findData(CDAD_KEYS.GROUPS, groupId);
  if (!group) return null;
  const members = new Set(group.members || []);
  members.add(studentDisplayId);
  const updated = editGroup(groupId, { members: Array.from(members) });
  logActivity(`${studentDisplayId} added to group ${updated.displayId}`);
  return updated;
}

function removeMember(groupId, studentDisplayId) {
  const group = findData(CDAD_KEYS.GROUPS, groupId);
  if (!group) return null;
  const members = (group.members || []).filter((m) => m !== studentDisplayId);
  const updates = { members };
  if (group.teamLeader === studentDisplayId) updates.teamLeader = members[0] || '';
  const updated = editGroup(groupId, updates);
  logActivity(`${studentDisplayId} removed from group ${updated.displayId}`);
  return updated;
}

/** Push a project's computed progress into its owning group. */
function syncGroupProgressFromProject(project) {
  const group = getGroup(project.group);
  if (!group) return;
  updateData(CDAD_KEYS.GROUPS, group.id, { progress: project.progress, status: project.status === 'Completed' ? group.status : group.status });
}


/* ================= Join-by-ID requests (student -> group leader) =================
   A student who has no group yet can look up another student's ID (the leader
   of the group they want to join), and send that leader a direct request.
   If the leader accepts, the requester is added to the group immediately. */

function allGroupJoinRequests() {
  return getData(CDAD_KEYS.GROUP_JOIN_REQUESTS);
}

function joinRequestsReceivedBy(leaderDisplayId) {
  return allGroupJoinRequests().filter((r) => r.to === leaderDisplayId && r.status === 'Pending');
}

function joinRequestsSentBy(studentDisplayId) {
  return allGroupJoinRequests().filter((r) => r.from === studentDisplayId);
}

/** Look up a student by ID and, if they lead a group, return that group. Used to preview before sending. */
function findLeaderAndGroupById(targetId) {
  const id = (targetId || '').trim().toLowerCase();
  const leader = getData(CDAD_KEYS.STUDENTS).find((s) => s.displayId.toLowerCase() === id);
  if (!leader) return { ok: false, error: 'No student found with that ID.' };
  const group = getData(CDAD_KEYS.GROUPS).find((g) => g.teamLeader === leader.displayId);
  if (!group) return { ok: false, error: `${leader.name} is not currently leading a group.` };
  return { ok: true, leader, group };
}

function sendGroupJoinRequest(fromDisplayId, targetLeaderId, message) {
  const fromStudent = getData(CDAD_KEYS.STUDENTS).find((s) => s.displayId === fromDisplayId);
  if (!fromStudent) return { ok: false, error: 'You are not recognized as a student.' };
  if (fromStudent.group) return { ok: false, error: 'You are already in a group.' };

  const lookup = findLeaderAndGroupById(targetLeaderId);
  if (!lookup.ok) return lookup;
  const { leader, group } = lookup;

  if (leader.displayId === fromDisplayId) return { ok: false, error: "You can't send a request to yourself." };
  const duplicate = allGroupJoinRequests().find((r) => r.from === fromDisplayId && r.groupId === group.id && r.status === 'Pending');
  if (duplicate) return { ok: false, error: 'You already have a pending request for this group.' };

  const req = {
    id: generateId('GJR'),
    from: fromDisplayId,
    to: leader.displayId,
    groupId: group.id,
    groupDisplayId: group.displayId,
    message: message || '',
    date: new Date().toISOString(),
    status: 'Pending'
  };
  addData(CDAD_KEYS.GROUP_JOIN_REQUESTS, req);
  createNotification({
    title: 'New Group Join Request',
    message: `${fromDisplayId} requested to join your group ${group.displayId} (${group.name}).`,
    type: 'request',
    recipient: leader.displayId
  });
  logActivity(`${fromDisplayId} requested to join group ${group.displayId} (leader ${leader.displayId})`);
  return { ok: true, request: req, leaderName: leader.name, groupName: group.name };
}

function respondToGroupJoinRequest(requestId, accept) {
  const req = findData(CDAD_KEYS.GROUP_JOIN_REQUESTS, requestId);
  if (!req) return { ok: false, error: 'Request not found.' };
  const status = accept ? 'Accepted' : 'Rejected';
  updateData(CDAD_KEYS.GROUP_JOIN_REQUESTS, requestId, { status });

  if (accept) {
    const stillOpen = getData(CDAD_KEYS.STUDENTS).find((s) => s.displayId === req.from && !s.group);
    if (!stillOpen) {
      updateData(CDAD_KEYS.GROUP_JOIN_REQUESTS, requestId, { status: 'Rejected' });
      return { ok: false, error: 'That student already joined another group.' };
    }
    addMember(req.groupId, req.from);
  }

  createNotification({
    title: `Group Join Request ${status}`,
    message: accept
      ? `You've been added to group ${req.groupDisplayId}.`
      : `Your request to join group ${req.groupDisplayId} was rejected.`,
    type: 'request',
    recipient: req.from
  });
  logActivity(`Group join request from ${req.from} for group ${req.groupDisplayId} ${status.toLowerCase()}`);
  return { ok: true };
}