// Генератор rail-моделей из детекторных шаблонов.
// Берёт проверенные геометрии detector_rail* и порождает powered/activator/detector_on_raised,
// заодно очищая Blockbench-мусор (format_version, credit, groups, name элементов).
// Запуск:  node tools/gen-rails.js
const fs = require('fs');
const path = require('path');

const BLOCK = path.join(__dirname, '..', 'assets', 'minecraft', 'models', 'block');
const read = f => JSON.parse(fs.readFileSync(path.join(BLOCK, f), 'utf8'));

// Красивый сериализатор: примитивные массивы инлайн, массивы объектов — многострочно.
function fmt(v, indent = 0) {
  const pad = '  '.repeat(indent);
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) {
    if (v.length && typeof v[0] === 'object') {
      const inner = '  '.repeat(indent + 1);
      return '[\n' + v.map(x => inner + fmt(x, indent + 1)).join(',\n') + '\n' + pad + ']';
    }
    return '[' + v.map(x => JSON.stringify(x)).join(', ') + ']';
  }
  const inner = '  '.repeat(indent + 1);
  const entries = Object.entries(v);
  return '{\n' + entries.map(([k, val]) => inner + JSON.stringify(k) + ': ' + fmt(val, indent + 1)).join(',\n') + '\n' + pad + '}';
}

// Удаление Blockbench-мусора.
function clean(obj) {
  delete obj.format_version;
  delete obj.credit;
  delete obj.groups;
  if (Array.isArray(obj.elements)) {
    for (const el of obj.elements) {
      if (el && typeof el === 'object') delete el.name;
    }
  }
  return obj;
}

// Клонировать шаблон, поставить текстуры, убрать Button (если !keepButton), почистить мусор.
function isButton(el) {
  return Array.isArray(el && el.from) && el.from[0] === 6.125 && el.from[1] === 0.75 && el.from[2] === 5.75;
}
function derive(templateFile, textures, keepButton) {
  const obj = JSON.parse(JSON.stringify(read(templateFile))); // deep clone
  if (!keepButton && Array.isArray(obj.elements)) {
    obj.elements = obj.elements.filter(el => !isButton(el));
  }
  obj.textures = textures;
  return clean(obj);
}

// Обычные рельсы → чистое 3D как у детекторных: убираем копланарную декаль-плоскость (Decorations),
// шпалы → #1 dark_oak_planks, рельсы → #2 iron_block. Без декали нет z-fighting, и обычные рельсы
// консистентны с detector/activator (дерево + железо).
function to3DRails(obj) {
  obj = clean(obj);
  obj.textures = obj.textures || {};
  obj.textures["1"] = "block/dark_oak_planks";
  obj.textures["2"] = "block/iron_block";
  if (obj.textures["particle"] === undefined) obj.textures["particle"] = "#rail";
  // Удалить декаль-плоскость (from.y == to.y == 0.365).
  obj.elements = (obj.elements || []).filter(el => {
    const isDecal = Array.isArray(el.from) && Math.abs(el.from[1] - 0.365) < 0.01 && Math.abs(el.to[1] - 0.365) < 0.01;
    return !isDecal;
  });
  for (const el of obj.elements) {
    if (!Array.isArray(el.from) || !el.faces) continue;
    const isTie  = el.from[1] === 0 && Math.abs(el.to[1] - 0.365) < 0.01;
    const isRail = el.from[1] === 0 && Math.abs(el.to[1] - 1) < 0.01;
    if (!isTie && !isRail) continue;
    const target = isTie ? "#1" : "#2";
    for (const f of Object.values(el.faces)) if (f.texture === "#rail") f.texture = target;
  }
  return obj;
}

function write(name, obj) {
  fs.writeFileSync(path.join(BLOCK, name), fmt(obj) + '\n', 'utf8');
  console.log('  written:', name);
}

