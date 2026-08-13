// Копирует geometрию/UV/cullface из исправленных oak_fence_gate_closed.json и
// oak_fence_gate_open.json на все остальные деревянные калитки, меняя только
// текстуру (каждая порода сохраняет СВОЙ материал, какой у неё уже был).
// nether_brick_fence_gate не трогаем — она каменная, не деревянная.
//
// Запуск: node tools/apply-oak-gate-to-species.js

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FENCE_DIR = path.join(ROOT, "assets", "minecraft", "models", "block", "fence");

const oakClosed = fs.readFileSync(path.join(FENCE_DIR, "oak", "fence_gate_closed.json"), "utf8");
const oakOpen = fs.readFileSync(path.join(FENCE_DIR, "oak", "fence_gate_open.json"), "utf8");

if ((oakClosed.match(/block\/oak_planks/g) || []).length === 0) {
    throw new Error("В oak/fence_gate_closed.json не найдено 'block/oak_planks' — шаблон изменился?");
}
if ((oakOpen.match(/block\/oak_planks/g) || []).length === 0) {
    throw new Error("В oak/fence_gate_open.json не найдено 'block/oak_planks' — шаблон изменился?");
}

// species -> { dir: папка внутри fence/, prefix: префикс имени файла ("" если без него), texture: своя текстура }
const species = {
    acacia:   { dir: "acacia",   prefix: "acacia_", texture: "block/stripped_acacia_log" },
    bamboo:   { dir: "bamboo",   prefix: "",        texture: "block/bamboo_stalk" },
    birch:    { dir: "birch",    prefix: "",        texture: "block/stripped_birch_log" },
    cherry:   { dir: "cherry",   prefix: "",        texture: "block/cherry_planks" },
    crimson:  { dir: "crimson",  prefix: "",        texture: "block/stripped_crimson_stem" },
    dark_oak: { dir: "dark_oak", prefix: "",        texture: "block/stripped_dark_oak_log" },
    jungle:   { dir: "jungle",   prefix: "",        texture: "block/stripped_jungle_log" },
    mangrove: { dir: "mangrove", prefix: "",        texture: "block/stripped_mangrove_log" },
    pale_oak: { dir: "pale_oak", prefix: "",        texture: "block/stripped_pale_oak_log" },
    spruce:   { dir: "spruce",   prefix: "",        texture: "block/stripped_spruce_log" },
    warped:   { dir: "warped",   prefix: "",        texture: "block/stripped_warped_stem" }
};

for (const [name, info] of Object.entries(species)) {
    const dir = path.join(FENCE_DIR, info.dir);
    fs.mkdirSync(dir, { recursive: true });

    const closedOut = oakClosed.split("block/oak_planks").join(info.texture);
    const openOut = oakOpen.split("block/oak_planks").join(info.texture);

    const closedPath = path.join(dir, `${info.prefix}fence_gate_closed.json`);
    const openPath = path.join(dir, `${info.prefix}fence_gate_open.json`);

    fs.writeFileSync(closedPath, closedOut, "utf8");
    fs.writeFileSync(openPath, openOut, "utf8");
    console.log(`${name.padEnd(10)} -> ${info.texture}`);
    console.log(`  ${path.relative(ROOT, closedPath)}`);
    console.log(`  ${path.relative(ROOT, openPath)}`);
}

console.log("\nГотово.");
