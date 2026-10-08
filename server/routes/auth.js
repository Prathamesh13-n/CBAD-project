/* ============================================================
   CDAD server :: routes/auth.js
   Ports js/auth.js's attemptLogin/logout/getCurrentUser onto real
   sessions. Passwords are bcrypt-hashed server-side (seed.js hashes
   them at seed time) instead of the frontend's old plaintext `===`.
   ============================================================ */
const express = require('express');
const bcrypt = require('bcryptjs');
const { db, logActivity } = require('../db');
const { serializeStudent, serializeFaculty } = require('../serializers');
const { COOKIE_NAME, createSession, getSession, destroySession } = require('../sessions');
const { createResetCode, checkResetCode, consumeResetCode } = require('../resetCodes');
const { sendResetCodeEmail } = require('../mailer');

const router = express.Router();

router.post('/login', (req, res) => {
  const { role, id, password } = req.body || {};
  const idLower = String(id || '').trim().toLowerCase();
  const pass = String(password || '').trim();

  if (role === 'faculty') {
    const fac = db.prepare('SELECT * FROM faculty WHERE LOWER(display_id) = ?').get(idLower);
    if (!fac || !bcrypt.compareSync(pass, fac.password_hash)) {
      return res.status(401).json({ ok: false, error: 'Invalid Faculty ID or password.' });
    }
    const user = { type: 'faculty', id: fac.id, displayId: fac.display_id };
    const sid = createSession(user);
    res.cookie(COOKIE_NAME, sid, { httpOnly: true, sameSite: 'lax' });
    logActivity(`Faculty ${fac.display_id} logged in`);
    return res.json({ ok: true, user });
  }

  const stu = db.prepare('SELECT * FROM students WHERE LOWER(display_id) = ?').get(idLower);
  if (!stu || !bcrypt.compareSync(pass, stu.password_hash)) {
    return res.status(401).json({ ok: false, error: 'Invalid Student ID or password.' });
  }
  if (stu.status !== 'Active') {
    return res.status(403).json({ ok: false, error: 'This student account is not active. Contact faculty.' });
  }
  const user = { type: 'student', id: stu.id, displayId: stu.display_id };
  const sid = createSession(user);
  res.cookie(COOKIE_NAME, sid, { httpOnly: true, sameSite: 'lax' });
  logActivity(`Student ${stu.display_id} logged in`);
  res.json({ ok: true, user });
});

/**
 * Self-service password reset, step 1 of 2. Verifies the ID matches the
 * email already on file for that account, then emails a 6-digit code to
 * that address (real email now, via server/mailer.js — Gmail SMTP with
 * an App Password). Step 2 (POST /forgot-password/confirm) takes that
 * code + the new password.
 */
router.post('/forgot-password/request', async (req, res) => {
  const { role, id, email } = req.body || {};
  const idLower = String(id || '').trim().toLowerCase();
  const emailLower = String(email || '').trim().toLowerCase();

  const table = role === 'faculty' ? 'faculty' : 'students';
  const row = db.prepare(`SELECT * FROM ${table} WHERE LOWER(display_id) = ?`).get(idLower);
  if (!row || String(row.email || '').trim().toLowerCase() !== emailLower) {
    return res.status(401).json({ ok: false, error: 'ID and email do not match our records.' });
  }

  const code = createResetCode(role, id);
  try {
    await sendResetCodeEmail(row.email, code);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || 'Could not send the reset email.' });
  }

  logActivity(`${role === 'faculty' ? 'Faculty' : 'Student'} ${row.display_id} requested a password reset code`);
  res.json({ ok: true });
});

/** Self-service password reset, step 2 of 2 — the code emailed in step 1, plus the new password. */
router.post('/forgot-password/confirm', (req, res) => {
  const { role, id, code, newPassword } = req.body || {};
  const idLower = String(id || '').trim().toLowerCase();
  const pass = String(newPassword || '').trim();

  if (pass.length < 4) {
    return res.status(400).json({ ok: false, error: 'New password must be at least 4 characters.' });
  }
  if (!checkResetCode(role, id, code)) {
    return res.status(401).json({ ok: false, error: 'That code is invalid or has expired. Request a new one.' });
  }

  const table = role === 'faculty' ? 'faculty' : 'students';
  const row = db.prepare(`SELECT * FROM ${table} WHERE LOWER(display_id) = ?`).get(idLower);
  if (!row) return res.status(404).json({ ok: false, error: 'Account not found.' });

  const passwordHash = bcrypt.hashSync(pass, 10);
  db.prepare(`UPDATE ${table} SET password_hash = ? WHERE id = ?`).run(passwordHash, row.id);
  consumeResetCode(role, id);
  logActivity(`${role === 'faculty' ? 'Faculty' : 'Student'} ${row.display_id} reset their password via Forgot Password`);
  res.json({ ok: true });
});

router.post('/logout', (req, res) => {
  const sid = req.cookies[COOKIE_NAME];
  const session = getSession(sid);
  if (session) {
    logActivity(`${session.type === 'faculty' ? 'Faculty' : 'Student'} ${session.displayId} logged out`);
    destroySession(sid);
  }
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  const session = getSession(req.cookies[COOKIE_NAME]);
  if (!session) return res.json(null);
  if (session.type === 'faculty') {
    const fac = db.prepare('SELECT * FROM faculty WHERE id = ?').get(session.id);
    return res.json(fac ? Object.assign({ type: 'faculty' }, serializeFaculty(fac)) : null);
  }
  const stu = db.prepare('SELECT * FROM students WHERE id = ?').get(session.id);
  res.json(stu ? Object.assign({ type: 'student' }, serializeStudent(stu)) : null);
});

module.exports = router;
