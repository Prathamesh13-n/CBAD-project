/* ================= Students (Section 1) ================= */
async function renderStudents() {
  const host = document.getElementById('studentsTableBody');
  if (!host) return;
  const groups = await getData(CDAD_KEYS.GROUPS);
  const groupFilterEl = document.getElementById('studentGroupFilter');
  if (groupFilterEl && groupFilterEl.dataset.built !== '1') {
    groupFilterEl.innerHTML = `<option value="">All Groups</option>` + groups.map((g) => `<option value="${g.displayId}">${g.displayId}</option>`).join('');
    groupFilterEl.dataset.built = '1';
  }
  const search = (document.getElementById('studentSearch')?.value || '').toLowerCase();
  const groupFilter = document.getElementById('studentGroupFilter')?.value || '';
  const statusFilter = document.getElementById('studentStatusFilter')?.value || '';

  let students = await getData(CDAD_KEYS.STUDENTS);

  // Section tabs: All | one per section | No Section, each with a count.
  const sectionNames = [...new Set(students.map((s) => s.section || '').filter(Boolean))].sort();
  const noSectionCount = students.filter((s) => !s.section).length;
  if (studentSectionTab !== '__all' && studentSectionTab !== '' && !sectionNames.includes(studentSectionTab)) studentSectionTab = '__all';
  const tabsEl = document.getElementById('studentSectionTabs');
  if (tabsEl) {
    const tab = (value, label, count) =>
      `<button class="btn btn--sm ${studentSectionTab === value ? 'btn--primary' : 'btn--ghost'}" data-section-tab="${escapeHtml(value)}">${escapeHtml(label)} <span style="opacity:.7;">(${count})</span></button>`;
    tabsEl.innerHTML = tab('__all', 'All Sections', students.length)
      + sectionNames.map((n) => tab(n, 'Section ' + n, students.filter((s) => s.section === n).length)).join('')
      + (noSectionCount && sectionNames.length ? tab('', 'No Section', noSectionCount) : '');
    tabsEl.querySelectorAll('[data-section-tab]').forEach((b) => b.addEventListener('click', () => {
      studentSectionTab = b.dataset.sectionTab;
      studentsPage = 1;
      renderStudents();
    }));
  }
  if (studentSectionTab !== '__all') students = students.filter((s) => (s.section || '') === studentSectionTab);

  if (search) students = students.filter((s) => (s.name + s.email + s.displayId).toLowerCase().includes(search));
  if (groupFilter) students = students.filter((s) => s.group === groupFilter);
  if (statusFilter) students = students.filter((s) => s.status === statusFilter);

  const totalPages = Math.max(1, Math.ceil(students.length / STUDENTS_PAGE_SIZE));
  if (studentsPage > totalPages) studentsPage = totalPages;
  const pageStudents = students.slice((studentsPage - 1) * STUDENTS_PAGE_SIZE, studentsPage * STUDENTS_PAGE_SIZE);

  const projects = await getData(CDAD_KEYS.PROJECTS);
  const marks = await getData(CDAD_KEYS.MARKS);

  host.innerHTML = pageStudents.length ? pageStudents.map((s) => {
    const group = groups.find((g) => g.displayId === s.group);
    const project = group ? projects.find((p) => p.displayId === group.project) : null;
    const marksRec = marks.find((m) => m.studentId === s.displayId);
    const totals = marksRec ? deriveMarkTotals(marksRec) : null;
    return `
    <tr>
      <td class="mono">${escapeHtml(s.displayId)}</td>
      <td>
        <div class="row-name">
          <div class="avatar" style="width:32px;height:32px;font-size:11px;">${s.avatar ? `<img src="${escapeHtml(s.avatar)}">` : initials(s.name)}</div>
          <div class="row-name__text"><strong>${escapeHtml(s.name)}</strong><span>${escapeHtml(s.email)}</span></div>
        </div>
      </td>
      <td>${s.section ? `<span class="badge badge--info">${escapeHtml(s.section)}</span>` : '—'}</td>
      <td>${escapeHtml(s.group || '—')}</td>
      <td>${project ? escapeHtml(project.title) : '—'}</td>
      <td>
        <div class="progress-cell">
          <div class="bar-track"><div class="bar-fill" style="width:${project ? project.progress : 0}%"></div></div>
          <span>${project ? project.progress : 0}%</span>
        </div>
      </td>
      <td>${totals ? totals.total + ' / ' + totals.max : '—'}</td>
      <td><span class="badge ${statusBadgeClass(s.status)}">${escapeHtml(s.status)}</span></td>
      <td class="table-actions">
        <button class="btn btn--ghost btn--sm" data-edit-student="${s.id}">Edit ✎</button>
        <button class="btn btn--danger btn--sm" data-del-student="${s.id}">Delete</button>
      </td>
    </tr>`;
  }).join('') : `<tr class="empty-row"><td colspan="9">No students match your filters.</td></tr>`;

  host.querySelectorAll('[data-edit-student]').forEach((b) => b.addEventListener('click', () => openEditStudentModal(b.dataset.editStudent)));
  host.querySelectorAll('[data-del-student]').forEach((b) => b.addEventListener('click', async () => {
    const s = await findData(CDAD_KEYS.STUDENTS, b.dataset.delStudent);
    confirmDelete(`Delete student ${s.name} (${s.displayId})? Group membership and marks will be cleaned up.`, async () => {
      if (s.group) {
        const group = await getGroup(s.group);
        if (group) await removeMember(group.id, s.displayId);
      }
      await deleteData(CDAD_KEYS.STUDENTS, s.id);
      showToast('Student deleted', 'success');
      await renderAll();
    });
  }));

  renderStudentsPagination(students.length, totalPages);
}

