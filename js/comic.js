// 墨读 · 漫画阅读器（页漫：左右翻页 + 双指放大）
import { getComic, getPageBlob, deleteComic } from './comics.js';
import { getProgress, setProgress } from './store.js';
import { toast } from './ui.js';

const $ = (s) => document.querySelector(s);
const CKEY = 'modu.comic.v1';
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

let meta = null;
let page = 0;
let scale = 1, tx = 0, ty = 0;
let urls = new Map();       // page -> objectURL
let onExit = null;
let shown = false;
let hideTimer = 0;

function cfg() {
  try { return Object.assign({ rtl: false, bg: 'auto' }, JSON.parse(localStorage.getItem(CKEY) || '{}')); } catch (e) { return { rtl: false, bg: 'auto' }; }
}

const BG_MODES = [
  { k: 'auto',  t: '背景：自动（跟页面底色）' },
  { k: 'dark',  t: '背景：纯黑' },
  { k: 'white', t: '背景：纯白' },
  { k: 'paper', t: '背景：米黄' }
];

/* 取页面外圈颜色当背景，让「填不满」的黑边消失 */
const bgCanvas = document.createElement('canvas');
function sampleColor(img) {
  try {
    const S = 32;
    bgCanvas.width = S; bgCanvas.height = S;
    const ctx = bgCanvas.getContext('2d', { willReadFrequently: true });
    ctx.clearRect(0, 0, S, S);
    ctx.drawImage(img, 0, 0, S, S);
    const d = ctx.getImageData(0, 0, S, S).data;
    // 取四个角各 3x3 的小块——页边空白几乎总在这里，最接近真实底色
    const blocks = [[0, 0], [S - 3, 0], [0, S - 3], [S - 3, S - 3]];
    let r = 0, g = 0, b = 0, n = 0;
    for (const [bx, by] of blocks) {
      for (let y = by; y < by + 3; y++) {
        for (let x = bx; x < bx + 3; x++) {
          const i = (y * S + x) * 4;
          if (d[i + 3] < 8) continue;
          r += d[i]; g += d[i + 1]; b += d[i + 2]; n++;
        }
      }
    }
    if (!n) return null;
    r /= n; g /= n; b /= n;
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    if (lum > 240) return '#FFFFFF';
    if (lum < 18) return '#0B0B0C';
    return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
  } catch (e) { return null; }
}

function applyBg(img) {
  const el = $('#comic');
  const mode = cfg().bg || 'auto';
  el.dataset.bg = mode;
  el.style.removeProperty('--cm-bg');
  if (mode === 'auto') {
    const c = img && img.naturalWidth ? sampleColor(img) : null;
    if (c) el.style.setProperty('--cm-bg', c);
  }
}
function saveCfg(c) { try { localStorage.setItem(CKEY, JSON.stringify(c)); } catch (e) {} }

export function initComic(opts = {}) {
  onExit = opts.onExit || null;
  bindUi();
}

/* ───────── 打开 / 关闭 ───────── */

export async function openComic(m) {
  if (meta && meta.id === m.id) { page = page; } else { page = 0; }
  meta = m;
  const p = getProgress(m.id);
  if (p && Number.isInteger(p.page) && p.page < m.pageCount) page = p.page;

  applyBg(null);
  $('#cm-slider').max = String(Math.max(0, m.pageCount - 1));
  $('#comic').classList.add('on');
  shown = true;
  reset(1);
  await show(page, 0);
  hint();
}

export function closeComic() {
  $('#comic').classList.remove('on');
  shown = false;
  releaseAll();
  meta = null;
  if (onExit) onExit();
}

/* ───────── 翻页 ───────── */

async function show(i, dir = 0) {
  if (!meta) return;
  page = clamp(i, 0, meta.pageCount - 1);
  const img = $('#cm-img');
  const url = await pageUrl(page);
  if (!url) { toast('这一页读取失败'); return; }
  img.classList.remove('in');
  img.src = url;
  await new Promise((r) => {
    if (img.complete && img.naturalWidth) return r();
    img.onload = img.onerror = () => r();
  });
  img.classList.add('in');
  applyBg(img);
  reset(1);
  updateUi();
  saveProgress();
  preload();
}

