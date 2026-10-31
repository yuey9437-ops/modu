// 墨读 · 漫画库
// 漫画存在 IndexedDB（localStorage 装不下几百 MB）；导入时在前端解压 CBZ/ZIP，
// 不上传任何东西。页面按需取 Blob，不一次性全读进内存。

const DB_NAME = 'modu-comics';
const DB_VER = 1;
const IMG_RE = /\.(jpe?g|png|webp|avif|gif|bmp)$/i;
const COLLATOR = new Intl.Collator('zh-Hans-CN', { numeric: true, sensitivity: 'base' });

let dbPromise = null;

function db() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('books')) d.createObjectStore('books', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('pages')) d.createObjectStore('pages');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function run(storeName, mode, fn) {
  return db().then(
    (d) =>
      new Promise((resolve, reject) => {
        const t = d.transaction(storeName, mode);
        let out;
        const req = fn(t.objectStore(storeName));
        if (req) req.onsuccess = () => (out = req.result);
        t.oncomplete = () => resolve(out);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      })
  );
}

/* ───────── 读取 ───────── */

export function listComics() {
  return run('books', 'readonly', (s) => s.getAll()).then((rows) =>
    (rows || []).sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0))
  );
}

export function getComic(id) {
  return run('books', 'readonly', (s) => s.get(id));
}

export function getPageBlob(id, i) {
  return run('pages', 'readonly', (s) => s.get([id, i]));
}

export function deleteComic(id) {
  return db().then(
    (d) =>
      new Promise((resolve, reject) => {
        const t = d.transaction(['books', 'pages'], 'readwrite');
        t.objectStore('books').delete(id);
        // 页记录键是 [id, i]，按范围删
        const range = IDBKeyRange.bound([id, 0], [id, Number.MAX_SAFE_INTEGER]);
        t.objectStore('pages').delete(range);
        t.oncomplete = () => { document.dispatchEvent(new CustomEvent('comics:changed')); resolve(true); };
        t.onerror = () => reject(t.error);
      })
  );
}

/* ───────── ZIP / CBZ 解析 ───────── */

function decodeName(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (e) {
    try {
      return new TextDecoder('gbk').decode(bytes);
    } catch (e2) {
      return new TextDecoder('utf-8').decode(bytes);
    }
  }
}

function u16(dv, o) { return dv.getUint16(o, true); }
function u32(dv, o) { return dv.getUint32(o, true); }

