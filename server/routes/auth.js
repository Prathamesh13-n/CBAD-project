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
const { createCaptcha, verifyCaptcha } = require('../captcha');

const router = express.Router();
// COOKIE_SECURE=true when served over HTTPS (browsers then only send the session cookie over TLS).
const COOKIE_OPTIONS = { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true' };

router.post('/login', (req, res) => {
  const { role, id, password } = req.body || {};
  const idLower = String(id || '').trim().toLowerCase();
  const pass = String(password || '').trim();

  if (role === 'admin') {
    const adm = db.prepare('SELECT * FROM admins WHERE LOWER(display_id) = ?').get(idLower);
    if (!adm || !bcrypt.compareSync(pass, adm.password_hash)) {
      return res.status(401).json({ ok: false, error: 'Invalid Admin ID or password.' });
    }
    const user = { type: 'admin', id: adm.id, displayId: adm.display_id };
    const sid = createSession(user);
    res.cookie(COOKIE_NAME, sid, COOKIE_OPTIONS);
    logActivity(`Admin ${adm.display_id} logged in`);
    return res.json({ ok: true, user });
  }

  if (role === 'faculty') {
    const fac = db.prepare('SELECT * FROM faculty WHERE LOWER(display_id) = ?').get(idLower);
    if (!fac || !bcrypt.compareSync(pass, fac.password_hash)) {
      return res.status(401).json({ ok: false, error: 'Invalid Faculty ID or password.' });
    }
    const user = { type: 'faculty', id: fac.id, displayId: fac.display_id };
    const sid = createSession(user);
    res.cookie(COOKIE_NAME, sid, COOKIE_OPTIONS);
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
  res.cookie(COOKIE_NAME, sid, COOKIE_OPTIONS);
  logActivity(`Student ${stu.display_id} logged in`);
  res.json({ ok: true, user });
});

/** A fresh image captcha: { id, svg }. The answer never leaves the server. */
router.get('/captcha', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(createCaptcha());
});

/**
 * Self-service password reset: the ID and the email on file for that account must match,
 * the captcha must be solved, and then the new password is set directly.
 * Body: { role, id, email, captchaId, captchaText, newPassword }. Admins can't use this.
 */
router.post('/forgot-password/reset', (req, res) => {
  const { role, id, email, captchaId, captchaText, newPassword } = req.body || {};
  if (role !== 'student' && role !== 'faculty') {
    return res.status(400).json({ ok: false, error: 'Password reset is only available for students and faculty.' });
  }
  // Checked first (and consumed) so a wrong captcha reveals nothing about the account.
  if (!verifyCaptcha(captchaId, captchaText)) {
    return res.status(400).json({ ok: false, error: 'Captcha was incorrect or expired. Try the new one.', captchaFailed: true });
  }
  const pass = String(newPassword || '').trim();
  if (pass.length < 4) return res.status(400).json({ ok: false, error: 'New password must be at least 4 characters.' });

  const table = role === 'faculty' ? 'faculty' : 'students';
  const row = db.prepare(`SELECT * FROM ${table} WHERE LOWER(display_id) = ?`).get(String(id || '').trim().toLowerCase());
  if (!row || String(row.email || '').trim().toLowerCase() !== String(email || '').trim().toLowerCase()) {
    return res.status(401).json({ ok: false, error: 'ID and email do not match our records.' });
  }
  db.prepare(`UPDATE ${table} SET password_hash = ? WHERE id = ?`).run(bcrypt.hashSync(pass, 10), row.id);
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
  if (session.type === 'admin') {
    const adm = db.prepare('SELECT * FROM admins WHERE id = ?').get(session.id);
    // Faculty-shaped so the faculty dashboard can render an admin too.
    return res.json(adm ? { type: 'admin', id: adm.id, displayId: adm.display_id, name: adm.name, email: adm.email,
      phone: '', department: 'Administration', designation: 'Administrator', avatar: '', session: '' } : null);
  }
  if (session.type === 'faculty') {
    const fac = db.prepare('SELECT * FROM faculty WHERE id = ?').get(session.id);
    return res.json(fac ? Object.assign({ type: 'faculty' }, serializeFaculty(fac)) : null);
  }
  const stu = db.prepare('SELECT * FROM students WHERE id = ?').get(session.id);
  res.json(stu ? Object.assign({ type: 'student' }, serializeStudent(stu)) : null);
});

module.exports = router;
