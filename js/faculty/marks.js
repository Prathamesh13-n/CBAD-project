/* ================= Marks (Section 5) ================= */
async function renderMarksTable() {
  const host = document.getElementById('marksTableBody');
  if (!host) return;
  const students = await getData(CDAD_KEYS.STUDENTS);
  const marks = await allMarks();

  // Section filter: rebuild options, keeping the current selection if it still exists.
  const filter = document.getElementById('marksSectionFilter');
  const sections = [...new Set(students.map((s) => s.section || ''))].sort((a, b) => (a || '￿').localeCompare(b || '￿'));
  const current = filter.value || '__all';
  filter.innerHTML = '<option value="__all">All Sections</option>' +
    sections.map((sec) => `<option value="${escapeHtml(sec)}">${sec ? 'Section ' + escapeHtml(sec) : 'No Section'}</option>`).join('');
  filter.value = [...filter.options].some((o) => o.value === current) ? current : '__all';
  filter.onchange = renderMarksTable;
  const searchEl = document.getElementById('marksSearch');
  if (!searchEl.dataset.wired) {
    searchEl.dataset.wired = '1';
    searchEl.addEventListener('input', renderMarksTable);
  }
  const query = searchEl.value.trim().toLowerCase();

  const studentRow = (s) => {
    const m = marks.find((x) => x.studentId === s.displayId);
    const t = m ? deriveMarkTotals(m) : null;
    return `
      <tr>
        <td><div class="row-name__text"><strong>${escapeHtml(s.name)}</strong><span class="mono">${escapeHtml(s.displayId)}</span></div></td>
        <td>${m ? m.internal + '/' + m.internalMax : '—'}</td>
        <td>${m ? m.project + '/' + m.projectMax : '—'}</td>
        <td>${m ? m.presentation + '/' + m.presentationMax : '—'}</td>
        <td>${m ? m.viva + '/' + m.vivaMax : '—'}</td>
        <td>${t ? t.total + '/' + t.max : '—'}</td>
        <td>${t ? t.percentage + '%' : '—'}</td>
        <td>${t ? `<span class="badge badge--info">${t.grade}</span>` : '—'}</td>
        <td class="table-actions">
          ${m ? `<button class="btn btn--ghost btn--sm" data-release-marks="${m.id}" data-released="${m.released ? 1 : 0}" title="${m.released ? 'Released — click to withdraw' : 'Hidden from student — click to release'}">${m.released ? '🔓' : '🔒'}</button>` : ''}
          <button class="btn btn--ghost btn--sm" data-edit-marks="${s.displayId}">Edit ✎</button>
          ${m ? `<button class="btn btn--ghost btn--sm" data-reset-marks="${m.id}">Reset</button><button class="btn btn--danger btn--sm" data-del-marks="${m.id}">Delete</button>` : ''}
        </td>
      </tr>`;
  };

  const matches = (s) => !query || s.displayId.toLowerCase().includes(query);
  const shown = sections.filter((sec) => (filter.value === '__all' || sec === filter.value) && students.some((s) => (s.section || '') === sec && matches(s)));
  host.innerHTML = !shown.length && query ? `<tr class="empty-row"><td colspan="9">No student matches "${escapeHtml(searchEl.value.trim())}".</td></tr>` : students.length ? shown.map((sec) => {
    const rows = students.filter((s) => (s.section || '') === sec && matches(s));
    const withMarks = rows.map((s) => marks.find((x) => x.studentId === s.displayId)).filter(Boolean);
    const avg = withMarks.length ? Math.round(withMarks.reduce((a, m) => a + deriveMarkTotals(m).percentage, 0) / withMarks.length * 100) / 100 : null;
    return `<tr class="section-row"><td colspan="9"><strong>${sec ? 'Section ' + escapeHtml(sec) : 'No Section'}</strong>
      <span class="faint"> · ${rows.length} student${rows.length === 1 ? '' : 's'}${avg !== null ? ' · avg ' + avg + '%' : ''}</span></td></tr>` + rows.map(studentRow).join('');
  }).join('') : `<tr class="empty-row"><td colspan="9">No students yet.</td></tr>`;

  host.querySelectorAll('[data-release-marks]').forEach((b) => b.addEventListener('click', async () => {
    const next = b.dataset.released !== '1';
    await setMarksReleased(b.dataset.releaseMarks, next);
    showToast(next ? 'Marks released to student' : 'Marks hidden from student', 'info');
    await renderMarksTable();
  }));
  host.querySelectorAll('[data-edit-marks]').forEach((b) => b.addEventListener('click', () => openMarksModal(b.dataset.editMarks)));
  host.querySelectorAll('[data-reset-marks]').forEach((b) => b.addEventListener('click', () => {
    confirmDelete('Reset all marks for this student to zero?', async () => { await resetMarks(b.dataset.resetMarks); showToast('Marks reset', 'info'); await renderAll(); });
  }));
  host.querySelectorAll('[data-del-marks]').forEach((b) => b.addEventListener('click', () => {
    confirmDelete("Delete this student's marks record?", async () => { await deleteMarks(b.dataset.delMarks); showToast('Marks deleted', 'success'); await renderAll(); });
  }));
}