// --- Текстуры для каждого варианта -------------------------------------------
const T = {
  // плоские (ключи 1,2,particle,rail)
  powered:        { "1": "block/dark_oak_planks", "2": "block/gold_block",  "particle": "block/powered_rail",    "rail": "block/powered_rail" },
  powered_on:     { "1": "block/dark_oak_planks", "2": "block/gold_block",  "particle": "block/powered_rail_on", "rail": "block/powered_rail_on" },
  activator:      { "1": "block/dark_oak_planks", "2": "block/iron_block",  "particle": "block/activator_rail",  "rail": "block/activator_rail" },
  activator_on:   { "1": "block/dark_oak_planks", "2": "block/iron_block",  "particle": "block/activator_rail_on","rail": "block/activator_rail_on" },
  // наклонные (ключи 1=rails,2=ties,particle,rail)
  powered_r_ne:   { "1": "block/gold_block",  "2": "block/dark_oak_planks", "particle": "block/powered_rail",    "rail": "block/powered_rail" },
  powered_r_on_ne:{ "1": "block/gold_block",  "2": "block/dark_oak_planks", "particle": "block/powered_rail_on", "rail": "block/powered_rail_on" },
  activator_r_ne: { "1": "block/iron_block",  "2": "block/dark_oak_planks", "particle": "block/activator_rail",  "rail": "block/activator_rail" },
  activator_r_on_ne:{ "1": "block/iron_block","2": "block/dark_oak_planks", "particle": "block/activator_rail_on","rail": "block/activator_rail_on" },
  detector_r_on:  { "1": "block/iron_block",  "2": "block/dark_oak_planks", "particle": "block/detector_rail_on","rail": "block/detector_rail_on" },
};

console.log('Generating powered_rail models:');
write('powered_rail.json',            derive('detector_rail.json',         T.powered,         false));
write('powered_rail_on.json',         derive('detector_rail_on.json',      T.powered_on,      false));
write('powered_rail_raised_ne.json',  derive('detector_rail_raised_ne.json', T.powered_r_ne,    false));
write('powered_rail_raised_sw.json',  derive('detector_rail_raised_sw.json', T.powered_r_ne,    false)); // same textures, sw geometry
write('powered_rail_on_raised_ne.json', derive('detector_rail_raised_ne.json', T.powered_r_on_ne, false));
write('powered_rail_on_raised_sw.json', derive('detector_rail_raised_sw.json', T.powered_r_on_ne, false));

console.log('Generating activator_rail models:');
write('activator_rail.json',            derive('detector_rail.json',         T.activator,         false));
write('activator_rail_on.json',         derive('detector_rail_on.json',      T.activator_on,      false));
write('activator_rail_raised_ne.json',  derive('detector_rail_raised_ne.json', T.activator_r_ne,    false));
write('activator_rail_raised_sw.json',  derive('detector_rail_raised_sw.json', T.activator_r_ne,    false));
write('activator_rail_on_raised_ne.json', derive('detector_rail_raised_ne.json', T.activator_r_on_ne, false));
write('activator_rail_on_raised_sw.json', derive('detector_rail_raised_sw.json', T.activator_r_on_ne, false));

console.log('Generating missing detector_rail_on_raised models:');
write('detector_rail_on_raised_ne.json', derive('detector_rail_raised_ne.json', T.detector_r_on, false));
write('detector_rail_on_raised_sw.json', derive('detector_rail_raised_sw.json', T.detector_r_on, false));

console.log('Cleaning existing detector models in place (keep Button on unlit):');
for (const f of ['detector_rail.json', 'detector_rail_on.json', 'detector_rail_raised_ne.json', 'detector_rail_raised_sw.json']) {
  write(f, clean(read(f)));
}

console.log('Converting normal-rail models to 3D (dark_oak ties + iron rails, decal plane removed):');
write('rail_flat.json', to3DRails(read('rail_flat.json')));
write('template_rail_raised_ne.json', to3DRails(read('template_rail_raised_ne.json')));
write('template_rail_raised_sw.json', to3DRails(read('template_rail_raised_sw.json')));
// rail_curved.json восстановлен вручную (3D-геометрия Blockbench без parent/мусора) — генератор его не трогает.

console.log('Done.');