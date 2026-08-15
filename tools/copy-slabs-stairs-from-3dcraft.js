// Копирует 3D slab/stairs (все 10 пород дерева) из 3DCraft (SkylaDev, MIT)
// в наш пак. Закрывает пробел из памяти "slabs-stairs-3d-deferred".
// Источник: https://github.com/SkylaDev/3DCraft (скачан локально в tmp_ores/3dcraft_repo)
//
// Запуск: node tools/copy-slabs-stairs-from-3dcraft.js

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "tmp_ores", "3dcraft_repo", "3DCraft-main", "assets", "minecraft");
const DST = path.join(__dirname, "..", "assets", "minecraft");

function copyFile(rel) {
    const s = path.join(SRC, rel);
    const d = path.join(DST, rel);
    fs.mkdirSync(path.dirname(d), { recursive: true });
    fs.copyFileSync(s, d);
    return rel;
}

const species = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "warped", "crimson"];

const stairSuffixes = [
    "e", "e_top", "inner_ne", "inner_ne_top", "inner_nw", "inner_nw_top",
    "inner_se", "inner_se_top", "inner_sw", "inner_sw_top",
    "n", "n_top", "outer_ne", "outer_ne_top", "outer_nw", "outer_nw_top",
    "outer_se", "outer_se_top", "outer_sw", "outer_sw_top",
    "s", "s_top", "w", "w_top"
];

let copied = [];

// --- общие шаблоны (models/block/temp_plank_*) ---
copied.push(copyFile("models/block/temp_plank_slab.json"));
copied.push(copyFile("models/block/temp_plank_slab_top.json"));
for (const suf of stairSuffixes) {
    copied.push(copyFile(`models/block/temp_plank_stairs_${suf}.json`));
}

// --- по каждой породе: slab/slab_top + 24 stairs-обёртки + blockstate stairs ---
for (const sp of species) {
    copied.push(copyFile(`models/block/${sp}_slab.json`));
    copied.push(copyFile(`models/block/${sp}_slab_top.json`));
    for (const suf of stairSuffixes) {
        copied.push(copyFile(`models/block/${sp}_stairs_${suf}.json`));
    }
    copied.push(copyFile(`blockstates/${sp}_stairs.json`));
}

console.log(`Скопировано файлов: ${copied.length}`);
console.log("Готово.");
