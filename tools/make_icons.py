# -*- coding: utf-8 -*-
"""生成 PWA 图标：朱红底 + 白文「墨」。"""
import os
from PIL import Image, ImageDraw, ImageFont

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(BASE, "assets", "icons")
os.makedirs(OUT, exist_ok=True)

def make(size, pad_ratio=0.0, radius_ratio=0.22, bg=(166, 61, 47)):
    S = size * 4
    img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    m = int(S * pad_ratio)
    r = int(S * radius_ratio)
    d.rounded_rectangle([m, m, S - m, S - m], radius=r, fill=bg + (255,))
    f = ImageFont.truetype("C:/Windows/Fonts/msyhbd.ttc", int(S * (0.50 if pad_ratio == 0 else 0.42)))
    d.text((S / 2, S / 2 + int(S * 0.02)), "墨", font=f, fill=(247, 242, 232), anchor="mm")
    return img.resize((size, size), Image.LANCZOS)

make(180).save(os.path.join(OUT, "icon-180.png"))
make(192).save(os.path.join(OUT, "icon-192.png"))
make(512).save(os.path.join(OUT, "icon-512.png"))
# maskable: 留安全边距
make(512, pad_ratio=0.10, radius_ratio=0.30).save(os.path.join(OUT, "icon-maskable.png"))
print("icons ok", os.listdir(OUT))