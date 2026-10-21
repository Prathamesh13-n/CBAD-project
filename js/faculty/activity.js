/* ================= Activity Log (Section 15) ================= */
async function renderActivity() {
  const host = document.getElementById('activityList');
  if (!host) return;
  const list = await getData(CDAD_KEYS.ACTIVITY);
  host.innerHTML = list.length ? list.map((a) => `
    <div class="activity-item">
      <div class="activity-dot"></div>
      <div>
        <div>${escapeHtml(a.text)}</div>
        <div class="activity-item__time">${formatDateTime(a.date)}</div>
      </div>
    </div>`).join('') : emptyState('No activity recorded yet.');
}

