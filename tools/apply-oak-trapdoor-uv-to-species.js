// Переносит новую (откорректированную вручную) геометрию/UV из oak_trapdoor.json
// на остальные деревянные люки, использующие текстуру досок (_planks).
// bamboo не трогаем — у неё своя текстура.
// Запуск: node tools/apply-oak-trapdoor-uv-to-species.js

const fs = require("fs");
const path = require("path");

const MODELS_DIR = path.join(__dirname, "..", "assets", "minecraft", "models", "block");

const oakJson = fs.readFileSync(path.join(MODELS_DIR, "oak_trapdoor.json"), "utf8");
const count = (oakJson.match(/block\/oak_planks/g) || []).length;
if (count === 0) {
    throw new Error("В oak_trapdoor.json не найдено 'block/oak_planks' — шаблон изменился?");
}

const species = ["spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "pale_oak", "crimson", "warped"];

for (const sp of species) {
    const out = oakJson.split("block/oak_planks").join(`block/${sp}_planks`);
    const p = path.join(MODELS_DIR, `${sp}_trapdoor.json`);
    fs.writeFileSync(p, out, "utf8");
    console.log(`${sp.padEnd(10)} -> block/${sp}_planks  (${count} вхожд.)`);
}

console.log("\nГотово. bamboo не тронут.");
