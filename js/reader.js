// 墨读 · 阅读器（CSS 多栏分页）
import { getProgress, setProgress, loadSettings, saveSettings, applySettings } from './store.js';
import { toast, esc } from './ui.js';

const $ = (s) => document.querySelector(s);

let S = loadSettings();
let book = null;
let chIdx = 0, pageIdx = 0, pageCount = 1;
let W = 0, H = 0, padX = 26, padT = 0, padB = 0;
let uiOn = false;
let el = {};
let cache = new Map();
let saveT = 0;
let onExit = null;
let curTocNode = null;

/* ───────────── 初始化 ───────────── */
export function initReader(opts = {}) {
  onExit = opts.onExit;
  el.reader = $('#reader');
  el.viewport = $('#viewport');
  el.clip = $('#clip');
  el.flow = $('#flow');
  el.top = $('#rd-top');
  el.bottom = $('#rd-bottom');
  el.book = $('#rd-book');
  el.chapter = $('#rd-chapter');
  el.count = $('#rd-count');
  el.page = $('#rd-page');
  el.slider = $('#rd-slider');

  bindUI();
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', () => setTimeout(onResize, 260));
}

/* ───────────── 打开 / 关闭 ───────────── */
export async function openBook(meta) {
  el.reader.classList.add('on');
  $('#shelf').classList.remove('on');
  el.book.textContent = meta.title;

  let data = cache.get(meta.id);
  if (!data) {
    const res = await fetch('assets/books/' + meta.id + '.json');
    data = await res.json();
    cache.set(meta.id, data);
  }
  book = data;

  layout();
  const p = getProgress(meta.id);
  chIdx = p ? Math.min(p.ch || 0, book.chapters.length - 1) : 0;
  renderChapter(chIdx, { page: p ? p.page || 0 : 0 });

  el.slider.max = String(book.chapters.length - 1);
  el.slider.value = String(chIdx);
  buildTOC();
  setUI(false);
  hintTools();
}

/* 第一次打开书时让工具栏闪现 2 秒：告诉用户「点一下中间能呼出返回/目录/字体」 */
function hintTools() {
  try {
    if (localStorage.getItem('modu.tools_hint')) return;
    localStorage.setItem('modu.tools_hint', '1');
  } catch (e) { return; }
  setTimeout(() => {
    if (!el.reader.classList.contains('on') || uiOn) return;
    setUI(true);
    setTimeout(() => {
      const busy = $('#panel').classList.contains('on') || $('#toc').classList.contains('on');
      if (!busy) setUI(false);
    }, 2000);
  }, 600);
}

export function closeBook() {
  flushSave();
  el.reader.classList.remove('on');
  $('#shelf').classList.add('on');
  el.flow.innerHTML = '';
  book = null;
  setUI(false);
  closeDrawer();
  closePanel();
  if (onExit) onExit();
}

/* ───────────── 版面 ───────────── */
function pxVar(name) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return parseFloat(v) || 0;
}

function layout() {
  const sat = pxVar('--sat'), sab = pxVar('--sab');
  const box = el.viewport.getBoundingClientRect();
  padX = 26;
  padT = sat + 58;
  padB = sab + 56;
  W = Math.round(box.width - padX * 2);
  // 版心高度对齐到「整行」，避免最后一行被切一半
  const lh = S.fontSize * S.lineHeight;
  H = Math.max(lh * 4, Math.floor((box.height - padT - padB) / lh) * lh);

  el.clip.style.left = padX + 'px';
  el.clip.style.top = padT + 'px';
  el.clip.style.width = W + 'px';
  el.clip.style.height = H + 'px';

  const f = el.flow.style;
  f.width = W + 'px';
  f.height = H + 'px';
  f.columnWidth = W + 'px';
  f.columnGap = '0px';
  f.fontSize = S.fontSize + 'px';
  f.lineHeight = String(S.lineHeight);
}

/* ───────────── 渲染 ───────────── */
function renderChapter(i, opts = {}) {
  const dir = opts.dir || 0;
  const ch = book.chapters[i];
  chIdx = i;
  el.chapter.textContent = ch.t;

  const f = el.flow.style;
  f.transition = 'none';
  el.flow.innerHTML =
    '<h2 class="ch-title">' + esc(ch.t) + '</h2>' +
    ch.p.map((t) => '<p>' + esc(t) + '</p>').join('');
  f.transform = 'translateX(0px)';
  void el.flow.offsetWidth;

  pageCount = measurePages();
  pageIdx = Math.max(0, Math.min(pageCount - 1, opts.page || 0));

  const target = -pageIdx * W;
  if (dir) {
    const start = target + dir * W;
    f.transform = 'translateX(' + start + 'px)';
    void el.flow.offsetWidth;
    requestAnimationFrame(() => {
      f.transition = 'transform .24s cubic-bezier(.22,.61,.36,1)';
      f.transform = 'translateX(' + target + 'px)';
    });
  } else {
    f.transform = 'translateX(' + target + 'px)';
  }

  markToc();
  updateMeta();
  save();
}

