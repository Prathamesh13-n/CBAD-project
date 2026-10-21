/* ================= Utility ================= */
function emptyState(msg) {
  return `<div class="empty-state"><div class="empty-state__icon">—</div><p>${escapeHtml(msg)}</p></div>`;
}
