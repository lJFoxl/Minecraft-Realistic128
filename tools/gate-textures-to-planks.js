// Меняет текстуру всех деревянных калиток (fence_gate_closed/open) на доски
// своего типа (_planks), не трогая геометрию/UV.
// Запуск: node tools/gate-textures-to-planks.js

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const FENCE_DIR = path.join(ROOT, "assets", "minecraft", "models", "block", "fence");

// species -> { dir, prefix, from: текущая текстура, to: новая (planks) }
const species = {
    oak:      { dir: "oak",      prefix: "",        from: "block/oak_planks",            to: "block/oak_planks" },
    acacia:   { dir: "acacia",   prefix: "acacia_", from: "block/stripped_acacia_log",   to: "block/acacia_planks" },
    bamboo:   { dir: "bamboo",   prefix: "",        from: "block/bamboo_stalk",          to: "block/bamboo_planks" },
    birch:    { dir: "birch",    prefix: "",        from: "block/stripped_birch_log",    to: "block/birch_planks" },
    cherry:   { dir: "cherry",   prefix: "",        from: "block/cherry_planks",         to: "block/cherry_planks" },
    crimson:  { dir: "crimson",  prefix: "",        from: "block/stripped_crimson_stem", to: "block/crimson_planks" },
    dark_oak: { dir: "dark_oak", prefix: "",        from: "block/stripped_dark_oak_log", to: "block/dark_oak_planks" },
    jungle:   { dir: "jungle",   prefix: "",        from: "block/stripped_jungle_log",   to: "block/jungle_planks" },
    mangrove: { dir: "mangrove", prefix: "",        from: "block/stripped_mangrove_log", to: "block/mangrove_planks" },
    pale_oak: { dir: "pale_oak", prefix: "",        from: "block/stripped_pale_oak_log", to: "block/pale_oak_planks" },
    spruce:   { dir: "spruce",   prefix: "",        from: "block/stripped_spruce_log",   to: "block/spruce_planks" },
    warped:   { dir: "warped",   prefix: "",        from: "block/stripped_warped_stem",  to: "block/warped_planks" }
};

for (const [name, info] of Object.entries(species)) {
    const dir = path.join(FENCE_DIR, info.dir);
    for (const kind of ["closed", "open"]) {
        const p = path.join(dir, `${info.prefix}fence_gate_${kind}.json`);
        if (!fs.existsSync(p)) {
            console.log(`${name.padEnd(10)} ПРОПУСК (нет файла): ${path.relative(ROOT, p)}`);
            continue;
        }
        const content = fs.readFileSync(p, "utf8");
        const count = (content.match(new RegExp(info.from.replace(/\//g, "\\/"), "g")) || []).length;
        if (count === 0) {
            console.log(`${name.padEnd(10)} ${kind}: '${info.from}' не найдено, пропуск`);
            continue;
        }
        const updated = content.split(info.from).join(info.to);
        fs.writeFileSync(p, updated, "utf8");
        console.log(`${name.padEnd(10)} ${kind}: ${info.from} -> ${info.to}  (${count} вхожд.)`);
    }
}

console.log("\nГотово.");
