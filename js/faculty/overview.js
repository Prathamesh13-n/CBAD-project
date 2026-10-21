/* ================= Overview: dashboard cards + charts (Sections 13/14) ================= */
async function renderOverview() {
  const host = document.getElementById('overviewStats');
  if (!host) return;
  const students = await getData(CDAD_KEYS.STUDENTS);
  const groups = await getData(CDAD_KEYS.GROUPS);
  const projects = await getData(CDAD_KEYS.PROJECTS);
  const requests = await getData(CDAD_KEYS.REQUESTS);
  const peerRequests = await allStudentRequests();
  const activeProjects = projects.filter((p) => p.status !== 'Completed').length;
  const completedProjects = projects.filter((p) => p.status === 'Completed').length;
  const pendingRequests = requests.filter((r) => r.status === 'Pending').length + peerRequests.filter((r) => r.status === 'Pending').length;

  host.innerHTML = `
    <div class="stat-tile"><div class="stat-tile__label">Total Students</div><div class="stat-tile__value">${students.length}</div><div class="stat-tile__sub">${students.filter(s=>s.status==='Active').length} active</div></div>
    <div class="stat-tile stat-tile--blue"><div class="stat-tile__label">Total Groups</div><div class="stat-tile__value">${groups.length}</div><div class="stat-tile__sub">${groups.filter(g=>g.status==='Active').length} active</div></div>
    <div class="stat-tile stat-tile--teal"><div class="stat-tile__label">Active Projects</div><div class="stat-tile__value">${activeProjects}</div><div class="stat-tile__sub">${completedProjects} completed</div></div>
    <div class="stat-tile stat-tile--rose"><div class="stat-tile__label">Pending Requests</div><div class="stat-tile__value">${pendingRequests}</div><div class="stat-tile__sub">across all types</div></div>`;

  // Group progress chart
  const chartHost = document.getElementById('groupProgressChart');
  if (chartHost) {
    chartHost.innerHTML = groups.length ? groups.map((g) => `
      <div class="bar-row">
        <div class="bar-row__label">${escapeHtml(g.displayId)} &middot; ${escapeHtml(g.name)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${g.progress || 0}%"></div></div>
        <div class="bar-row__value">${g.progress || 0}%</div>
      </div>`).join('') : emptyState('No groups yet.');
  }

  // Project status donut-ish legend (css bars as substitute)
  const statusHost = document.getElementById('projectStatusChart');
  if (statusHost) {
    const byStatus = {};
    projects.forEach((p) => { byStatus[p.status] = (byStatus[p.status] || 0) + 1; });
    const total = projects.length || 1;
    statusHost.innerHTML = Object.keys(byStatus).length ? Object.entries(byStatus).map(([status, count]) => `
      <div class="bar-row">
        <div class="bar-row__label">${escapeHtml(status)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round((count/total)*100)}%"></div></div>
        <div class="bar-row__value">${count}</div>
      </div>`).join('') : emptyState('No projects yet.');
  }
}

