// Копирует geometry/UV забора (fence_post/fence_side/fence_inventory) с oak
// на все остальные деревянные заборы, меняя только текстуру на _planks
// своей породы. bamboo не трогаем.
//
// acacia использует префиксованные имена файлов (acacia_fence_post.json и
// т.д.) — учитываем это при записи, остальные породы используют обычные
// fence_post.json/fence_side.json/fence_inventory.json (как в блокстейтах).
//
// Запуск: node tools/apply-oak-fence-to-species.js

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FENCE_DIR = path.join(ROOT, "assets", "minecraft", "models", "block", "fence");

const parts = ["fence_post", "fence_side", "fence_inventory"];

const oakSources = {};
for (const part of parts) {
    const content = fs.readFileSync(path.join(FENCE_DIR, "oak", `${part}.json`), "utf8");
    if ((content.match(/block\/oak_planks/g) || []).length === 0) {
        throw new Error(`В oak/${part}.json не найдено 'block/oak_planks' — шаблон изменился?`);
    }
    oakSources[part] = content;
}

// species -> { dir, prefix } — prefix пустой, если имена файлов без префикса породы
const species = {
    spruce:   { dir: "spruce",   prefix: "" },
    birch:    { dir: "birch",    prefix: "" },
    jungle:   { dir: "jungle",   prefix: "" },
    acacia:   { dir: "acacia",   prefix: "acacia_" },
    dark_oak: { dir: "dark_oak", prefix: "" },
    mangrove: { dir: "mangrove", prefix: "" },
    cherry:   { dir: "cherry",   prefix: "" },
    pale_oak: { dir: "pale_oak", prefix: "" },
    crimson:  { dir: "crimson",  prefix: "" },
    warped:   { dir: "warped",   prefix: "" }
};

for (const [name, info] of Object.entries(species)) {
    const dir = path.join(FENCE_DIR, info.dir);
    for (const part of parts) {
        const out = oakSources[part].split("block/oak_planks").join(`block/${name}_planks`);
        const outPath = path.join(dir, `${info.prefix}${part}.json`);
        fs.writeFileSync(outPath, out, "utf8");
        console.log(`${path.relative(ROOT, outPath)}`);
    }
    console.log(`${name.padEnd(10)} -> block/${name}_planks\n`);
}

console.log("Готово. bamboo не тронут.");
