# -*- coding: utf-8 -*-
"""
Подгоняет цвет ОЧИЩЕННЫХ брёвен/стволов (stripped_*_log, stripped_*_stem)
и их торцов под цвет соответствующих досок — чтобы очищенное дерево (внутренняя
древесина) совпадало по тону с досками после того, как доски были перекрашены
от oak (recolor-planks.ps1).

Кору (не-stripped *_log) и обычные торцы (*_log_top) НЕ трогаем — они остаются
как есть, кора темнее и грубее досок по задумке.

Метод — тот же попиксельный перканальный коэффициент, что в recolor-planks.ps1:
  ratio_c = plank_avg_c / log_avg_c   (по средним цветам НАШИХ файлов)
  out_c   = log_c * (1 - STRENGTH + STRENGTH * ratio_c)
При STRENGTH=1 лог полностью совпадает по среднему цвету с досками (кора
становится такой же яркой, как срез — обычно слишком), при STRENGTH=0 лог не
меняется. Промежуточное значение сдвигает оттенок к доскам, сохраняя тени/
блики/рисунок коры и её характерную относительную тёмность.

_n/_s НЕ трогаются — геометрия коры/спила не меняется, меняется только альбедо.
Обрабатываются только текстуры, которые уже есть в паке; отсутствующие
(напр. mangrove_log, cherry_log) пропускаются — они используют ваниль.

Запуск:  python tools/recolor-logs-to-planks.py [STRENGTH]
"""
import os
import sys

import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
DST_DIR = os.path.join(ROOT, "assets", "minecraft", "textures", "block")

STRENGTH = 0.6
if len(sys.argv) > 1:
    STRENGTH = float(sys.argv[1])

# Породы, у которых есть доски в паке. Для нижнего мира planks = *_planks,
# а лог-семья называется *_stem — это учитывается в patterns.
SPECIES = [
    "oak", "spruce", "birch", "jungle", "acacia", "dark_oak",
    "mangrove", "cherry", "pale_oak", "crimson", "warped",
]

# Кандидаты — ТОЛЬКО очищенные варианты (stripped). Кору и обычные торцы не трогаем.
PATTERNS = [
    "stripped_{sp}_log.png",
    "stripped_{sp}_log_top.png",
    "stripped_{sp}_stem.png",
    "stripped_{sp}_stem_top.png",
]


def avg_rgb(path):
    arr = np.asarray(Image.open(path).convert("RGB"), dtype=np.float64)
    return arr.reshape(-1, 3).mean(axis=0)


def recolor(log_path, plank_avg, log_avg):
    img = Image.open(log_path).convert("RGBA")
    arr = np.asarray(img, dtype=np.float64)
    rgb = arr[..., :3]
    alpha = arr[..., 3]

    ratio = plank_avg / np.maximum(log_avg, 1.0)        # поканально
    factor = 1.0 - STRENGTH + STRENGTH * ratio           # скаляр по каналам
    out_rgb = np.clip(rgb * factor, 0, 255)

    out = np.dstack([out_rgb, alpha]).astype(np.uint8)
    Image.fromarray(out, "RGBA").save(log_path)


print(f"STRENGTH={STRENGTH}")
for sp in SPECIES:
    plank_path = os.path.join(DST_DIR, f"{sp}_planks.png")
    if not os.path.exists(plank_path):
        continue
    plank_avg = avg_rgb(plank_path)
    print(f"\n=== {sp}  planks avg={tuple(int(v) for v in plank_avg)} ===")
    for pat in PATTERNS:
        log_path = os.path.join(DST_DIR, pat.format(sp=sp))
        if not os.path.exists(log_path):
            continue
        log_avg = avg_rgb(log_path)
        recolor(log_path, plank_avg, log_avg)
        new_avg = avg_rgb(log_path)
        name = os.path.basename(log_path)
        print(f"  {name:34s} {tuple(int(v) for v in log_avg)} -> "
              f"{tuple(int(v) for v in new_avg)}")

print("\nГотово.")