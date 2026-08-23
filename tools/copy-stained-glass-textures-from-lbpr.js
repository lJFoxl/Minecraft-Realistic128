// Копирует базовые текстуры цветного стекла (16 цветов) из LBPR:
// <color>_stained_glass.png + <color>_stained_glass_pane_top.png.
// Это только "плоская" текстура (нужна как база блока/иконка и для расчёта
// цветового коэффициента в generate-stained-glass-ctm.py) — сам бесшовный
// вид даёт CTM, который генерируется отдельным скриптом на основе обычного
// стекла (assets/minecraft/optifine/ctm/glass).
//
// Запуск: node tools/copy-stained-glass-textures-from-lbpr.js

const fs = require("fs");
const path = require("path");

const SRC = "C:\\GameDev\\LBPR\\assets\\minecraft";
const DST = path.join(__dirname, "..", "assets", "minecraft");

const COLORS = [
    "white", "orange", "magenta", "light_blue", "yellow", "lime", "pink", "gray",
    "light_gray", "cyan", "purple", "blue", "brown", "green", "red", "black"
];

function copyFile(rel) {
    const srcPath = path.join(SRC, rel);
    const dstPath = path.join(DST, rel);
    fs.mkdirSync(path.dirname(dstPath), { recursive: true });
    fs.copyFileSync(srcPath, dstPath);
    return rel;
}

const copiedFiles = [];
for (const c of COLORS) {
    copiedFiles.push(copyFile(`textures\\block\\${c}_stained_glass.png`));
    copiedFiles.push(copyFile(`textures\\block\\${c}_stained_glass_pane_top.png`));
}

console.log(`Скопировано файлов: ${copiedFiles.length}`);
copiedFiles.forEach(f => console.log("  " + f));
