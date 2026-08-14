# -*- coding: utf-8 -*-
"""
Осветляет oak_planks.png — не просто поднимает яркость, а подгоняет
распределение светлоты (Lightness) под референс (tmp_ores/oak_planks_seam/
oak_planks_before.png) методом histogram matching. У референса светлота
плотно сжата вокруг светлого диапазона (мало тёмных пикселей — только тонкие
стыки досок), у текущей текстуры разброс намного шире (широкая теневая
штриховка/грязь на стыках) — из-за этого она выглядит "тёмной", хотя средняя
яркость почти та же. matching выравнивает именно это распределение, сохраняя
собственный рисунок текстуры (ранги пикселей по яркости не меняются).

Насыщенность (Saturation) дополнительно немного поднимается — у референса
она выше (более сочный жёлто-медовый цвет, а не блёклый серо-коричневый).
Тон (Hue) не трогаем — порода та же, просто чище/светлее.

Применяется и к _n/_s? Нет — PBR-карты геометрии не касаются, не трогаем.

Запуск: python tools/lighten-oak-planks.py
"""

import bisect
import colorsys
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
TARGET_PATH = os.path.join(ROOT, "assets", "minecraft", "textures", "block", "oak_planks.png")
REF_PATH = os.path.join(ROOT, "tmp_ores", "oak_planks_seam", "oak_planks_before.png")

N_BINS = 1024


def collect_l_s(path, step=1):
    img = Image.open(path).convert("RGB")
    w, h = img.size
    px = img.load()
    ls = []
    s_sum = 0.0
    n = 0
    for y in range(0, h, step):
        for x in range(0, w, step):
            r, g, b = px[x, y]
            _, l, s = colorsys.rgb_to_hls(r / 255.0, g / 255.0, b / 255.0)
            ls.append(l)
            s_sum += s
            n += 1
    ls.sort()
    return ls, s_sum / n


src_l_sorted, src_mean_s = collect_l_s(TARGET_PATH)
ref_l_sorted, ref_mean_s = collect_l_s(REF_PATH)

# Насыщенность НЕ трогаем: подъём sat отдельно только усиливал мох в стыках
# (он и так зелёный/насыщенный, поднимать его саму его контрастность вредно).
sat_scale = 1.0
print(f"src_mean_s={src_mean_s:.3f} ref_mean_s={ref_mean_s:.3f} sat_scale={sat_scale:.3f} (отключено)")

# LUT: для квантованного значения L исходника находим его перцентиль в
# src-распределении и берём значение с тем же перцентилем в ref-распределении.
n_src = len(src_l_sorted)
n_ref = len(ref_l_sorted)
lut = []
for i in range(N_BINS + 1):
    l_val = i / N_BINS
    rank = bisect.bisect_left(src_l_sorted, l_val) / n_src
    ref_idx = min(int(rank * n_ref), n_ref - 1)
    lut.append(ref_l_sorted[ref_idx])

img = Image.open(TARGET_PATH).convert("RGBA")
w, h = img.size
src = img.load()
out = Image.new("RGBA", (w, h))
dst = out.load()

for y in range(h):
    for x in range(w):
        r, g, b, a = src[x, y]
        hh, ll, ss = colorsys.rgb_to_hls(r / 255.0, g / 255.0, b / 255.0)
        new_l = lut[min(int(ll * N_BINS), N_BINS)]
        new_s = max(0.0, min(1.0, ss * sat_scale))
        nr, ng, nb = colorsys.hls_to_rgb(hh, new_l, new_s)
        dst[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)

out.save(TARGET_PATH)
print("Готово:", TARGET_PATH)
