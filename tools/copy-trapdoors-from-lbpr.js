// Копирует 3D-модели люков (trapdoor) из LBPR (C:\GameDev\LBPR) в наш пак,
// с полным разрешением ссылок (blockstate -> model -> parent -> textures),
// чтобы не забыть ни одного файла. Аналог того, как переносили цветы/растения.
//
// Запуск: node tools/copy-trapdoors-from-lbpr.js

const fs = require("fs");
const path = require("path");

const SRC = "C:\\GameDev\\LBPR\\assets\\minecraft";
const DST = path.join(__dirname, "..", "assets", "minecraft");

const species = [
    "oak", "spruce", "birch", "jungle", "acacia", "dark_oak", "mangrove",
    "cherry", "pale_oak", "bamboo", "crimson", "warped",
    "iron", "copper", "exposed_copper", "oxidized_copper", "weathered_copper",
    "waxed_copper", "waxed_exposed_copper", "waxed_oxidized_copper", "waxed_weathered_copper"
];

function readJson(p) {
    return JSON.parse(fs.readFileSync(p, "utf8"));
}
function existsSrc(rel) {
    return fs.existsSync(path.join(SRC, rel));
}
function copyFile(rel) {
    const srcPath = path.join(SRC, rel);
    const dstPath = path.join(DST, rel);
    fs.mkdirSync(path.dirname(dstPath), { recursive: true });
    fs.copyFileSync(srcPath, dstPath);
    return rel;
}

const modelRefRegex = /"model"\s*:\s*"([^"]+)"/g;
const copiedFiles = [];
const missing = [];
const visitedModels = new Set();

function normalizeNs(v) {
    return v.replace(/^minecraft:/, "");
}

function copyModelClosure(modelRelNoExt) {
    // modelRelNoExt например "block/oak_trapdoor" (без namespace, без .json)
    if (visitedModels.has(modelRelNoExt)) return;
    visitedModels.add(modelRelNoExt);

    const rel = `models/${modelRelNoExt}.json`;
    if (!existsSrc(rel)) {
        // может быть встроенная ванильная модель (thin_block, block/block и т.д.) - пропускаем
        return;
    }
    copiedFiles.push(copyFile(rel));

    const json = readJson(path.join(SRC, rel));

    // рекурсия по parent (если это наша же модель, не ванильная)
    if (json.parent) {
        const p = normalizeNs(json.parent);
        if (existsSrc(`models/${p}.json`)) {
            copyModelClosure(p);
        }
    }

    // текстуры
    if (json.textures) {
        for (const v of Object.values(json.textures)) {
            if (typeof v === "string" && !v.startsWith("#")) {
                const texRel = `textures/${normalizeNs(v)}.png`;
                if (existsSrc(texRel)) {
                    copiedFiles.push(copyFile(texRel));
                    const mc = texRel + ".mcmeta";
                    if (existsSrc(mc)) copiedFiles.push(copyFile(mc));
                } else {
                    missing.push(texRel);
                }
            }
        }
    }
}

for (const sp of species) {
    const bsRel = `blockstates/${sp}_trapdoor.json`;
    const itemRel = `items/${sp}_trapdoor.json`;
    const itemModelRel = `models/item/${sp}_trapdoor.json`;

    if (existsSrc(bsRel)) {
        copiedFiles.push(copyFile(bsRel));
        const content = fs.readFileSync(path.join(SRC, bsRel), "utf8");
        let m;
        modelRefRegex.lastIndex = 0;
        while ((m = modelRefRegex.exec(content))) {
            copyModelClosure(normalizeNs(m[1]));
        }
    } else {
        missing.push(bsRel);
    }

    if (existsSrc(itemRel)) {
        copiedFiles.push(copyFile(itemRel));
        const content = fs.readFileSync(path.join(SRC, itemRel), "utf8");
        let m;
        modelRefRegex.lastIndex = 0;
        while ((m = modelRefRegex.exec(content))) {
            const ref = normalizeNs(m[1]);
            if (ref.startsWith("item/waxed_icon")) continue; // ванильная встроенная иконка воска
            copyModelClosure(ref);
        }
    } else {
        missing.push(itemRel);
    }

    if (existsSrc(itemModelRel)) {
        copiedFiles.push(copyFile(itemModelRel));
    }
}

console.log(`Скопировано файлов: ${copiedFiles.length}`);
copiedFiles.sort().forEach(f => console.log("  " + f));

if (missing.length > 0) {
    console.log(`\nНе найдено в LBPR (пропущено, возможно ванильное или не существует): ${missing.length}`);
    missing.forEach(f => console.log("  " + f));
}