async function pageUrl(i) {
  if (urls.has(i)) return urls.get(i);
  const rec = await getPageBlob(meta.id, i);
  if (!rec || !rec.blob) return null;
  const u = URL.createObjectURL(rec.blob);
  urls.set(i, u);
  return u;
}

function preload() {
  if (!meta) return;
  for (const d of [1, -1, 2, -2]) {
    const i = page + d;
    if (i >= 0 && i < meta.pageCount) pageUrl(i);
  }
  // 释放远处的
  for (const [i, u] of urls) {
    if (Math.abs(i - page) > 3) { URL.revokeObjectURL(u); urls.delete(i); }
  }
}

function releaseAll() {
  for (const u of urls.values()) URL.revokeObjectURL(u);
  urls.clear();
  $('#cm-img').removeAttribute('src');
}

function turn(d) {
  if (!meta) return;
  const r = cfg().rtl ? -d : d;
  const next = page + r;
  if (next < 0 || next >= meta.pageCount) {
    toast(r < 0 ? '已经是第一页' : '已经是最后一页');
    return;
  }
  animateTurn(r);
  show(next, r);
}

function animateTurn(r) {
  const stage = $('#cm-stage');
  stage.style.setProperty('--tx', (r > 0 ? -18 : 18) + 'px');
  stage.classList.remove('turn');
  void stage.offsetWidth;
  stage.classList.add('turn');
}

/* ───────── 缩放 / 位移 ───────── */

function apply() {
  const img = $('#cm-img');
  img.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  img.classList.toggle('zoomed', scale > 1.01);
}

function reset(s = 1) {
  scale = s; tx = 0; ty = 0;
  apply();
}

function zoomAt(px, py, s2) {
  const stage = $('#cm-stage').getBoundingClientRect();
  const cx = stage.width / 2, cy = stage.height / 2;
  const mx = px - cx, my = py - cy;      // 相对中心
  s2 = clamp(s2, 1, 5);
  tx = mx - (mx - tx) * (s2 / scale);
  ty = my - (my - ty) * (s2 / scale);
  scale = s2;
  clampPan();
  apply();
}

function clampPan() {
  const stage = $('#cm-stage').getBoundingClientRect();
  const maxX = (stage.width * (scale - 1)) / 2;
  const maxY = (stage.height * (scale - 1)) / 2;
  tx = clamp(tx, -maxX, maxX);
  ty = clamp(ty, -maxY, maxY);
}

/* ───────── 手势 ───────── */

let g = null;

let uiBound = false;

