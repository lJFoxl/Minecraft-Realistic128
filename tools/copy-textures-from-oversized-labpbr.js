// Переносит диффузные + PBR (_n/_s) текстуры из Oversized-LabPbr-512x
// (tmp_ores/Oversized-LabPbr-512x) в наш пак для: брёвен, обтёсанных брёвен,
// досок, камня, булыжника (обычного), каменного кирпича (обычного),
// красного песка, арбуза.
//
// Копируются только те файлы, что реально есть в источнике (пак неполный —
// не все породы дерева покрыты). Пропуски выводятся в консоль.
//
// Запуск: node tools/copy-textures-from-oversized-labpbr.js

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "tmp_ores", "Oversized-LabPbr-512x", "assets", "minecraft", "textures", "block");
const DST = path.join(__dirname, "..", "assets", "minecraft", "textures", "block");

const suffixes = ["", "_n", "_s"];

function tryCopy(name) {
    let any = false;
    for (const suf of suffixes) {
        const file = `${name}${suf}.png`;
        const s = path.join(SRC, file);
        if (fs.existsSync(s)) {
            fs.copyFileSync(s, path.join(DST, file));
            any = true;
        }
    }
    return any;
}

const logSpecies = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak"];
const strippedNames = [
    "stripped_oak_log", "stripped_oak_wood",
    "stripped_acacia_log", "stripped_acacia_wood",
    "stripped_birch_log",
    "stripped_dark_oak_log"
];
const plankSpecies = ["oak", "spruce", "birch", "dark_oak", "acacia"];
const singles = ["stone", "cobblestone", "stone_bricks", "red_sand", "melon_side", "melon_top"];

const report = [];

for (const sp of logSpecies) {
    const base = tryCopy(`${sp}_log`);
    const top = tryCopy(`${sp}_log_top`);
    report.push(`log ${sp.padEnd(10)} base=${base ? "OK" : "нет"}  top=${top ? "OK" : "нет"}`);
}

for (const name of strippedNames) {
    const ok = tryCopy(name);
    report.push(`stripped ${name.padEnd(22)} ${ok ? "OK" : "нет"}`);
}

for (const sp of plankSpecies) {
    const ok = tryCopy(`${sp}_planks`);
    report.push(`planks ${sp.padEnd(10)} ${ok ? "OK" : "нет"}`);
}

for (const name of singles) {
    const ok = tryCopy(name);
    report.push(`single ${name.padEnd(12)} ${ok ? "OK" : "нет"}`);
}

console.log(report.join("\n"));
console.log("\nГотово.");
