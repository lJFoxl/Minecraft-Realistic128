// Генератор 3D (октагональных) моделей брёвен/поленьев/стволов для всех пород.
// Форма: квадратное сечение cube_column со срезанными фасками по 4 углам
// (правильная восьмигранная призма), верх/низ остаются простым квадратом
// (ванильный "end"), чтобы не городить восьмиугольные торцевые крышки.
// Все текстуры — ванильные имена (#end/#side), новых картинок не требуется.
//
// Геометрия угловых фасок выведена и проверена аналитически (поворот на
// ±45° вокруг вершины соседней грани должен точно попасть в целевую точку
// на противоположной грани) — см. чат/комментарии ниже.
//
// Запуск: node tools/gen-logs.js   (из корня репозитория)

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const MODELS_DIR = path.join(ROOT, "assets", "minecraft", "models", "block");

const c = 3;                    // инсет фаски от края (0..16)
const D = +(c * Math.sqrt(2)).toFixed(4); // длина диагональной грани
const t = 1;                    // толщина диагональной "срезанной" грани

function r(n) { return +n.toFixed(4); } // подчистить хвосты плавающей точки

function bevel(faceKey, from, to, origin, angle) {
    return {
        from, to,
        faces: {
            [faceKey]: { texture: "#side", uv: [0, 0, D, 16] }
        },
        rotation: { angle, axis: "y", origin }
    };
}

function buildElements(capUpRotation) {
    const elements = [];

    // Верх/низ — обычный квадрат (ванильный "end"), без фасок.
    elements.push({
        from: [0, 0, 0], to: [16, 16, 16],
        faces: {
            up: { texture: "#end", cullface: "up", ...(capUpRotation ? { rotation: capUpRotation } : {}) },
            down: { texture: "#end", cullface: "down" }
        }
    });

    // Восток/запад — полная ширина по X, сжато по Z до [c, 16-c].
    elements.push({
        from: [0, 0, c], to: [16, 16, 16 - c],
        faces: {
            east: { texture: "#side", cullface: "east" },
            west: { texture: "#side", cullface: "west" }
        }
    });

    // Север/юг — полосы между фасками.
    elements.push({
        from: [c, 0, 0], to: [16 - c, 16, c],
        faces: { north: { texture: "#side", cullface: "north" } }
    });
    elements.push({
        from: [c, 0, 16 - c], to: [16 - c, 16, 16],
        faces: { south: { texture: "#side", cullface: "south" } }
    });

    // 4 диагональные фаски по углам (координаты и углы выверены аналитически).
    elements.push(bevel("north", [r(-D + c), 0, 0], [c, 16, t], [c, 8, 0], -45));
    elements.push(bevel("north", [16 - c, 0, 0], [r(16 - c + D), 16, t], [16 - c, 8, 0], 45));
    elements.push(bevel("south", [16 - c, 0, 16 - t], [r(16 - c + D), 16, 16], [16 - c, 8, 16], -45));
    elements.push(bevel("south", [r(-D + c), 0, 16 - t], [c, 16, 16], [c, 8, 16], 45));

    return elements;
}

function writeJson(relPath, data) {
    const abs = path.join(MODELS_DIR, relPath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(data, null, 2) + "\n", "utf8");
    console.log("  " + path.relative(ROOT, abs));
}

// --- Базовая геометрия (2 файла) --------------------------------------------
console.log("Базовые модели:");
writeJson("log_octagonal.json", {
    parent: "minecraft:block/block",
    textures: { particle: "#side" },
    elements: buildElements(null)
});
writeJson("log_octagonal_horizontal.json", {
    parent: "minecraft:block/block",
    textures: { particle: "#side" },
    elements: buildElements(180)
});

// --- Породы дерева -----------------------------------------------------------
// pattern: "std" = <name>_log[.json] + <name>_log_horizontal.json
//          "cherry" = cherry_log_y/x/z.json (без отдельного horizontal-файла)
//          "stem" = <name>_stem.json (одна модель на все оси, без horizontal)
const overworld = [
    "oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove", "pale_oak"
];
const nether = ["crimson", "warped"]; // log-семья называется "stem"

function wrapperLog(species, stripped) {
    const prefix = stripped ? `stripped_${species}` : species;
    return {
        parent: "block/log_octagonal",
        textures: {
            end: `block/${prefix}_log_top`,
            side: `block/${prefix}_log`
        }
    };
}
function wrapperLogHorizontal(species, stripped) {
    const prefix = stripped ? `stripped_${species}` : species;
    return {
        parent: "block/log_octagonal_horizontal",
        textures: {
            end: `block/${prefix}_log_top`,
            side: `block/${prefix}_log`
        }
    };
}
function wrapperWood(species, stripped) {
    const prefix = stripped ? `stripped_${species}` : species;
    return {
        parent: "block/log_octagonal",
        textures: {
            end: `block/${prefix}_log`,
            side: `block/${prefix}_log`
        }
    };
}
function wrapperStem(species, stripped) {
    const prefix = stripped ? `stripped_${species}` : species;
    return {
        parent: "block/log_octagonal",
        textures: {
            end: `block/${prefix}_stem_top`,
            side: `block/${prefix}_stem`
        }
    };
}
function wrapperHyphae(species, stripped) {
    const prefix = stripped ? `stripped_${species}` : species;
    return {
        parent: "block/log_octagonal",
        textures: {
            end: `block/${prefix}_stem`,
            side: `block/${prefix}_stem`
        }
    };
}

console.log("\nОбычные породы (log/wood):");
for (const sp of overworld) {
    for (const stripped of [false, true]) {
        const prefix = stripped ? `stripped_${sp}` : sp;
        if (sp === "cherry") continue; // отдельная ветка ниже
        writeJson(`${prefix}_log.json`, wrapperLog(sp, stripped));
        writeJson(`${prefix}_log_horizontal.json`, wrapperLogHorizontal(sp, stripped));
        writeJson(`${prefix}_wood.json`, wrapperWood(sp, stripped));
    }
}

console.log("\nCherry (свой набор имён файлов _x/_y/_z):");
for (const stripped of [false, true]) {
    const prefix = stripped ? "stripped_cherry" : "cherry";
    writeJson(`${prefix}_log_y.json`, wrapperLog("cherry", stripped));
    writeJson(`${prefix}_log_x.json`, wrapperLogHorizontal("cherry", stripped));
    writeJson(`${prefix}_log_z.json`, wrapperLogHorizontal("cherry", stripped));
    writeJson(`${prefix}_wood.json`, wrapperWood("cherry", stripped));
}

console.log("\nНижний мир (stem/hyphae, без horizontal-варианта):");
for (const sp of nether) {
    for (const stripped of [false, true]) {
        const prefix = stripped ? `stripped_${sp}` : sp;
        writeJson(`${prefix}_stem.json`, wrapperStem(sp, stripped));
        writeJson(`${prefix}_hyphae.json`, wrapperHyphae(sp, stripped));
    }
}

console.log("\nГотово.");