function bindUi() {
  if (uiBound) return;          // 只绑一次（initComic 可能被调用多次）
  uiBound = true;
  const stage = $('#cm-stage');

  stage.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      const [a, b] = e.touches;
      g = { mode: 'pinch', d0: dist(a, b), s0: scale, mx: (a.clientX + b.clientX) / 2, my: (a.clientY + b.clientY) / 2, t0: Date.now() };
    } else if (e.touches.length === 1) {
      g = { mode: 'tap', x0: e.touches[0].clientX, y0: e.touches[0].clientY, t0: Date.now(), moved: 0, pan: scale > 1, last: null };
    }
  }, { passive: true });

  stage.addEventListener('touchmove', (e) => {
    if (!g) return;
    if (g.mode === 'pinch' && e.touches.length === 2) {
      const [a, b] = e.touches;
      const s2 = g.s0 * (dist(a, b) / (g.d0 || 1));
      zoomAt((a.clientX + b.clientX) / 2, (a.clientY + b.clientY) / 2, s2);
      e.preventDefault();
    } else if (g.mode === 'tap' && e.touches.length === 1) {
      const t = e.touches[0];
      const dx = t.clientX - g.x0, dy = t.clientY - g.y0;
      g.moved = Math.max(g.moved, Math.hypot(dx, dy));
      if (g.pan || scale > 1) {
        const prev = g.last || { x: t.clientX, y: t.clientY };
        tx += t.clientX - prev.x;
        ty += t.clientY - prev.y;
        g.last = { x: t.clientX, y: t.clientY };
        clampPan(); apply();
        e.preventDefault();
      }
    }
  }, { passive: false });

  stage.addEventListener('touchend', (e) => {
    if (!g) return;
    const gg = g;
    g = null;
    if (gg.mode === 'pinch') {
      if (scale < 1.05) reset(1);
      return;
    }
    const dt = Date.now() - gg.t0;
    // 双指捏合后抬起一根手指：不当作点击
    if (e.touches.length > 0) return;

    if (scale > 1.02) {
      if (gg.moved < 6 && dt < 300) reset(1);  // 放大状态轻点 = 还原
      return;
    }

    if (dt < 300 && gg.moved < 30) {
      // 轻点：按 x 分三块
      const x = gg.x0, w = window.innerWidth;
      if (x < w * 0.28) turn(-1);
      else if (x > w * 0.72) turn(1);
      else toggleUi();
      return;
    }
    // 滑动
    const dx = (e.changedTouches[0]?.clientX ?? gg.x0) - gg.x0;
    if (Math.abs(dx) > 45) turn(dx < 0 ? 1 : -1);
  });

  // 桌面：滚轮 / 方向键
  stage.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) < 2) return;
    if (scale > 1) return;
    turn(e.deltaY > 0 ? 1 : -1);
  }, { passive: true });

  document.addEventListener('keydown', (e) => {
    if (!shown) return;
    if (e.key === 'ArrowRight') turn(1);
    else if (e.key === 'ArrowLeft') turn(-1);
    else if (e.key === 'Escape') closeComic();
  });

  $('#cm-back').addEventListener('click', closeComic);
  $('#cm-slider').addEventListener('input', (e) => {
    const i = Number(e.target.value);
    if (Number.isInteger(i)) show(i);
  });
  $('#cm-bg').addEventListener('click', () => {
    const c = cfg();
    const i = BG_MODES.findIndex((m) => m.k === (c.bg || 'auto'));
    const nx = BG_MODES[(i + 1) % BG_MODES.length];
    c.bg = nx.k; saveCfg(c);
    applyBg($('#cm-img'));
    toast(nx.t);
  });

  document.querySelectorAll('[data-cm]').forEach((b) => {
    b.addEventListener('click', async () => {
      const k = b.dataset.cm;
      if (k === 'first') show(0);
      else if (k === 'last') show(meta.pageCount - 1);
      else if (k === 'prev') turn(-1);
      else if (k === 'next') turn(1);
      else if (k === 'rtl') {
        const c = cfg(); c.rtl = !c.rtl; saveCfg(c);
        toast(c.rtl ? '从右往左翻（日漫）' : '从左往右翻');
        updateUi();
      } else if (k === 'del') {
        if (!confirm(`从书架删除《${meta.title}》？页图会一起清掉，不可恢复。`)) return;
        const id = meta.id;
        $('#comic').classList.remove('on');
        shown = false; releaseAll(); meta = null;
        await deleteComic(id);
        toast('已删除');
        if (onExit) onExit();
      }
    });
  });
}

function dist(a, b) {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

/* ───────── UI ───────── */

function updateUi() {
  if (!meta) return;
  $('#cm-page').textContent = `${page + 1} / ${meta.pageCount}`;
  $('#cm-slider').value = String(page);
  $('#cm-count').textContent = meta.title;
  $('#cm-count2').textContent = `第 ${page + 1} 页`;
  $('#cm-sub').textContent = cfg().rtl ? '右 ← 左' : '左 → 右';
}

function toggleUi() {
  const on = $('#comic').classList.toggle('ui');
  clearTimeout(hideTimer);
  if (on) hideTimer = setTimeout(() => $('#comic').classList.remove('ui'), 3600);
}

export function hideUi() {
  $('#comic').classList.remove('ui');
  clearTimeout(hideTimer);
}

function hint() {
  // 第一次打开：闪一下工具条，告诉人哪里能点
  if (localStorage.getItem('modu.comic_hint') === '1') return;
  localStorage.setItem('modu.comic_hint', '1');
  $('#comic').classList.add('ui');
  hideTimer = setTimeout(() => $('#comic').classList.remove('ui'), 2600);
}

function saveProgress() {
  if (!meta) return;
  setProgress(meta.id, {
    page,
    percent: (page + 1) / meta.pageCount,
    ch: 0,
    chapterTitle: `第 ${page + 1} 页`,
    kind: 'comic',
  });
}