async function currentFilteredStudents() {
  const search = (document.getElementById('studentSearch')?.value || '').toLowerCase();
  const groupFilter = document.getElementById('studentGroupFilter')?.value || '';
  const statusFilter = document.getElementById('studentStatusFilter')?.value || '';
  let students = await getData(CDAD_KEYS.STUDENTS);
  if (studentSectionTab !== '__all') students = students.filter((s) => (s.section || '') === studentSectionTab);
  if (search) students = students.filter((s) => (s.name + s.email + s.displayId).toLowerCase().includes(search));
  if (groupFilter) students = students.filter((s) => s.group === groupFilter);
  if (statusFilter) students = students.filter((s) => s.status === statusFilter);
  return students;
}

async function openAssignSectionModal() {
  const list = await currentFilteredStudents();
  if (!list.length) return showToast('No students in the current list', 'info');
  const existing = [...new Set((await getData(CDAD_KEYS.STUDENTS)).map((s) => s.section).filter(Boolean))].sort();
  openModal('Assign Section', `
    <p class="field-hint" style="margin-bottom:14px;">All <strong>${list.length}</strong> student(s) currently listed (respecting the tab, search and filters) will be placed in the section below. Leave it blank to remove their section.</p>
    <div class="field full" style="margin-bottom:14px;">
      <label>Section / Division</label>
      <input id="assignSectionInput" list="assignSectionList" placeholder="e.g. A" autocomplete="off">
      <datalist id="assignSectionList">${existing.map((v) => `<option value="${escapeHtml(v)}">`).join('')}</datalist>
    </div>
    <div class="form-actions">
      <button type="button" class="btn btn--ghost" id="cancelAssignSection">Cancel</button>
      <button type="button" class="btn btn--primary" id="confirmAssignSection">Assign</button>
    </div>`, {
    onMount: () => {
      document.getElementById('cancelAssignSection').addEventListener('click', closeModal);
      document.getElementById('confirmAssignSection').addEventListener('click', async () => {
        const section = document.getElementById('assignSectionInput').value.trim();
        closeModal();
        for (const s of list) await updateData(CDAD_KEYS.STUDENTS, s.id, { section });
        if (section) studentSectionTab = section;
        showToast(section ? `${list.length} student(s) moved to section ${section}` : `Section cleared for ${list.length} student(s)`, 'success');
        await renderAll();
      });
    }
  });
}

function renderStudentsPagination(total, totalPages) {
  const host = document.getElementById('studentsPagination');
  if (!host) return;
  const start = total === 0 ? 0 : (studentsPage - 1) * STUDENTS_PAGE_SIZE + 1;
  const end = Math.min(studentsPage * STUDENTS_PAGE_SIZE, total);

  const pageButtons = [];
  const maxButtons = 5;
  let from = Math.max(1, studentsPage - Math.floor(maxButtons / 2));
  let to = Math.min(totalPages, from + maxButtons - 1);
  from = Math.max(1, to - maxButtons + 1);
  for (let p = from; p <= to; p++) {
    pageButtons.push(`<button class="page-btn ${p === studentsPage ? 'active' : ''}" data-page="${p}">${p}</button>`);
  }

  host.innerHTML = `
    <div class="pagination__info">Showing ${start} to ${end} of ${total} students</div>
    <div class="pagination__pages">
      <button class="page-btn" id="pagePrev" ${studentsPage === 1 ? 'disabled' : ''}>‹</button>
      ${pageButtons.join('')}
      <button class="page-btn" id="pageNext" ${studentsPage === totalPages ? 'disabled' : ''}>›</button>
    </div>`;

  host.querySelectorAll('[data-page]').forEach((b) => b.addEventListener('click', () => { studentsPage = Number(b.dataset.page); renderStudents(); }));
  const prev = document.getElementById('pagePrev');
  const next = document.getElementById('pageNext');
  if (prev) prev.addEventListener('click', () => { if (studentsPage > 1) { studentsPage--; renderStudents(); } });
  if (next) next.addEventListener('click', () => { if (studentsPage < totalPages) { studentsPage++; renderStudents(); } });
}

