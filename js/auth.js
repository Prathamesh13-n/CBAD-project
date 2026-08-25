/* ============================================================
   CDAD :: auth.js
   Minimal frontend-only authentication against the seeded
   students/faculty tables. Session lives in cdad_current_user.
   ============================================================ */

/**
 * Attempts login. Always authenticates by the person's ID
 * (Student ID like ADT24SOCB0001, or Faculty ID like FAC001) —
 * never by email. Returns { ok, error, user } — never throws.
 */
function attemptLogin(role, studentOrFacultyId, password) {
  const id = (studentOrFacultyId || '').trim().toLowerCase();

  if (role === 'faculty') {
    const fac = getData(CDAD_KEYS.FACULTY).find((f) => f.displayId.toLowerCase() === id);
    if (!fac || fac.password !== password) return { ok: false, error: 'Invalid Faculty ID or password.' };
    const user = { type: 'faculty', id: fac.id, displayId: fac.displayId };
    saveData(CDAD_KEYS.CURRENT_USER, user);
    logActivity(`Faculty ${fac.displayId} logged in`);
    return { ok: true, user };
  }

  const stu = getData(CDAD_KEYS.STUDENTS).find((s) => s.displayId.toLowerCase() === id);
  if (!stu || stu.password !== password) return { ok: false, error: 'Invalid Student ID or password.' };
  if (stu.status !== 'Active') return { ok: false, error: 'This student account is not active. Contact faculty.' };
  const user = { type: 'student', id: stu.id, displayId: stu.displayId };
  saveData(CDAD_KEYS.CURRENT_USER, user);
  logActivity(`Student ${stu.displayId} logged in`);
  return { ok: true, user };
}

function getCurrentUser() {
  const u = getData(CDAD_KEYS.CURRENT_USER);
  if (!u || Array.isArray(u) || !u.id) return null;
  return u;
}

function logout() {
  const u = getCurrentUser();
  if (u) logActivity(`${u.type === 'faculty' ? 'Faculty' : 'Student'} ${u.displayId} logged out`);
  localStorage.removeItem(CDAD_KEYS.CURRENT_USER);
  window.location.href = 'index.html';
}

/** Call at the top of student.html / faculty.html to enforce the correct role. */
function requireRole(role) {
  const u = getCurrentUser();
  if (!u || u.type !== role) {
    window.location.href = 'index.html';
    return null;
  }
  return u;
}

function currentStudentRecord() {
  const u = getCurrentUser();
  if (!u || u.type !== 'student') return null;
  return findData(CDAD_KEYS.STUDENTS, u.id);
}

function currentFacultyRecord() {
  const u = getCurrentUser();
  if (!u || u.type !== 'faculty') return null;
  return findData(CDAD_KEYS.FACULTY, u.id);
}

function attemptLogin(role, studentOrFacultyId, password) {
  const id = (studentOrFacultyId || '').trim().toLowerCase();
  const pass = (password || '').trim();

  if (role === 'faculty') {
    const fac = getData(CDAD_KEYS.FACULTY).find((f) => f.displayId.toLowerCase() === id);
    if (!fac || fac.password !== pass) return { ok: false, error: 'Invalid Faculty ID or password.' };
    const user = { type: 'faculty', id: fac.id, displayId: fac.displayId };
    saveData(CDAD_KEYS.CURRENT_USER, user);
    logActivity(`Faculty ${fac.displayId} logged in`);
    return { ok: true, user };
  }

  const stu = getData(CDAD_KEYS.STUDENTS).find((s) => s.displayId.toLowerCase() === id);
  if (!stu || stu.password !== pass) return { ok: false, error: 'Invalid Student ID or password.' };
  if (stu.status !== 'Active') return { ok: false, error: 'This student account is not active. Contact faculty.' };
  const user = { type: 'student', id: stu.id, displayId: stu.displayId };
  saveData(CDAD_KEYS.CURRENT_USER, user);
  logActivity(`Student ${stu.displayId} logged in`);
  return { ok: true, user };
}