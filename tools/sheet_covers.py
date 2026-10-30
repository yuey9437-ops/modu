# -*- coding: utf-8 -*-
from PIL import Image
import os
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COV = os.path.join(BASE, "assets", "covers")
order = ["liaozhai", "fusheng", "laocan", "lunyu"]
w, h = 240, 320
sheet = Image.new("RGB", (w * 4 + 50, h + 20), (235, 232, 226))
for i, s in enumerate(order):
    im = Image.open(os.path.join(COV, s + ".jpg")).resize((w, h), Image.LANCZOS)
    sheet.paste(im, (10 + i * (w + 10), 10))
out = os.path.join(BASE, "assets", "_covers_sheet.jpg")
sheet.save(out, quality=88)
print(out)