function openAddStudentModal() { studentFormModal('Add Student', null); }
async function openEditStudentModal(id) { studentFormModal('Edit Student', await findData(CDAD_KEYS.STUDENTS, id)); }

/* ================= Bulk import students from CSV ================= */
/** Minimal dependency-free CSV parser. Handles quoted fields and commas inside quotes. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { pushField(); rows.push(row); row = []; };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') pushField();
      else if (c === '\r') { /* skip */ }
      else if (c === '\n') pushRow();
      else field += c;
    }
  }
  if (field.length || row.length) pushRow();
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/** Finds the column index whose header loosely matches any of the given aliases. */
function findColumn(headers, aliases) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normHeaders = headers.map(norm);
  for (const alias of aliases) {
    const idx = normHeaders.indexOf(norm(alias));
    if (idx !== -1) return idx;
  }
  return -1;
}

function openImportStudentsModal(opts) {
  const bySection = !!(opts && opts.bySection);
  openModal(bySection ? 'Import Students by Section' : 'Import Students from CSV', `
    ${bySection ? `
    <p class="field-hint" style="margin-bottom:14px;">Choose the section / division, then upload its CSV. Imported students are placed in that section, and students who already exist are moved into it. If the CSV has a "Section" column, only rows for the chosen section are imported.</p>
    <div class="field full" style="margin-bottom:14px;">
      <label>Section / Division</label>
      <input id="importSection" list="importSectionList" placeholder="e.g. A" autocomplete="off">
      <datalist id="importSectionList"></datalist>
    </div>` : `
    <p class="field-hint" style="margin-bottom:14px;">Upload a CSV with columns for Enrollment No. and Name (matches the roster template — Email, Phone, Group, Section, and Password columns are optional). Existing Student IDs are skipped, not overwritten.</p>`}
    <div class="field full" style="margin-bottom:14px;">
      <label>CSV File</label>
      <input type="file" id="csvFileInput" accept=".csv,text/csv">
    </div>
    <div id="importPreview" style="margin-bottom:14px;"></div>
    <div class="form-actions">
      <button type="button" class="btn btn--ghost" id="cancelImport">Cancel</button>
      <button type="button" class="btn btn--primary" id="confirmImportBtn" disabled>Import Students</button>
    </div>
  `, {
    onMount: () => {
      let parsedRows = [];
      let sectionUpdates = []; // existing students to move into the chosen section
      const sectionEl = document.getElementById('importSection');
      const chosenSection = () => (sectionEl ? sectionEl.value.trim() : '');
      document.getElementById('cancelImport').addEventListener('click', closeModal);
      if (sectionEl) {
        getData(CDAD_KEYS.STUDENTS).then((all) => {
          document.getElementById('importSectionList').innerHTML = [...new Set(all.map((s) => s.section).filter(Boolean))]
            .map((v) => `<option value="${escapeHtml(v)}">`).join('');
        });
        // Changing the section after choosing a file re-runs the preview with the new filter.
        sectionEl.addEventListener('input', () => {
          const fi = document.getElementById('csvFileInput');
          if (fi.files[0]) fi.dispatchEvent(new Event('change'));
          else document.getElementById('confirmImportBtn').disabled = true;
        });
      }

      document.getElementById('csvFileInput').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
          const rows = parseCsv(evt.target.result);
          if (rows.length < 2) {
            document.getElementById('importPreview').innerHTML = `<div class="login-error show" style="display:block;">No data rows found in this file.</div>`;
            return;
          }
          const headers = rows[0];
          const idCol = findColumn(headers, ['ENROLLMENT NO.', 'ENROLLMENT NO', 'ENROLLMENTNO', 'STUDENT ID', 'ID']);
          const nameCol = findColumn(headers, ['NAME OF STUDENT', 'NAME', 'STUDENT NAME']);
          const emailCol = findColumn(headers, ['EMAIL (optional)', 'EMAIL']);
          const phoneCol = findColumn(headers, ['PHONE (optional)', 'PHONE', 'PHONE NUMBER']);
          const groupCol = findColumn(headers, ['GROUP (optional)', 'GROUP']);
          const sectionCol = findColumn(headers, ['SECTION (optional)', 'SECTION', 'DIVISION', 'DIV']);
          const passCol = findColumn(headers, ['PASSWORD (optional)', 'PASSWORD']);

          if (idCol === -1 || nameCol === -1) {
            document.getElementById('importPreview').innerHTML = `<div class="login-error show" style="display:block;">Couldn't find "Enrollment No." and "Name" columns in the header row. Check your CSV matches the template.</div>`;
            document.getElementById('confirmImportBtn').disabled = true;
            return;
          }

          const existingStudents = await getData(CDAD_KEYS.STUDENTS);
          const existingIds = new Set(existingStudents.map((s) => s.displayId.toLowerCase()));
          const dataRows = rows.slice(1);
          const totalDataRows = dataRows.length;

          const invalidRows = []; // rows missing ID or Name
          const rawParsed = dataRows.map((r, idx) => {
            const displayId = (r[idCol] || '').trim();
            const name = (r[nameCol] || '').trim();
            if (!displayId || !name) invalidRows.push({ line: idx + 2, displayId, name }); // +2: header is line 1, data starts at line 2
            return {
              displayId,
              name,
              email: emailCol !== -1 ? (r[emailCol] || '').trim() : '',
              phone: phoneCol !== -1 ? (r[phoneCol] || '').trim() : '',
              group: groupCol !== -1 ? (r[groupCol] || '').trim() : '',
              section: sectionCol !== -1 ? (r[sectionCol] || '').trim() : '',
              password: passCol !== -1 ? (r[passCol] || '').trim() : ''
            };
          });

          const sec = chosenSection();
          let validRows = rawParsed.filter((r) => r.displayId && r.name);
          let otherSection = 0;
          if (bySection) {
            // A Section column narrows the file to the chosen division; blank cells are taken as belonging to it.
            const mine = validRows.filter((r) => !r.section || r.section.toLowerCase() === sec.toLowerCase());
            otherSection = validRows.length - mine.length;
            validRows = mine;
          }
          const duplicateRows = validRows.filter((r) => existingIds.has(r.displayId.toLowerCase()));
          parsedRows = validRows.filter((r) => !existingIds.has(r.displayId.toLowerCase()));
          sectionUpdates = bySection
            ? duplicateRows.map((r) => existingStudents.find((s) => s.displayId.toLowerCase() === r.displayId.toLowerCase()))
                .filter((s) => s && (s.section || '') !== sec)
            : [];

          document.getElementById('importPreview').innerHTML = `
            <div class="list-item">
              <div class="list-item__body"><strong>${totalDataRows}</strong> data row(s) found in the file.</div>
              <div class="list-item__body"><strong>${parsedRows.length}</strong> will be imported.</div>
              ${invalidRows.length ? `<div class="list-item__body" style="color:var(--red);">${invalidRows.length} row(s) skipped — missing Enrollment No. or Name (line ${invalidRows.slice(0, 8).map((r) => r.line).join(', ')}${invalidRows.length > 8 ? ', …' : ''}).</div>` : ''}
              ${bySection ? `<div class="list-item__body"><strong>${sectionUpdates.length}</strong> existing student(s) will be moved to section ${escapeHtml(sec || '—')}.</div>` : ''}
              ${otherSection ? `<div class="list-item__body faint">${otherSection} row(s) ignored — they belong to other sections.</div>` : ''}
              ${!bySection && duplicateRows.length ? `<div class="list-item__body" style="color:var(--orange);">${duplicateRows.length} row(s) skipped — Student ID already exists (${duplicateRows.slice(0, 8).map((r) => escapeHtml(r.displayId)).join(', ')}${duplicateRows.length > 8 ? ', …' : ''}).</div>` : ''}
              <div class="list-item__body faint">First row to import: ${parsedRows[0] ? escapeHtml(parsedRows[0].displayId) + ' — ' + escapeHtml(parsedRows[0].name) : '—'}</div>
            </div>`;
          document.getElementById('confirmImportBtn').disabled = (parsedRows.length === 0 && sectionUpdates.length === 0) || (bySection && !sec);
        };
        reader.readAsText(file);
      });

      document.getElementById('confirmImportBtn').addEventListener('click', async () => {
        const sec = chosenSection();
        if (bySection && !sec) { showToast('Enter a section first', 'error'); return; }
        const existingIds = new Set((await getData(CDAD_KEYS.STUDENTS)).map((s) => s.displayId.toLowerCase()));
        let imported = 0;
        for (const r of parsedRows) {
          if (existingIds.has(r.displayId.toLowerCase())) continue;
          const newStudent = {
            displayId: r.displayId,
            name: r.name,
            email: r.email || '',
            password: r.password || 'PASS123',
            phone: r.phone || '',
            course: '', year: '', department: '', section: bySection ? sec : r.section || '',
            group: r.group || '',
            role: 'Member',
            status: 'Active',
            avatar: ''
          };
          await addData(CDAD_KEYS.STUDENTS, newStudent);
          existingIds.add(r.displayId.toLowerCase());
          imported++;
        }
        for (const s of sectionUpdates) await updateData(CDAD_KEYS.STUDENTS, s.id, { section: sec });
        closeModal();
        showToast(bySection
          ? `Section ${sec}: ${imported} imported, ${sectionUpdates.length} moved in`
          : `Imported ${imported} student(s)`, 'success');
        await renderAll();
      });
    }
  });
}

