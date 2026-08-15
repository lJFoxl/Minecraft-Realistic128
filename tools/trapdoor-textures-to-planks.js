// Меняет текстуры деревянных люков на доски своего типа (_planks), не трогая
// bamboo (у неё остаётся её собственная текстура bamboo_trapdoor/door_sides).
// Запуск: node tools/trapdoor-textures-to-planks.js

const fs = require("fs");
const path = require("path");

const MODELS_DIR = path.join(__dirname, "..", "assets", "minecraft", "models", "block");

const species = ["oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "cherry", "pale_oak", "crimson", "warped"];

for (const sp of species) {
    const p = path.join(MODELS_DIR, `${sp}_trapdoor.json`);
    let content = fs.readFileSync(p, "utf8");
    const before = content;
    content = content.split(`block/${sp}_door_sides`).join(`block/${sp}_planks`);
    content = content.split(`block/${sp}_trapdoor`).join(`block/${sp}_planks`);
    fs.writeFileSync(p, content, "utf8");
    const changed = content !== before;
    console.log(`${sp.padEnd(10)} ${changed ? "-> block/" + sp + "_planks" : "(без изменений?)"}`);
}

console.log("\nГотово. bamboo не тронут.");
