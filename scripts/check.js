// Проверка сайта перед публикацией: запускается роботом на каждый Pull Request.
// Локально: node scripts/check.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.join(__dirname, '..');
let errors = 0;
const fail = (msg) => { console.error('❌ ' + msg); errors++; };
const ok = (msg) => console.log('✅ ' + msg);

// 1. Синтаксис всех JS-файлов (лишняя запятая, незакрытая кавычка и т. п.)
const files = fs.readdirSync(root).filter((f) => f.endsWith('.js')).map((f) => path.join(root, f))
  .concat(['telegram-worker/templates.js', 'telegram-worker/worker.js'].map((f) => path.join(root, f)));
const { spawnSync } = require('child_process');
for (const f of files) {
  // node --check проверяет синтаксис, ничего не запуская (модули с import/export распознаются сами)
  const r = spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' });
  if (r.status === 0) ok('синтаксис ' + path.relative(root, f));
  else {
    const lines = (r.stderr || '').split('\n');
    const where = (lines[0].match(/:(\d+)$/) || [])[1];
    const why = lines.find((l) => /Error/.test(l)) || lines.slice(0, 3).join(' ');
    fail(path.relative(root, f) + (where ? ', строка ' + where : '') + ': ' + why.trim() + (/Unexpected/.test(why) ? ' (часто это пропущенная запятая или кавычка в строке выше)' : '') + (lines[1] ? '\n     ' + lines[1].trim().slice(0, 120) : ''));
  }
}

// 2. Переводы: во всех трёх языках одинаковый набор ключей
try {
  // Заглушка браузера: любое обращение к document / window возвращает «ничего не делающий» объект
  const stub = () => new Proxy(function () {}, { get: (t, k) => (k === Symbol.toPrimitive ? () => '' : k === 'length' ? 0 : stub()), apply: () => stub() });
  const sandbox = { window: {}, document: stub(), navigator: { language: 'ru', languages: ['ru'] }, location: { search: '', hash: '' }, localStorage: { getItem: () => null, setItem() {} }, console };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(root, 'i18n.js'), 'utf8') + ';this.__DICT = typeof DICT !== "undefined" ? DICT : (window.MMM_I18N && window.MMM_I18N.dict);', sandbox);
  const dict = sandbox.__DICT;
  if (!dict || !dict.ru) throw new Error('не найден DICT');
  const ru = Object.keys(dict.ru);
  for (const l of ['uz', 'en']) {
    const keys = new Set(Object.keys(dict[l] || {}));
    const missing = ru.filter((k) => !keys.has(k));
    if (missing.length) fail(`i18n.js: в «${l}» нет ключей: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '…' : ''}`);
    else ok(`переводы ${l}: все ${ru.length} ключей на месте`);
  }
} catch (e) { fail('i18n.js: ' + e.message); }

// 3. Цены, калькулятор и база знаний считаются без ошибок
try {
  const plans = require(path.join(root, 'plans.js'));
  const calc = require(path.join(root, 'calc.js'));
  const kb = require(path.join(root, 'knowledge.js'));
  for (const l of ['ru', 'uz', 'en']) if (!plans[l] || !Object.keys(plans[l]).length) fail('plans.js: нет пакетов для ' + l);
  for (const [id, s] of Object.entries(calc.presets)) {
    const r = calc.compute(s);
    if (!(r.total > 0)) fail('calc.js: пресет ' + id + ' считает ' + r.total);
  }
  ok('калькулятор: пресеты считаются');
  const ids = new Set();
  for (const it of kb.items) {
    if (ids.has(it.id)) fail('knowledge.js: повторяется id «' + it.id + '»');
    ids.add(it.id);
    for (const l of ['ru', 'uz', 'en']) {
      const a = kb.answer(it.id, l);
      if (!a || !a.text || /undefined|—\s*$/.test(a.text) || /\{(min|price):/.test(a.text)) fail(`knowledge.js: ответ «${it.id}» (${l}) пустой или с неизвестной ценой`);
      if (!it.q || !it.q[l]) fail(`knowledge.js: у «${it.id}» нет вопроса на ${l}`);
    }
  }
  for (const id of kb.quickIds) if (!ids.has(id)) fail('knowledge.js: в QUICK есть «' + id + '», а такого вопроса нет');
  ok(`база знаний: ${kb.items.length} вопросов на трёх языках`);
} catch (e) { fail('цены / калькулятор / база знаний: ' + e.message); }

// 4. Секреты не попали в файлы
const secretRe = /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/; // формат токена Telegram-бота
for (const f of files.concat(['index.html'].map((x) => path.join(root, x)))) {
  if (secretRe.test(fs.readFileSync(f, 'utf8'))) fail(path.relative(root, f) + ': похоже на токен бота — секреты храните только в Cloudflare');
}

if (errors) { console.error(`\nНайдено ошибок: ${errors}. Исправьте их до публикации.`); process.exit(1); }
console.log('\nВсё в порядке — можно публиковать.');
