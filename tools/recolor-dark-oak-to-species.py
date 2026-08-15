# -*- coding: utf-8 -*-
"""
Единый стиль досок: берёт dark_oak_planks.png (грейн/рисунок) как основу и
перекрашивает его под ВСЕ остальные породы дерева (кроме bamboo — у него
принципиально другая структура текстуры, вертикальные стволы, не доски).
dark_oak сам остаётся источником, не трогается.

Раньше у oak/spruce/birch/acacia были свои настоящие HD-текстуры (из
Oversized-LabPbr-512x), а jungle/crimson/warped были перекрашены от oak
(recolor-oak-to-species.py). Теперь всё унифицируем — один и тот же рисунок
доски у всех пород, различается только цвет — как в реальности одна порода
дерева, обработанная в доски, отличается от другой в основном оттенком, а
не рисунком волокон.

Цвет (Hue/Saturation) — из референсных текстур LBPR (C:\\GameDev\\LBPR),
метод тот же, что в recolor-oak-to-species.py: круговое средневзвешенное по
насыщенности для тона, взвешенное среднее для насыщенности.

Lightness НЕ просто масштабируется (для светлых пород типа pale_oak/cherry
простое умножение яркости выше 1.0 обрезает пиксели в белый — выгорают
светлые доски, пропадает рисунок). Вместо этого — histogram matching: ранги
пикселей dark_oak по светлоте переносятся на распределение светлоты
референса (как в lighten-oak-planks.py), это не даёт хардклиппинга.

_n/_s копируются с dark_oak как есть (геометрия доски не меняется).

Запуск: python tools/recolor-dark-oak-to-species.py
"""

import bisect
import colorsys
import math
import os

from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
DST_DIR = os.path.join(ROOT, "assets", "minecraft", "textures", "block")
LBPR_DIR = r"C:\GameDev\LBPR\assets\minecraft\textures\block"

BASE_NAME = "dark_oak_planks"


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


def collect_l_sorted(path, sample_step=1):
    img = Image.open(path).convert("RGB")
    w, h = img.size
    px = img.load()
    vals = []
    for y in range(0, h, sample_step):
        for x in range(0, w, sample_step):
            r, g, b = px[x, y]
            _, ll, _ = colorsys.rgb_to_hls(r / 255.0, g / 255.0, b / 255.0)
            vals.append(ll)
    vals.sort()
    return vals


N_BINS = 1024


def build_l_lut(base_l_sorted, ref_l_sorted):
    n_base = len(base_l_sorted)
    n_ref = len(ref_l_sorted)
    lut = []
    for i in range(N_BINS + 1):
        l_val = i / N_BINS
        rank = bisect.bisect_left(base_l_sorted, l_val) / n_base
        ref_idx = min(int(rank * n_ref), n_ref - 1)
        lut.append(ref_l_sorted[ref_idx])
    return lut


def colorize(base_path, out_path, target_h, target_s, l_lut):
    img = Image.open(base_path).convert("RGBA")
    w, h = img.size
    src = img.load()
    out = Image.new("RGBA", (w, h))
    dst = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = src[x, y]
            _, ll, _ = colorsys.rgb_to_hls(r / 255.0, g / 255.0, b / 255.0)
            new_l = l_lut[min(int(ll * N_BINS), N_BINS)]
            nr, ng, nb = colorsys.hls_to_rgb(target_h, new_l, target_s)
            dst[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    out.save(out_path)


def copy_pbr_maps(base_name, target_name):
    for suf in ("_n", "_s"):
        s = os.path.join(DST_DIR, f"{base_name}{suf}.png")
        d = os.path.join(DST_DIR, f"{target_name}{suf}.png")
        if os.path.exists(s):
            Image.open(s).save(d)


species = ["oak", "spruce", "birch", "jungle", "acacia", "mangrove", "cherry", "pale_oak", "crimson", "warped"]

base_path = os.path.join(DST_DIR, f"{BASE_NAME}.png")
base_l_sorted = collect_l_sorted(base_path)

for sp in species:
    target_name = f"{sp}_planks"
    ref_path = os.path.join(LBPR_DIR, f"{target_name}.png")
    out_path = os.path.join(DST_DIR, f"{target_name}.png")

    h, s, ref_l = analyze_target_color(ref_path)
    ref_l_sorted = collect_l_sorted(ref_path)
    lut = build_l_lut(base_l_sorted, ref_l_sorted)
    colorize(base_path, out_path, h, s, lut)
    copy_pbr_maps(BASE_NAME, target_name)

    print(f"{target_name:16s} <- {BASE_NAME}  (H={h:.3f} S={s:.3f} ref_mean_L={ref_l:.3f})")

print("\nГотово. dark_oak и bamboo не тронуты.")
