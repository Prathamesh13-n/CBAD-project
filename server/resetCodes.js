/* ============================================================
   CDAD server :: resetCodes.js
   Short-lived, single-use codes for the Forgot Password email
   confirmation step. In-memory like sessions.js — a server restart
   invalidates any in-flight reset, which is fine at this scale.
   ============================================================ */
const crypto = require('node:crypto');

const CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const codes = new Map(); // key (`${role}:${idLower}`) -> { code, expiresAt }

function keyFor(role, id) {
  return `${role}:${String(id).trim().toLowerCase()}`;
}

/** Generates and stores a fresh 6-digit code, overwriting any previous pending code for this account. */
function createResetCode(role, id) {
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  codes.set(keyFor(role, id), { code, expiresAt: Date.now() + CODE_TTL_MS });
  return code;
}

/** Checks the code without consuming it (so a wrong attempt doesn't burn the real code). */
function checkResetCode(role, id, code) {
  const entry = codes.get(keyFor(role, id));
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) { codes.delete(keyFor(role, id)); return false; }
  return entry.code === String(code).trim();
}

/** Call after a successful password reset so the code can't be reused. */
function consumeResetCode(role, id) {
  codes.delete(keyFor(role, id));
}

module.exports = { createResetCode, checkResetCode, consumeResetCode };
