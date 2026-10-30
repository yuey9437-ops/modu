# -*- coding: utf-8 -*-
"""把 Gutenberg 中文纯文本做成 demo 书架数据：简体 / 分章 / 段落重排 / 生成封面。"""
import urllib.request, os, re, io, sys, json, zipfile
import zhconv
from PIL import Image, ImageDraw, ImageFont

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(BASE, "assets", "books", "_raw")
OUT = os.path.join(BASE, "assets", "books")
COV = os.path.join(BASE, "assets", "covers")
os.makedirs(RAW, exist_ok=True); os.makedirs(OUT, exist_ok=True); os.makedirs(COV, exist_ok=True)

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"}

BOOKS = [
    dict(slug="liaozhai", gid=51828, title="聊斋志异", author="蒲松龄",
         intro="写鬼写妖高人一等，刺贪刺虐入骨三分。",
         c1=(29, 46, 40), c2=(10, 20, 17), accent=(201, 162, 39)),
    dict(slug="fusheng", gid=25192, title="浮生六记", author="沈复",
         intro="布衣菜饭，可乐终身。清代最动人的夫妻生活记。",
         c1=(107, 74, 52), c2=(45, 26, 18), accent=(232, 211, 176)),
    dict(slug="laocan", gid=25124, title="老残游记", author="刘鹗",
         intro="晚清四大谴责小说之一，大明湖边听一曲王小玉说书。",
         c1=(27, 43, 69), c2=(12, 21, 38), accent=(184, 201, 217)),
    dict(slug="lunyu", gid=23839, title="论语", author="孔子及弟子",
         intro="学而时习之，不亦说乎。",
         c1=(92, 31, 26), c2=(40, 13, 11), accent=(217, 178, 106)),
]

HEAD = {
    "liaozhai": re.compile(r"^〈(.{1,12})〉$"),
    "fusheng": re.compile(r"^第([一二三四五六七八九十]+)卷\s*(.*)$"),
    "laocan": re.compile(r"^第([一二三四五六七八九十百]+)回[\s　]*(.*)$"),
    "lunyu": re.compile(r"^([\u4e00-\u9fa5]{1,4})第([一二三四五六七八九十]+)$"),
}

def download(b):
    dst = os.path.join(RAW, b["slug"] + ".txt")
    if os.path.exists(dst) and os.path.getsize(dst) > 5000:
        return
    url = f"https://www.gutenberg.org/ebooks/{b['gid']}.txt.utf-8"
    data = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60).read()
    open(dst, "wb").write(data)
    print("  downloaded", b["slug"], len(data))

def load_text(slug):
    t = open(os.path.join(RAW, slug + ".txt"), "rb").read().decode("utf-8", "replace")
    t = t.replace("\r\n", "\n").replace("\ufeff", "")
    m = re.search(r"\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG EBOOK.*?\*\*\*", t, re.I)
    if m: t = t[m.end():]
    m = re.search(r"\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG EBOOK", t, re.I)
    if m: t = t[:m.start()]
    return t

SKIP = re.compile(r"^(Title|Author|Release date|Language|Credits|Produced by|Most recently|Character set|"
                  r"含|End of|Updated editions|Transcriber)", re.I)

def paragraphs(t):
    """硬换行合并；长段落按句号重排到 ~520 字。"""
    blocks = re.split(r"\n\s*\n", t)
    out = []
    for blk in blocks:
        line = re.sub(r"\s*\n\s*", "", blk).strip()
        line = re.sub(r"[ \t\u00a0]+", " ", line)
        if not line or SKIP.match(line):
            continue
        if len(line) <= 520:
            out.append(line); continue
        # 长段落：在句末切
        buf = ""
        for seg in re.split(r"(?<=[。！？」』])", line):
            if not seg: continue
            buf += seg
            if len(buf) >= 460:
                out.append(buf.strip()); buf = ""
        if buf.strip(): out.append(buf.strip())
    return out

def build_chapters(b, paras):
    rx = HEAD[b["slug"]]
    chapters, cur = [], {"t": "序", "p": []}
    for p in paras:
        if b["slug"] == "liaozhai" and re.match(r"^卷[一二三四五六七八九十]+$", p):
            continue
        m = rx.match(p)
        if m:
            if cur["p"] or cur["t"] != "序":
                chapters.append(cur)
            if b["slug"] == "lunyu":
                title = p
            elif b["slug"] == "liaozhai":
                title = m.group(1)
            else:
                title = (m.group(1) and ("第%s卷 " % m.group(1) if b["slug"] == "fusheng" else "第%s回 " % m.group(1)) or "") + (m.group(2) or "").strip()
            cur = {"t": title.strip(), "p": []}
        else:
            cur["p"].append(p)
    if cur["p"]: chapters.append(cur)
    # 丢掉开头没有正文的占位章
    chapters = [c for c in chapters if c["p"]]
    return chapters

