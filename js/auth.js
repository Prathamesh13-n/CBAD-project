/* ============================================================
   CDAD :: auth.js
   Thin wrapper over /api/auth/* — the server now owns credential
   checking (bcrypt) and session state (an HttpOnly cookie) instead
   of a plaintext LocalStorage comparison.
   ============================================================ */

/**
 * Attempts login. Always authenticates by the person's ID
 * (Student ID like ADT24SOCB0001, or Faculty ID like FAC001) —
 * never by email. Returns { ok, error, user } — never throws.
 */
async function attemptLogin(role, studentOrFacultyId, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, id: studentOrFacultyId, password })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || 'Login failed.' };
  return { ok: true, user: data.user };
}

/**
 * Self-service password reset. No email is sent — identity is verified
 * by matching `id` against the email already on file for that account.
 * Returns { ok, error } — never throws.
 */
async function resetPassword(role, id, email, newPassword) {
  const res = await fetch('/api/auth/forgot-password', {
    method: 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, id, email, newPassword })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error || 'Could not reset password.' };
  return { ok: true };
}

/** The full current-user record (student or faculty shape) plus a `type` field, or null. */
async function getCurrentUser() {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (!res.ok) return null;
  return res.json();
}

async function logout() {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  window.location.href = 'index.html';
}

/** Call at the top of a page to enforce the correct role — or, with no argument, just require any logged-in session. */
async function requireRole(role) {
  const u = await getCurrentUser();
  if (!u || (role && u.type !== role)) {
    window.location.href = 'index.html';
    return null;
  }
  return u;
}

async function currentStudentRecord() {
  const u = await getCurrentUser();
  return u && u.type === 'student' ? u : null;
}

async function currentFacultyRecord() {
  const u = await getCurrentUser();
  return u && u.type === 'faculty' ? u : null;
}
