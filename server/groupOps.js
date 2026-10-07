/* ============================================================
   CDAD server :: groupOps.js
   Shared group-membership operations used by both routes/groups.js
   and routes/groupJoinRequests.js (kept out of either to avoid a
   circular require between the two route modules).
   ============================================================ */
const { db, logActivity } = require('./db');

function addMember(groupId, studentId) {
  db.prepare('UPDATE students SET group_id = ? WHERE id = ?').run(groupId, studentId);
}

/** Removes a member; if they were the leader, promotes the next remaining member. */
function removeMember(groupId, studentId) {
  const group = db.prepare('SELECT * FROM student_groups WHERE id = ?').get(groupId);
  if (!group) return;
  db.prepare('UPDATE students SET group_id = NULL WHERE id = ? AND group_id = ?').run(studentId, groupId);
  if (group.team_leader_id === studentId) {
    const nextLeader = db.prepare('SELECT id FROM students WHERE group_id = ? ORDER BY id LIMIT 1').get(groupId);
    db.prepare('UPDATE student_groups SET team_leader_id = ? WHERE id = ?').run(nextLeader ? nextLeader.id : null, groupId);
  }
}

function deleteGroup(groupId) {
  const group = db.prepare('SELECT * FROM student_groups WHERE id = ?').get(groupId);
  if (!group) return false;
  db.prepare('UPDATE students SET group_id = NULL WHERE group_id = ?').run(groupId);
  db.prepare('DELETE FROM student_groups WHERE id = ?').run(groupId);
  logActivity(`Group ${group.display_id} deleted`);
  return true;
}

module.exports = { addMember, removeMember, deleteGroup };
