/* ================= Presentation ================= */
async function renderPresentation() {
  const host = document.getElementById('presentationPanel');
  if (!host) return;
  const group = await getGroup(ME.group);
  const list = group ? await presentationsForGroup(group.displayId) : [];
  if (!list.length) { host.innerHTML = emptyState('No presentation scheduled for your group.'); return; }
  host.innerHTML = list.map((p) => `
    <div class="list-item">
      <div class="list-item__top">
        <div>
          <div class="list-item__title">${escapeHtml(p.displayId)} &middot; ${escapeHtml(p.venue)}</div>
          <div class="list-item__body">${formatDate(p.date)} at ${escapeHtml(p.time)}</div>
        </div>
        <span class="badge ${statusBadgeClass(p.status)}">${escapeHtml(p.status)}</span>
      </div>
      ${p.notes ? `<div class="list-item__body">Note: ${escapeHtml(p.notes)}</div>` : ''}
    </div>`).join('');
}

