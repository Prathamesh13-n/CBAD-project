/* ================= My Group ================= */
async function renderGroupPanel() {
  const host = document.getElementById('groupPanel');
  if (!host) return;
  const group = await getGroup(ME.group);
  if (!group) {
    host.innerHTML = `
      ${emptyState('You are not assigned to a group yet.')}
      <div style="text-align:center; margin-top:-10px;">
        <button class="btn btn--primary" id="createGroupBtn">+ Create Group</button>
      </div>`;
    document.getElementById('createGroupBtn').addEventListener('click', () => showView('creategroup'));
    return;
  }
  const students = await getData(CDAD_KEYS.STUDENTS);
  const members = (group.members || []).map((m) => students.find((s) => s.displayId === m)).filter(Boolean);
  host.innerHTML = `
    <div class="section__head">
      <div><span class="faint mono" style="font-size:11px;">${escapeHtml(group.displayId)}</span><h3>${escapeHtml(group.name)}</h3></div>
      <span class="badge ${statusBadgeClass(group.status)}">${escapeHtml(group.status)}</span>
    </div>
    <div class="form-grid" style="margin-bottom:20px;">
      <div><div class="faint" style="font-size:11px; text-transform:uppercase;">Team Leader</div><div style="font-size:13.5px;">${escapeHtml(group.teamLeader || '—')}</div></div>
      <div><div class="faint" style="font-size:11px; text-transform:uppercase;">Members</div><div style="font-size:13.5px;">${memberCount(group)}</div></div>
      <div><div class="faint" style="font-size:11px; text-transform:uppercase;">Project</div><div style="font-size:13.5px;">${escapeHtml(group.project || '—')}</div></div>
      <div><div class="faint" style="font-size:11px; text-transform:uppercase;">Progress</div><div style="font-size:13.5px;">${group.progress || 0}%</div></div>
    </div>
    <h4 style="font-size:13.5px; margin-bottom:10px;">Members</h4>
    <div class="card-grid" style="margin-bottom:20px;">
      ${members.map((s) => `
        <div class="card">
          <div class="card__top">
            <div style="display:flex; gap:10px; align-items:center;">
              <div class="avatar">${avatarHtml(s)}</div>
              <div><div class="card__title">${escapeHtml(s.name)}</div><div class="card__meta">${escapeHtml(s.displayId)}</div></div>
            </div>
            ${s.displayId === group.teamLeader ? '<span class="badge badge--warn">Leader</span>' : ''}
          </div>
        </div>`).join('')}
    </div>
    <button class="btn btn--danger btn--sm" id="leaveGroupBtn">Leave Group</button>`;

  document.getElementById('leaveGroupBtn').addEventListener('click', () => {
    const warning = memberCount(group) <= 1
      ? `You're the last member of ${group.displayId}. Leaving will disband the group entirely.`
      : group.teamLeader === ME.displayId
        ? `You're the leader of ${group.displayId}. Leaving will pass leadership to another member.`
        : `Leave ${group.displayId} — ${group.name}?`;
    confirmDelete(warning, async () => {
      const result = await leaveGroup(ME.displayId);
      if (!result.ok) { showToast(result.error, 'error'); return; }
      showToast(result.disbanded ? 'You left and the group was disbanded' : 'You left the group', 'success');
      await renderAll();
      showView('creategroup');
    });
  });
}

