// Собирает модели обычного поршня из моделей липкого: та же геометрия, но без слизи.
//
// template_piston_sticky      -> template_piston
//   элемент [3,3,0]..[13,13,4] (центральная лицевая панель) — слизь #4 заменяется на
//   дерево #3, растянутый UV [0,0,16,16] меняется на позиционный (как у такой же
//   панели 10x10x4 в template_piston_head_sticky), иначе доски были бы сжаты.
// template_piston_head_sticky -> template_piston_head
//   передняя накладка (три элемента толщиной 1px, #slime) — на дерево #3;
//   их UV уже позиционные, трогать не нужно.
//
// Запускать после каждой правки липких моделей в Blockbench.

const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "assets", "minecraft", "models", "block", "piston");
const T = "\t\t\t\t";

// грани центральной панели поршня с деревом (UV по положению элемента в блоке)
const panelFaces = [
	`"north": {"uv": [3, 3, 13, 13], "texture": "#3"},`,
	`"east": {"uv": [3, 3, 7, 13], "texture": "#3"},`,
	`"south": {"uv": [3, 3, 13, 13], "texture": "#3"},`,
	`"west": {"uv": [4, 3, 0, 13], "texture": "#3"},`,
	`"up": {"uv": [3, 3, 13, 7], "texture": "#3"},`,
	`"down": {"uv": [3, 3, 13, 7], "texture": "#3"}`,
].map((l) => T + l).join("\n");

function build(src, dst, transform) {
	const file = path.join(dir, src);
	let raw = fs.readFileSync(file, "utf8");
	raw = transform(raw);
	JSON.parse(raw); // страховка от битого JSON
	fs.writeFileSync(path.join(dir, dst), raw);
	const n = JSON.parse(raw).elements.length;
	console.log(`+ ${dst}  (из ${src}, элементов: ${n})`);
}

// корпус поршня
build("template_piston_sticky.json", "template_piston.json", (raw) => {
	const before = raw;
	raw = raw.replace(/\t\t"4": "block\/slime_block",\n/, "");
	if (raw === before) throw new Error("не найдена текстура слизи в template_piston_sticky");

	// заменить грани панели целиком, опознав её по геометрии
	const re = /("from": \[3, 3, 0\],\n\t\t\t"to": \[13, 13, 4\],(?:.*\n)*?\t\t\t"faces": \{\n)(?:.*\n)*?(\t\t\t\})/;
	if (!re.test(raw)) throw new Error("не найдена панель [3,3,0]..[13,13,4]");
	raw = raw.replace(re, `$1${panelFaces}\n$2`);

	if (raw.includes('"#4"')) throw new Error("остались ссылки на #4");
	return raw;
});

// головка поршня
build("template_piston_head_sticky.json", "template_piston_head.json", (raw) => {
	const before = raw;
	raw = raw.replace(/\t\t"slime": "block\/slime_block",\n/, "");
	if (raw === before) throw new Error("не найдена текстура слизи в template_piston_head_sticky");

	const n = (raw.match(/"#slime"/g) || []).length;
	raw = raw.replace(/"texture": "#slime"/g, `"texture": "#3"`);
	console.log(`  граней слизи переведено на дерево: ${n}`);
	return raw;
});
