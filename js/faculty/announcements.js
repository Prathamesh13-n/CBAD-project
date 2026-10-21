/* ================= Announcements (Section 12) ================= */
async function renderAnnouncements() {
  const host = document.getElementById('announcementsList');
  if (!host) return;
  const list = await allAnnouncements();
  host.innerHTML = list.length ? list.map((a) => `
    <div class="list-item">
      <div class="list-item__top">
        <div class="list-item__title">${escapeHtml(a.title)}</div>
        <span class="badge ${statusBadgeClass(a.priority)}">${escapeHtml(a.priority)}</span>
      </div>
      <div class="list-item__body">${escapeHtml(a.message)}</div>
      <div class="list-item__body faint">${escapeHtml(a.author)} &middot; ${formatDate(a.date)}</div>
      <div class="list-item__foot">
        <button class="btn btn--ghost btn--sm" data-edit-ann="${a.id}">Edit ✎</button>
        <button class="btn btn--danger btn--sm" data-del-ann="${a.id}">Delete</button>
      </div>
    </div>`).join('') : emptyState('No announcements yet.');

  host.querySelectorAll('[data-edit-ann]').forEach((b) => b.addEventListener('click', async () => openAnnouncementModal(await findData(CDAD_KEYS.ANNOUNCEMENTS, b.dataset.editAnn))));
  host.querySelectorAll('[data-del-ann]').forEach((b) => b.addEventListener('click', () => {
    confirmDelete('Delete this announcement?', async () => { await deleteAnnouncement(b.dataset.delAnn); showToast('Deleted', 'success'); await renderAll(); });
  }));
}

function openAddAnnouncementModal() { openAnnouncementModal(null); }

function openAnnouncementModal(ann) {
  openModal(ann ? 'Edit Announcement' : 'Create Announcement', `
    <form id="annForm">
      <div class="form-grid">
        <div class="field full"><label>Title</label><input name="title" required value="${escapeHtml(ann?.title || '')}"></div>
        <div class="field full"><label>Message</label><textarea name="message" required>${escapeHtml(ann?.message || '')}</textarea></div>
        <div class="field">
          <label>Priority</label>
          <select name="priority">${['Normal','Important','Urgent'].map((p) => `<option ${ann?.priority===p?'selected':''}>${p}</option>`).join('')}</select>
        </div>
        <div class="field">
          <label>Status</label>
          <select name="status">${['Active','Archived'].map((s) => `<option ${ann?.status===s?'selected':''}>${s}</option>`).join('')}</select>
        </div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="cancelAnnForm">Cancel</button>
        <button type="submit" class="btn btn--primary">Save</button>
      </div>
    </form>
  `, {
    onMount: () => {
      document.getElementById('cancelAnnForm').addEventListener('click', closeModal);
      document.getElementById('annForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const fields = { title: fd.get('title').trim(), message: fd.get('message').trim(), priority: fd.get('priority'), status: fd.get('status'), author: FAC.name };
        if (ann) await editAnnouncement(ann.id, fields);
        else await createAnnouncement(fields);
        closeModal();
        showToast('Announcement saved', 'success');
        await renderAll();
      });
    }
  });
}

