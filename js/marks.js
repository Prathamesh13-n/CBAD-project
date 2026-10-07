/* ============================================================
   CDAD :: marks.js
   Faculty-editable marks per student. Total/percentage/grade
   are always derived — never stored as independent fields.
   Thin wrappers over /api/marks now; activity logging happens
   server-side.
   ============================================================ */

async function allMarks() {
  return getData(CDAD_KEYS.MARKS);
}

async function marksForStudent(studentDisplayId) {
  const marks = await allMarks();
  return marks.find((m) => m.studentId === studentDisplayId) || null;
}

function deriveMarkTotals(m) {
  const total = (m.internal || 0) + (m.project || 0) + (m.presentation || 0) + (m.viva || 0);
  const max = (m.internalMax || 20) + (m.projectMax || 40) + (m.presentationMax || 20) + (m.vivaMax || 10);
  const pct = max > 0 ? Math.round(((total / max) * 100) * 100) / 100 : 0;
  return { total, max, percentage: pct, grade: gradeFromPercentage(pct) };
}

async function upsertMarks(studentDisplayId, fields) {
  const res = await fetch(`/api/marks/student/${encodeURIComponent(studentDisplayId)}`, {
    method: 'PUT', credentials: 'include',
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields)
  });
  return res.ok ? res.json() : null;
}

async function deleteMarks(id) {
  return deleteData(CDAD_KEYS.MARKS, id);
}

async function resetMarks(id) {
  const res = await fetch(`/api/marks/${id}/reset`, { method: 'POST', credentials: 'include' });
  return res.ok;
}
