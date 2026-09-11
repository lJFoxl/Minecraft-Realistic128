// Тиражирует ручную работу пользователя над oak_door (новая геометрия
// bottom через общие parent door_bottom/door_bottom_rh + новая геометрия
// top с текстурными слотами planks/log, плюс починенный top_right_open)
// на остальные деревянные породы дверей. iron/copper-семья НЕ трогается —
// это не дерево, у них остаётся своя текстура door_upper/lower/sides.
//
// Для каждой породы: "log" = {sp}_log, кроме crimson/warped ({sp}_stem)
// и bamboo (bamboo_block — у бамбука нет log, это ближайший аналог).
//
// Запуск: node tools/scale-oak-door-to-species.js

const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "assets", "minecraft", "models", "block");

const SPECIES = {
    spruce: "spruce_log",
    birch: "birch_log",
    jungle: "jungle_log",
    acacia: "acacia_log",
    dark_oak: "dark_oak_log",
    mangrove: "mangrove_log",
    cherry: "cherry_log",
    pale_oak: "pale_oak_log",
    bamboo: "bamboo_block",
    crimson: "crimson_stem",
    warped: "warped_stem",
};

function readJson(p) {
    return JSON.parse(fs.readFileSync(p, "utf8"));
}
function writeJson(p, obj) {
    fs.writeFileSync(p, JSON.stringify(obj, null, "\t") + "\n");
}

const oakTopLeft = readJson(path.join(DIR, "oak_door_top_left.json"));
const oakTopRight = readJson(path.join(DIR, "oak_door_top_right.json"));

const written = [];

for (const [sp, log] of Object.entries(SPECIES)) {
    const planks = `${sp}_planks`;

    // --- низ: через общие parent-модели door_bottom / door_bottom_rh ---
    writeJson(path.join(DIR, `${sp}_door_bottom_left.json`), {
        format_version: "1.21.11",
        credit: "Made with Blockbench",
        parent: "block/door_bottom",
        textures: {
            sides: `block/${log}`,
            front: `block/${planks}`,
        },
    });
    written.push(`${sp}_door_bottom_left.json`);

    writeJson(path.join(DIR, `${sp}_door_bottom_right.json`), {
        format_version: "1.21.11",
        credit: "Made with Blockbench",
        parent: "block/door_bottom_rh",
        textures: {
            sides: `block/${log}`,
            particle: `block/${planks}`,
            front: `block/${planks}`,
        },
    });
    written.push(`${sp}_door_bottom_right.json`);

    // --- верх: та же геометрия, что у oak, свои текстуры ---
    const topLeft = JSON.parse(JSON.stringify(oakTopLeft));
    topLeft.textures = { "3": `block/${planks}`, "4": `block/${log}`, particle: `block/${log}` };
    writeJson(path.join(DIR, `${sp}_door_top_left.json`), topLeft);
    written.push(`${sp}_door_top_left.json`);

    const topRight = JSON.parse(JSON.stringify(oakTopRight));
    topRight.textures = { "1": `block/${planks}`, "2": `block/${log}`, particle: `block/${planks}` };
    writeJson(path.join(DIR, `${sp}_door_top_right.json`), topRight);
    written.push(`${sp}_door_top_right.json`);

    // --- top_right_open: parent на общую повёрнутую модель, текстура planks ---
    writeJson(path.join(DIR, `${sp}_door_top_right_open.json`), {
        parent: "minecraft:block/door_top_right_open",
        textures: {
            bottom: `minecraft:block/${planks}`,
            top: `minecraft:block/${planks}`,
        },
    });
    written.push(`${sp}_door_top_right_open.json`);
}

console.log(`Записано файлов: ${written.length}`);
written.forEach(f => console.log("  " + f));
