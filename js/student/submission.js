/* ================= Submission tab (dedicated page) ================= */
async function renderSubmissionTab() {
  const host = document.getElementById('submissionTabPanel');
  if (!host) return;
  const group = await getGroup(ME.group);
  const project = group ? await getProject(group.project) : null;

  if (!project) {
    host.innerHTML = emptyState('You need a project before you can submit anything. Check My Project.');
    return;
  }

  host.innerHTML = `
    <div class="section__head">
      <div><span class="faint mono" style="font-size:11px;">${escapeHtml(project.displayId)}</span><h3>${escapeHtml(project.title)}</h3></div>
    </div>
    <p class="field-hint" style="margin-bottom:18px;">Submit your finished work here for faculty to review. You can update your submission any time until it's approved.</p>
    <div id="submissionTabBlock" style="padding-top:6px;"></div>`;

  renderSubmissionBlock(project, 'submissionTabBlock', group.teamLeader === ME.displayId);
  await renderExamSubmissionCards(host, group.teamLeader === ME.displayId);
}

/* TA1 / TA2 / EndSem: one card per exam, team leader submits a link and/or file. */
async function renderExamSubmissionCards(host, amLeader) {
  const { exams, submissions, deadlines = {} } = await fetchExamSubmissions();
  const wrap = document.createElement('div');
  wrap.style.marginTop = '28px';
  wrap.innerHTML = `
    <h4 style="font-size:13.5px; margin-bottom:10px;">Exam Submissions</h4>
    <p class="field-hint" style="margin-bottom:14px;">Submit your PPT, document or link for each exam${amLeader ? '' : ' — only your team leader can submit'}.</p>
    <div class="card-grid">
      ${exams.map((exam) => {
        const s = submissions.find((x) => x.exam === exam);
        const dl = deadlines[exam];
        const closed = !!dl && new Date(dl) < new Date();
        return `
          <div class="card">
            <div class="card__top"><div class="card__title">${EXAM_LABELS[exam] || exam}</div>
              <span class="badge ${s ? 'badge--good' : 'badge--warn'}">${s ? 'Submitted' : 'Pending'}</span></div>
            ${s ? `
              ${s.link ? `<div class="card__meta"><a href="${escapeHtml(s.link)}" target="_blank" rel="noopener">Link ↗</a></div>` : ''}
              ${s.files.map((f) => `<div class="card__meta"><a href="/api/exam-submissions/files/${f.id}" target="_blank">${escapeHtml(f.name)}</a> <span class="faint">(${formatFileSize(f.size)})</span></div>`).join('')}
              <div class="card__meta faint">by ${escapeHtml(s.submittedBy)} · ${formatDateTime(s.submittedAt)}</div>` : ''}
            ${dl ? `<div class="card__meta" style="${closed ? 'color:var(--red);' : ''}">${closed ? '🔒 Closed' : '⏰ Due'} ${formatDateTime(dl)}</div>` : ''}
            ${amLeader ? (closed
              ? `<div class="card__actions"><button class="btn btn--ghost btn--sm" disabled>Submissions closed</button></div>`
              : `<div class="card__actions"><button class="btn btn--ghost btn--sm" data-exam-submit="${exam}">${s ? 'Update' : 'Submit'}</button></div>`) : ''}
          </div>`;
      }).join('')}
    </div>`;
  host.appendChild(wrap);
  wrap.querySelectorAll('[data-exam-submit]').forEach((b) => b.addEventListener('click', () => {
    openExamSubmitModal(b.dataset.examSubmit, submissions.find((x) => x.exam === b.dataset.examSubmit));
  }));
}