/* ================= Create Group tab (create OR join by leader's ID) ================= */
async function renderCreateGroupTab() {
  const host = document.getElementById('createGroupPanel');
  if (!host) return;
  const myGroup = await getGroup(ME.group);
  const amLeader = myGroup && myGroup.teamLeader === ME.displayId;

  let html = '';

  if (myGroup) {
    // If I lead this group, show incoming join requests here too.
    if (amLeader) {
      const received = await joinRequestsReceivedBy(ME.displayId);
      const students = await getData(CDAD_KEYS.STUDENTS);
      html += `
        <div class="section">
          <div class="section__head"><h3>Requests to Join Your Group</h3>${received.length ? `<span class="badge badge--warn">${received.length} pending</span>` : ''}</div>
          ${received.length ? received.map((r) => joinRequestRow(r, students)).join('') : emptyState('No pending join requests right now.')}
        </div>`;
    }

    html += `
      <div class="section">
        <p style="font-size:13.5px; margin-bottom:14px;">You're already in <strong>${escapeHtml(myGroup.displayId)} — ${escapeHtml(myGroup.name)}</strong>. Go to <a href="javascript:void(0)" onclick="showView('group')">My Group</a> to see members, or leave it below to create/join a different one.</p>
        <button class="btn btn--danger btn--sm" id="leaveGroupFromTabBtn">Leave Group</button>
      </div>`;
    host.innerHTML = html;
    wireCreateGroupTabEvents(host);
    const leaveBtn = document.getElementById('leaveGroupFromTabBtn');
    if (leaveBtn) leaveBtn.addEventListener('click', () => {
      const warning = memberCount(myGroup) <= 1
        ? `You're the last member of ${myGroup.displayId}. Leaving will disband the group entirely.`
        : amLeader
          ? `You're the leader of ${myGroup.displayId}. Leaving will pass leadership to another member.`
          : `Leave ${myGroup.displayId} — ${myGroup.name}?`;
      confirmDelete(warning, async () => {
        const result = await leaveGroup(ME.displayId);
        if (!result.ok) { showToast(result.error, 'error'); return; }
        showToast(result.disbanded ? 'You left and the group was disbanded' : 'You left the group', 'success');
        await renderAll();
      });
    });
    return;
  }

  // No group yet — show Create + Join by ID + my sent requests.
  const allStudents = await getData(CDAD_KEYS.STUDENTS);
  const available = allStudents.filter((s) => s.displayId !== ME.displayId && !s.group);
  const sentRequestsRaw = await joinRequestsSentBy(ME.displayId);
  const sentRequests = sentRequestsRaw.sort((a, b) => new Date(b.date) - new Date(a.date));

  html += `
    <div class="dash-grid--2" style="display:grid; grid-template-columns:1fr 1fr; gap:18px;">
      <div class="section">
        <div class="section__head"><h3>Create a New Group</h3></div>
        <form id="createGroupTabForm">
          <div class="field full" style="margin-bottom:14px;">
            <label>Group Name</label>
            <input name="name" required placeholder="e.g. Group Gamma">
          </div>
          <div class="field full">
            <label>Add Members (Enrollment)</label>
            <div class="field-hint" style="margin-bottom:8px;">You'll be the team leader automatically. Pick classmates to enroll right now.</div>
            <div class="checkbox-grid">
              ${available.length ? available.map((s) => `
                <label class="checkbox-row">
                  <input type="checkbox" name="members" value="${s.displayId}">
                  ${escapeHtml(s.displayId)} — ${escapeHtml(s.name)}
                </label>`).join('') : '<span class="faint" style="font-size:12.5px;">No unassigned students available right now.</span>'}
            </div>
          </div>
          <button type="submit" class="btn btn--primary" style="margin-top:14px;">Create Group</button>
        </form>
      </div>

      <div class="section">
        <div class="section__head"><h3>Join a Group by ID</h3></div>
        <p class="field-hint" style="margin-bottom:12px;">Enter the Student ID of a group's leader (e.g. ADT24SOCB0001). If they lead a group, you'll see their name and can send a join request straight to them.</p>
        <div class="field full" style="margin-bottom:10px;">
          <label>Leader's Student ID</label>
          <input type="text" id="joinLookupId" placeholder="ADT24SOCB0001">
        </div>
        <button type="button" class="btn btn--ghost btn--sm" id="joinLookupBtn">Find Group</button>
        <div id="joinLookupResult" style="margin-top:14px;"></div>

        <h4 style="font-size:13px; margin:20px 0 10px;">My Sent Requests</h4>
        <div id="mySentJoinRequests">
          ${sentRequests.length ? sentRequests.map(sentJoinRequestRow).join('') : emptyState('You have not sent any join requests yet.')}
        </div>
      </div>
    </div>`;

  host.innerHTML = html;
  wireCreateGroupTabEvents(host);
}
function wireCreateGroupTabEvents(host) {
  const createForm = host.querySelector('#createGroupTabForm');
  if (createForm) {
    createForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (ME.group) { showToast('You are already in a group.', 'error'); return; }
      const fd = new FormData(e.target);
      const enrolled = fd.getAll('members');
      await createGroup({
        name: fd.get('name').trim(),
        teamLeader: ME.displayId,
        members: [ME.displayId, ...enrolled],
        status: 'Active'
      });
      showToast('Group created — you are the leader', 'success');
      await renderAll();
      showView('creategroup');
    });
  }

  const lookupBtn = host.querySelector('#joinLookupBtn');
  if (lookupBtn) {
    lookupBtn.addEventListener('click', async () => {
      const id = host.querySelector('#joinLookupId').value.trim();
      const resultHost = host.querySelector('#joinLookupResult');
      const lookup = await findLeaderAndGroupById(id);
      if (!lookup.ok) {
        resultHost.innerHTML = `<div class="login-error show" style="display:block;">${escapeHtml(lookup.error)}</div>`;
        return;
      }
      resultHost.innerHTML = `
        <div class="list-item">
          <div class="list-item__top">
            <div style="display:flex; gap:10px; align-items:center;">
              <div class="avatar">${avatarHtml(lookup.leader)}</div>
              <div>
                <div class="list-item__title">${escapeHtml(lookup.leader.name)}</div>
                <div class="faint" style="font-size:12px;">Leads ${escapeHtml(lookup.group.displayId)} — ${escapeHtml(lookup.group.name)} (${memberCount(lookup.group)} members)</div>
              </div>
            </div>
          </div>
          <div class="field full" style="margin-top:10px;"><textarea id="joinRequestMessage" placeholder="Optional message to include..."></textarea></div>
          <button type="button" class="btn btn--primary btn--sm" id="sendJoinRequestBtn" style="margin-top:8px;">Send Join Request</button>
        </div>`;
      resultHost.querySelector('#sendJoinRequestBtn').addEventListener('click', async () => {
        const message = resultHost.querySelector('#joinRequestMessage').value.trim();
        const result = await sendGroupJoinRequest(ME.displayId, id, message);
        if (!result.ok) { showToast(result.error, 'error'); return; }
        showToast(`Request sent to ${result.leaderName}`, 'success');
        await renderAll();
        showView('creategroup');
      });
    });
  }

  host.querySelectorAll('[data-accept-join]').forEach((b) => b.addEventListener('click', async () => {
    const result = await respondToGroupJoinRequest(b.dataset.acceptJoin, true);
    if (!result.ok) { showToast(result.error, 'error'); return; }
    showToast('Student added to your group', 'success');
    await renderAll();
    showView('creategroup');
  }));
  host.querySelectorAll('[data-reject-join]').forEach((b) => b.addEventListener('click', async () => {
    await respondToGroupJoinRequest(b.dataset.rejectJoin, false);
    showToast('Request rejected', 'info');
    await renderAll();
    showView('creategroup');
  }));
}

