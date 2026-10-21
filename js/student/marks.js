/* ================= Marks page (Evaluation Summary + Donut + Trend + Details) ================= */
async function renderMarksPage() {
  const host = document.getElementById('marksMainGrid');
  if (!host) return;
  const m = await marksForStudent(ME.displayId);
  const groupCard = await buildGroupMarksCard();
  if (!m) { host.innerHTML = `<div class="section">${emptyState('Marks have not been released yet.')}</div>` + groupCard; return; }
  const t = deriveMarkTotals(m);

  const summaryCard = `
    <div class="section">
      <div class="section__head"><h3>Evaluation Summary</h3></div>
      <div class="marks-ledger">
        <table>
          <thead><tr><th>Evaluation</th><th>Marks Obtained</th><th>Maximum Marks</th><th>Percentage</th></tr></thead>
          <tbody>
            <tr><td>Internal Assessment</td><td>${m.internal}</td><td>${m.internalMax}</td><td>${Math.round((m.internal/m.internalMax)*100)}%</td></tr>
            <tr><td>Project</td><td>${m.project}</td><td>${m.projectMax}</td><td>${Math.round((m.project/m.projectMax)*100)}%</td></tr>
            <tr><td>Presentation</td><td>${m.presentation}</td><td>${m.presentationMax}</td><td>${Math.round((m.presentation/m.presentationMax)*100)}%</td></tr>
            <tr><td>Viva</td><td>${m.viva}</td><td>${m.vivaMax}</td><td>${Math.round((m.viva/m.vivaMax)*100)}%</td></tr>
          </tbody>
          <tfoot><tr><td>Total</td><td>${t.total}</td><td>${t.max}</td><td>${t.percentage}%</td></tr></tfoot>
        </table>
      </div>
    </div>`;

  const donutCard = `
    <div class="section">
      <div class="section__head"><h3>Overall Marks</h3></div>
      <div class="donut-wrap">
        <div style="position:relative; width:160px; height:160px;">
          ${buildDonutChart(t.percentage, { size: 160, stroke: 16, color: 'var(--blue)' })}
          <div style="position:absolute; inset:0; display:flex; flex-direction:column; align-items:center; justify-content:center;">
            <div class="donut-center-value">${t.total} / ${t.max}</div>
            <div class="donut-center-label">${t.percentage}%</div>
          </div>
        </div>
        <div class="donut-stats">
          <div class="donut-stat"><div class="donut-stat__value">${t.grade}</div><div class="donut-stat__label">Grade</div></div>
          <div class="donut-stat"><div class="donut-stat__value donut-stat__value--good">${t.percentage >= 60 ? 'Good' : 'Needs Work'}</div><div class="donut-stat__label">Status</div></div>
        </div>
      </div>
    </div>`;

  const trendPoints = [
    Math.round((m.internal / m.internalMax) * 100),
    Math.round((m.project / m.projectMax) * 100),
    Math.round((m.presentation / m.presentationMax) * 100),
    Math.round((m.viva / m.vivaMax) * 100)
  ];
  const trendLabels = ['Internal Assessment', 'Project', 'Presentation', 'Viva'];
  const trendCard = `
    <div class="section">
      <div class="section__head"><h3>Marks Trend</h3></div>
      <div class="line-chart-wrap">
        ${buildLineChart(trendPoints, trendLabels, { width: 420, height: 160, max: 100, min: 0 })}
        <div class="line-chart-caption">${trendLabels.map((l) => `<span>${l}</span>`).join('')}</div>
      </div>
    </div>`;

  const detailsCard = `
    <div class="section">
      <div class="section__head"><h3>Evaluation Details</h3></div>
      <p class="muted" style="font-size:12.5px;">Note: Marks will be updated by respective faculty members.</p>
      <p class="faint" style="font-size:12px;">Check back regularly for the latest updates.</p>
      <div style="margin-top:18px; text-align:center; opacity:0.5; font-size:38px;">📋</div>
    </div>`;

  host.innerHTML = summaryCard + donutCard + trendCard + detailsCard + groupCard;
}

/* Marks of every member of the student's own group, as assigned by faculty. */
async function buildGroupMarksCard() {
  const group = await getGroup(ME.group);
  if (!group) return '';
  const students = await getData(CDAD_KEYS.STUDENTS);
  const marks = await allMarks();
  const members = (group.members || []).map((id) => students.find((s) => s.displayId === id)).filter(Boolean);
  const rows = members.map((s) => {
    const m = marks.find((x) => x.studentId === s.displayId);
    return { s, m, t: m ? deriveMarkTotals(m) : null };
  });
  const scored = rows.filter((r) => r.t);
  const avg = scored.length ? Math.round(scored.reduce((a, r) => a + r.t.percentage, 0) / scored.length * 100) / 100 : null;
  const cell = (m, k) => (m ? `${m[k]}/${m[k + 'Max']}` : '—');
  return `
    <div class="section" style="grid-column:1 / -1;">
      <div class="section__head">
        <div><span class="faint mono" style="font-size:11px;">${escapeHtml(group.displayId)}</span><h3>Group Marks — ${escapeHtml(group.name)}</h3></div>
        ${avg !== null ? `<span class="badge badge--info">Group avg ${avg}%</span>` : ''}
      </div>
      <div class="marks-ledger">
        <table>
          <thead><tr><th>Member</th><th>Internal</th><th>Project</th><th>Presentation</th><th>Viva</th><th>Total</th><th>%</th><th>Grade</th></tr></thead>
          <tbody>
            ${rows.map(({ s, m, t }) => `
              <tr${s.displayId === ME.displayId ? ' style="font-weight:600;"' : ''}>
                <td>${escapeHtml(s.name)}${s.displayId === ME.displayId ? ' (you)' : ''}<div class="faint mono" style="font-size:11px;">${escapeHtml(s.displayId)}</div></td>
                <td>${cell(m, 'internal')}</td><td>${cell(m, 'project')}</td><td>${cell(m, 'presentation')}</td><td>${cell(m, 'viva')}</td>
                <td>${t ? t.total + '/' + t.max : '—'}</td><td>${t ? t.percentage + '%' : '—'}</td><td>${t ? t.grade : '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <p class="faint" style="font-size:12px; margin-top:10px;">Marks are assigned by your faculty and shown for all members of your group.</p>
    </div>`;
}

