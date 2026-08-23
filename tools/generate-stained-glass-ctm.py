# -*- coding: utf-8 -*-
"""
Генерирует бесшовный CTM для всех 16 цветов витражного стекла НА БАЗЕ уже
скопированного CTM обычного стекла (assets/minecraft/optifine/ctm/glass,
47 тайлов из LBPR, см. copy-glass-from-lbpr.js).

Геометрия/альфа (какой тайл куда подставляется при соединении блоков) берётся
как есть у обычного стекла — она не зависит от цвета. Меняется только RGB, и
не прямым умножением на коэффициент (это давало слишком светлые тёмные цвета:
чёрное стекло не выглядело чёрным, а на глаз почти не отличалось от tinted
glass — ratio для обоих был near-1:1 по каналам, т.к. оба цвета почти серые),
а переносом среднего + приглушённой вариацией паттерна вокруг него:
    out = цвет_avg + (tile_rgb - ctm_tiles_avg) * CONTRAST
Так итоговый тон тайла ВСЕГДА совпадает со средним цветом текстуры (чёрное
реально тёмное, витражные цвета не размываются яркими бликами рамы из
обычного стекла), а само соединительное CTM-паттерн остаётся видно слабым
рельефом по краям. Альфа не меняется.

Результат кладётся в assets/minecraft/optifine/ctm/stained_glass/<color>/
с properties (matchBlocks=<color>_stained_glass, method=ctm, tiles=0-46).

Запуск:  python tools/generate-stained-glass-ctm.py
"""
import os

import numpy as np
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
TEX_DIR = os.path.join(ROOT, "assets", "minecraft", "textures", "block")
SRC_CTM_DIR = os.path.join(ROOT, "assets", "minecraft", "optifine", "ctm", "glass")
DST_CTM_ROOT = os.path.join(ROOT, "assets", "minecraft", "optifine", "ctm", "stained_glass")

TILE_COUNT = 47  # 0..46
CONTRAST = 0.35  # доля исходной вариации паттерна, сохраняемая поверх среднего цвета

COLORS = [
    "white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray",
    "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black",
]


def avg_rgb(path):
    arr = np.asarray(Image.open(path).convert("RGB"), dtype=np.float64)
    return arr.reshape(-1, 3).mean(axis=0)


tile_paths = [os.path.join(SRC_CTM_DIR, f"{i}.png") for i in range(TILE_COUNT)]
clear_avg = np.mean([avg_rgb(p) for p in tile_paths], axis=0)
print(f"ctm tiles avg={tuple(round(v, 1) for v in clear_avg)}")

for color in COLORS:
    color_tex = os.path.join(TEX_DIR, f"{color}_stained_glass.png")
    if not os.path.exists(color_tex):
        print(f"  [{color}] пропущено: нет {color_tex}")
        continue

    color_avg = avg_rgb(color_tex)
    print(f"{color:12s} avg={tuple(round(v, 1) for v in color_avg)}")

    dst_dir = os.path.join(DST_CTM_ROOT, color)
    os.makedirs(dst_dir, exist_ok=True)

    for i in range(TILE_COUNT):
        src_tile = os.path.join(SRC_CTM_DIR, f"{i}.png")
        img = Image.open(src_tile).convert("RGBA")
        arr = np.asarray(img, dtype=np.float64)
        rgb = arr[..., :3]
        alpha = arr[..., 3]

        out_rgb = np.clip(color_avg + (rgb - clear_avg) * CONTRAST, 0, 255)
        out = np.dstack([out_rgb, alpha]).astype(np.uint8)
        Image.fromarray(out, "RGBA").save(os.path.join(dst_dir, f"{i}.png"))

    props_path = os.path.join(dst_dir, f"{color}.properties")
    with open(props_path, "w", encoding="utf-8") as f:
        f.write(
            f"matchBlocks={color}_stained_glass\n"
            "connect=block\n"
            "method=ctm\n"
            "tiles=0-46\n"
            "innerSeams=true\n"
        )

print("\nГотово.")
