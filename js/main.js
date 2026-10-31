// 墨读 · 启动
import { loadSettings, saveSettings, applySettings } from './store.js';
import { initShelf, setBooks, render as renderShelf } from './shelf.js';
import { initReader, openBook } from './reader.js';
import { initComic, openComic } from './comic.js';
import { listComics, importComics } from './comics.js';
import { toast } from './ui.js';

const S = loadSettings();
applySettings(S);

let books = [];
const coverUrls = new Map();

function withCover(c) {
  if (c.cover && typeof c.cover === 'object') {
    if (!coverUrls.has(c.id)) coverUrls.set(c.id, URL.createObjectURL(c.cover));
    return Object.assign({}, c, { cover: coverUrls.get(c.id) });
  }
  return c;
}

async function refreshShelf() {
  let comics = [];
  try { comics = await listComics(); } catch (e) { comics = []; }
  setBooks([...comics.map(withCover), ...books]);
}

async function boot() {
  let index;
  try {
    const res = await fetch('assets/books/index.json', { cache: 'no-cache' });
    index = await res.json();
  } catch (e) {
    document.getElementById('shelf-sub').textContent = '书库加载失败，请用 http 方式打开';
    return;
  }
  books = index;

  initShelf((b) => openItem(b), openImport);
  initReader({ onExit: () => refreshShelf() });
  initComic({ onExit: () => refreshShelf() });
  await refreshShelf();

  document.addEventListener('comics:changed', () => refreshShelf());
  document.getElementById('btn-more').addEventListener('click', toggleTheme);
  document.getElementById('btn-import').addEventListener('click', openImport);
  bindImport();
  iosHint();
  registerSW();
}

function openItem(b) {
  if (b.kind === 'comic') openComic(b);
  else openBook(b);
}

/* ───────── 导入 ───────── */

function openImport() {
  document.getElementById('import-sheet').classList.add('on');
  document.getElementById('mask').classList.add('on');
}

function closeImport() {
  document.getElementById('import-sheet').classList.remove('on');
  document.getElementById('mask').classList.remove('on');
}

function bindImport() {
  const sheet = document.getElementById('import-sheet');
  const mask = document.getElementById('mask');
  const fz = document.getElementById('file-zip');
  const fi = document.getElementById('file-img');
  const fd = document.getElementById('file-dir');

  document.getElementById('import-cancel').addEventListener('click', closeImport);
  mask.addEventListener('click', () => {
    closeImport();
    document.getElementById('panel')?.classList.remove('on');
  });
  document.getElementById('pick-zip').addEventListener('click', () => { closeImport(); fz.click(); });
  document.getElementById('pick-img').addEventListener('click', () => {
    closeImport();
    // 桌面浏览器优先用「选文件夹」，iOS 上没有目录选择器，退回多选图片
    if (fd && !/iphone|ipad|ipod/i.test(navigator.userAgent)) fd.click();
    else fi.click();
  });
  fz.addEventListener('change', () => fz.files.length && doImport(fz.files, fz));
  fi.addEventListener('change', () => fi.files.length && doImport(fi.files, fi));
  fd.addEventListener('change', () => fd.files.length && doImport(fd.files, fd));
  void sheet;
}

async function doImport(files, input) {
  const list = Array.from(files);
  if (!list.length) return;
  const ov = progressOverlay(list.length === 1 ? list[0].name : `${list.length} 个文件`);
  try {
    const made = await importComics(list, (done, total, label) => setOverlay(ov, done, total, label));
    ov.remove();
    if (made.length) toast(`导入完成：《${made[0].title}》${made[0].pageCount} 页`);
    await refreshShelf();
  } catch (e) {
    ov.remove();
    toast('导入失败：' + (e.message || e));
  } finally {
    try { input.value = ''; } catch (e) {}
  }
}

function progressOverlay(title) {
  const el = document.createElement('div');
  el.className = 'imp-ov';
  el.innerHTML = `
    <div class="imp-box">
      <b>正在导入</b>
      <i class="imp-title">${title}</i>
      <div class="imp-bar"><span></span></div>
      <em class="imp-num">0%</em>
    </div>`;
  document.body.appendChild(el);
  return el;
}

function setOverlay(el, done, total, label) {
  const pct = Math.round((done / Math.max(1, total)) * 100);
  el.querySelector('.imp-bar span').style.width = pct + '%';
  el.querySelector('.imp-num').textContent = pct + '%';
  if (label) el.querySelector('.imp-title').textContent = label;
}

/* 书架右上角：日间 / 夜间 一键切换 */
function toggleTheme() {
  S.theme = S.theme === 'night' ? 'paper' : 'night';
  saveSettings(S);
  applySettings(S);
  toast(S.theme === 'night' ? '已切换到夜间模式' : '已切换到日间模式');
}

/* iOS Safari 添加到主屏幕提示 */
function iosHint() {
  const ua = navigator.userAgent;
  const isIOS = /iphone|ipad|ipod/i.test(ua);
  const standalone =
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  if (!isIOS || standalone) return;
  if (localStorage.getItem('modu.hint') === '1') return;

  const el = document.createElement('div');
  el.className = 'hint';
  el.innerHTML =
    '<span>把<b>墨读</b>装到桌面：点底部 <b>分享</b> → <b>添加到主屏幕</b></span>' +
    '<button class="x" aria-label="关闭">✕</button>';
  document.body.appendChild(el);
  el.querySelector('.x').addEventListener('click', () => {
    el.remove();
    localStorage.setItem('modu.hint', '1');
  });
  setTimeout(() => el.classList.add('fade'), 9000);
}

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}

boot();