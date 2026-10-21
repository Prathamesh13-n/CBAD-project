/* ================= Requests (Section 10) ================= */
async function renderRequests() {
  const host = document.getElementById('requestsList');
  if (!host) return;
  const listRaw = await allRequests();
  const list = listRaw.sort((a, b) => new Date(b.date) - new Date(a.date));
  host.innerHTML = list.length ? list.map((r) => `
    <div class="list-item ${r.status === 'Pending' ? 'unread' : ''}">
      <div class="list-item__top">
        <div class="list-item__title">${escapeHtml(r.student)} — ${escapeHtml(r.type)} <span class="faint mono" style="font-weight:400;">${escapeHtml(r.displayId)}</span></div>
        <span class="badge ${statusBadgeClass(r.status)}">${escapeHtml(r.status)}</span>
      </div>
      <div class="list-item__body">${escapeHtml(r.message)}</div>
      ${r.response ? `<div class="list-item__body"><strong>Response:</strong> ${escapeHtml(r.response)}</div>` : ''}
      <div class="list-item__foot">
        ${r.status === 'Pending' ? `
          <button class="btn btn--primary btn--sm" data-accept-req="${r.id}">Accept</button>
          <button class="btn btn--ghost btn--sm" data-reject-req="${r.id}">Reject</button>` : '<span></span>'}
        <button class="btn btn--danger btn--sm" data-del-req="${r.id}">Delete</button>
      </div>
    </div>`).join('') : emptyState('No requests submitted yet.');

  host.querySelectorAll('[data-accept-req]').forEach((b) => b.addEventListener('click', () => openRespondModal(b.dataset.acceptReq, 'Accepted')));
  host.querySelectorAll('[data-reject-req]').forEach((b) => b.addEventListener('click', () => openRespondModal(b.dataset.rejectReq, 'Rejected')));
  host.querySelectorAll('[data-del-req]').forEach((b) => b.addEventListener('click', () => {
    confirmDelete('Delete this request?', async () => { await deleteRequest(b.dataset.delReq); showToast('Deleted', 'success'); await renderAll(); });
  }));

  // Peer (student-to-student) requests — read-only oversight list
  const peerHost = document.getElementById('peerRequestsMonitor');
  if (peerHost) {
    const peersRaw = await allStudentRequests();
    const peers = peersRaw.sort((a, b) => new Date(b.date) - new Date(a.date));
    peerHost.innerHTML = peers.length ? peers.map((r) => `
      <div class="list-item">
        <div class="list-item__top">
          <div class="list-item__title">${escapeHtml(r.from)} → ${escapeHtml(r.to)}</div>
          <span class="badge ${statusBadgeClass(r.status)}">${escapeHtml(r.status)}</span>
        </div>
        ${r.message ? `<div class="list-item__body">"${escapeHtml(r.message)}"</div>` : ''}
        <div class="list-item__body faint">${formatDate(r.date)}</div>
      </div>`).join('') : emptyState('No student-to-student requests yet.');
  }

  // Group join requests (student -> group leader) — read-only oversight list
  const groupJoinHost = document.getElementById('groupJoinRequestsMonitor');
  if (groupJoinHost) {
    const joinReqsRaw = await allGroupJoinRequests();
    const joinReqs = joinReqsRaw.sort((a, b) => new Date(b.date) - new Date(a.date));
    groupJoinHost.innerHTML = joinReqs.length ? joinReqs.map((r) => `
      <div class="list-item">
        <div class="list-item__top">
          <div class="list-item__title">${escapeHtml(r.from)} → ${escapeHtml(r.groupDisplayId)} <span class="faint" style="font-weight:400;">(leader ${escapeHtml(r.to)})</span></div>
          <span class="badge ${statusBadgeClass(r.status)}">${escapeHtml(r.status)}</span>
        </div>
        ${r.message ? `<div class="list-item__body">"${escapeHtml(r.message)}"</div>` : ''}
        <div class="list-item__body faint">${formatDate(r.date)}</div>
      </div>`).join('') : emptyState('No group join requests yet.');
  }
}

function openRespondModal(id, status) {
  openModal(`Mark Request as ${status}`, `
    <form id="respondForm">
      <div class="field full"><label>Response Message (optional)</label><textarea name="response" placeholder="Add a note for the student..."></textarea></div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="cancelRespond">Cancel</button>
        <button type="submit" class="btn btn--primary">Confirm ${status}</button>
      </div>
    </form>
  `, {
    onMount: () => {
      document.getElementById('cancelRespond').addEventListener('click', closeModal);
      document.getElementById('respondForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        await respondToRequest(id, status, fd.get('response').trim());
        closeModal();
        showToast(`Request ${status.toLowerCase()}`, 'success');
        await renderAll();
      });
    }
  });
}

