# -*- coding: utf-8 -*-
"""从 PDF 提取《共和国的历程》为墨读 PWA 书籍 JSON（行级重建段落版）。"""
import json
import re
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
SRC = next((ROOT.parent / 'books').glob('共和国的历程*.pdf'))
OUT = ROOT / 'assets' / 'books' / 'gongheguo.json'

RE_PART = re.compile(r'^(导言|绪论|后记|结语|尾声|附录)')
RE_CH = re.compile(r'^(第[一二三四五六七八九十]+章)')
RE_SEC = re.compile(r'^(第[一二三四五六七八九十]+节)')
RE_NUM = re.compile(r'^\d{1,4}$')
RE_SUB = re.compile(r'^[一二三四五六七八九十]+、')


def tidy(s: str) -> str:
    s = s.replace('\u00ad', '').replace('\u3000', ' ')
    s = re.sub(r'[ \t]+', ' ', s).strip()
    s = re.sub(r'(?<=[\u4e00-\u9fff，。、；：？！“”‘’（）《》…—])\s+(?=[\u4e00-\u9fff，。、；：？！“”‘’（）《》…—])', '', s)
    s = re.sub(r'(?<=[\u4e00-\u9fff])\s+(?=[，。、；：？！）》”’])', '', s)
    s = re.sub(r'(?<=[（《“‘])\s+(?=[\u4e00-\u9fff])', '', s)
    return s


def split_heading(text, m):
    """把 '第一节民主革命业未竟' 还原成 ('第一节', '民主革命业未竟')。"""
    head = m.group(1)
    rest = text[len(head):].strip()
    return head, rest


def main():
    doc = pymupdf.open(SRC)
    items = []          # (kind, text, size, x1)
    body_right = {}

    for pno, page in enumerate(doc):
        lines = []
        for b in page.get_text('dict')['blocks']:
            if b.get('type') != 0:
                continue
            for line in b['lines']:
                text = ''.join(s['text'] for s in line['spans'])
                size = max((round(s['size'], 1) for s in line['spans']), default=0)
                if not text.strip():
                    continue
                lines.append((text, size, line['bbox'][2], pno))
        sizes = [s for _, s, _, _ in lines if s >= 11.5]
        body = max(set(sizes), key=sizes.count) if sizes else 12.0
        rights = [x for t, s, x, _ in lines if abs(s - body) < 0.6 and not RE_NUM.match(t.strip())]
        right = max(rights) if rights else 0
        body_right[pno] = right
        for text, size, x1, _ in lines:
            t = tidy(text)
            if not t:
                continue
            if RE_NUM.match(t) and size < 11:
                continue
            if size >= body * 1.20 and (RE_PART.match(t) or RE_CH.match(t)):
                kind = 'h1'
            elif RE_SEC.match(t) and size >= body * 1.05:
                kind = 'h2'
            elif size >= body * 1.15:
                kind = 'h1'                       # 目录 / 大标题
            else:
                kind = 'body'
            items.append((kind, t, size, x1, pno))

    # 从前置里找「导言」起点（目录之后）
    start = next((i for i, it in enumerate(items) if it[0] == 'h1' and RE_PART.match(it[1]) and '导言' in it[1]), None)
    if start is None:
        start = next(i for i, it in enumerate(items) if it[0] == 'h1' and RE_CH.match(it[1]))
    items = items[start:]

    chapters = []
    cur = None
    pending = None      # 章标题（作分隔段）
    buf = []

    def flush():
        nonlocal buf
        if buf and cur is not None:
            para = ''.join(buf)
            if para:
                cur['p'].append(para)
        buf = []

    def new_chapter(title, sep=None):
        nonlocal cur, buf
        flush()
        cur = {'t': title, 'p': []}
        if sep:
            cur['p'].append(sep)
        chapters.append(cur)

    for kind, text, size, x1, pno in items:
        if kind == 'h1':
            flush()
            if RE_PART.match(text):
                head, rest = split_heading(text, RE_PART.match(text))
                pending = None
                new_chapter(f'{head} {rest}'.strip())
            elif RE_CH.match(text):
                head, rest = split_heading(text, RE_CH.match(text))
                pending = f'{head} {rest}'.strip()
            else:
                pending = None
            continue
        if kind == 'h2':
            head, rest = split_heading(text, RE_SEC.match(text))
            title = rest or head
            sep = f'【{pending}】' if pending else None
            pending = None
            new_chapter(title, sep)
            continue
        # 正文行（脚注 9pt 直接跳过）
        if size < 11.5 or cur is None:
            continue
        # 小标题（一、二、三）独立成段
        if RE_SUB.match(text):
            flush()
            cur['p'].append(text)
            continue
        buf.append(text)
        para = ''.join(buf)
        # 段落结束：遇到句末标点，或长度失控
        if para.endswith(('。', '！', '？', '”', '』', '）')) or len(para) > 1500:
            flush()

    flush()

    # 清理：脚注序号粘连、纯数字段、段尾页码
    for c in chapters:
        clean = []
        for para in c['p']:
            para = re.sub(r'^\d{1,3}(?=[一-鿿“《])', '', para)
            para = re.sub(r'(?<=[。！？])\s*\d{1,4}$', '', para)
            para = para.strip()
            if not para or RE_NUM.match(para) or len(para) < 2:
                continue
            para = tidy(para)
            clean.append(para)
        c['p'] = clean
    chapters = [c for c in chapters if c['p']]

    total = sum(len(''.join(c['p'])) for c in chapters)
    book = {
        'id': 'gongheguo',
        'title': '共和国的历程',
        'author': '北京大学马克思主义学会',
        'intro': '革命与复辟的历史与逻辑 · 1949 年以来的中国与世界',
        'cover': 'assets/covers/gongheguo.jpg',
        'chapters': [{'t': c['t'], 'p': c['p']} for c in chapters],
    }
    OUT.write_text(json.dumps(book, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'chapters={len(chapters)} chars={total} bytes={OUT.stat().st_size}')
    for c in chapters:
        avg = len(''.join(c['p'])) // max(1, len(c['p']))
        print(f'  {c["t"][:34]:36} paras={len(c["p"]):4d} chars={len("".join(c["p"])):6d} avg={avg}')


if __name__ == '__main__':
    main()