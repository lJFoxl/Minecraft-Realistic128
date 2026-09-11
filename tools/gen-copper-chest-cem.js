// Генерирует OptiFine CEM-модели для медных сундуков из базовых chest.jem / chest_right.jem.
//
// Проблема: chest.jem — общая модель для обычного и всех 4 стадий окисления медного
// сундука. Декоративные планки-засовы (submodels bone2/bone3) жёстко ссылаются на
// textures/block/iron_block.png, поэтому у медного сундука засов выглядит железным.
// CEM не умеет условно менять текстуру submodel по типу блока — нужен отдельный .jem
// на каждый вариант. OptiFine подхватывает их по имени блока; если версия OptiFine
// медные сундуки в CEM не поддерживает, файлы просто игнорируются (фолбэк на chest.jem).
//
// Обычный chest.jem/chest_right.jem не трогаем — там засов остаётся железным.

const fs = require("fs");
const path = require("path");

const cemDir = path.join(__dirname, "..", "assets", "minecraft", "optifine", "cem");
const IRON = "textures/block/iron_block.png";

// имя блока (префикс .jem) -> текстура медного блока нужной стадии окисления
const variants = {
	copper_chest: "textures/block/copper_block.png",
	exposed_copper_chest: "textures/block/exposed_copper.png",
	weathered_copper_chest: "textures/block/weathered_copper.png",
	oxidized_copper_chest: "textures/block/oxidized_copper.png",
};

// базовый файл -> суффикс генерируемого
const bases = [
	{ src: "chest.jem", suffix: ".jem" },
	{ src: "chest_right.jem", suffix: "_right.jem" },
];

let written = 0;
for (const { src, suffix } of bases) {
	const srcPath = path.join(cemDir, src);
	const raw = fs.readFileSync(srcPath, "utf8");
	if (!raw.includes(IRON)) {
		console.warn(`! ${src}: не найдено ${IRON}, пропуск`);
		continue;
	}
	for (const [block, tex] of Object.entries(variants)) {
		const out = raw.split(IRON).join(tex);
		const outName = block + suffix;
		fs.writeFileSync(path.join(cemDir, outName), out);
		console.log(`+ ${outName}  (${IRON} -> ${tex})`);
		written++;
	}
}
console.log(`\nГотово: ${written} файлов.`);
