/* ============================================================
   CDAD server :: serializers.js
   Reconstructs the exact JSON shapes the frontend already expects
   (the ones it used to read straight out of LocalStorage) from the
   normalized SQL rows. Keeping this shape stable is what lets most
   of the frontend survive the migration with only `await` added.
   ============================================================ */
const { db } = require('./db');

function studentDisplayId(id) {
  if (!id) return '';
  const row = db.prepare('SELECT display_id FROM students WHERE id = ?').get(id);
  return row ? row.display_id : '';
}

function facultyDisplayId(id) {
  if (!id) return '';
  const row = db.prepare('SELECT display_id FROM faculty WHERE id = ?').get(id);
  return row ? row.display_id : '';
}

function groupDisplayId(id) {
  if (!id) return '';
  const row = db.prepare('SELECT display_id FROM student_groups WHERE id = ?').get(id);
  return row ? row.display_id : '';
}

function studentIdByDisplayId(displayId) {
  const row = db.prepare('SELECT id FROM students WHERE display_id = ?').get(displayId);
  return row ? row.id : null;
}

function groupIdByDisplayId(displayId) {
  const row = db.prepare('SELECT id FROM student_groups WHERE display_id = ?').get(displayId);
  return row ? row.id : null;
}

function connectionsOf(studentId) {
  const rows = db.prepare(`
    SELECT CASE WHEN student_a_id = ? THEN student_b_id ELSE student_a_id END AS other_id
    FROM student_connections WHERE student_a_id = ? OR student_b_id = ?
  `).all(studentId, studentId, studentId);
  return rows.map((r) => studentDisplayId(r.other_id));
}

function serializeFaculty(row) {
  if (!row) return null;
  return {
    id: row.id, displayId: row.display_id, name: row.name, email: row.email,
    phone: row.phone, department: row.department, designation: row.designation,
    avatar: row.avatar, session: row.session
  };
}

function serializeStudent(row) {
  if (!row) return null;
  return {
    id: row.id, displayId: row.display_id, name: row.name, email: row.email,
    phone: row.phone, course: row.course, year: row.year, department: row.department,
    group: groupDisplayId(row.group_id), role: row.role, status: row.status, avatar: row.avatar,
    connections: connectionsOf(row.id)
  };
}

function serializeGroup(row) {
  if (!row) return null;
  const members = db.prepare('SELECT display_id FROM students WHERE group_id = ?').all(row.id).map((r) => r.display_id);
  const project = db.prepare('SELECT display_id, progress FROM projects WHERE group_id = ?').get(row.id);
  return {
    id: row.id, displayId: row.display_id, name: row.name,
    teamLeader: studentDisplayId(row.team_leader_id), members,
    project: project ? project.display_id : '', status: row.status,
    progress: project ? project.progress : 0
  };
}

function serializeSubmission(row) {
  if (!row) return null;
  return {
    link: row.link, note: row.note, submittedBy: studentDisplayId(row.submitted_by_id),
    submittedAt: row.submitted_at, status: row.status, facultyNote: row.faculty_note, reviewedAt: row.reviewed_at
  };
}

function serializeProject(row) {
  if (!row) return null;
  const submission = db.prepare('SELECT * FROM submissions WHERE project_id = ?').get(row.id);
  return {
    id: row.id, displayId: row.display_id, title: row.title, description: row.description,
    techStack: row.tech_stack, group: groupDisplayId(row.group_id), teamLeader: row.team_leader_display_id || '',
    startDate: row.start_date, deadline: row.deadline, progress: row.progress, status: row.status,
    githubUrl: row.github_url, repoName: row.repo_name, branch: row.branch,
    stages: JSON.parse(row.stages),
    submission: submission ? serializeSubmission(submission) : null
  };
}

function serializeMarks(row) {
  if (!row) return null;
  return {
    id: row.id, studentId: studentDisplayId(row.student_id),
    internal: row.internal, internalMax: row.internal_max,
    project: row.project, projectMax: row.project_max,
    presentation: row.presentation, presentationMax: row.presentation_max,
    viva: row.viva, vivaMax: row.viva_max
  };
}

function serializePresentation(row) {
  if (!row) return null;
  return {
    id: row.id, displayId: row.display_id, group: groupDisplayId(row.group_id),
    project: row.project_id ? db.prepare('SELECT display_id FROM projects WHERE id = ?').get(row.project_id).display_id : '',
    date: row.date, time: row.time, venue: row.venue, faculty: facultyDisplayId(row.faculty_id),
    status: row.status, notes: row.notes
  };
}

function serializeRequest(row) {
  if (!row) return null;
  return {
    id: row.id, displayId: row.display_id, student: studentDisplayId(row.student_id),
    type: row.type, group: groupDisplayId(row.group_id), message: row.message,
    date: row.date, status: row.status, response: row.response
  };
}

function serializeGroupJoinRequest(row) {
  if (!row) return null;
  return {
    id: row.id, from: studentDisplayId(row.from_student_id), to: studentDisplayId(row.to_student_id),
    groupId: row.group_id, groupDisplayId: groupDisplayId(row.group_id),
    message: row.message, date: row.date, status: row.status
  };
}

function serializePeerRequest(row) {
  if (!row) return null;
  return {
    id: row.id, from: studentDisplayId(row.from_student_id), to: studentDisplayId(row.to_student_id),
    message: row.message, date: row.date, status: row.status
  };
}

function serializeNotification(row) {
  if (!row) return null;
  let recipient = row.recipient_kind;
  if (row.recipient_kind === 'student') recipient = studentDisplayId(row.recipient_student_id);
  else if (row.recipient_kind === 'faculty') recipient = facultyDisplayId(row.recipient_faculty_id);
  else if (row.recipient_kind === 'group') recipient = groupDisplayId(row.recipient_group_id);
  return {
    id: row.id, title: row.title, message: row.message, type: row.type,
    recipient, date: row.date, read: !!row.read
  };
}

function serializeAnnouncement(row) {
  if (!row) return null;
  return {
    id: row.id, title: row.title, message: row.message, author: row.author,
    date: row.date, priority: row.priority, status: row.status
  };
}

function serializeActivity(row) {
  if (!row) return null;
  return { id: row.id, text: row.text, date: row.date };
}

module.exports = {
  studentDisplayId, facultyDisplayId, groupDisplayId, studentIdByDisplayId, groupIdByDisplayId, connectionsOf,
  serializeFaculty, serializeStudent, serializeGroup, serializeProject, serializeSubmission,
  serializeMarks, serializePresentation, serializeRequest, serializeGroupJoinRequest,
  serializePeerRequest, serializeNotification, serializeAnnouncement, serializeActivity
};
