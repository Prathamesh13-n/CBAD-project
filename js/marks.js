/* ============================================================
   CDAD :: marks.js
   Faculty-editable marks per student. Total/percentage/grade
   are always derived — never stored as independent fields.
   ============================================================ */

function allMarks() {
  return getData(CDAD_KEYS.MARKS);
}

function marksForStudent(studentDisplayId) {
  return allMarks().find((m) => m.studentId === studentDisplayId) || null;
}

function deriveMarkTotals(m) {
  const total = (m.internal || 0) + (m.project || 0) + (m.presentation || 0) + (m.viva || 0);
  const max = (m.internalMax || 20) + (m.projectMax || 40) + (m.presentationMax || 20) + (m.vivaMax || 10);
  const pct = max > 0 ? Math.round(((total / max) * 100) * 100) / 100 : 0;
  return { total, max, percentage: pct, grade: gradeFromPercentage(pct) };
}

function upsertMarks(studentDisplayId, fields) {
  const existing = marksForStudent(studentDisplayId);
  if (existing) {
    const updated = updateData(CDAD_KEYS.MARKS, existing.id, fields);
    logActivity(`Marks updated for ${studentDisplayId}`);
    return updated;
  }
  const record = Object.assign({
    id: generateId('MRK'),
    studentId: studentDisplayId,
    internal: 0, internalMax: 20,
    project: 0, projectMax: 40,
    presentation: 0, presentationMax: 20,
    viva: 0, vivaMax: 10
  }, fields);
  addData(CDAD_KEYS.MARKS, record);
  logActivity(`Marks added for ${studentDisplayId}`);
  return record;
}

function deleteMarks(id) {
  const m = findData(CDAD_KEYS.MARKS, id);
  if (!m) return false;
  deleteData(CDAD_KEYS.MARKS, id);
  logActivity(`Marks deleted for ${m.studentId}`);
  return true;
}

function resetMarks(id) {
  const m = findData(CDAD_KEYS.MARKS, id);
  if (!m) return false;
  updateData(CDAD_KEYS.MARKS, id, { internal: 0, project: 0, presentation: 0, viva: 0 });
  logActivity(`Marks reset for ${m.studentId}`);
  return true;
}
