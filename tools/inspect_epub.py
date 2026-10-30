# -*- coding: utf-8 -*-
import zipfile, re, io, sys, os, html
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
RAW = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "books", "_raw")

def spine(z):
    cont = z.read("META-INF/container.xml").decode("utf-8")
    opf_path = re.search(r'full-path="([^"]+)"', cont).group(1)
    opf = z.read(opf_path).decode("utf-8")
    base = opf_path.rsplit("/", 1)[0] + "/" if "/" in opf_path else ""
    order = re.findall(r"<itemref[^>]*idref=\"([^\"]+)\"", opf)
    ids = dict(re.findall(r"<item[^>]*id=\"([^\"]+)\"[^>]*href=\"([^\"]+)\"", opf))
    ids2 = dict((i, h) for h, i in re.findall(r"<item[^>]*href=\"([^\"]+)\"[^>]*id=\"([^\"]+)\"", opf))
    ids.update(ids2)
    out = []
    for r in order:
        h = ids.get(r)
        if h and (h.endswith(".html") or h.endswith(".xhtml")):
            out.append(base + h)
    return out

for slug in ["liaozhai", "fusheng", "laocan", "lunyu"]:
    z = zipfile.ZipFile(os.path.join(RAW, slug + ".epub"))
    files = spine(z)
    print("=" * 20, slug, "files:", len(files))
    for f in files[:3]:
        b = z.read(f).decode("utf-8", "replace")
        body = b[b.find("<body"):]
        heads = re.findall(r"<h([1-4])[^>]*>(.*?)</h\1>", body, re.S)
        print("  file", f, "len", len(b), "heads", len(heads))
        for lv, t in heads[:6]:
            print("    h%s: %s" % (lv, re.sub(r"<[^>]+>", "", t).strip()[:40]))
        ps = re.findall(r"<p[^>]*>(.*?)</p>", body, re.S)
        print("    ps:", len(ps))
        for p in ps[:4]:
            print("      p:", re.sub(r"<[^>]+>", "", p).strip()[:70])