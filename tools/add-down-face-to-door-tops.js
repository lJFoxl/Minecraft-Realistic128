// Добавляет нижнюю грань (down) нижней доске верхней половины двери.
//
// Элемент from [0,0,0] to [3,1,16] в *_door_top_left/right.json — нижняя доска
// верхнего блока двери. У неё была только up, снизу дыра. Эталон — oak
// (изменён вручную): "down": {"uv": [0,0,3,16], "texture": <та же, что у up>}.
//
// Породы с parent (iron, exposed/weathered/oxidized_copper) наследуют от copper.
// Открытая дверь (door_top_right_open.json) — общий шаблон, правится отдельно.

const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "assets", "minecraft", "models", "block");
const FROM = "[0,0,0]";
const TO = "[3,1,16]";

const files = fs.readdirSync(dir).filter((f) => /_door_top_(left|right)\.json$/.test(f));

let changed = 0, skipped = 0;
for (const f of files) {
	const full = path.join(dir, f);
	const json = JSON.parse(fs.readFileSync(full, "utf8"));
	if (!json.elements) { skipped++; continue; } // parent-модель

	const el = json.elements.find(
		(e) => JSON.stringify(e.from) === FROM && JSON.stringify(e.to) === TO
	);
	if (!el) { console.warn(`! ${f}: элемент ${FROM}->${TO} не найден`); continue; }
	if (!el.faces || !el.faces.up) { console.warn(`! ${f}: у элемента нет грани up`); continue; }
	if (el.faces.down) { skipped++; continue; }

	el.faces.down = { uv: [0, 0, 3, 16], texture: el.faces.up.texture };
	fs.writeFileSync(full, JSON.stringify(json, null, "\t") + "\n");
	console.log(`+ ${f} (texture ${el.faces.up.texture})`);
	changed++;
}
console.log(`\nИзменено: ${changed}, пропущено: ${skipped}, всего: ${files.length}`);