def cover(b, title, author):
    W, H = 600, 800
    img = Image.new("RGB", (W, H), b["c1"])
    px = img.load()
    c1, c2 = b["c1"], b["c2"]
    for y in range(H):
        t = y / H
        for x in range(W):
            k = min(1, max(0, t * 0.75 + (x / W) * 0.25))
            px[x, y] = (int(c1[0] + (c2[0] - c1[0]) * k),
                        int(c1[1] + (c2[1] - c1[1]) * k),
                        int(c1[2] + (c2[2] - c1[2]) * k))
    d = ImageDraw.Draw(img, "RGBA")
    ac = b["accent"]
    d.rectangle([26, 26, W - 26, H - 26], outline=ac + (105,), width=2)
    d.rectangle([34, 34, W - 34, H - 34], outline=ac + (38,), width=1)

    fp = "C:/Windows/Fonts/msyhbd.ttc"
    fs = "C:/Windows/Fonts/msyh.ttc"
    n = len(title)
    size = 104 if n <= 3 else (94 if n == 4 else 78)
    gap = 20
    f = ImageFont.truetype(fp, size)
    block_h = n * size + (n - 1) * gap
    top = 300 - block_h // 2
    x = W - 132
    y = top
    for ch in list(title):
        d.text((x, y), ch, font=f, fill=(246, 242, 234), anchor="mt")
        y += size + gap
    af = ImageFont.truetype(fs, 30)
    ay = y + 34
    for ch in author:
        d.text((x, ay), ch, font=af, fill=ac + (225,), anchor="mt")
        ay += 36
    # 左侧细竖线
    d.line([(x - size * 0.92, top - 10), (x - size * 0.92, ay - 40)], fill=ac + (60,), width=1)
    # 朱印
    sw = 74
    sx, sy = 74, H - 150
    d.rounded_rectangle([sx, sy, sx + sw, sy + sw], radius=6, fill=(166, 61, 47, 235))
    sf = ImageFont.truetype(fp, 40)
    d.text((sx + sw / 2, sy + sw / 2 + 2), "藏", font=sf, fill=(247, 240, 230), anchor="mm")
    img.save(os.path.join(COV, b["slug"] + ".jpg"), quality=90, optimize=True)

report = []
for b in BOOKS:
    download(b)
    t = load_text(b["slug"])
    t = zhconv.convert(t, "zh-cn")
    ps = paragraphs(t)
    chs = build_chapters(b, ps)
    data = dict(id=b["slug"], title=b["title"], author=b["author"], intro=b["intro"],
                cover=f"assets/covers/{b['slug']}.jpg",
                chapters=[{"t": c["t"], "p": c["p"]} for c in chs])
    p = os.path.join(OUT, b["slug"] + ".json")
    json.dump(data, open(p, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    cover(b, b["title"], b["author"])
    n = sum(len(x) for c in chs for x in c["p"])
    report.append((b["slug"], len(chs), n, round(os.path.getsize(p) / 1024)))

print("\n slug        chaps   chars    json")
for r in report:
    print(" %-10s %5d %7d %6dK" % r)

index = []
for b in BOOKS:
    d = json.load(open(os.path.join(OUT, b["slug"] + ".json"), encoding="utf-8"))
    index.append(dict(id=d["id"], title=d["title"], author=d["author"], intro=d["intro"],
                      cover=d["cover"], chapters=len(d["chapters"]),
                      chars=sum(len(p) for c in d["chapters"] for p in c["p"])))
json.dump(index, open(os.path.join(OUT, "index.json"), "w", encoding="utf-8"),
          ensure_ascii=False, separators=(",", ":"))
print(" index.json ->", len(index), "books")
print("\n sample:", json.dumps(BOOKS[0]["slug"]))
d = json.load(open(os.path.join(OUT, "liaozhai.json"), encoding="utf-8"))
for c in d["chapters"][:2]:
    print(" 章:", c["t"], "| 段:", len(c["p"]))
    print("   ", (c["p"][0] if c["p"] else "")[:60])
d = json.load(open(os.path.join(OUT, "fusheng.json"), encoding="utf-8"))
for c in d["chapters"][:2]:
    print(" 章:", c["t"], "| 段:", len(c["p"]), "| 字:", sum(len(x) for x in c["p"]))
    print("   ", (c["p"][0] if c["p"] else "")[:60])