/* ================= Peer connections ================= */
async function renderPeers() {
  const host = document.getElementById('peersPanel');
  if (!host) return;
  const allStudents = await getData(CDAD_KEYS.STUDENTS);
  const students = allStudents.filter((s) => s.displayId !== ME.displayId);
  const receivedRaw = await peerRequestsReceivedBy(ME.displayId);
  const received = receivedRaw.filter((r) => r.status === 'Pending');
  const sent = await peerRequestsSentBy(ME.displayId);
  const connections = await connectionsOf(ME.displayId);
  const myGroup = await getGroup(ME.group);

  host.innerHTML = `
    <div class="tabbar">
      <button class="tab-btn active" data-peer-tab="directory">Directory</button>
      <button class="tab-btn" data-peer-tab="received">Received ${received.length ? `<span class="badge badge--warn">${received.length}</span>` : ''}</button>
      <button class="tab-btn" data-peer-tab="sent">Sent</button>
      <button class="tab-btn" data-peer-tab="connections">My Connections ${connections.length ? `<span class="badge badge--good">${connections.length}</span>` : ''}</button>
    </div>
    <div id="peerTab-directory" class="peer-tab-panel">
      <div class="card-grid">
        ${students.map((s) => peerDirectoryCard(s, connections, sent, myGroup)).join('') || emptyState('No other students found.')}
      </div>
    </div>
    <div id="peerTab-received" class="peer-tab-panel" style="display:none;">
      ${received.length ? received.map((r) => receivedPeerRow(r, allStudents)).join('') : emptyState('No pending requests received.')}
    </div>
    <div id="peerTab-sent" class="peer-tab-panel" style="display:none;">
      ${sent.length ? sent.map(sentPeerRow).join('') : emptyState("You haven't sent any requests yet.")}
    </div>
    <div id="peerTab-connections" class="peer-tab-panel" style="display:none;">
      ${connections.length ? connections.map((c) => connectionRow(c, allStudents)).join('') : emptyState('No connections yet. Send a request from the Directory tab.')}
    </div>`;

  host.querySelectorAll('[data-peer-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      host.querySelectorAll('[data-peer-tab]').forEach((b) => b.classList.toggle('active', b === btn));
      host.querySelectorAll('.peer-tab-panel').forEach((p) => { p.style.display = 'none'; });
      host.querySelector(`#peerTab-${btn.dataset.peerTab}`).style.display = 'block';
    });
  });
  host.querySelectorAll('[data-send-peer]').forEach((btn) => btn.addEventListener('click', () => openSendPeerRequestModal(btn.dataset.sendPeer)));
  host.querySelectorAll('[data-accept-peer]').forEach((btn) => btn.addEventListener('click', async () => { await respondToPeerRequest(btn.dataset.acceptPeer, true); showToast('Request accepted', 'success'); await renderAll(); }));
  host.querySelectorAll('[data-reject-peer]').forEach((btn) => btn.addEventListener('click', async () => { await respondToPeerRequest(btn.dataset.rejectPeer, false); showToast('Request rejected', 'info'); await renderAll(); }));
  host.querySelectorAll('[data-remove-connection]').forEach((btn) => btn.addEventListener('click', () => {
    confirmDelete(`Remove connection with ${btn.dataset.removeConnection}?`, async () => { await removeConnection(ME.displayId, btn.dataset.removeConnection); showToast('Connection removed', 'info'); await renderAll(); });
  }));
  host.querySelectorAll('[data-invite-group]').forEach((btn) => btn.addEventListener('click', async () => {
    if (!myGroup) { showToast('You are not in a group.', 'error'); return; }
    await addMember(myGroup.id, btn.dataset.inviteGroup);
    showToast('Student added to your group', 'success');
    await renderAll();
  }));
}

