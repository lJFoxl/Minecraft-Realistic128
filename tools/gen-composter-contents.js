// Генерирует модели содержимого компостера для уровней 1-7.
//
// Ванильный blockstate composter — multipart: поверх block/composter накладывается
// block/composter_contents<N> (level=1..7) или composter_contents_ready (level=8).
// В паке была переопределена только _ready, поэтому частично заполненный компостер
// показывал ванильную composter_compost. Здесь генерируются недостающие 1-7.
//
// Геометрия повторяет composter_contents_ready из пака:
//   элемент 1 — [2,0,2]..[14,H,14]: сам слой содержимого;
//   элемент 2 — [0,0,0]..[16,H-0.1,16]: закрывает щель по периметру, т.к. внутренняя
//   полость 3D-модели шире ванильной (стенки 0..1 и 15..16), а слой 2..14 её не перекрывает.
// Высоты: ванильные (3,5,7,9,11,13,15) минус 1 — как в _ready (ваниль 15 -> 14).

const fs = require("fs");
const path = require("path");

const dir = path.join(__dirname, "..", "assets", "minecraft", "models", "block");
const TEXTURE = "block/dirt";
const heights = { 1: 2, 2: 4, 3: 6, 4: 8, 5: 10, 6: 12, 7: 14 };

for (const [level, h] of Object.entries(heights)) {
	const json = `{
	"format_version": "1.21.11",
	"credit": "Made with Blockbench",
	"textures": {
		"particle": "${TEXTURE}",
		"inside": "${TEXTURE}"
	},
	"elements": [
		{
			"from": [2, 0, 2],
			"to": [14, ${h}, 14],
			"faces": {
				"up": {"uv": [2, 2, 14, 14], "texture": "#inside"}
			}
		},
		{
			"from": [0, 0, 0],
			"to": [16, ${h - 0.1}, 16],
			"faces": {
				"up": {"uv": [0, 0, 16, 16], "texture": "#particle"}
			}
		}
	]
}
`;
	const file = path.join(dir, `composter_contents${level}.json`);
	JSON.parse(json);
	fs.writeFileSync(file, json);
	console.log(`+ composter_contents${level}.json  (высота ${h})`);
}
