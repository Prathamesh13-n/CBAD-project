/* ============================================================
   CDAD :: examSubmissions.js
   Per-exam (TA1 / TA2 / EndSem) submissions — link and/or file per group.
   ============================================================ */

async function fetchExamSubmissions() {
  const res = await fetch('/api/exam-submissions', { credentials: 'include' });
  return res.ok ? res.json() : { exams: ['TA1', 'TA2', 'EndSem'], submissions: [] };
}

/** Team leader submits (or replaces) a group's work for one exam. */
async function submitExamWork(exam, { link, note, files = [], removeFileIds = [] }) {
  const fd = new FormData();
  fd.append('link', link || '');
  fd.append('note', note || '');
  files.forEach((f) => fd.append('files', f));
  fd.append('removeFileIds', JSON.stringify(removeFileIds));
  const res = await fetch(`/api/exam-submissions/${encodeURIComponent(exam)}`, {
    method: 'POST', credentials: 'include', body: fd
  });
  const data = await res.json().catch(() => ({}));
  return res.ok ? data : { error: data.error || 'Submission failed.' };
}

async function deleteExamSubmission(id) {
  const res = await fetch(`/api/exam-submissions/${id}`, { method: 'DELETE', credentials: 'include' });
  return res.ok;
}

const EXAM_MAX_FILES = 5;
const EXAM_LABELS = { TA1: 'TA1', TA2: 'TA2', EndSem: 'End Sem' };

/* ---------- In-browser preview (no download) ---------- */
const EXAM_PREVIEWABLE = ['pdf', 'csv', 'docx'];

function canPreviewExamFile(f) {
  return EXAM_PREVIEWABLE.includes((f.type || '').toLowerCase());
}

function loadMammoth() {
  if (window.mammoth) return Promise.resolve(window.mammoth);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
    s.onload = () => resolve(window.mammoth);
    s.onerror = () => reject(new Error('Could not load the document viewer.'));
    document.head.appendChild(s);
  });
}

function parseCsv(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (c !== '\r') cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

async function openExamFilePreview(f) {
  const url = `/api/exam-submissions/files/${f.id}?inline=1`;
  openModal(f.name, `
    <div id="examPreviewBody" style="min-width:min(900px,80vw); height:70vh; display:flex; flex-direction:column;">
      <p class="muted">Loading preview…</p>
    </div>
    <div class="form-actions">
      <a class="btn btn--ghost" href="/api/exam-submissions/files/${f.id}" target="_blank">Download</a>
      <button type="button" class="btn btn--primary" id="closeExamPreview">Close</button>
    </div>`, {
    onMount: async () => {
      const box = document.querySelector('#cdadModalOverlay .modal');
      box.style.maxWidth = '1000px';
      const restore = () => { box.style.maxWidth = ''; };
      document.getElementById('closeExamPreview').addEventListener('click', () => { restore(); closeModal(); });
      document.getElementById('cdadModalClose').addEventListener('click', restore, { once: true });
      document.getElementById('cdadModalOverlay').addEventListener('click', restore, { once: true });
      const body = document.getElementById('examPreviewBody');
      const type = (f.type || '').toLowerCase();
      try {
        if (type === 'pdf') {
          body.innerHTML = `<iframe src="${url}" style="flex:1; width:100%; border:1px solid var(--border, #ddd); border-radius:8px;"></iframe>`;
        } else if (type === 'csv') {
          const text = await (await fetch(url, { credentials: 'include' })).text();
          const rows = parseCsv(text).slice(0, 500);
          body.innerHTML = `<div style="overflow:auto; flex:1;"><table class="data-table"><tbody>${
            rows.map((r, i) => `<tr>${r.map((c) => i === 0 ? `<th>${escapeHtml(c)}</th>` : `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')
          }</tbody></table></div>`;
        } else if (type === 'docx') {
          const [mammoth, buf] = await Promise.all([
            loadMammoth(), fetch(url, { credentials: 'include' }).then((r) => r.arrayBuffer())
          ]);
          const { value } = await mammoth.convertToHtml({ arrayBuffer: buf });
          // Student-supplied content: render in a fully sandboxed iframe so no script can run.
          const frame = document.createElement('iframe');
          frame.setAttribute('sandbox', '');
          frame.style.cssText = 'flex:1; width:100%; border:1px solid #ddd; border-radius:8px; background:#fff;';
          frame.srcdoc = `<body style="font-family:sans-serif; padding:16px; line-height:1.5;">${value}</body>`;
          body.innerHTML = '';
          body.appendChild(frame);
        } else {
          body.innerHTML = '<p class="muted">This file type cannot be previewed in the browser. Use Download.</p>';
        }
      } catch (err) {
        body.innerHTML = `<p class="muted">${escapeHtml(err.message || 'Preview failed.')}</p>`;
      }
    }
  });
}

async function setExamDeadline(exam, deadlineIso) {
  const res = await fetch(`/api/exam-submissions/deadlines/${encodeURIComponent(exam)}`, {
    method: 'PUT', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deadline: deadlineIso || '' })
  });
  return res.ok;
}

/** ISO string -> value for <input type="datetime-local"> in the viewer's timezone. */
function isoToLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