function openExamSubmitModal(exam, existing) {
  openModal(`${existing ? 'Update' : 'Submit'} ${EXAM_LABELS[exam] || exam}`, `
    <form id="examSubmitForm">
      <div class="login-error" id="examSubmitError"></div>
      <div class="field full" style="margin-bottom:14px;">
        <label>Link (Drive / PPT / repo — optional if attaching a file)</label>
        <input name="link" type="url" placeholder="https://..." value="${escapeHtml(existing?.link || '')}">
      </div>
      <div class="field full" style="margin-bottom:14px;">
        <label>Attach files (up to ${EXAM_MAX_FILES} — PDF, PPT, CSV or DOC, max 10MB each)</label>
        ${(existing?.files || []).map((f) => `
          <label class="field-hint" style="display:flex; gap:8px; align-items:center; margin:4px 0;">
            <input type="checkbox" data-keep-file="${f.id}" checked> ${escapeHtml(f.name)} <span class="faint">(${formatFileSize(f.size)})</span>
          </label>`).join('')}
        <input type="file" name="files" id="examFilesInput" multiple accept=".pdf,.ppt,.pptx,.csv,.doc,.docx">
        <div class="field-hint" style="margin-top:6px;" id="examFilesHint"></div>
      </div>
      <div class="field full"><label>Note (optional)</label><textarea name="note">${escapeHtml(existing?.note || '')}</textarea></div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="cancelExamSubmit">Cancel</button>
        <button type="submit" class="btn btn--primary">${existing ? 'Update' : 'Submit'}</button>
      </div>
    </form>
  `, {
    onMount: () => {
      document.getElementById('cancelExamSubmit').addEventListener('click', closeModal);
      document.getElementById('examSubmitForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const link = fd.get('link').trim();
        const files = [...e.target.querySelector('#examFilesInput').files];
        const removeFileIds = [...e.target.querySelectorAll('[data-keep-file]')].filter((c) => !c.checked).map((c) => Number(c.dataset.keepFile));
        const keptCount = (existing?.files || []).length - removeFileIds.length;
        const errEl = document.getElementById('examSubmitError');
        errEl.classList.remove('show');
        const fail = (msg) => { errEl.textContent = msg; errEl.classList.add('show'); };
        if (!link && !files.length && !keptCount) return fail('Provide a link or attach at least one file.');
        if (keptCount + files.length > EXAM_MAX_FILES) return fail(`At most ${EXAM_MAX_FILES} files in total (${keptCount} kept + ${files.length} new).`);
        const r = await submitExamWork(exam, { link, note: fd.get('note').trim(), files, removeFileIds });
        if (r.error) { errEl.textContent = r.error; errEl.classList.add('show'); return; }
        closeModal();
        showToast(`${EXAM_LABELS[exam] || exam} submitted`, 'success');
        await renderAll();
      });
    }
  });
}
/** amLeader: only the group's team leader can submit/resubmit (server enforces this
    too) — everyone else still sees the submission's status/link/file/note, just not
    the button to change it. */