function studentFormModal(title, student) {
  getData(CDAD_KEYS.GROUPS).then((groups) => {
    openModal(title, `
      <form id="studentForm">
        <div class="form-grid">
          <div class="field full"><label>Name</label><input name="name" required value="${escapeHtml(student?.name || '')}"></div>
          <div class="field"><label>Email</label><input type="email" name="email" required value="${escapeHtml(student?.email || '')}"></div>
          <div class="field"><label>Password</label><input name="password" ${student ? '' : 'required'} placeholder="${student ? 'Leave blank to keep current' : ''}" value="${student ? '' : 'PASS123'}"></div>
          <div class="field"><label>Phone</label><input name="phone" value="${escapeHtml(student?.phone || '')}"></div>
          <div class="field">
            <label>Course</label>
            <select name="course">
              ${['Computer Engineering','Information Technology','AI & Data Science','Electronics Engineering'].map((c) => `<option ${student?.course===c?'selected':''}>${c}</option>`).join('')}
            </select>
          </div>
          <div class="field"><label>Year</label><input name="year" value="${escapeHtml(student?.year || '1st Year')}"></div>
          <div class="field"><label>Department</label><input name="department" value="${escapeHtml(student?.department || 'Computer Engineering')}"></div>
          <div class="field"><label>Section</label><input name="section" placeholder="e.g. A" value="${escapeHtml(student?.section || '')}"></div>
          <div class="field">
            <label>Group</label>
            <select name="group">
              <option value="">— None —</option>
              ${groups.map((g) => `<option value="${g.displayId}" ${student?.group===g.displayId?'selected':''}>${g.displayId} — ${escapeHtml(g.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>Role</label>
            <select name="role"><option ${student?.role==='Member'?'selected':''}>Member</option><option ${student?.role==='Team Leader'?'selected':''}>Team Leader</option></select>
          </div>
          <div class="field">
            <label>Status</label>
            <select name="status"><option ${student?.status==='Active'?'selected':''}>Active</option><option ${student?.status==='Inactive'?'selected':''}>Inactive</option></select>
          </div>
          <div class="field full"><label>Profile Image URL</label><input name="avatar" value="${escapeHtml(student?.avatar || '')}"></div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn--ghost" id="cancelStudentForm">Cancel</button>
          <button type="submit" class="btn btn--primary">Save Changes</button>
        </div>
      </form>
    `, {
      onMount: () => {
        document.getElementById('cancelStudentForm').addEventListener('click', closeModal);
        document.getElementById('studentForm').addEventListener('submit', async (e) => {
          e.preventDefault();
          const fd = new FormData(e.target);
          const fields = {
            name: fd.get('name').trim(), email: fd.get('email').trim(),
            phone: fd.get('phone').trim(), course: fd.get('course'), year: fd.get('year').trim(),
            department: fd.get('department').trim(), section: fd.get('section').trim(), group: fd.get('group'), role: fd.get('role'),
            status: fd.get('status'), avatar: fd.get('avatar').trim()
          };
          const password = fd.get('password');
          if (password) fields.password = password;

          if (student) {
            await updateData(CDAD_KEYS.STUDENTS, student.id, fields);
            showToast('Student updated', 'success');
          } else {
            await addData(CDAD_KEYS.STUDENTS, fields);
            showToast('Student added', 'success');
          }
          closeModal();
          await renderAll();
        });
      }
    });
  });
}

