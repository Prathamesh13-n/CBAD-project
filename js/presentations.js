/* ============================================================
   CDAD :: presentations.js
   CRUD for group presentations / defenses.
   ============================================================ */

function allPresentations() {
  return getData(CDAD_KEYS.PRESENTATIONS);
}

function presentationsForGroup(groupDisplayId) {
  return allPresentations().filter((p) => p.group === groupDisplayId);
}

function createPresentation(data) {
  const displayId = nextSequentialId(CDAD_KEYS.PRESENTATIONS, 'PRE', 3);
  const pres = {
    id: generateId('PRE'),
    displayId,
    group: data.group,
    project: data.project || (projectForGroup(data.group)?.displayId || ''),
    date: data.date,
    time: data.time,
    venue: data.venue,
    faculty: data.faculty || '',
    status: data.status || 'Scheduled',
    notes: data.notes || ''
  };
  addData(CDAD_KEYS.PRESENTATIONS, pres);
  createNotification({
    title: 'Presentation Scheduled',
    message: `A presentation for ${pres.group} has been scheduled on ${formatDate(pres.date)} at ${pres.time}.`,
    type: 'presentation',
    recipient: pres.group
  });
  logActivity(`Presentation ${displayId} scheduled for group ${pres.group}`);
  return pres;
}

function editPresentation(id, updates) {
  const updated = updateData(CDAD_KEYS.PRESENTATIONS, id, updates);
  if (updated) logActivity(`Presentation ${updated.displayId} updated`);
  return updated;
}

function reschedulePresentation(id, date, time) {
  const updated = updateData(CDAD_KEYS.PRESENTATIONS, id, { date, time, status: 'Rescheduled' });
  if (updated) {
    createNotification({
      title: 'Presentation Rescheduled',
      message: `Presentation for ${updated.group} moved to ${formatDate(date)} at ${time}.`,
      type: 'presentation',
      recipient: updated.group
    });
    logActivity(`Presentation ${updated.displayId} rescheduled`);
  }
  return updated;
}

function cancelPresentation(id) {
  const updated = updateData(CDAD_KEYS.PRESENTATIONS, id, { status: 'Cancelled' });
  if (updated) logActivity(`Presentation ${updated.displayId} cancelled`);
  return updated;
}

function completePresentation(id) {
  const updated = updateData(CDAD_KEYS.PRESENTATIONS, id, { status: 'Completed' });
  if (updated) logActivity(`Presentation ${updated.displayId} marked completed`);
  return updated;
}

function deletePresentation(id) {
  const p = findData(CDAD_KEYS.PRESENTATIONS, id);
  if (!p) return false;
  deleteData(CDAD_KEYS.PRESENTATIONS, id);
  logActivity(`Presentation ${p.displayId} deleted`);
  return true;
}
