// 墨读 · 书架
import { allProgress, lastBookId } from './store.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let items = [];
let onOpen = null;
let onImport = null;

export function initShelf(openCb, importCb) {
  onOpen = openCb;
  onImport = importCb || null;
  render();
}

export function setBooks(list) {
  items = list || [];
  render();
}

export function render() {
  const prog = allProgress();
  const done = items.filter((b) => prog[b.id] && prog[b.id].percent > 0.995).length;
  const comics = items.filter((b) => b.kind === 'comic').length;
  $('#shelf-sub').textContent = items.length
    ? `共 ${items.length} 本${comics ? ` · 漫画 ${comics}` : ''} · 读毕 ${done} 本`
    : '书架还空着，导入一本漫画试试';

  renderContinue(prog);
  renderGrid(prog);
}

function metaLine(b, p) {
  if (b.kind === 'comic') {
    const pct = Math.round((p?.percent || 0) * 100);
    return p ? `已读${pct}% · 第 ${(p.page || 0) + 1} / ${b.pageCount} 页` : `漫画 · 共 ${b.pageCount} 页`;
  }
  return p ? `已读 ${Math.round((p.percent || 0) * 100)}% · 第 ${p.ch + 1} 章` : `${b.author} · 共 ${b.chapters} 章`;
}

function renderContinue(prog) {
  const host = $('#continue-card');
  const last = lastBookId();
  const book = items.find((b) => b.id === last) || items[0];
  if (!book) { host.innerHTML = ''; return; }
  const p = prog[book.id];
  const pct = p ? Math.round((p.percent || 0) * 100) : 0;
  const kicker = p ? '继续阅读' : '开始阅读';
  const sub = b_sub(book, p);

  host.innerHTML = `
    <div class="cont" role="button" tabindex="0" data-id="${esc(book.id)}">
      <div class="cv"><img src="${esc(book.cover)}" alt=""></div>
      <div class="txt">
        <div class="kicker">${kicker}</div>
        <div class="tt">${esc(book.title)}</div>
        <div class="cc">${esc(sub)}</div>
        <div class="bar${pct ? '' : ' zero'}"><i style="width:${Math.max(pct, 2)}%"></i></div>
      </div>
      <div class="go"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></div>
    </div>`;
  host.querySelector('.cont').addEventListener('click', () => onOpen(book));
}

function b_sub(book, p) {
  if (book.kind === 'comic') return metaLine(book, p);
  return p ? p.chapterTitle || '' : book.intro;
}

function renderGrid(prog) {
  const grid = $('#grid');
  grid.innerHTML = items
    .map((b) => {
      const p = prog[b.id];
      const pct = p ? Math.round((p.percent || 0) * 100) : 0;
      const badge = b.kind === 'comic' ? '<em class="tag">漫画</em>' : '';
      return `
      <button class="book" data-id="${esc(b.id)}">
        <div class="cv"><img src="${esc(b.cover)}" alt="" loading="lazy">${badge}</div>
        <div class="tt">${esc(b.title)}</div>
        <div class="pb${pct ? '' : ' zero'}"><i style="width:${pct}%"></i></div>
      </button>`;
    })
    .concat(`
      <button class="book add" id="tile-import">
        <div class="cv"><span>＋</span></div>
        <div class="tt">导入漫画</div>
        <div class="pb zero"><i></i></div>
      </button>`)
    .join('');
  grid.querySelectorAll('.book[data-id]').forEach((el) => {
    el.addEventListener('click', () => {
      const b = items.find((x) => x.id === el.dataset.id);
      if (b) onOpen(b);
    });
  });
  const add = $('#tile-import');
  if (add) add.addEventListener('click', () => onImport && onImport());
}