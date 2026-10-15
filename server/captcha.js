/* ============================================================
   CDAD server :: captcha.js
   Image captcha for Forgot Password. A random 5-character code is
   rendered as a distorted SVG (no external service, no dependencies);
   the answer stays on the server, keyed by a one-time id, and expires
   after 5 minutes. Checking a captcha always consumes it, right or wrong,
   so a code can't be guessed repeatedly.
   ============================================================ */
const crypto = require('node:crypto');

const TTL_MS = 5 * 60 * 1000;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I to avoid look-alikes
const pending = new Map(); // id -> { answer, expiresAt }

function randInt(max) { return crypto.randomInt(0, max); }

function purgeExpired() {
  const now = Date.now();
  for (const [id, c] of pending) if (c.expiresAt < now) pending.delete(id);
}

// 5x7 bitmap glyphs, drawn as small squares: the SVG contains no <text>, so the answer
// can't be read out of the markup by a script.
const GLYPH_ROWS = [
  'A: .###. #...# #...# ##### #...# #...# #...#',
  'B: ####. #...# #...# ####. #...# #...# ####.',
  'C: .#### #.... #.... #.... #.... #.... .####',
  'D: ####. #...# #...# #...# #...# #...# ####.',
  'E: ##### #.... #.... ####. #.... #.... #####',
  'F: ##### #.... #.... ####. #.... #.... #....',
  'G: .#### #.... #.... #.### #...# #...# .###.',
  'H: #...# #...# #...# ##### #...# #...# #...#',
  'J: ..### ...#. ...#. ...#. ...#. #..#. .##..',
  'K: #...# #..#. #.#.. ##... #.#.. #..#. #...#',
  'L: #.... #.... #.... #.... #.... #.... #####',
  'M: #...# ##.## #.#.# #.#.# #...# #...# #...#',
  'N: #...# ##..# #.#.# #..## #...# #...# #...#',
  'P: ####. #...# #...# ####. #.... #.... #....',
  'Q: .###. #...# #...# #...# #.#.# #..#. .##.#',
  'R: ####. #...# #...# ####. #.#.. #..#. #...#',
  'S: .#### #.... #.... .###. ....# ....# ####.',
  'T: ##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
  'U: #...# #...# #...# #...# #...# #...# .###.',
  'V: #...# #...# #...# #...# #...# .#.#. ..#..',
  'W: #...# #...# #...# #.#.# #.#.# ##.## #...#',
  'X: #...# #...# .#.#. ..#.. .#.#. #...# #...#',
  'Y: #...# #...# .#.#. ..#.. ..#.. ..#.. ..#..',
  'Z: ##### ....# ...#. ..#.. .#... #.... #####',
  '2: .###. #...# ....# ...#. ..#.. .#... #####',
  '3: ####. ....# ....# .###. ....# ....# ####.',
  '4: ...#. ..##. .#.#. #..#. ##### ...#. ...#.',
  '5: ##### #.... ####. ....# ....# #...# .###.',
  '6: ..##. .#... #.... ####. #...# #...# .###.',
  '7: ##### ....# ...#. ..#.. .#... .#... .#...',
  '8: .###. #...# #...# .###. #...# #...# .###.',
  '9: .###. #...# #...# .#### ....# ...#. .##..',
];
const GLYPHS = Object.fromEntries(GLYPH_ROWS.map((r) => [r[0], r.slice(3).replace(/ /g, '')]));

function renderSvg(text) {
  const cell = 5, gw = 5 * cell, gh = 7 * cell, gap = 12, pad = 14;
  const w = pad * 2 + text.length * gw + (text.length - 1) * gap, h = 62;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`,
    '<rect width="100%" height="100%" fill="#eef2fb"/>'];
  for (let i = 0; i < 4; i++) { // background noise lines
    parts.push(`<line x1="${randInt(w)}" y1="${randInt(h)}" x2="${randInt(w)}" y2="${randInt(h)}" stroke="hsl(${randInt(360)},40%,70%)" stroke-width="2"/>`);
  }
  [...text].forEach((ch, i) => {
    const g = GLYPHS[ch];
    const ox = pad + i * (gw + gap), oy = (h - gh) / 2 + randInt(9) - 4, rot = randInt(31) - 15;
    const color = `hsl(${randInt(360)},55%,30%)`;
    const rects = [];
    for (let k = 0; k < 35; k++) {
      if (g[k] !== '#') continue;
      const x = (k % 5) * cell + randInt(3) - 1, y = Math.floor(k / 5) * cell + randInt(3) - 1;
      rects.push(`<rect x="${x}" y="${y}" width="${cell + 1}" height="${cell + 1}" rx="1"/>`);
    }
    parts.push(`<g transform="translate(${ox} ${oy}) rotate(${rot} ${gw / 2} ${gh / 2})" fill="${color}">${rects.join('')}</g>`);
  });
  for (let i = 0; i < 3; i++) { // strike-through noise on top of the characters
    parts.push(`<line x1="0" y1="${10 + randInt(h - 20)}" x2="${w}" y2="${10 + randInt(h - 20)}" stroke="hsl(${randInt(360)},50%,40%)" stroke-width="1.5" opacity="0.8"/>`);
  }
  for (let i = 0; i < 30; i++) parts.push(`<circle cx="${randInt(w)}" cy="${randInt(h)}" r="1.3" fill="#556"/>`);
  parts.push('</svg>');
  return parts.join('');
}

/** Returns { id, svg } and remembers the answer server-side. */
function createCaptcha() {
  purgeExpired();
  const text = Array.from({ length: 5 }, () => ALPHABET[randInt(ALPHABET.length)]).join('');
  const id = crypto.randomUUID();
  pending.set(id, { answer: text, expiresAt: Date.now() + TTL_MS });
  return { id, svg: renderSvg(text) };
}

/** Case-insensitive check; the captcha is consumed whether or not it matched. */
function verifyCaptcha(id, input) {
  const c = pending.get(id);
  pending.delete(id);
  if (!c || Date.now() > c.expiresAt) return false;
  return c.answer === String(input || '').trim().toUpperCase();
}

module.exports = { createCaptcha, verifyCaptcha };