function confirmReleaseAllMarks() {
  openModal('Release All Marks', `
    <p class="confirm-text">Release marks for all students? Every student with a marks record will be able to see their own marks and their group's marks.</p>
    <p class="faint" style="font-size:12.5px;">You can hide individual students again with the lock icon in the table.</p>
    <div class="form-actions">
      <button class="btn btn--ghost" id="relCancelBtn" type="button">Cancel</button>
      <button class="btn btn--primary" id="relOkBtn" type="button">📢 Release All</button>
    </div>
  `, {
    onMount: () => {
      document.getElementById('relCancelBtn').addEventListener('click', closeModal);
      document.getElementById('relOkBtn').addEventListener('click', async () => {
        closeModal();
        const r = await releaseAllMarks(true);
        if (r) showToast(`Marks released for ${r.updated} student${r.updated === 1 ? '' : 's'}`, 'success');
        else showToast('Could not release marks', 'error');
        await renderAll();
      });
    }
  });
}

async function openGroupMarksModal() {
  const groups = await getData(CDAD_KEYS.GROUPS);
  const withMembers = groups.filter((g) => (g.members || []).length);
  if (!withMembers.length) return showToast('No groups with members yet', 'info');
  const d = { internalMax: 20, projectMax: 40, presentationMax: 20, vivaMax: 10 };
  openModal('Add Group Marks', `
    <form id="groupMarksForm">
      <div class="form-grid">
        <div class="field full"><label>Group</label>
          <select name="group" required>
            ${withMembers.map((g) => `<option value="${g.displayId}">${g.displayId} — ${escapeHtml(g.name)} (${g.members.length} members)</option>`).join('')}
          </select>
        </div>
        <div class="field"><label>Internal (/${d.internalMax})</label><input type="number" name="internal" min="0" max="${d.internalMax}" placeholder="leave blank to skip"></div>
        <div class="field"><label>Project (/${d.projectMax})</label><input type="number" name="project" min="0" max="${d.projectMax}" placeholder="leave blank to skip"></div>
        <div class="field"><label>Presentation (/${d.presentationMax})</label><input type="number" name="presentation" min="0" max="${d.presentationMax}" placeholder="leave blank to skip"></div>
        <div class="field"><label>Viva (/${d.vivaMax})</label><input type="number" name="viva" min="0" max="${d.vivaMax}" placeholder="leave blank to skip"></div>
      </div>
      <p class="faint" style="font-size:12.5px;">Applied to every member of the group. Blank fields keep each member's existing mark. You can still edit individuals afterwards.</p>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="cancelGroupMarksForm">Cancel</button>
        <button type="submit" class="btn btn--primary">Apply to Group</button>
      </div>
    </form>
  `, {
    onMount: () => {
      document.getElementById('cancelGroupMarksForm').addEventListener('click', closeModal);
      document.getElementById('groupMarksForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const fields = {};
        ['internal', 'project', 'presentation', 'viva'].forEach((k) => { if (fd.get(k) !== '') fields[k] = Number(fd.get(k)); });
        const r = await upsertGroupMarks(fd.get('group'), fields);
        closeModal();
        if (r) showToast(`Marks applied to ${r.updated} member${r.updated === 1 ? '' : 's'}`, 'success');
        else showToast('Could not apply group marks', 'error');
        await renderAll();
      });
    }
  });
}

async function openMarksModal(studentDisplayId) {
  const m = (await marksForStudent(studentDisplayId)) || { internal: 0, internalMax: 20, project: 0, projectMax: 40, presentation: 0, presentationMax: 20, viva: 0, vivaMax: 10 };
  openModal(`Edit Marks — ${studentDisplayId}`, `
    <form id="marksForm">
      <div class="form-grid">
        <div class="field"><label>Internal (/${m.internalMax})</label><input type="number" name="internal" min="0" max="${m.internalMax}" value="${m.internal}"></div>
        <div class="field"><label>Project (/${m.projectMax})</label><input type="number" name="project" min="0" max="${m.projectMax}" value="${m.project}"></div>
        <div class="field"><label>Presentation (/${m.presentationMax})</label><input type="number" name="presentation" min="0" max="${m.presentationMax}" value="${m.presentation}"></div>
        <div class="field"><label>Viva (/${m.vivaMax})</label><input type="number" name="viva" min="0" max="${m.vivaMax}" value="${m.viva}"></div>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="cancelMarksForm">Cancel</button>
        <button type="submit" class="btn btn--primary">Save Marks</button>
      </div>
    </form>
  `, {
    onMount: () => {
      document.getElementById('cancelMarksForm').addEventListener('click', closeModal);
      document.getElementById('marksForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        await upsertMarks(studentDisplayId, {
          internal: Number(fd.get('internal')) || 0,
          project: Number(fd.get('project')) || 0,
          presentation: Number(fd.get('presentation')) || 0,
          viva: Number(fd.get('viva')) || 0
        });
        closeModal();
        showToast('Marks saved', 'success');
        await renderAll();
      });
    }
  });
}

