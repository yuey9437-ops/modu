// 墨读 · 启动
import { loadSettings, saveSettings, applySettings } from './store.js';
import { initShelf, render as renderShelf } from './shelf.js';
import { initReader, openBook } from './reader.js';
import { toast } from './ui.js';

const S = loadSettings();
applySettings(S);

let books = [];

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

  initShelf(books, (b) => openBook(b));
  initReader({ onExit: () => renderShelf() });

  document.getElementById('btn-more').addEventListener('click', toggleTheme);
  iosHint();
  registerSW();
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