/* ================= Academic requests (to faculty) ================= */
async function renderRequests() {
  const host = document.getElementById('requestsPanel');
  if (!host) return;
  const mineRaw = await requestsForStudent(ME.displayId);
  const mine = mineRaw.sort((a, b) => new Date(b.date) - new Date(a.date));
  host.innerHTML = `
    <div class="section__head">
      <h3>My Requests to Faculty</h3>
      <button class="btn btn--primary btn--sm" id="newRequestBtn">+ New Request</button>
    </div>
    ${mine.length ? mine.map(academicRequestRow).join('') : emptyState('You have not submitted any requests.')}`;
  document.getElementById('newRequestBtn').addEventListener('click', openNewRequestModal);
}

function academicRequestRow(r) {
  return `
    <div class="list-item">
      <div class="list-item__top">
        <div class="list-item__title">${escapeHtml(r.type)} <span class="faint mono" style="font-weight:400;">${escapeHtml(r.displayId)}</span></div>
        <span class="badge ${statusBadgeClass(r.status)}">${escapeHtml(r.status)}</span>
      </div>
      <div class="list-item__body">${escapeHtml(r.message)}</div>
      ${r.response ? `<div class="list-item__body"><strong>Faculty response:</strong> ${escapeHtml(r.response)}</div>` : ''}
      <div class="list-item__body faint">${formatDate(r.date)}</div>
    </div>`;
}

async function openNewRequestModal() {
  const groups = await allGroups();
  openModal('New Request', `
    <form id="newRequestForm">
      <div class="form-grid">
        <div class="field full">
          <label>Request Type</label>
          <select name="type" required>
            <option>Join Group</option><option>Leave Group</option><option>Change Group</option>
            <option>Project Request</option><option>General Request</option>
          </select>
        </div>
        <div class="field full">
          <label>Related Group (optional)</label>
          <select name="group"><option value="">— None —</option>${groups.map((g) => `<option value="${g.displayId}">${g.displayId} — ${escapeHtml(g.name)}</option>`).join('')}</select>
        </div>
        <div class="field full"><label>Message</label><textarea name="message" required placeholder="Describe your request..."></textarea></div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="cancelNewRequest">Cancel</button>
        <button type="submit" class="btn btn--primary">Submit Request</button>
      </div>
    </form>
  `, {
    onMount: () => {
      document.getElementById('cancelNewRequest').addEventListener('click', closeModal);
      document.getElementById('newRequestForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        await createRequest({ type: fd.get('type'), group: fd.get('group'), message: fd.get('message').trim() });
        closeModal();
        showToast('Request submitted', 'success');
        await renderAll();
      });
    }
  });
}