function measurePages() {
  let n = Math.round(el.flow.scrollWidth / W);
  if (!isFinite(n) || n < 1) n = 1;

  const origin = el.flow.getBoundingClientRect().left;
  let maxRight = 0;
  const kids = el.flow.children;
  for (let i = 0; i < kids.length; i++) {
    const r = kids[i].getBoundingClientRect();
    if (r.width > 0) maxRight = Math.max(maxRight, r.right - origin);
  }
  if (maxRight > 0) n = Math.max(n, Math.ceil((maxRight - 2) / W));
  return Math.max(1, n);
}

function goPage(n) {
  pageIdx = Math.max(0, Math.min(pageCount - 1, n));
  el.flow.style.transition = 'transform .23s cubic-bezier(.22,.61,.36,1)';
  el.flow.style.transform = 'translateX(' + -pageIdx * W + 'px)';
  updateMeta();
  save();
}

function turn(dir) {
  if (!book) return;
  if (dir > 0) {
    if (pageIdx < pageCount - 1) return goPage(pageIdx + 1);
    if (chIdx < book.chapters.length - 1) return renderChapter(chIdx + 1, { page: 0, dir: 1 });
    return toast('已经是最后一页了');
  }
  if (pageIdx > 0) return goPage(pageIdx - 1);
  if (chIdx > 0) return renderChapter(chIdx - 1, { page: 99999, dir: -1 });
  toast('已经是第一页了');
}

function updateMeta() {
  if (!book) return;
  el.count.textContent = '第 ' + (chIdx + 1) + ' / ' + book.chapters.length + ' 章';
  el.page.textContent = pageIdx + 1 + ' / ' + pageCount;
  el.slider.value = String(chIdx);
}

/* ───────────── 进度 ───────────── */
function save() {
  if (!book) return;
  clearTimeout(saveT);
  saveT = setTimeout(flushSave, 200);
}

function flushSave() {
  if (!book) return;
  const total = book.chapters.length;
  const percent = Math.min(1, (chIdx + (pageIdx + 1) / pageCount) / total);
  setProgress(book.id, {
    ch: chIdx,
    chapterTitle: book.chapters[chIdx].t,
    page: pageIdx,
    pages: pageCount,
    percent: percent,
  });
}

/* ───────────── 工具栏 / 抽屉 ───────────── */
function setUI(on) {
  uiOn = on;
  el.top.classList.toggle('show', on);
  el.bottom.classList.toggle('show', on);
}

function bindUI() {
  $('#rd-back').addEventListener('click', closeBook);
  $('#rd-more').addEventListener('click', () => { setUI(false); openDrawer(); });
  $('#rd-more').setAttribute('aria-label', '目录');

  el.slider.addEventListener('change', () => {
    const i = +el.slider.value;
    renderChapter(i, { page: 0 });
    setUI(true);
  });

  document.querySelectorAll('.rd-tools .tool').forEach((btn) => {
    btn.addEventListener('click', () => {
      const act = btn.dataset.act;
      if (act === 'toc') { setUI(false); openDrawer(); }
      else if (act === 'prev') jumpChapter(-1);
      else if (act === 'next') jumpChapter(1);
      else if (act === 'style') openPanel('font');
      else if (act === 'theme') openPanel('theme');
    });
  });

  $('#mask').addEventListener('click', () => { closeDrawer(); closePanel(); });
  $('#panel-done').addEventListener('click', closePanel);

  // 设置项
  const fsEl = $('#opt-fs');
  fsEl.value = String(S.fontSize);
  fsEl.addEventListener('input', () => updateSetting('fontSize', +fsEl.value));

  document.querySelectorAll('#opt-lh button').forEach((b) =>
    b.addEventListener('click', () => updateSetting('lineHeight', +b.dataset.v)));
  document.querySelectorAll('#opt-font button').forEach((b) =>
    b.addEventListener('click', () => updateSetting('font', b.dataset.v)));
  document.querySelectorAll('#opt-theme button').forEach((b) =>
    b.addEventListener('click', () => updateSetting('theme', b.dataset.v)));

  syncControls();
  bindGestures();
}

function jumpChapter(d) {
  const i = chIdx + d;
  if (i < 0 || i >= book.chapters.length) return toast(d > 0 ? '已经是最后一章' : '已经是第一章');
  renderChapter(i, { page: 0 });
  setUI(true);
}

function syncControls() {
  $('#opt-fs').value = String(S.fontSize);
  document.querySelectorAll('#opt-lh button').forEach((b) =>
    b.classList.toggle('on', Math.abs(+b.dataset.v - S.lineHeight) < 0.01));
  document.querySelectorAll('#opt-font button').forEach((b) =>
    b.classList.toggle('on', b.dataset.v === S.font));
  document.querySelectorAll('#opt-theme button').forEach((b) =>
    b.classList.toggle('on', b.dataset.v === S.theme));
}

