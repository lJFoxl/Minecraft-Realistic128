# -*- coding: utf-8 -*-
"""
Берёт stripped_dark_oak_log_top как основу (рисунок годичных колец/торца)
и перекрашивает под остальные породы, у которых уже есть HD stripped_*_log
(боковая текстура), но нет top: acacia, birch, jungle, oak, crimson, warped.

Цвет (Hue/Saturation) берётся из УЖЕ ОДОБРЕННОЙ боковой HD-текстуры
stripped_<порода>_log/stem.png этой же породы в нашем паке (не внешний
референс) — та же техника, что и tools/recolor-oak-to-species.py.
Из dark_oak top берётся только Lightness каждого пикселя (рисунок сохраняется).

Нормали (_n) и specular (_s) копируются с dark_oak top как есть.

Запуск: python tools/recolor-dark-oak-top-to-species.py
"""

import colorsys
import math
import os

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
DIR = os.path.join(ROOT, "assets", "minecraft", "textures", "block")

BASE = os.path.join(DIR, "stripped_dark_oak_log_top.png")


def analyze_target_color(ref_path, sample_step=2):
    img = Image.open(ref_path).convert("RGB")
    w, h = img.size
    px = img.load()
    sx = sy = sw = 0.0
    sat_weighted_sum = 0.0
    l_sum = 0.0
    n = 0
    for y in range(0, h, sample_step):
        for x in range(0, w, sample_step):
            r, g, b = px[x, y]
            hh, ll, ss = colorsys.rgb_to_hls(r / 255.0, g / 255.0, b / 255.0)
            weight = ss
            sx += math.cos(hh * 2 * math.pi) * weight
            sy += math.sin(hh * 2 * math.pi) * weight
            sat_weighted_sum += ss * ss
            sw += weight
            l_sum += ll
            n += 1
    if sw == 0:
        sw = 1.0
    mean_h = (math.atan2(sy / sw, sx / sw) / (2 * math.pi)) % 1.0
    mean_s = max(0.0, min(1.0, sat_weighted_sum / sw))
    mean_l = l_sum / n
    return mean_h, mean_s, mean_l


def mean_lightness(path, sample_step=2):
    img = Image.open(path).convert("RGB")
    w, h = img.size
    px = img.load()
    total = 0.0
    n = 0
    for y in range(0, h, sample_step):
        for x in range(0, w, sample_step):
            r, g, b = px[x, y]
            _, ll, _ = colorsys.rgb_to_hls(r / 255.0, g / 255.0, b / 255.0)
            total += ll
            n += 1
    return total / n


def colorize(base_path, out_path, target_h, target_s, l_scale):
    img = Image.open(base_path).convert("RGBA")
    w, h = img.size
    src = img.load()
    out = Image.new("RGBA", (w, h))
    dst = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = src[x, y]
            _, ll, _ = colorsys.rgb_to_hls(r / 255.0, g / 255.0, b / 255.0)
            ll = max(0.0, min(1.0, ll * l_scale))
            nr, ng, nb = colorsys.hls_to_rgb(target_h, ll, target_s)
            dst[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    out.save(out_path)


def copy_pbr_maps(target_name):
    for suf in ("_n", "_s"):
        s = os.path.join(DIR, f"stripped_dark_oak_log_top{suf}.png")
        d = os.path.join(DIR, f"{target_name}{suf}.png")
        if os.path.exists(s):
            Image.open(s).save(d)


jobs = [
    # (референс цвета — своя же боковая текстура породы, целевое имя top)
    ("stripped_acacia_log.png", "stripped_acacia_log_top"),
    ("stripped_birch_log.png", "stripped_birch_log_top"),
    ("stripped_jungle_log.png", "stripped_jungle_log_top"),
    ("stripped_oak_log.png", "stripped_oak_log_top"),
    ("stripped_crimson_stem.png", "stripped_crimson_stem_top"),
    ("stripped_warped_stem.png", "stripped_warped_stem_top"),
]

base_l = mean_lightness(BASE)

for ref_name, target_name in jobs:
    ref_path = os.path.join(DIR, ref_name)
    out_path = os.path.join(DIR, f"{target_name}.png")

    h, s, ref_l = analyze_target_color(ref_path)
    l_scale = ref_l / base_l if base_l > 0 else 1.0
    colorize(BASE, out_path, h, s, l_scale)
    copy_pbr_maps(target_name)

    print(f"{target_name:28s} <- dark_oak top (H={h:.3f} S={s:.3f} L_scale={l_scale:.3f}, референс {ref_name})")

print("\nГотово.")
