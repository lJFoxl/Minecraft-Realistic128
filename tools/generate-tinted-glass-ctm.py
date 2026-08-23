# -*- coding: utf-8 -*-
"""
Генерирует бесшовный CTM для tinted_glass (тонированное стекло) НА БАЗЕ уже
скопированного CTM обычного стекла (assets/minecraft/optifine/ctm/glass,
47 тайлов из LBPR) — тем же способом, что и generate-stained-glass-ctm.py
для витражного стекла: каждый тайл умножается на поканальный коэффициент
    ratio = tinted_glass_avg / ctm_tiles_avg
альфа не меняется (геометрия соединения одна и та же, tinted_glass — просто
блок глубже/темнее по тону).

Красится тем же способом, что и generate-stained-glass-ctm.py: out = avg +
(tile - ctm_tiles_avg) * CONTRAST — иначе прямое умножение на коэффициент
оставляло тайл слишком светлым (яркие блики рамы из обычного стекла почти не
темнели) и tinted_glass визуально не отличался от black_stained_glass — у
ванильного tinted_glass и так едва заметный (несколько единиц RGB) фиолетово-
бурый оттенок относительно серого, поэтому здесь он ещё умеренно усилен
(SATURATION_BOOST), чтобы цвет читался как "тонировка", а не просто "серее".

Результат: assets/minecraft/optifine/ctm/tinted_glass/0-46.png +
tinted_glass.properties (matchBlocks=tinted_glass, method=ctm, tiles=0-46).

Запуск:  python tools/generate-tinted-glass-ctm.py
"""
import os

import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
TEX_DIR = os.path.join(ROOT, "assets", "minecraft", "textures", "block")
SRC_CTM_DIR = os.path.join(ROOT, "assets", "minecraft", "optifine", "ctm", "glass")
DST_CTM_DIR = os.path.join(ROOT, "assets", "minecraft", "optifine", "ctm", "tinted_glass")

TILE_COUNT = 47  # 0..46
CONTRAST = 0.35  # доля исходной вариации паттерна, сохраняемая поверх среднего цвета
SATURATION_BOOST = 5.0  # усиление слабого фиолетово-бурого оттенка tinted_glass


def avg_rgb(path):
    arr = np.asarray(Image.open(path).convert("RGB"), dtype=np.float64)
    return arr.reshape(-1, 3).mean(axis=0)


tile_paths = [os.path.join(SRC_CTM_DIR, f"{i}.png") for i in range(TILE_COUNT)]
clear_avg = np.mean([avg_rgb(p) for p in tile_paths], axis=0)
print(f"ctm tiles avg={tuple(round(v, 1) for v in clear_avg)}")

tinted_avg = avg_rgb(os.path.join(TEX_DIR, "tinted_glass.png"))
luminance = tinted_avg.mean()
boosted_avg = luminance + (tinted_avg - luminance) * SATURATION_BOOST
print(f"tinted_glass avg={tuple(round(v, 1) for v in tinted_avg)} boosted={tuple(round(v, 1) for v in boosted_avg)}")

os.makedirs(DST_CTM_DIR, exist_ok=True)

for i in range(TILE_COUNT):
    img = Image.open(tile_paths[i]).convert("RGBA")
    arr = np.asarray(img, dtype=np.float64)
    rgb = arr[..., :3]
    alpha = arr[..., 3]

    out_rgb = np.clip(boosted_avg + (rgb - clear_avg) * CONTRAST, 0, 255)
    out = np.dstack([out_rgb, alpha]).astype(np.uint8)
    Image.fromarray(out, "RGBA").save(os.path.join(DST_CTM_DIR, f"{i}.png"))

props_path = os.path.join(DST_CTM_DIR, "tinted_glass.properties")
with open(props_path, "w", encoding="utf-8") as f:
    f.write(
        "matchBlocks=tinted_glass\n"
        "connect=block\n"
        "method=ctm\n"
        "tiles=0-46\n"
        "innerSeams=true\n"
    )

print("\nГотово.")
