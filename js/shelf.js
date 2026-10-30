// 墨读 · 书架
import { allProgress, lastBookId } from './store.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let books = [];
let onOpen = null;

export function initShelf(list, openCb) {
  books = list;
  onOpen = openCb;
  render();
}

export function render() {
  const prog = allProgress();
  const done = books.filter((b) => prog[b.id] && prog[b.id].percent > 0.995).length;
  $('#shelf-sub').textContent = `共 ${books.length} 本 · 读毕 ${done} 本`;

  renderContinue(prog);
  renderGrid(prog);
}

function renderContinue(prog) {
  const host = $('#continue-card');
  const last = lastBookId();
  const book = books.find((b) => b.id === last) || books[0];
  if (!book) return;
  const p = prog[book.id];
  const pct = p ? Math.round((p.percent || 0) * 100) : 0;
  const kicker = p ? '继续阅读' : '开始阅读';
  const chapter = p ? (p.chapterTitle || '') : book.intro;
  const meta = p ? `已读 ${pct}% · 第 ${p.ch + 1} 章` : `${book.author} · 共 ${book.chapters} 章`;

  host.innerHTML = `
    <div class="cont" role="button" tabindex="0" data-id="${esc(book.id)}">
      <div class="cv"><img src="${esc(book.cover)}" alt=""></div>
      <div class="txt">
        <div class="kicker">${kicker}</div>
        <div class="tt">${esc(book.title)}</div>
        <div class="cc">${esc(p ? meta : chapter)}</div>
        <div class="bar${pct ? '' : ' zero'}"><i style="width:${Math.max(pct, 2)}%"></i></div>
      </div>
      <div class="go"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></div>
    </div>`;
  host.querySelector('.cont').addEventListener('click', () => onOpen(book));
}

function renderGrid(prog) {
  const grid = $('#grid');
  grid.classList.toggle('cols-2', books.length <= 4);
  $('#book-count').textContent = `${books.length} 本`;
  grid.innerHTML = books
    .map((b) => {
      const p = prog[b.id];
      const pct = p ? Math.round((p.percent || 0) * 100) : 0;
      return `
      <button class="book" data-id="${esc(b.id)}">
        <div class="cv"><img src="${esc(b.cover)}" alt="" loading="lazy"></div>
        <div class="tt">${esc(b.title)}</div>
        <div class="pb${pct ? '' : ' zero'}"><i style="width:${pct}%"></i></div>
      </button>`;
    })
    .join('');
  grid.querySelectorAll('.book').forEach((el) => {
    el.addEventListener('click', () => {
      const b = books.find((x) => x.id === el.dataset.id);
      if (b) onOpen(b);
    });
  });
}