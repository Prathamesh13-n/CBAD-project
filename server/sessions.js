/* ============================================================
   CDAD server :: sessions.js
   In-memory session store (class-project scale: a server restart
   logs everyone out, which is an accepted tradeoff — see the plan).
   ============================================================ */
const crypto = require('node:crypto');

const COOKIE_NAME = 'cdad_sid';
const sessions = new Map(); // sid -> { type: 'student'|'faculty', id, displayId }

function createSession(user) {
  const sid = crypto.randomUUID();
  sessions.set(sid, user);
  return sid;
}

function getSession(sid) {
  return sid ? sessions.get(sid) || null : null;
}

function destroySession(sid) {
  sessions.delete(sid);
}

/** Express middleware factory. requireRole() (no arg) = any authenticated user. */
function requireRole(role) {
  return (req, res, next) => {
    const session = getSession(req.cookies[COOKIE_NAME]);
    if (!session || (role && session.type !== role)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.user = session;
    next();
  };
}

module.exports = { COOKIE_NAME, createSession, getSession, destroySession, requireRole };
