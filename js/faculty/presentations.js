/* ================= Presentations (Section 6) ================= */
async function renderPresentations() {
  const host = document.getElementById('presentationsTableBody');
  if (!host) return;
  const list = await allPresentations();
  host.innerHTML = list.length ? list.map((p) => `
    <tr>
      <td class="mono">${escapeHtml(p.displayId)}</td>
      <td>${escapeHtml(p.group)}</td>
      <td>${escapeHtml(p.project)}</td>
      <td>${formatDate(p.date)} ${escapeHtml(p.time)}</td>
      <td>${escapeHtml(p.venue)}</td>
      <td><span class="badge ${statusBadgeClass(p.status)}">${escapeHtml(p.status)}</span></td>
      <td class="table-actions">
        <button class="btn btn--ghost btn--sm" data-edit-pres="${p.id}">Edit ✎</button>
        <button class="btn btn--ghost btn--sm" data-complete-pres="${p.id}">Complete</button>
        <button class="btn btn--ghost btn--sm" data-cancel-pres="${p.id}">Cancel</button>
        <button class="btn btn--danger btn--sm" data-del-pres="${p.id}">Delete</button>
      </td>
    </tr>`).join('') : `<tr class="empty-row"><td colspan="7">No presentations scheduled.</td></tr>`;

  host.querySelectorAll('[data-edit-pres]').forEach((b) => b.addEventListener('click', async () => openPresentationModal(await findData(CDAD_KEYS.PRESENTATIONS, b.dataset.editPres))));
  host.querySelectorAll('[data-complete-pres]').forEach((b) => b.addEventListener('click', async () => { await completePresentation(b.dataset.completePres); showToast('Marked completed', 'success'); await renderAll(); }));
  host.querySelectorAll('[data-cancel-pres]').forEach((b) => b.addEventListener('click', async () => { await cancelPresentation(b.dataset.cancelPres); showToast('Presentation cancelled', 'info'); await renderAll(); }));
  host.querySelectorAll('[data-del-pres]').forEach((b) => b.addEventListener('click', () => {
    confirmDelete('Delete this presentation?', async () => { await deletePresentation(b.dataset.delPres); showToast('Deleted', 'success'); await renderAll(); });
  }));
}

function openAddPresentationModal() { openPresentationModal(null); }

function openPresentationModal(pres) {
  allGroups().then((groups) => {
    const isoDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
    openModal(pres ? 'Edit Presentation' : 'Schedule Presentation', `
      <form id="presForm">
        <div class="form-grid">
          <div class="field full">
            <label>Group</label>
            <select name="group" required>${groups.map((g) => `<option value="${g.displayId}" ${pres?.group===g.displayId?'selected':''}>${g.displayId} — ${escapeHtml(g.name)}</option>`).join('')}</select>
          </div>
          <div class="field"><label>Date</label><input type="date" name="date" required value="${isoDate(pres?.date)}"></div>
          <div class="field"><label>Time</label><input type="time" name="time" required value="${escapeHtml(pres?.time || '10:00')}"></div>
          <div class="field full"><label>Venue</label><input name="venue" required value="${escapeHtml(pres?.venue || '')}"></div>
          <div class="field">
            <label>Status</label>
            <select name="status">${['Pending','Scheduled','Completed','Cancelled','Rescheduled'].map((s) => `<option ${pres?.status===s?'selected':''}>${s}</option>`).join('')}</select>
          </div>
          <div class="field full"><label>Notes</label><textarea name="notes">${escapeHtml(pres?.notes || '')}</textarea></div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn--ghost" id="cancelPresForm">Cancel</button>
          <button type="submit" class="btn btn--primary">Save</button>
        </div>
      </form>
    `, {
      onMount: () => {
        document.getElementById('cancelPresForm').addEventListener('click', closeModal);
        document.getElementById('presForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const fields = { group: fd.get('group'), date: new Date(fd.get('date')).toISOString(), time: fd.get('time'), venue: fd.get('venue').trim(), status: fd.get('status'), notes: fd.get('notes').trim(), faculty: FAC.displayId };
          if (pres) await editPresentation(pres.id, fields);
          else await createPresentation(fields);
          closeModal();
          showToast('Presentation saved', 'success');
          await renderAll();
        });
      }
    });
  });
}

