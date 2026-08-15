// Копирует геометрию acacia_trapdoor.json на все остальные ДЕРЕВЯННЫЕ люки
// (кроме bamboo — у неё осталась своя модель), меняя только текстуры.
// Запуск: node tools/apply-acacia-trapdoor-to-species.js

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const MODELS_DIR = path.join(ROOT, "assets", "minecraft", "models", "block");

const acaciaJson = fs.readFileSync(path.join(MODELS_DIR, "acacia_trapdoor.json"), "utf8");
if ((acaciaJson.match(/block\/acacia_trapdoor/g) || []).length === 0 ||
    (acaciaJson.match(/block\/acacia_door_sides/g) || []).length === 0) {
    throw new Error("В acacia_trapdoor.json не найдены ожидаемые текстуры — шаблон изменился?");
}

const species = ["oak", "spruce", "birch", "jungle", "dark_oak", "mangrove", "cherry", "pale_oak", "crimson", "warped"];

for (const sp of species) {
    let out = acaciaJson.split("block/acacia_trapdoor").join(`block/${sp}_trapdoor`);
    out = out.split("block/acacia_door_sides").join(`block/${sp}_door_sides`);
    const p = path.join(MODELS_DIR, `${sp}_trapdoor.json`);
    fs.writeFileSync(p, out, "utf8");
    console.log(`${sp.padEnd(10)} -> block/${sp}_trapdoor + block/${sp}_door_sides`);
}

console.log("\nГотово.");
