// Тиражирует новую геометрию oak_door (общие parent door_bottom/door_bottom_rh
// для низа + новая геометрия верха с текстурными слотами) на металлические
// двери: iron и copper-семью (copper/exposed_copper/oxidized_copper/
// weathered_copper). Каждая — под ОДНУ текстуру всего блока (как уже сделали
// вручную для iron_door: front/sides/всё = iron_block), а не под лог+доски.
//
// copper получает полноценную самостоятельную верх-геометрию (как oak),
// exposed/oxidized/weathered наследуют её через parent (как это уже было
// устроено у LBPR: "block/copper_door_top_left/right") со своей текстурой.
//
// Запуск: node tools/scale-oak-door-to-metal.js

const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "assets", "minecraft", "models", "block");

// порядок важен: copper первым — под него делается самостоятельная геометрия,
// остальные наследуют её через parent
const TYPES = {
    copper: "copper_block",
    exposed_copper: "exposed_copper",
    oxidized_copper: "oxidized_copper",
    weathered_copper: "weathered_copper",
    iron: "iron_block",
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

for (const [sp, tex] of Object.entries(TYPES)) {
    // --- низ: общие parent-модели, единая текстура на front и sides ---
    writeJson(path.join(DIR, `${sp}_door_bottom_left.json`), {
        format_version: "1.21.11",
        credit: "Made with Blockbench",
        parent: "block/door_bottom",
        textures: {
            particle: `block/${tex}`,
            sides: `block/${tex}`,
            front: `block/${tex}`,
        },
    });
    written.push(`${sp}_door_bottom_left.json`);

    writeJson(path.join(DIR, `${sp}_door_bottom_right.json`), {
        format_version: "1.21.11",
        credit: "Made with Blockbench",
        parent: "block/door_bottom_rh",
        textures: {
            particle: `block/${tex}`,
            sides: `block/${tex}`,
            front: `block/${tex}`,
        },
    });
    written.push(`${sp}_door_bottom_right.json`);

    // --- верх: copper — своя копия геометрии oak; остальные — parent на copper ---
    if (sp === "copper") {
        const topLeft = JSON.parse(JSON.stringify(oakTopLeft));
        topLeft.textures = { "3": `block/${tex}`, "4": `block/${tex}`, particle: `block/${tex}` };
        writeJson(path.join(DIR, `${sp}_door_top_left.json`), topLeft);

        const topRight = JSON.parse(JSON.stringify(oakTopRight));
        topRight.textures = { "1": `block/${tex}`, "2": `block/${tex}`, particle: `block/${tex}` };
        writeJson(path.join(DIR, `${sp}_door_top_right.json`), topRight);
    } else {
        writeJson(path.join(DIR, `${sp}_door_top_left.json`), {
            parent: "block/copper_door_top_left",
            textures: { "3": `block/${tex}`, "4": `block/${tex}`, particle: `block/${tex}` },
        });
        writeJson(path.join(DIR, `${sp}_door_top_right.json`), {
            parent: "block/copper_door_top_right",
            textures: { "1": `block/${tex}`, "2": `block/${tex}`, particle: `block/${tex}` },
        });
    }
    written.push(`${sp}_door_top_left.json`, `${sp}_door_top_right.json`);

    // --- top_right_open: как у дерева ---
    writeJson(path.join(DIR, `${sp}_door_top_right_open.json`), {
        parent: "minecraft:block/door_top_right_open",
        textures: {
            bottom: `minecraft:block/${tex}`,
            top: `minecraft:block/${tex}`,
        },
    });
    written.push(`${sp}_door_top_right_open.json`);
}

console.log(`Записано файлов: ${written.length}`);
written.forEach(f => console.log("  " + f));