function joinRequestRow(r, students) {
  const from = students.find((s) => s.displayId === r.from);
  return `
    <div class="list-item unread">
      <div class="list-item__top">
        <div class="list-item__title">${escapeHtml(from ? from.name : r.from)} <span class="faint mono" style="font-weight:400;">${escapeHtml(r.from)}</span></div>
        <span class="faint" style="font-size:11px;">${formatDate(r.date)}</span>
      </div>
      ${r.message ? `<div class="list-item__body">"${escapeHtml(r.message)}"</div>` : ''}
      <div class="list-item__foot">
        <button class="btn btn--primary btn--sm" data-accept-join="${r.id}">Accept</button>
        <button class="btn btn--ghost btn--sm" data-reject-join="${r.id}">Reject</button>
      </div>
    </div>`;
}

function sentJoinRequestRow(r) {
  return `
    <div class="list-item">
      <div class="list-item__top">
        <div class="list-item__title">${escapeHtml(r.groupDisplayId)} <span class="faint" style="font-weight:400;">(leader ${escapeHtml(r.to)})</span></div>
        <span class="badge ${statusBadgeClass(r.status)}">${escapeHtml(r.status)}</span>
      </div>
      <div class="list-item__body faint">${formatDate(r.date)}</div>
    </div>`;
}