function updateSetting(k, v) {
  S[k] = v;
  saveSettings(S);
  applySettings(S);
  syncControls();
  if (k === 'theme') return;
  relayout();
}

function relayout() {
  if (!book) return;
  const ratio = pageCount > 1 ? pageIdx / (pageCount - 1) : 0;
  layout();
  renderChapter(chIdx, { page: 0 });
  pageIdx = Math.max(0, Math.min(pageCount - 1, Math.round(ratio * (pageCount - 1))));
  el.flow.style.transition = 'none';
  el.flow.style.transform = 'translateX(' + -pageIdx * W + 'px)';
  updateMeta();
  save();
}

function openDrawer() {
  $('#toc').classList.add('on');
  $('#mask').classList.add('on');
  const cur = document.querySelector('#toc-list .dr-item.cur');
  if (cur) cur.scrollIntoView({ block: 'center' });
}

function closeDrawer() {
  $('#toc').classList.remove('on');
  if (!$('#panel').classList.contains('on')) $('#mask').classList.remove('on');
}

function openPanel(which) {
  $('#panel').classList.add('on');
  $('#mask').classList.add('on');
  if (which === 'font') {
    $('#opt-fs').focus({ preventScroll: true });
  }
}

function closePanel() {
  $('#panel').classList.remove('on');
  if (!$('#toc').classList.contains('on')) $('#mask').classList.remove('on');
}

function buildTOC() {
  const list = $('#toc-list');
  $('#toc-count').textContent = book.chapters.length + ' 章';
  const frag = document.createDocumentFragment();
  book.chapters.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'dr-item';
    b.dataset.i = String(i);
    b.innerHTML = '<small>' + String(i + 1).padStart(2, '0') + '</small>' + esc(c.t);
    b.addEventListener('click', () => {
      renderChapter(i, { page: 0 });
      closeDrawer();
      setUI(false);
    });
    frag.appendChild(b);
  });
  list.innerHTML = '';
  list.appendChild(frag);
  curTocNode = null;
  markToc();
}

function markToc() {
  const list = $('#toc-list');
  if (!list || !list.children.length) return;
  if (curTocNode) curTocNode.classList.remove('cur');
  curTocNode = list.children[chIdx] || null;
  if (curTocNode) curTocNode.classList.add('cur');
}

/* ───────────── 手势 ───────────── */
function bindGestures() {
  const vp = el.viewport;
  let sx = 0, sy = 0, t0 = 0, baseX = 0, dragging = false;

  vp.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1 || !book) return;
    const t = e.touches[0];
    sx = t.clientX; sy = t.clientY;
    t0 = Date.now();
    dragging = false;
    baseX = -pageIdx * W;
    el.flow.style.transition = 'none';
  }, { passive: true });

  vp.addEventListener('touchmove', (e) => {
    if (!book || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (!dragging) {
      if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.1) dragging = true;
      else return;
    }
    e.preventDefault();
    let d = dx;
    const atStart = chIdx === 0 && pageIdx === 0;
    const atEnd = chIdx === book.chapters.length - 1 && pageIdx === pageCount - 1;
    if ((atStart && d > 0) || (atEnd && d < 0)) d *= 0.28;
    el.flow.style.transform = 'translateX(' + (baseX + d) + 'px)';
  }, { passive: false });

  vp.addEventListener('touchend', (e) => {
    if (!book) return;
    const t = e.changedTouches[0];
    if (!dragging) {
      const dt = Date.now() - t0;
      if (dt < 420 && Math.abs(t.clientX - sx) < 10 && Math.abs(t.clientY - sy) < 10) {
        el.flow.style.transition = '';
        return handleTap(t.clientX);
      }
      el.flow.style.transition = '';
      return;
    }
    const dx = t.clientX - sx;
    el.flow.style.transition = '';
    dragging = false;
    if (dx < -46) turn(1);
    else if (dx > 46) turn(-1);
    else goPage(pageIdx);
  }, { passive: true });

  // 桌面/调试用键盘
  window.addEventListener('keydown', (e) => {
    if (!el.reader.classList.contains('on')) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); turn(1); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); turn(-1); }
    if (e.key === 'Escape') closeBook();
  });
}

function handleTap(x) {
  if (uiOn) return setUI(false);
  const box = el.viewport.getBoundingClientRect();
  const r = (x - box.left) / box.width;
  if (r < 0.3) return turn(-1);
  if (r > 0.7) return turn(1);
  setUI(true);
}

/* ───────────── 尺寸变化 ───────────── */
function onResize() {
  if (!book || !el.reader.classList.contains('on')) return;
  relayout();
}

export function getSettings() { return S; }