function peerDirectoryCard(s, connections, sent, myGroup) {
  const isConnected = connections.includes(s.displayId);
  const pendingSent = sent.find((r) => r.to === s.displayId && r.status === 'Pending');
  let actionHtml;
  if (isConnected) actionHtml = `<span class="badge badge--good">Connected</span>`;
  else if (pendingSent) actionHtml = `<span class="badge badge--warn">Request Pending</span>`;
  else actionHtml = `<button class="btn btn--ghost btn--sm" data-send-peer="${s.displayId}">Send Request</button>`;

  const iAmLeader = myGroup && myGroup.teamLeader === ME.displayId;
  const canInvite = iAmLeader && isConnected && !s.group;
  const inviteHtml = canInvite ? `<button class="btn btn--primary btn--sm" data-invite-group="${s.displayId}">Invite to Group</button>` : '';

  return `
    <div class="card">
      <div class="card__top">
        <div style="display:flex; gap:10px; align-items:center;">
          <div class="avatar">${avatarHtml(s)}</div>
          <div><div class="card__title">${escapeHtml(s.name)}</div><div class="card__meta">${escapeHtml(s.displayId)} &middot; ${escapeHtml(s.group || 'No group')}</div></div>
        </div>
      </div>
      <div class="card__meta">${escapeHtml(s.course)}</div>
      <div class="card__actions">${actionHtml}${inviteHtml}</div>
    </div>`;
}

function receivedPeerRow(r, students) {
  const from = students.find((s) => s.displayId === r.from);
  return `
    <div class="list-item unread">
      <div class="list-item__top">
        <div class="list-item__title">${escapeHtml(from ? from.name : r.from)} (${escapeHtml(r.from)})</div>
        <span class="faint" style="font-size:11px;">${formatDate(r.date)}</span>
      </div>
      ${r.message ? `<div class="list-item__body">"${escapeHtml(r.message)}"</div>` : ''}
      <div class="list-item__foot">
        <button class="btn btn--primary btn--sm" data-accept-peer="${r.id}">Accept</button>
        <button class="btn btn--ghost btn--sm" data-reject-peer="${r.id}">Reject</button>
      </div>
    </div>`;
}

function sentPeerRow(r) {
  return `
    <div class="list-item">
      <div class="list-item__top"><div class="list-item__title">To ${escapeHtml(r.to)}</div><span class="badge ${statusBadgeClass(r.status)}">${escapeHtml(r.status)}</span></div>
      ${r.message ? `<div class="list-item__body">"${escapeHtml(r.message)}"</div>` : ''}
      <div class="list-item__body faint">${formatDate(r.date)}</div>
    </div>`;
}

function connectionRow(displayId, students) {
  const s = students.find((x) => x.displayId === displayId);
  return `
    <div class="list-item">
      <div class="list-item__top">
        <div style="display:flex; gap:10px; align-items:center;">
          <div class="avatar" style="width:30px;height:30px;font-size:11px;">${s ? avatarHtml(s) : '?'}</div>
          <div class="list-item__title">${s ? escapeHtml(s.name) : displayId} <span class="faint mono" style="font-weight:400;">${escapeHtml(displayId)}</span></div>
        </div>
        <button class="btn btn--ghost btn--sm" data-remove-connection="${displayId}">Remove</button>
      </div>
    </div>`;
}

async function openSendPeerRequestModal(toDisplayId) {
  const students = await getData(CDAD_KEYS.STUDENTS);
  const to = students.find((s) => s.displayId === toDisplayId);
  openModal(`Send Request to ${to ? to.name : toDisplayId}`, `
    <form id="peerRequestForm">
      <div class="field full"><label>Message (optional)</label><textarea name="message" placeholder="Say why you'd like to connect..."></textarea></div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="cancelPeerReq">Cancel</button>
        <button type="submit" class="btn btn--primary">Send Request</button>
      </div>
    </form>
  `, {
    onMount: () => {
      document.getElementById('cancelPeerReq').addEventListener('click', closeModal);
      document.getElementById('peerRequestForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const result = await sendPeerRequest(ME.displayId, toDisplayId, fd.get('message').trim());
        closeModal();
        if (result.ok) { showToast('Request sent', 'success'); await renderAll(); }
        else showToast(result.error, 'error');
      });
    }
  });
}

