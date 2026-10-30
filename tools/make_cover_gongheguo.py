# -*- coding: utf-8 -*-
"""生成《共和国的历程》封面，风格对齐书架其它封面（600×800 竖排书名）。"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'covers' / 'gongheguo.jpg'

W, H = 600, 800
CREAM = (243, 231, 203)
GOLD = (198, 176, 130)
RED = (176, 46, 38)

TITLE = '共和国的历程'
AUTHOR = '北京大学马克思主义学会'


def font(path, size):
    return ImageFont.truetype(path, size)


def gradient():
    img = Image.new('RGB', (W, H))
    top, bot = (86, 27, 26), (38, 16, 16)
    d = ImageDraw.Draw(img)
    for y in range(H):
        t = y / (H - 1)
        d.line([(0, y), (W, y)], fill=tuple(round(top[i] + (bot[i] - top[i]) * t) for i in range(3)))
    return img


def vtext(d, text, x, y, f, fill, step):
    for ch in text:
        bbox = d.textbbox((0, 0), ch, font=f)
        w = bbox[2] - bbox[0]
        d.text((x - w / 2 - bbox[0], y), ch, font=f, fill=fill)
        y += step
    return y


def main():
    img = gradient()
    d = ImageDraw.Draw(img, 'RGBA')

    # 边框
    d.rectangle([26, 26, W - 26, H - 26], outline=(*GOLD, 150), width=1)
    d.rectangle([33, 33, W - 33, H - 33], outline=(*GOLD, 60), width=1)

    f_title = font(r'C:\Windows\Fonts\simhei.ttf', 74)
    step = 84
    y0 = (H - step * len(TITLE)) / 2 + 6
    vtext(d, TITLE, 452, y0, f_title, CREAM, step)

    # 竖线
    d.line([(388, y0 + 6), (388, y0 + step * (len(TITLE) - 1) + 44)], fill=(*GOLD, 120), width=1)

    # 作者（横排小字，书名下方）
    f_author = font(r'C:\Windows\Fonts\simsun.ttc', 19)
    ay = y0 + step * (len(TITLE) - 1) + 74
    bbox = d.textbbox((0, 0), AUTHOR, font=f_author)
    d.text((452 - (bbox[2] - bbox[0]) / 2 - bbox[0], ay), AUTHOR, font=f_author, fill=(*CREAM, 190))

    # 印章
    seal = 62
    sx, sy = 66, H - 66 - seal
    d.rounded_rectangle([sx, sy, sx + seal, sy + seal], radius=6, fill=(*RED, 235))
    f_seal = font(r'C:\Windows\Fonts\simhei.ttf', 38)
    bbox = d.textbbox((0, 0), '马', font=f_seal)
    d.text((sx + seal / 2 - (bbox[2] - bbox[0]) / 2 - bbox[0],
            sy + seal / 2 - (bbox[3] - bbox[1]) / 2 - bbox[1]), '马', font=f_seal, fill=(247, 238, 220))

    img.save(OUT, 'JPEG', quality=90, optimize=True, progressive=True)
    print('cover ->', OUT, OUT.stat().st_size, 'bytes')


if __name__ == '__main__':
    main()