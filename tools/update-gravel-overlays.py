# -*- coding: utf-8 -*-
"""
Обновляет CTM-оверлеи "гравий перекрывает соседние блоки"
(optifine/ctm/2_overlays/gravel и .../suspicious_gravel) под новую
текстуру gravel.png (перенесена из Oversized-LabPbr-512x).

Та же техника, что и для булыжника (см. update-cobblestone-overlays.py):
RGB тайлов заменяется на новую текстуру гравия в её родном разрешении,
альфа-маска (форма кромки/угла) масштабируется вверх с исходного размера
и по форме не меняется.

suspicious_gravel тоже обновляем — визуально это тот же гравий (архео-блок),
должен совпадать по цвету с обычным гравием на стыках.

Запуск: python tools/update-gravel-overlays.py
"""

import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
NEW_GRAVEL = os.path.join(ROOT, "assets", "minecraft", "textures", "block", "gravel.png")
OVERLAY_DIRS = [
    os.path.join(ROOT, "assets", "minecraft", "optifine", "ctm", "2_overlays", "gravel"),
    os.path.join(ROOT, "assets", "minecraft", "optifine", "ctm", "2_overlays", "suspicious_gravel"),
]

new_src = Image.open(NEW_GRAVEL).convert("RGBA")
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
