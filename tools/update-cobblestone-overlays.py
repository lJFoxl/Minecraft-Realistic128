# -*- coding: utf-8 -*-
"""
Обновляет CTM-оверлеи "булыжник перекрывает соседние блоки"
(optifine/ctm/2_overlays/cobblestone и .../cobblestone_logs) под новую
текстуру cobblestone.png (перенесена из Oversized-LabPbr-512x).

Каждый файл 0.png..16.png в этих папках — это один и тот же холст булыжника
с разной альфа-маской (форма угла/кромки перехода на соседний блок).
Меняем RGB на новую текстуру булыжника В ЕЁ РОДНОМ РАЗРЕШЕНИИ (512x512,
без уменьшения), альфа-маску (форму) масштабируем вверх с исходных 128x128
и оставляем как есть по форме.

mossy_cobblestone НЕ трогаем — речь только про обычный булыжник.

Запуск: python tools/update-cobblestone-overlays.py
"""

import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
NEW_COBBLE = os.path.join(ROOT, "assets", "minecraft", "textures", "block", "cobblestone.png")
OVERLAY_DIRS = [
    os.path.join(ROOT, "assets", "minecraft", "optifine", "ctm", "2_overlays", "cobblestone"),
    os.path.join(ROOT, "assets", "minecraft", "optifine", "ctm", "2_overlays", "cobblestone_logs"),
]

new_src = Image.open(NEW_COBBLE).convert("RGBA")
target_size = new_src.size

for d in OVERLAY_DIRS:
    tiles = [f for f in os.listdir(d) if f.endswith(".png")]
    for fname in tiles:
        p = os.path.join(d, fname)
        old = Image.open(p).convert("RGBA")
        alpha = old.split()[3].resize(target_size, Image.LANCZOS)
        out = new_src.copy()
        out.putalpha(alpha)
        out.save(p)
    print(f"{os.path.relpath(d, ROOT)}: обновлено {len(tiles)} тайлов -> {target_size[0]}x{target_size[1]}")

print("\nГотово.")
