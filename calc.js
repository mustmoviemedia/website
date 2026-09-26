// MUST MOVIE MEDIA — калькулятор мероприятия (секция #calculator).
//
// ЦЕНЫ МЕНЯЙТЕ ЗДЕСЬ. Все суммы — в миллионах сум.
// Стартовые значения подобраны так, чтобы наборы из CALC_PRESETS давали цены пакетов:
// Блокбастер 170,7 · Исторический 1 97,7 · Исторический 2 57,9 · Исторический 3 27,9.
// Если меняете цены, сверьте результат кнопками «Как Блокбастер» и т. д.
var CALC_PRICES = {
  // Организация проекта: продюсер, подготовка, выезд команды — один раз за мероприятие
  base: 2.1,

  // Масштаб: сколько гостей входит в базовую цену и доплата за каждые следующие 50 гостей
  guestsIncluded: 100,
  per50Guests: 1.0,

  // Команда: за 1 человека за 1 час на площадке (с монтажом/обработкой его материала)
  operatorHour: 1.3,
  photographerHour: 1.3,

  // Прямой эфир: режиссёр трансляции, техник, стрим-оборудование — за день
  live: 9.0,

  // Техника — за день
  drone: 4.7,   // аэросъёмка с лицензией и пилотом
  fpv: 4.0,     // FPV-дрон с пилотом
  gopro: 1.0,   // GoPro-ракурсы

  // Графика и подготовка гостей
  invitation: 4.0, // видео-приглашение
  ledEach: 0.8,    // одна LED-заставка для экранов
  welcome: 2.4,    // welcome-фотосессия гостей

  // Монтаж
  verticalEach: 0.5,               // один вертикальный ролик
  report: { none: 0, short: 2.5, long: 5.0 }, // отчётный ролик: нет / до 2 мин / 2–5 мин

  // Передача всех исходников
  sources: 2.5
};

// Параметры для кнопок быстрого старта. id совпадают с пакетами в plans.js.
var CALC_PRESETS = {
  'ev-blockbuster': { guests: 400, hours: 10, operators: 6, photographers: 3, live: true, drone: true, fpv: true, gopro: true, invite: true, led: 10, welcome: true, sources: true, vertical: 10, report: 'long' },
  'ev-hist1': { guests: 250, hours: 8, operators: 3, photographers: 3, live: false, drone: true, fpv: false, gopro: true, invite: true, led: 10, welcome: false, sources: true, vertical: 10, report: 'long' },
  'ev-hist2': { guests: 200, hours: 8, operators: 2, photographers: 2, live: false, drone: true, fpv: false, gopro: false, invite: false, led: 0, welcome: false, sources: false, vertical: 5, report: 'long' },
  'ev-hist3': { guests: 100, hours: 4, operators: 2, photographers: 2, live: false, drone: false, fpv: false, gopro: false, invite: false, led: 0, welcome: false, sources: false, vertical: 5, report: 'short' }
};
// Цены пакетов для подсказки «Ближе всего к пакету»
var CALC_PACKAGE_PRICES = { 'ev-blockbuster': 170.7, 'ev-hist1': 97.7, 'ev-hist2': 57.9, 'ev-hist3': 27.9 };

