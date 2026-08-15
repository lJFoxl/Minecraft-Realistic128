# -*- coding: utf-8 -*-
"""
Берёт дубовые доски / очищенное бревно как основу (геометрия/грейн уже HD 512x
из Oversized-LabPbr-512x) и перекрашивает их под тропическое (jungle),
багряное (crimson) и искажённое (warped) дерево.

Цвет (Hue/Saturation) берётся из референсных ванильных-по-стилю текстур LBPR
(C:\\GameDev\\LBPR) — вычисляется круговое средневзвешенное по насыщенности,
чтобы серые/тёмные пиксели (стыки досок) не искажали оценку тона.
Из дуба берётся только Lightness (яркость) каждого пикселя — так сохраняется
рисунок текстуры, а цвет проставляется целевой (аналог Photoshop Colorize).

Нормали (_n) и specular (_s) просто копируются с дуба как есть — геометрия
доски не меняется, меняется только альбедо.

Запуск: python tools/recolor-oak-to-species.py
"""

import colorsys
import math
import os

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
DST_DIR = os.path.join(ROOT, "assets", "minecraft", "textures", "block")
LBPR_DIR = r"C:\GameDev\LBPR\assets\minecraft\textures\block"


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
    mean_s = sat_weighted_sum / sw
    mean_s = max(0.0, min(1.0, mean_s))
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


def copy_pbr_maps(base_name, target_name):
    for suf in ("_n", "_s"):
        s = os.path.join(DST_DIR, f"{base_name}{suf}.png")
        d = os.path.join(DST_DIR, f"{target_name}{suf}.png")
        if os.path.exists(s):
            Image.open(s).save(d)


jobs = [
    # (базовая текстура в нашем паке, целевое имя, референс в LBPR для цвета)
    ("oak_planks", "jungle_planks", "jungle_planks.png"),
    ("oak_planks", "crimson_planks", "crimson_planks.png"),
    ("oak_planks", "warped_planks", "warped_planks.png"),
    ("stripped_oak_log", "stripped_jungle_log", "stripped_jungle_log.png"),
    ("stripped_oak_log", "stripped_crimson_stem", "stripped_crimson_stem.png"),
    ("stripped_oak_log", "stripped_warped_stem", "stripped_warped_stem.png"),
]

for base_name, target_name, ref_file in jobs:
    ref_path = os.path.join(LBPR_DIR, ref_file)
    base_path = os.path.join(DST_DIR, f"{base_name}.png")
    out_path = os.path.join(DST_DIR, f"{target_name}.png")

    h, s, ref_l = analyze_target_color(ref_path)
    base_l = mean_lightness(base_path)
    l_scale = ref_l / base_l if base_l > 0 else 1.0
    colorize(base_path, out_path, h, s, l_scale)
    copy_pbr_maps(base_name, target_name)

    print(f"{target_name:26s} <- {base_name}  (H={h:.3f} S={s:.3f} L_scale={l_scale:.3f}, референс {ref_file})")

print("\nГотово.")
