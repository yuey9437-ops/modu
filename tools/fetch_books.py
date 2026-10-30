# -*- coding: utf-8 -*-
"""下载 Gutenberg 中文 EPUB，供 demo 书架使用。一次性跑完，不做交互。"""
import urllib.request, os, sys, time

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(BASE, "assets", "books", "_raw")
os.makedirs(RAW, exist_ok=True)

UA = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
}

BOOKS = [
    (51828, "liaozhai"),
    (25192, "fusheng"),
    (25124, "laocan"),
    (23839, "lunyu"),
]

for gid, slug in BOOKS:
    dst = os.path.join(RAW, slug + ".epub")
    if os.path.exists(dst) and os.path.getsize(dst) > 5000:
        print("skip", slug, os.path.getsize(dst))
        continue
    for fmt in (".epub.noimages", ".epub.images"):
        url = f"https://www.gutenberg.org/ebooks/{gid}{fmt}"
        try:
            t = time.time()
            r = urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60)
            data = r.read()
            if len(data) < 3000:
                raise ValueError("too small")
            open(dst, "wb").write(data)
            print("OK", slug, len(data), round(time.time() - t, 1), "s")
            break
        except Exception as e:
            print("  fail", slug, fmt, type(e).__name__, str(e)[:70])
    else:
        print("!! ALL FAILED", slug)