var MMM_CALC = (function () {
  'use strict';
  var P = CALC_PRICES;

  function round1(v) { return Math.round(v * 10) / 10; }

  // Расчёт: строки разбивки и итог (млн сум)
  function compute(s) {
    var extraGuests = Math.max(0, s.guests - P.guestsIncluded);
    var rows = [
      { id: 'team', value: s.hours * (s.operators * P.operatorHour + s.photographers * P.photographerHour) },
      { id: 'org', value: P.base + Math.ceil(extraGuests / 50) * P.per50Guests },
      { id: 'live', value: s.live ? P.live : 0 },
      { id: 'gear', value: (s.drone ? P.drone : 0) + (s.fpv ? P.fpv : 0) + (s.gopro ? P.gopro : 0) },
      { id: 'design', value: (s.invite ? P.invitation : 0) + s.led * P.ledEach },
      { id: 'welcome', value: s.welcome ? P.welcome : 0 },
      { id: 'edit', value: s.vertical * P.verticalEach + (P.report[s.report] || 0) },
      { id: 'sources', value: s.sources ? P.sources : 0 }
    ];
    var total = rows.reduce(function (sum, r) { return sum + r.value; }, 0);
    return { rows: rows, total: round1(total) };
  }

  function closest(total) {
    var best = null;
    Object.keys(CALC_PACKAGE_PRICES).forEach(function (id) {
      var d = Math.abs(CALC_PACKAGE_PRICES[id] - total);
      if (!best || d < best.d) best = { id: id, d: d };
    });
    return best.id;
  }

  var api = { prices: P, presets: CALC_PRESETS, compute: compute, closest: closest };

  // В Node (проверочный скрипт) интерфейс не нужен
  if (typeof document === 'undefined') return api;

  var i18n = window.MMM_I18N;
  var root = document.getElementById('calculator');
  if (!root) return api;

  var form = document.getElementById('calc-form');
  var totalEl = document.getElementById('calc-total');
  var barTotal = document.getElementById('calc-bar-total');
  var liveEl = document.getElementById('calc-live');
  var rowsEl = document.getElementById('calc-rows');
  var closestName = document.getElementById('calc-closest-name');
  var closestBtn = document.getElementById('calc-closest-open');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var shown = 0;       // число, которое сейчас на экране (для анимации)
  var anim = null;
  var liveTimer = null;
  var lastClosest = null;

  function t(k, p, l) { return i18n.t(k, p, l); }
  function totalText(v, l) { return '≈ ' + i18n.num(v, 1, l) + ' ' + t('unit.total', null, l); }
  function reportText(r, l) { return t(r === 'short' ? 'calc.reportShort' : r === 'long' ? 'calc.reportLong' : 'calc.reportNone', null, l); }

  // ---------- Состояние формы ----------
  function read() {
    var f = form.elements;
    var radio = function (name) { var el = form.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : null; };
    return {
      guests: Number(f.guests.value),
      hours: Number(radio('hours') || 8),
      operators: Number(f.operators.value),
      photographers: Number(f.photographers.value),
      live: f.live.checked, drone: f.drone.checked, fpv: f.fpv.checked, gopro: f.gopro.checked,
      invite: f.invite.checked, welcome: f.welcome.checked, sources: f.sources.checked,
      led: Number(f.led.value),
      vertical: Number(f.vertical.value),
      report: radio('report') || 'none'
    };
  }
  function write(s) {
    var f = form.elements;
    ['guests', 'operators', 'photographers', 'led', 'vertical'].forEach(function (k) { f[k].value = s[k]; });
    ['live', 'drone', 'fpv', 'gopro', 'invite', 'welcome', 'sources'].forEach(function (k) { f[k].checked = !!s[k]; });
    form.querySelectorAll('input[name="hours"]').forEach(function (el) { el.checked = Number(el.value) === s.hours; });
    form.querySelectorAll('input[name="report"]').forEach(function (el) { el.checked = el.value === s.report; });
  }

  // ---------- Описание расчёта для брифа ----------
  // «Прямой эфир» → «прямой эфир» внутри списка; FPV, LED, GoPro не трогаем
  function lc(str) { return str.length > 1 && str[1] === str[1].toLowerCase() ? str[0].toLowerCase() + str.slice(1) : str; }
  function describe(s, l) {
    var parts = [
      t('calc.d.guests', { n: s.guests }, l),
      t('calc.hUnit', { n: s.hours }, l),
      t('calc.d.ops', { n: s.operators }, l),
      t('calc.d.ph', { n: s.photographers }, l)
    ];
    if (s.live) parts.push(lc(t('calc.live', null, l)));
    if (s.drone) parts.push(lc(t('calc.drone', null, l)));
    if (s.fpv) parts.push(t('calc.fpv', null, l));
    if (s.gopro) parts.push('GoPro');
    if (s.invite) parts.push(lc(t('calc.invite', null, l)));
    if (s.led) parts.push(t('calc.rowDesignD', { n: s.led }, l));
    if (s.welcome) parts.push(lc(t('calc.welcome', null, l)));
    if (s.vertical) parts.push(t('calc.d.vert', { n: s.vertical }, l));
    if (s.report !== 'none') parts.push(t('calc.d.report', { r: lc(reportText(s.report, l)) }, l));
    if (s.sources) parts.push(lc(t('calc.sources', null, l)));
    return t('calc.desc', { total: totalText(compute(s).total, l), params: parts.join(', ') }, l);
  }
  api.describe = describe;

  // ---------- Отрисовка ----------
  function rowLabel(r, s) {
    var gear = [];
    if (s.drone) gear.push(t('calc.drone'));
    if (s.fpv) gear.push(t('calc.fpv'));
    if (s.gopro) gear.push('GoPro');
    var map = {
      team: [t('calc.rowTeam'), t('calc.rowTeamD', { ops: s.operators, ph: s.photographers, h: s.hours })],
      org: [t('calc.rowOrg'), t('calc.rowOrgD', { n: s.guests })],
      live: [t('calc.live'), ''],
      gear: [t('calc.rowGear'), gear.join(', ')],
      design: [t('calc.rowDesign'), s.led ? t('calc.rowDesignD', { n: s.led }) : ''],
      welcome: [t('calc.welcome'), ''],
      edit: [t('calc.rowEdit'), t('calc.rowEditD', { v: s.vertical, r: reportText(s.report) })],
      sources: [t('calc.sources'), '']
    };
    return map[r.id];
  }

  function renderRows(s, res) {
    rowsEl.innerHTML = '';
    res.rows.forEach(function (r) {
      if (r.value <= 0) return;
      var lbl = rowLabel(r, s);
      var li = document.createElement('li');
      var name = document.createElement('span');
      name.className = 'calc__row-name';
      name.textContent = lbl[0];
      if (lbl[1]) {
        var small = document.createElement('small');
        small.textContent = lbl[1];
        name.appendChild(small);
      }
      var val = document.createElement('span');
      val.className = 'calc__row-val';
      val.textContent = i18n.moneyText(r.value);
      li.appendChild(name);
      li.appendChild(val);
      rowsEl.appendChild(li);
    });
  }

  function paintTotal(v) {
    var txt = totalText(v);
    totalEl.textContent = txt;
    barTotal.textContent = txt;
  }

  function animateTo(v) {
    if (anim) cancelAnimationFrame(anim);
    if (reduce || shown === v) { shown = v; paintTotal(v); return; }
    var from = shown;
    var start = null;
    var dur = 450;
    function step(ts) {
      if (start === null) start = ts;
      var k = Math.min(1, (ts - start) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      shown = from + (v - from) * e;
      paintTotal(k < 1 ? shown : v);
      if (k < 1) anim = requestAnimationFrame(step);
      else { shown = v; anim = null; }
    }
    anim = requestAnimationFrame(step);
  }

  function renderOutputs(s) {
    form.querySelectorAll('input[type="range"]').forEach(function (el) {
      var out = document.getElementById(el.id + '-out');
      if (out) out.textContent = el.value;
      var pct = (el.value - el.min) / (el.max - el.min) * 100;
      el.style.setProperty('--fill', pct + '%');
      el.setAttribute('aria-valuetext', el.value);
    });
    // Активная кнопка быстрого старта — если параметры совпадают с пакетом
    root.querySelectorAll('[data-preset]').forEach(function (btn) {
      var p = CALC_PRESETS[btn.getAttribute('data-preset')];
      var same = Object.keys(p).every(function (k) { return p[k] === s[k]; });
      btn.setAttribute('aria-pressed', same ? 'true' : 'false');
    });
  }

  function update(animate) {
    var s = read();
    var res = compute(s);
    renderOutputs(s);
    renderRows(s, res);
    if (animate) animateTo(res.total); else { if (anim) cancelAnimationFrame(anim); shown = res.total; paintTotal(res.total); }
    lastClosest = closest(res.total);
    var plans = (window.MMM_PLANS || {})[i18n.lang()] || (window.MMM_PLANS || {}).ru || {};
    closestName.textContent = plans[lastClosest] ? plans[lastClosest].name : '';
    // Для экранных дикторов — итог без промежуточных чисел анимации
    clearTimeout(liveTimer);
    liveTimer = setTimeout(function () { liveEl.textContent = t('calc.liveMsg', { total: totalText(res.total) }); }, 500);
  }

  form.addEventListener('input', function () { update(true); });
  form.addEventListener('change', function () { update(true); });
  form.addEventListener('submit', function (e) { e.preventDefault(); });

  root.addEventListener('click', function (e) {
    var preset = e.target.closest('[data-preset]');
    if (preset) {
      write(CALC_PRESETS[preset.getAttribute('data-preset')]);
      update(true);
      return;
    }
    if (e.target.closest('#calc-closest-open')) {
      if (window.MMM_openPlan && lastClosest) window.MMM_openPlan(lastClosest, closestBtn);
      return;
    }
    if (e.target.closest('[data-calc-send]')) {
      if (window.MMM_choosePlan) window.MMM_choosePlan({ type: 'calc', state: read() }, 'Мероприятие');
    }
  });

  i18n.onChange(function () { update(false); });

  // Старт — параметры «Исторического 2»
  write(CALC_PRESETS['ev-hist2']);
  update(false);

  return api;
})();

if (typeof module !== 'undefined' && module.exports) module.exports = MMM_CALC;
else window.MMM_CALC = MMM_CALC;
