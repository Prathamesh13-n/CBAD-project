/* ============================================================
   CDAD :: common.js
   Shared helpers used by both student.js and faculty.js:
   modal control, toasts, activity log, notification creation,
   avatar initials, formatting.
   ============================================================ */

/* ---------- Activity log ---------- */
function logActivity(text) {
  addData(CDAD_KEYS.ACTIVITY, {
    id: generateId('ACT'),
    text,
    date: new Date().toISOString()
  });
}

function clearActivityLog() {
  saveData(CDAD_KEYS.ACTIVITY, []);
}

/* ---------- Notifications ---------- */
/**
 * recipient: 'all-students' | 'all-faculty' | a student displayId | a faculty displayId
 */
function createNotification({ title, message, type, recipient }) {
  return addData(CDAD_KEYS.NOTIFICATIONS, {
    id: generateId('NOTIF'),
    title,
    message,
    type: type || 'info',
    recipient,
    date: new Date().toISOString(),
    read: false
  });
}

function notificationsFor(user) {
  const all = getData(CDAD_KEYS.NOTIFICATIONS);
  if (!user) return [];
  if (user.type === 'student') {
    return all.filter((n) => n.recipient === 'all-students' || n.recipient === user.displayId);
  }
  return all.filter((n) => n.recipient === 'all-faculty' || n.recipient === user.displayId);
}

/* ---------- Toasts ---------- */
function showToast(message, kind) {
  let host = document.getElementById('toastHost');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toastHost';
    host.className = 'toast-host';
    document.body.appendChild(host);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast--${kind || 'info'}`;
  toast.textContent = message;
  host.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast--visible'));
  setTimeout(() => {
    toast.classList.remove('toast--visible');
    setTimeout(() => toast.remove(), 250);
  }, 2600);
}

/* ---------- Modal engine ----------
   A single reusable modal shell. Call openModal(title, bodyHtml, { onMount }) */
/* ---------- Modal engine ----------
   A single reusable modal shell. Call openModal(title, bodyHtml, { onMount, blocking }).
   blocking: true prevents closing via overlay click, Escape, or the X button —
   used for mandatory steps like completing your profile before continuing. */
let MODAL_BLOCKING = false;

function ensureModalShell() {
  if (document.getElementById('cdadModalOverlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'cdadModalOverlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal__head">
        <h3 id="cdadModalTitle"></h3>
        <button class="modal__close" id="cdadModalClose" aria-label="Close">&times;</button>
      </div>
      <div class="modal__body" id="cdadModalBody"></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && !MODAL_BLOCKING) closeModal();
  });
  document.getElementById('cdadModalClose').addEventListener('click', () => {
    if (!MODAL_BLOCKING) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !MODAL_BLOCKING) closeModal();
  });
}

function openModal(title, bodyHtml, opts) {
  ensureModalShell();
  MODAL_BLOCKING = !!(opts && opts.blocking);
  document.getElementById('cdadModalTitle').textContent = title;
  document.getElementById('cdadModalBody').innerHTML = bodyHtml;
  document.getElementById('cdadModalClose').style.display = MODAL_BLOCKING ? 'none' : '';
  document.getElementById('cdadModalOverlay').classList.add('modal-overlay--open');
  document.body.classList.add('no-scroll');
  if (opts && typeof opts.onMount === 'function') opts.onMount();
}

function closeModal() {
  const overlay = document.getElementById('cdadModalOverlay');
  if (overlay) overlay.classList.remove('modal-overlay--open');
  document.body.classList.remove('no-scroll');
  MODAL_BLOCKING = false;
}

function openModal(title, bodyHtml, opts) {
  ensureModalShell();
  document.getElementById('cdadModalTitle').textContent = title;
  document.getElementById('cdadModalBody').innerHTML = bodyHtml;
  document.getElementById('cdadModalOverlay').classList.add('modal-overlay--open');
  document.body.classList.add('no-scroll');
  if (opts && typeof opts.onMount === 'function') opts.onMount();
}

function closeModal() {
  const overlay = document.getElementById('cdadModalOverlay');
  if (overlay) overlay.classList.remove('modal-overlay--open');
  document.body.classList.remove('no-scroll');
}

/** Confirmation modal for destructive actions. onConfirm runs if user confirms. */
function confirmDelete(message, onConfirm) {
  openModal('Confirm deletion', `
    <p class="confirm-text">${message}</p>
    <p class="confirm-warning">This action cannot be undone.</p>
    <div class="form-actions">
      <button class="btn btn--ghost" id="confirmCancelBtn" type="button">Cancel</button>
      <button class="btn btn--danger" id="confirmOkBtn" type="button">Delete</button>
    </div>
  `, {
    onMount: () => {
      document.getElementById('confirmCancelBtn').addEventListener('click', closeModal);
      document.getElementById('confirmOkBtn').addEventListener('click', () => {
        closeModal();
        onConfirm();
      });
    }
  });
}

/* ---------- Formatting helpers ---------- */
function initials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('');
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusBadgeClass(status) {
  const map = {
    Active: 'badge--good', Completed: 'badge--good', Accepted: 'badge--good',
    'In Progress': 'badge--warn', Scheduled: 'badge--warn', Pending: 'badge--warn',
    Inactive: 'badge--muted', Cancelled: 'badge--bad', Rejected: 'badge--bad',
    Rescheduled: 'badge--info', Urgent: 'badge--bad', Important: 'badge--warn', Normal: 'badge--muted'
  };
  return map[status] || 'badge--muted';
}

/* ---------- Progress derivation ---------- */
const PROJECT_STAGES = ['Planning', 'Requirement Analysis', 'Design', 'Development', 'Testing', 'Presentation', 'Submission'];

function computeProgressFromStages(stages) {
  if (!stages) return 0;
  const total = PROJECT_STAGES.length;
  let score = 0;
  PROJECT_STAGES.forEach((s) => {
    const v = stages[s];
    if (v === 'Completed') score += 1;
    else if (v === 'In Progress') score += 0.5;
  });
  return Math.round((score / total) * 100);
}

function gradeFromPercentage(pct) {
  if (pct >= 90) return 'A+';
  if (pct >= 80) return 'A';
  if (pct >= 70) return 'B';
  if (pct >= 60) return 'C';
  if (pct >= 50) return 'D';
  return 'F';
}

/* ---------- Lightweight inline SVG charts (no external libs) ---------- */

/** Donut/ring chart showing a single percentage, with center label. */
function buildDonutChart(pct, opts) {
  opts = opts || {};
  const size = opts.size || 160;
  const stroke = opts.stroke || 16;
  const color = opts.color || 'var(--blue)';
  const track = opts.track || 'var(--line-soft)';
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, pct));
  const offset = circumference * (1 - clamped / 100);
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform: rotate(-90deg);">
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"></circle>
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round"></circle>
    </svg>`;
}

