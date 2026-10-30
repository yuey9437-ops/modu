// 墨读 · 小工具
let tEl = null, tTimer = 0;

export function toast(msg, ms = 1600) {
  if (!tEl) tEl = document.getElementById('toast');
  if (!tEl) return;
  tEl.textContent = msg;
  tEl.classList.add('on');
  clearTimeout(tTimer);
  tTimer = setTimeout(() => tEl.classList.remove('on'), ms);
}

export const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));