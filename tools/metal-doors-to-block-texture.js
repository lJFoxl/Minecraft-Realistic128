// Заменяет текстуры металлических дверей (copper-семья) на соответствующий
// цельный блок (block/copper_block, block/exposed_copper, ...), по образцу
// того, что вручную сделали для iron_door (block/iron_block везде).
// Правит только текстурные ссылки block/<sp>_door_(lower|upper|sides) ->
// block/<blockTexture>, геометрию не трогает. Работает по сырому тексту
// файла, чтобы не менять форматирование/отступы.
//
// Запуск: node tools/metal-doors-to-block-texture.js

const fs = require("fs");
const path = require("path");

const DIR = path.join(__dirname, "..", "assets", "minecraft", "models");

const TYPES = {
    copper: "copper_block",
    exposed_copper: "exposed_copper",
    oxidized_copper: "oxidized_copper",
    weathered_copper: "weathered_copper",
};

const FILES = (sp) => [
    path.join(DIR, "block", `${sp}_door_bottom_left.json`),
    path.join(DIR, "block", `${sp}_door_bottom_right.json`),
    path.join(DIR, "block", `${sp}_door_top_left.json`),
    path.join(DIR, "block", `${sp}_door_top_right.json`),
    path.join(DIR, "item", `${sp}_door.json`),
];

let changed = 0;
for (const [sp, blockTex] of Object.entries(TYPES)) {
    const pattern = new RegExp(`block/${sp}_door_(?:lower|upper|sides)`, "g");
    for (const f of FILES(sp)) {
        if (!fs.existsSync(f)) {
            console.log(`  пропущено (нет файла): ${f}`);
            continue;
        }
        const before = fs.readFileSync(f, "utf8");
        const after = before.replace(pattern, `block/${blockTex}`);
        if (after !== before) {
            fs.writeFileSync(f, after);
            changed++;
            console.log(`  ${path.relative(DIR, f)} -> block/${blockTex}`);
        }
    }
}

console.log(`\nИзменено файлов: ${changed}`);
