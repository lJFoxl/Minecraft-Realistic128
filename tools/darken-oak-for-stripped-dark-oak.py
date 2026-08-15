# -*- coding: utf-8 -*-
"""
Заменяет stripped_dark_oak_log (сейчас — грязная тёмная поцарапанная
текстура, визуально не похожая на дерево) на затемнённую версию обычного
stripped_oak_log: тот же дубовый рисунок (текстура/оттенок), просто темнее.

Тон (Hue) и насыщенность (Saturation) берём от самого дуба (не перекрашиваем
под другую породу) — просто масштабируем Lightness каждого пикселя вниз, до
уровня в среднем как у dark_oak_planks.png (наш ориентир "насколько тёмным
должно быть тёмное дерево" в этом паке).

_n/_s копируются с обычного дуба как есть (геометрия доски не меняется).

Запуск: python tools/darken-oak-for-stripped-dark-oak.py
"""

import colorsys
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
DIR = os.path.join(ROOT, "assets", "minecraft", "textures", "block")

BASE = os.path.join(DIR, "stripped_oak_log.png")
REF_DARK = os.path.join(DIR, "dark_oak_planks.png")
OUT = os.path.join(DIR, "stripped_dark_oak_log.png")


def mean_l(path, step=2):
    img = Image.open(path).convert("RGB")
    w, h = img.size
    px = img.load()
    total = 0.0
    n = 0
    for y in range(0, h, step):
        for x in range(0, w, step):
            r, g, b = px[x, y]
            _, l, _ = colorsys.rgb_to_hls(r / 255.0, g / 255.0, b / 255.0)
            total += l
            n += 1
    return total / n

base_l = mean_l(BASE)
ref_l = mean_l(REF_DARK)
l_scale = ref_l / base_l if base_l > 0 else 1.0
print(f"base(oak) L={base_l:.3f} ref(dark_oak_planks) L={ref_l:.3f} l_scale={l_scale:.3f}")

img = Image.open(BASE).convert("RGBA")
w, h = img.size
src = img.load()
out = Image.new("RGBA", (w, h))
dst = out.load()
for y in range(h):
    for x in range(w):
        r, g, b, a = src[x, y]
        hh, ll, ss = colorsys.rgb_to_hls(r / 255.0, g / 255.0, b / 255.0)
        ll = max(0.0, min(1.0, ll * l_scale))
        nr, ng, nb = colorsys.hls_to_rgb(hh, ll, ss)
        dst[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
out.save(OUT)
print("saved", OUT)

for suf in ("_n", "_s"):
    s = os.path.join(DIR, f"stripped_oak_log{suf}.png")
    d = os.path.join(DIR, f"stripped_dark_oak_log{suf}.png")
    if os.path.exists(s):
        Image.open(s).save(d)
        print("copied", d)

print("\nГотово.")
