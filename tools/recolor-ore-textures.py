# -*- coding: utf-8 -*-
"""
Берёт gold_ore.png (512, Oversized-LabPbr-512x) как единую структурную
основу (кристаллическая огранка) для iron_ore И gold_ore — у исходного
iron_ore в паке-источнике была совсем другая (поцарапанный металл), не
сочетающаяся стилистически текстура, поэтому берём одну и ту же основу и
разного его перекрашиваем.

Текущий цвет в источнике "слабый" (блёклый оливково-серый, S~0.33) — тон
частично смещаем к целевому (не полностью флэттим — сохраняем собственные
вариации яркости/оттенка кристаллов как текстуру), насыщенность заметно
поднимаем.

iron_block.png = копия итогового iron_ore (по просьбе — блок железа
использует текстуру рудного железа).

_n/_s берутся с исходного gold_ore (структура/геометрия одна и та же для
обеих руд и для железного блока).

Запуск: python tools/recolor-ore-textures.py
"""

import colorsys
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), "..")
DST_DIR = os.path.join(ROOT, "assets", "minecraft", "textures", "block")
SRC_BASE = os.path.join(ROOT, "tmp_ores", "Oversized-LabPbr-512x", "assets", "minecraft", "textures", "block", "gold_ore.png")
SRC_BASE_N = os.path.join(ROOT, "tmp_ores", "Oversized-LabPbr-512x", "assets", "minecraft", "textures", "block", "gold_ore_n.png")
SRC_BASE_S = os.path.join(ROOT, "tmp_ores", "Oversized-LabPbr-512x", "assets", "minecraft", "textures", "block", "gold_ore_s.png")


def recolor(base_path, out_path, target_h, hue_blend, sat_mult, l_mult=1.0):
    img = Image.open(base_path).convert("RGBA")
    w, h = img.size
    src = img.load()
    out = Image.new("RGBA", (w, h))
    dst = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = src[x, y]
            hh, ll, ss = colorsys.rgb_to_hls(r / 255.0, g / 255.0, b / 255.0)
            new_h = hh * (1 - hue_blend) + target_h * hue_blend
            new_s = max(0.0, min(1.0, ss * sat_mult))
            new_l = max(0.0, min(1.0, ll * l_mult))
            nr, ng, nb = colorsys.hls_to_rgb(new_h, new_l, new_s)
            dst[x, y] = (round(nr * 255), round(ng * 255), round(nb * 255), a)
    out.save(out_path)


gold_out = os.path.join(DST_DIR, "gold_ore.png")
iron_out = os.path.join(DST_DIR, "iron_ore.png")
iron_block_out = os.path.join(DST_DIR, "iron_block.png")

# золото: сдвигаем ближе к чистому жёлто-золотому (0.13), насыщенность x1.9
recolor(SRC_BASE, gold_out, target_h=0.13, hue_blend=0.55, sat_mult=1.9, l_mult=1.05)
print("gold_ore.png готов")

# железо: сдвигаем к ржаво-рыжему (0.065), насыщенность x1.35 (железо менее яркое, чем золото)
recolor(SRC_BASE, iron_out, target_h=0.065, hue_blend=0.75, sat_mult=1.35, l_mult=0.95)
print("iron_ore.png готов")

for suf, src_p in ((".png", None), ("_n.png", SRC_BASE_N), ("_s.png", SRC_BASE_S)):
    if src_p is None:
        continue
    for name in ("gold_ore", "iron_ore"):
        Image.open(src_p).save(os.path.join(DST_DIR, f"{name}{suf}"))
print("_n/_s скопированы для gold_ore и iron_ore")

# iron_block = копия итогового iron_ore (+ n/s)
Image.open(iron_out).save(iron_block_out)
Image.open(SRC_BASE_N).save(os.path.join(DST_DIR, "iron_block_n.png"))
Image.open(SRC_BASE_S).save(os.path.join(DST_DIR, "iron_block_s.png"))
print("iron_block.png (+n/s) = копия iron_ore")

print("\nГотово.")
