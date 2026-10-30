// 墨读 · 设置与进度持久化
const SKEY = 'modu.settings.v1';
const PKEY = 'modu.progress.v1';

export const DEFAULTS = { fontSize: 17, lineHeight: 1.85, font: 'song', theme: 'paper' };
const THEME_COLOR = { paper: '#F6F3EC', sepia: '#EFE4CE', green: '#CFE3D2', night: '#131312' };

export function loadSettings() {
  try {
    return Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(SKEY) || '{}'));
  } catch (e) {
    return Object.assign({}, DEFAULTS);
  }
}

export function saveSettings(s) {
  try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch (e) {}
}

export function applySettings(s) {
  const r = document.documentElement;
  r.dataset.theme = s.theme;
  r.dataset.font = s.font;
  r.style.setProperty('--fs', s.fontSize + 'px');
  r.style.setProperty('--lh', String(s.lineHeight));
  const m = document.querySelector('meta[name="theme-color"]');
  if (m) m.setAttribute('content', THEME_COLOR[s.theme] || '#F6F3EC');
  // iOS 独立模式的状态栏：浅色主题用深色字，夜间用浅色字
  const sb = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]');
  if (sb) sb.setAttribute('content', s.theme === 'night' ? 'black-translucent' : 'default');
}

function readAll() {
  try { return JSON.parse(localStorage.getItem(PKEY) || '{}'); } catch (e) { return {}; }
}

export function getProgress(id) { return readAll()[id] || null; }
export function allProgress() { return readAll(); }

export function setProgress(id, p) {
  try {
    const a = readAll();
    a[id] = Object.assign({}, p, { at: Date.now() });
    localStorage.setItem(PKEY, JSON.stringify(a));
  } catch (e) {}
}

export function lastBookId() {
  const a = readAll();
  let best = null, t = 0;
  for (const k in a) if (a[k].at > t) { t = a[k].at; best = k; }
  return best;
}