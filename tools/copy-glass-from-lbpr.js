// Копирует бесшовное стекло (OptiFine CTM) из LBPR (C:\GameDev\LBPR) в наш пак:
//   - optifine/ctm/glass/         — connect-CTM (47 тайлов) для обычного glass,
//     убирает видимые швы между соседними блоками стекла
//   - optifine/ctm/4_fixed/glass_pane/ — fixed-CTM, подменяет текстуру панели
//     на менее шовный вариант (glass_pane_better.png)
//   - сами текстуры glass/glass_pane/glass_pane_top/glass_pane_better
//
// Блокстейты/модели glass и glass_pane в LBPR не переопределены (используются
// ванильные), поэтому их копировать не нужно — только текстуры и ctm-конфиги.
//
// Запуск: node tools/copy-glass-from-lbpr.js

const fs = require("fs");
const path = require("path");

const SRC = "C:\\GameDev\\LBPR\\assets\\minecraft";
const DST = path.join(__dirname, "..", "assets", "minecraft");

function copyFile(rel) {
    const srcPath = path.join(SRC, rel);
    const dstPath = path.join(DST, rel);
    fs.mkdirSync(path.dirname(dstPath), { recursive: true });
    fs.copyFileSync(srcPath, dstPath);
    return rel;
}
function copyDir(rel) {
    const srcDir = path.join(SRC, rel);
    const copied = [];
    for (const name of fs.readdirSync(srcDir)) {
        copied.push(copyFile(path.join(rel, name)));
    }
    return copied;
}

const copiedFiles = [];

copiedFiles.push(...copyDir("optifine\\ctm\\glass"));
copiedFiles.push(...copyDir("optifine\\ctm\\4_fixed\\glass_pane"));

const textures = [
    "textures\\block\\glass.png",
    "textures\\block\\glass_pane.png",
    "textures\\block\\glass_pane_top.png",
    "textures\\block\\glass_pane_better.png",
];
for (const t of textures) {
    copiedFiles.push(copyFile(t));
}

console.log(`Скопировано файлов: ${copiedFiles.length}`);
copiedFiles.sort().forEach(f => console.log("  " + f));