/** 解析中央目录，返回图片条目（按文件名自然排序） */
function readZipEntries(buf) {
  const dv = new DataView(buf);
  const len = buf.byteLength;
  if (len < 22) throw new Error('文件不是 zip（太短）');

  // 从尾部找 EOCD
  let eocd = -1;
  const stop = Math.max(0, len - 66560);
  for (let i = len - 22; i >= stop; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('不是有效的 zip 文件');

  let count = u16(dv, eocd + 10);
  let cdOffset = u32(dv, eocd + 16);

  // ZIP64：字段为 0xFFFFFFFF 时去 ZIP64 EOCD 里取
  if (count === 0xffff || cdOffset === 0xffffffff) {
    const z64 = eocd - 20;
    if (z64 >= 0 && dv.getUint32(z64, true) === 0x07064b50) {
      const off = Number(dv.getBigUint64(z64 + 8, true));
      if (dv.getUint32(off, true) === 0x06064b50) {
        count = Number(dv.getBigUint64(off + 32, true));
        cdOffset = Number(dv.getBigUint64(off + 48, true));
      }
    }
  }

  const entries = [];
  let p = cdOffset;
  for (let n = 0; n < count && p + 46 <= len; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = u16(dv, p + 10);
    const csize = u32(dv, p + 20);
    const usize = u32(dv, p + 24);
    const nlen = u16(dv, p + 28);
    const elen = u16(dv, p + 30);
    const clen = u16(dv, p + 32);
    const lho = u32(dv, p + 42);
    const name = decodeName(new Uint8Array(buf, p + 46, nlen));
    p += 46 + nlen + elen + clen;
    if (name.endsWith('/') || name.startsWith('__MACOSX/') || !IMG_RE.test(name)) continue;
    if (csize === 0xffffffff || usize === 0xffffffff) continue;
    entries.push({ name, method, csize, usize, lho });
  }
  return entries.sort((a, b) => COLLATOR.compare(a.name, b.name));
}

/** 取出单页，返回 Blob */
async function extractEntry(buf, dv, e) {
  const nlen = u16(dv, e.lho + 26);
  const elen = u16(dv, e.lho + 28);
  const start = e.lho + 30 + nlen + elen;
  const raw = new Uint8Array(buf, start, e.csize);
  if (e.method === 0) return new Blob([raw], { type: mimeOf(e.name) });
  if (e.method !== 8) throw new Error('不支持的压缩方式: ' + e.method);
  if (typeof DecompressionStream !== 'function') throw new Error('浏览器不支持解压（需 iOS 16.4+）');
  const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const out = await new Response(stream).blob();
  return new Blob([out], { type: mimeOf(e.name) });
}

function mimeOf(name) {
  const ext = (name.match(/\.([a-z0-9]+)$/i) || [])[1] || '';
  const m = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', avif: 'image/avif' };
  return m[ext.toLowerCase()] || 'image/jpeg';
}

/** 自然排序：第2页排在第10页前面 */
function naturalSort(files) {
  return files.slice().sort((a, b) => COLLATOR.compare(a.name, b.name));
}

/* ───────── 导入 ───────── */

const rid = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/**
 * 导入漫画。files 可以是 CBZ/ZIP，也可以是若干图片（一次算一本）。
 * onProgress(done, total, label)
 */
export async function importComics(fileList, onProgress = () => {}) {
  const files = Array.from(fileList || []);
  const zips = files.filter((f) => /\.(cbz|zip)$/i.test(f.name));
  const imgs = files.filter((f) => f.type.startsWith('image/') || IMG_RE.test(f.name));
  const made = [];

  for (let zi = 0; zi < zips.length; zi++) {
    const f = zips[zi];
    onProgress(0, 1, `读取 ${f.name}`);
    const buf = await f.arrayBuffer();
    const dv = new DataView(buf);
    const entries = readZipEntries(buf);
    if (!entries.length) throw new Error(`${f.name} 里没有图片`);
    const id = rid();
    const title = f.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim() || '未命名漫画';
    let cover = null;
    for (let i = 0; i < entries.length; i++) {
      const blob = await extractEntry(buf, dv, entries[i]);
      if (i === 0) cover = blob;
      await run('pages', 'readwrite', (s) => s.put({ blob, name: entries[i].name }, [id, i]));
      onProgress(i + 1, entries.length, title);
      if (i % 8 === 0) await new Promise((r) => setTimeout(r, 0)); // 让 UI 喘口气
    }
    const meta = {
      id, title, kind: 'comic', pageCount: entries.length,
      cover, addedAt: Date.now(),
      size: entries.reduce((a, e) => a + e.usize, 0),
    };
    await run('books', 'readwrite', (s) => s.put(meta));
    made.push(meta);
    document.dispatchEvent(new CustomEvent('comics:changed'));
  }

  if (imgs.length) {
    const id = rid();
    const title = (prompt('给这本漫画起个名字', '新漫画') || '新漫画').trim() || '新漫画';
    const sorted = naturalSort(imgs.map((f) => ({ name: f.name, file: f })));
    let cover = null;
    for (let i = 0; i < sorted.length; i++) {
      const blob = sorted[i].file.slice(0, sorted[i].file.size, mimeOf(sorted[i].name));
      if (i === 0) cover = blob;
      await run('pages', 'readwrite', (s) => s.put({ blob, name: sorted[i].name }, [id, i]));
      onProgress(i + 1, sorted.length, title);
    }
    const meta = {
      id, title, kind: 'comic', pageCount: sorted.length, cover,
      addedAt: Date.now(), size: sorted.reduce((a, x) => a + x.file.size, 0),
    };
    await run('books', 'readwrite', (s) => s.put(meta));
    made.push(meta);
    document.dispatchEvent(new CustomEvent('comics:changed'));
  }

  return made;
}

/** 磁盘占用估算（MB） */
export async function storageUsage() {
  try {
    const est = await navigator.storage.estimate();
    return { used: est.usage || 0, quota: est.quota || 0, persisted: await navigator.storage.persisted?.() };
  } catch (e) {
    return null;
  }
}