function renderSubmissionBlock(project, hostId, amLeader) {
  const host = document.getElementById(hostId || 'submissionBlock');
  if (!host) return;
  const sub = project.submission;

  if (!sub) {
    host.innerHTML = `
      <h4 style="font-size:13.5px; margin-bottom:10px;">Final Submission</h4>
      <p class="muted" style="font-size:12.5px; margin-bottom:12px;">Once your project is ready, submit a link (repository, drive folder, etc.) and/or attach a file (PDF, PPT, CSV, or DOC) for faculty to review.</p>
      ${amLeader
        ? `<button class="btn btn--primary btn--sm" data-submit-project-btn>Submit Project</button>`
        : `<p class="field-hint">Only your team leader (${escapeHtml(project.teamLeader || 'not set')}) can submit this project.</p>`}`;
    const submitBtn = host.querySelector('[data-submit-project-btn]');
    if (submitBtn) submitBtn.addEventListener('click', () => openSubmitProjectModal(project));
    return;
  }

  const badgeClass = sub.status === 'Approved' ? 'badge--good' : sub.status === 'Rejected' ? 'badge--bad' : 'badge--warn';
  host.innerHTML = `
    <div class="section__head"><h4 style="font-size:13.5px; margin:0;">Final Submission</h4><span class="badge ${badgeClass}">${escapeHtml(sub.status)}</span></div>
    <div class="list-item">
      ${sub.link ? `<div class="list-item__body"><strong>Link:</strong> <a href="${escapeHtml(sub.link)}" target="_blank" rel="noopener">${escapeHtml(sub.link)}</a></div>` : ''}
      ${sub.fileName ? `<div class="list-item__body"><strong>File:</strong> <a href="/api/projects/${project.id}/submission/file" target="_blank">${escapeHtml(sub.fileName)}</a> <span class="faint">(${formatFileSize(sub.fileSize)})</span></div>` : ''}
      ${sub.note ? `<div class="list-item__body"><strong>Note:</strong> ${escapeHtml(sub.note)}</div>` : ''}
      <div class="list-item__body faint">Submitted by ${escapeHtml(sub.submittedBy)} on ${formatDateTime(sub.submittedAt)}</div>
      ${sub.facultyNote ? `<div class="list-item__body"><strong>Faculty note:</strong> ${escapeHtml(sub.facultyNote)}</div>` : ''}
    </div>
    ${sub.status !== 'Approved' && amLeader ? `<button class="btn btn--ghost btn--sm" data-resubmit-project-btn>${sub.status === 'Rejected' ? 'Resubmit' : 'Update Submission'}</button>` : ''}
    ${sub.status !== 'Approved' && !amLeader ? `<p class="field-hint">Only your team leader (${escapeHtml(project.teamLeader || sub.submittedBy)}) can update this submission.</p>` : ''}`;

  const resubmitBtn = host.querySelector('[data-resubmit-project-btn]');
  if (resubmitBtn) resubmitBtn.addEventListener('click', () => openSubmitProjectModal(project));
}

function openSubmitProjectModal(project) {
  const sub = project.submission;
  openModal(sub ? 'Update Submission' : 'Submit Project', `
    <form id="submitProjectForm">
      <div class="login-error" id="submitProjectError"></div>
      <div class="field full" style="margin-bottom:14px;">
        <label>Link (repository, drive folder, doc, etc. — optional if attaching a file)</label>
        <input name="link" type="url" placeholder="https://..." value="${escapeHtml(sub?.link || project.githubUrl || '')}">
      </div>
      <div class="field full" style="margin-bottom:14px;">
        <label>Attach a file (optional — PDF, PPT, CSV, or DOC, max 10MB)</label>
        <input type="file" name="file" accept=".pdf,.ppt,.pptx,.csv,.doc,.docx">
        ${sub?.fileName ? `<div class="field-hint" style="margin-top:6px;">Currently attached: ${escapeHtml(sub.fileName)} — choose a new file to replace it, or leave blank to keep it.</div>` : ''}
      </div>
      <div class="field full">
        <label>Note for faculty (optional)</label>
        <textarea name="note" placeholder="Anything faculty should know before reviewing...">${escapeHtml(sub?.note || '')}</textarea>
      </div>
      <div class="form-actions">
        <button type="button" class="btn btn--ghost" id="cancelSubmitProject">Cancel</button>
        <button type="submit" class="btn btn--primary">${sub ? 'Resubmit' : 'Submit'}</button>
      </div>
    </form>
  `, {
    onMount: () => {
      document.getElementById('cancelSubmitProject').addEventListener('click', closeModal);
      document.getElementById('submitProjectForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        const link = fd.get('link').trim();
        const file = e.target.querySelector('input[name=file]').files[0] || null;
        const errEl = document.getElementById('submitProjectError');
        errEl.classList.remove('show');

        if (!link && !file && !sub?.fileName) {
          errEl.textContent = 'Provide a link or attach a file.';
          errEl.classList.add('show');
          return;
        }

        const result = await submitProjectWork(project.id, { link, note: fd.get('note').trim(), file });
        if (result.error) {
          errEl.textContent = result.error;
          errEl.classList.add('show');
          return;
        }
        closeModal();
        showToast('Submission sent to faculty for review', 'success');
        await renderAll();
      });
    }
  });
}