/** Simple smoothed line chart. points: array of numbers. labels: array of strings (same length). */
function buildLineChart(points, labels, opts) {
  opts = opts || {};
  const w = opts.width || 400;
  const h = opts.height || 160;
  const padX = 24;
  const padY = 20;
  const max = opts.max !== undefined ? opts.max : Math.max(...points, 10);
  const min = opts.min !== undefined ? opts.min : Math.min(0, Math.min(...points));
  const color = opts.color || 'var(--blue)';
  const fillColor = opts.fillColor || 'var(--blue-dim)';
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const step = points.length > 1 ? innerW / (points.length - 1) : 0;
  const xy = points.map((v, i) => {
    const x = padX + step * i;
    const ratio = max === min ? 0.5 : (v - min) / (max - min);
    const y = padY + innerH * (1 - ratio);
    return [x, y];
  });
  const linePath = xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${xy[xy.length - 1][0].toFixed(1)},${(h - padY).toFixed(1)} L${xy[0][0].toFixed(1)},${(h - padY).toFixed(1)} Z`;
  const dots = xy.map(([x, y]) => `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5" fill="${color}" stroke="#fff" stroke-width="1.5"></circle>`).join('');
  const gridLines = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const y = padY + innerH * f;
    return `<line x1="${padX}" y1="${y.toFixed(1)}" x2="${w - padX}" y2="${y.toFixed(1)}" stroke="var(--line-soft)" stroke-width="1"></line>`;
  }).join('');
  return `
    <svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="overflow:visible;">
      ${gridLines}
      <path d="${areaPath}" fill="${fillColor}" opacity="0.6"></path>
      <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></path>
      ${dots}
    </svg>`;
}
