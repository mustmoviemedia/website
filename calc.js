// MUST MOVIE MEDIA — калькулятор (секция #calculator).
//
// ЦЕНЫ МЕНЯЙТЕ ЗДЕСЬ. Все суммы — в миллионах сум.
// • Мероприятия и прямой эфир считаются по CALC_PRICES (часы, люди, опции).
//   Наборы из CALC_PRESETS дают цены, близкие к пакетам: Блокбастер 188 · Исторический 1 107,5 ·
//   Исторический 2 64 · Исторический 3 31.
// • Reels, фото и SMM считаются по ценам пакетов из plans.js — при смене цен в plans.js
//   калькулятор пересчитается сам.
// • Итог показывается вилкой «≈ от … до …». Верх вилки — CALC_RANGE.
//
// TODO — цен нет в данных, сейчас калькулятор пишет «уточним индивидуально» или использует допущение:
//   1) рекламный ролик (сценарий, актёры, продакшен) — «индивидуально»;
//   2) фотосъёмка больше 50 кадров — «индивидуально» (пакет «Индивидуально» в plans.js без цены);
//   3) наценка за срочность — CALC_URGENT, сейчас +20 %;
//   4) верх вилки — CALC_RANGE, сейчас +15 %;
//   5) отдельная аэросъёмка без мероприятия — собрана из CALC_PRICES (база + дрон), проверьте;
//   6) выезд за город — «оплачивается отдельно», цены нет.
var CALC_PRICES = {
  // Организация проекта: продюсер, подготовка, выезд команды — один раз за съёмку
  base: 2.8,

  // Масштаб: сколько гостей входит в базовую цену и доплата за каждые следующие 50 гостей
  guestsIncluded: 100,
  per50Guests: 1.1,

  // Команда: за 1 человека за 1 час на площадке (с монтажом/обработкой его материала)
  operatorHour: 1.4,
  photographerHour: 1.4,

  // Прямой эфир: режиссёр трансляции, техник, стрим-оборудование — за день
  live: 9.9,

  // Техника — за день
  drone: 5.2,   // аэросъёмка с лицензией и пилотом
  fpv: 4.4,     // FPV-дрон с пилотом
  gopro: 1.1,   // GoPro-ракурсы

  // Графика и подготовка гостей
  invitation: 4.4, // видео-приглашение
  ledEach: 0.9,    // одна LED-заставка для экранов
  welcome: 2.6,    // welcome-фотосессия гостей

  // Монтаж
  verticalEach: 0.6,               // один вертикальный ролик
  report: { none: 0, short: 2.8, long: 5.5 }, // отчётный ролик: нет / до 2 мин / 2–5 мин

  // Передача всех исходников
  sources: 2.8
};

var CALC_RANGE = 1.15;  // верх вилки = расчёт × 1,15 (запас на сложность съёмки)
var CALC_URGENT = 0.2;  // срочность (сдача за 3–5 дней): +20 %. TODO: подтвердите
var CALC_SMM_DISCOUNT = { 1: 0, 3: 0.07, 6: 0.12, 12: 0.18 }; // скидки за предоплату SMM, как на сайте

// Параметры для кнопок быстрого старта. id совпадают с пакетами в plans.js.
var CALC_PRESETS = {
  'ev-blockbuster': { guests: 400, hours: 10, operators: 6, photographers: 3, live: true, drone: true, fpv: true, gopro: true, invite: true, led: 10, welcome: true, sources: true, vertical: 10, report: 'long' },
  'ev-hist1': { guests: 250, hours: 8, operators: 3, photographers: 3, live: false, drone: true, fpv: false, gopro: true, invite: true, led: 10, welcome: false, sources: true, vertical: 10, report: 'long' },
  'ev-hist2': { guests: 200, hours: 8, operators: 2, photographers: 2, live: false, drone: true, fpv: false, gopro: false, invite: false, led: 0, welcome: false, sources: false, vertical: 5, report: 'long' },
  'ev-hist3': { guests: 100, hours: 4, operators: 2, photographers: 2, live: false, drone: false, fpv: false, gopro: false, invite: false, led: 0, welcome: false, sources: false, vertical: 5, report: 'short' }
};
// Цены пакетов мероприятий (подсказка «Ближе всего к пакету» — только в старой версии сайта)
var CALC_PACKAGE_PRICES = { 'ev-blockbuster': 188.0, 'ev-hist1': 107.5, 'ev-hist2': 64.0, 'ev-hist3': 31.0 };

// Значения по умолчанию для всех услуг
var CALC_DEFAULTS = {
  service: 'event', urgent: false,
  reel_format: 'reels', reel_count: 4, reel_drone: false, reel_fpv: false, reel_sources: false,
  photo_count: 30, photo_drone: false, photo_sources: false,
  smm_level: 'smm-pro', smm_months: 1,
  live_hours: 4, live_cams: 2, live_drone: false, live_record: false,
  aer_fpv: false, aer_edit: true, aer_sources: false
};

var MMM_CALC = (function () {
  'use strict';
  var P = CALC_PRICES;

  function round1(v) { return Math.round(v * 10) / 10; }
  function plans() {
    if (typeof window !== 'undefined' && window.MMM_PLANS) return window.MMM_PLANS.ru;
    if (typeof require === 'function') { try { return require('./plans.js').ru; } catch (e) { /* нет plans.js */ } }
    return {};
  }
  function price(id) { var p = plans()[id]; return p && p.price != null ? p.price : null; }

  // ---------- Мероприятие (логика не менялась) ----------
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

  // Цена одного Reels по пакетам «Только видео»: чем больше роликов, тем выгоднее
  function reelRate(n) {
    var tiers = ['video-start', 'video-pro', 'video-premium'].map(function (id) {
      var p = plans()[id] || {};
      return { n: p.reels || 1, rate: (p.price || 0) / (p.reels || 1) };
    });
    for (var i = 0; i < tiers.length; i++) if (n <= tiers[i].n) return tiers[i].rate;
    return tiers[tiers.length - 1].rate;
  }

  // ---------- Все услуги: строки, вилка «от–до», признак «индивидуально» ----------
  function computeService(s) {
    s = fill(s);
    var rows = [];
    var individual = false;
    var fixed = false; // цена пакета без вилки (SMM)
    switch (s.service) {
      case 'event': {
        var ev = compute(s);
        rows = ev.rows.filter(function (r) { return r.value > 0; });
        break;
      }
      case 'reels': {
        if (s.reel_format === 'ad') { individual = true; break; }
        var rate = reelRate(s.reel_count);
        rows.push({ id: 'clips', value: s.reel_count * rate, n: s.reel_count });
        if (s.reel_drone) rows.push({ id: 'drone', value: P.drone });
        if (s.reel_fpv) rows.push({ id: 'fpv', value: P.fpv });
        if (s.reel_sources) rows.push({ id: 'sources', value: P.sources });
        break;
      }
      case 'photo': {
        var start = plans()['foto-start'] || {}, pro = plans()['foto-pro'] || {};
        if (s.photo_count > (pro.photos || 50)) { individual = true; break; }
        var pack = s.photo_count <= (start.photos || 30) ? start : pro;
        rows.push({ id: 'photos', value: pack.price || 0, n: s.photo_count, pack: pack.name });
        if (s.photo_drone) rows.push({ id: 'drone', value: P.drone });
        if (s.photo_sources) rows.push({ id: 'sources', value: P.sources });
        break;
      }
      case 'smm': {
        var monthly = price(s.smm_level) || 0;
        var d = CALC_SMM_DISCOUNT[s.smm_months] || 0;
        rows.push({ id: 'smm', value: monthly * s.smm_months * (1 - d), m: s.smm_months, d: Math.round(d * 100), pack: (plans()[s.smm_level] || {}).name });
        fixed = true;
        break;
      }
      case 'live': {
        rows.push({ id: 'stream', value: P.live });
        rows.push({ id: 'crew', value: s.live_hours * s.live_cams * P.operatorHour, h: s.live_hours, n: s.live_cams });
        rows.push({ id: 'org', value: P.base });
        if (s.live_drone) rows.push({ id: 'drone', value: P.drone });
        if (s.live_record) rows.push({ id: 'record', value: P.report.short });
        break;
      }
      case 'aerial': {
        rows.push({ id: 'drone', value: P.drone });
        rows.push({ id: 'org', value: P.base });
        if (s.aer_fpv) rows.push({ id: 'fpv', value: P.fpv });
        if (s.aer_edit) rows.push({ id: 'aeredit', value: P.report.short });
        if (s.aer_sources) rows.push({ id: 'sources', value: P.sources });
        break;
      }
    }
    if (individual) return { rows: [], low: null, high: null, individual: true, service: s.service };
    var sum = rows.reduce(function (a, r) { return a + r.value; }, 0);
    if (s.urgent) { rows.push({ id: 'urgent', value: sum * CALC_URGENT }); sum *= 1 + CALC_URGENT; }
    var low = round1(sum);
    var high = fixed ? low : round1(sum * CALC_RANGE);
    return { rows: rows, low: low, high: high, individual: false, service: s.service };
  }

  function fill(s) {
    var o = {};
    Object.keys(CALC_DEFAULTS).forEach(function (k) { o[k] = CALC_DEFAULTS[k]; });
    Object.keys(CALC_PRESETS['ev-hist2']).forEach(function (k) { o[k] = CALC_PRESETS['ev-hist2'][k]; });
    Object.keys(s || {}).forEach(function (k) { if (s[k] !== undefined && s[k] !== null) o[k] = s[k]; });
    return o;
  }

  // Минимальная цена по категории — для строки «от …» (Фото / Видео / SMM / Мероприятия)
  function minPrice(prefix) {
    var list = Object.keys(plans()).filter(function (id) { return id.indexOf(prefix + '-') === 0; })
      .map(function (id) { return plans()[id]; }).filter(function (p) { return p.price != null; });
    if (!list.length) return null;
    return list.reduce(function (a, b) { return b.price < a.price ? b : a; });
  }

  var api = { prices: P, presets: CALC_PRESETS, defaults: CALC_DEFAULTS, compute: compute, computeService: computeService, closest: closest, minPrice: minPrice, fill: fill };

  // В Node / Worker интерфейс не нужен
  if (typeof document === 'undefined') return api;

  var i18n = window.MMM_I18N;
  var root = document.getElementById('calculator');
  if (!root) return api;

  var form = document.getElementById('calc-form');
  var totalEl = document.getElementById('calc-total');
  var barTotal = document.getElementById('calc-bar-total');
  var liveEl = document.getElementById('calc-live');
  var rowsEl = document.getElementById('calc-rows');
  var noteEl = document.getElementById('calc-ind-note');
  var closestName = document.getElementById('calc-closest-name'); // только старая версия
  var closestBtn = document.getElementById('calc-closest-open');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var shown = { low: 0, high: 0 };
  var anim = null;
  var liveTimer = null;
  var lastClosest = null;
  var usedTracked = false;

  function t(k, p, l) { return i18n.t(k, p, l); }
  function money(v, l) { return i18n.num(v, 1, l) + ' ' + t('unit.total', null, l); }
  function rangeText(low, high, l) {
    if (low == null) return t('v2.calc.individual', null, l);
    if (high == null || Math.abs(high - low) < 0.05) return '≈ ' + money(low, l);
    return t('v2.calc.range', { a: i18n.num(low, 1, l), b: money(high, l) }, l);
  }
  function totalText(v, l) { return '≈ ' + money(v, l); }
  function reportText(r, l) { return t(r === 'short' ? 'calc.reportShort' : r === 'long' ? 'calc.reportLong' : 'calc.reportNone', null, l); }
  function has(name) { return !!form.elements[name]; }

  // ---------- Состояние формы ----------
  function radio(name) { var el = form.querySelector('input[name="' + name + '"]:checked'); return el ? el.value : null; }
  function read() {
    var f = form.elements;
    var s = {
      service: radio('service') || 'event',
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
    if (has('urgent')) {
      s.urgent = f.urgent.checked;
      s.reel_format = radio('reel_format') || 'reels';
      s.reel_count = Number(f.reel_count.value);
      s.reel_drone = f.reel_drone.checked; s.reel_fpv = f.reel_fpv.checked; s.reel_sources = f.reel_sources.checked;
      s.photo_count = Number(f.photo_count.value);
      s.photo_drone = f.photo_drone.checked; s.photo_sources = f.photo_sources.checked;
      s.smm_level = radio('smm_level') || 'smm-pro';
      s.smm_months = Number(radio('smm_months') || 1);
      s.live_hours = Number(radio('live_hours') || 4);
      s.live_cams = Number(f.live_cams.value);
      s.live_drone = f.live_drone.checked; s.live_record = f.live_record.checked;
      s.aer_fpv = f.aer_fpv.checked; s.aer_edit = f.aer_edit.checked; s.aer_sources = f.aer_sources.checked;
    }
    return s;
  }
  function write(s) {
    var f = form.elements;
    Object.keys(s).forEach(function (k) {
      var el = f[k];
      if (!el) return;
      if (el.length !== undefined && !el.tagName) { // группа радиокнопок
        Array.prototype.forEach.call(el, function (r) { r.checked = String(r.value) === String(s[k]); });
      } else if (el.type === 'checkbox') el.checked = !!s[k];
      else el.value = s[k];
    });
  }

  // ---------- Описание расчёта (бриф, чат, заявка менеджеру) ----------
  function lc(str) { return str.length > 1 && str[1] === str[1].toLowerCase() ? str[0].toLowerCase() + str.slice(1) : str; }
  var SERVICE_KEY = { event: 'w.event', reels: 'v2.svc.reels', photo: 'w.photo', smm: 'v2.svc.smm', live: 'calc.live', aerial: 'ev.aerial' };
  function serviceName(k, l) { return t(SERVICE_KEY[k] || 'w.event', null, l); }
  function describe(s, l) {
    s = fill(s);
    var res = computeService(s);
    var parts = [];
    switch (s.service) {
      case 'event':
        parts.push(t('calc.d.guests', { n: s.guests }, l), t('calc.hUnit', { n: s.hours }, l), t('calc.d.ops', { n: s.operators }, l), t('calc.d.ph', { n: s.photographers }, l));
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
        break;
      case 'reels':
        parts.push(s.reel_format === 'ad' ? lc(t('w.ad', null, l)) : 'Reels', t('v2.row.clipsD', { n: s.reel_count }, l));
        if (s.reel_drone) parts.push(lc(t('calc.drone', null, l)));
        if (s.reel_fpv) parts.push(t('calc.fpv', null, l));
        if (s.reel_sources) parts.push(lc(t('calc.sources', null, l)));
        break;
      case 'photo':
        parts.push(t('v2.row.photoD', { n: s.photo_count }, l));
        if (s.photo_drone) parts.push(lc(t('calc.drone', null, l)));
        if (s.photo_sources) parts.push(lc(t('calc.sources', null, l)));
        break;
      case 'smm':
        parts.push((plans()[s.smm_level] || {}).name || '', t('v2.calc.mo', { n: s.smm_months }, l));
        break;
      case 'live':
        parts.push(t('calc.hUnit', { n: s.live_hours }, l), t('v2.d.cams', { n: s.live_cams }, l));
        if (s.live_drone) parts.push(lc(t('calc.drone', null, l)));
        if (s.live_record) parts.push(lc(t('v2.calc.record', null, l)));
        break;
      case 'aerial':
        if (s.aer_fpv) parts.push(t('calc.fpv', null, l));
        if (s.aer_edit) parts.push(lc(t('v2.calc.edit', null, l)));
        if (s.aer_sources) parts.push(lc(t('calc.sources', null, l)));
        break;
    }
    if (s.urgent) parts.push(lc(t('v2.calc.urgent', null, l)));
    var params = serviceName(s.service, l) + (parts.length ? ': ' + parts.filter(Boolean).join(', ') : '');
    return t('calc.desc', { total: rangeText(res.low, res.high, l), params: params }, l);
  }
  api.describe = describe;
  api.serviceName = serviceName;

  // ---------- Отрисовка ----------
  function rowLabel(r, s) {
    var gear = [];
    if (s.drone) gear.push(t('calc.drone'));
    if (s.fpv) gear.push(t('calc.fpv'));
    if (s.gopro) gear.push('GoPro');
    switch (r.id) {
      case 'team': return [t('calc.rowTeam'), t('calc.rowTeamD', { ops: s.operators, ph: s.photographers, h: s.hours })];
      case 'org': return [t('calc.rowOrg'), s.service === 'event' ? t('calc.rowOrgD', { n: s.guests }) : ''];
      case 'live': case 'stream': return [t('calc.live'), ''];
      case 'gear': return [t('calc.rowGear'), gear.join(', ')];
      case 'design': return [t('calc.rowDesign'), s.led ? t('calc.rowDesignD', { n: s.led }) : ''];
      case 'welcome': return [t('calc.welcome'), ''];
      case 'edit': return [t('calc.rowEdit'), t('calc.rowEditD', { v: s.vertical, r: reportText(s.report) })];
      case 'sources': return [t('calc.sources'), ''];
      case 'clips': return ['Reels', t('v2.row.clipsD', { n: r.n })];
      case 'photos': return [t('w.photo'), t('v2.row.photoD', { n: r.n }) + (r.pack ? ' · ' + r.pack : '')];
      case 'smm': return ['SMM ' + (r.pack || ''), t('v2.row.smmD', { m: r.m, d: r.d })];
      case 'crew': return [t('v2.calc.cams'), t('v2.row.crewD', { n: r.n, h: r.h })];
      case 'drone': return [t('calc.drone'), ''];
      case 'fpv': return [t('calc.fpv'), ''];
      case 'record': return [t('v2.calc.record'), ''];
      case 'aeredit': return [t('v2.calc.edit'), ''];
      case 'urgent': return [t('v2.row.urgent'), '+' + Math.round(CALC_URGENT * 100) + '%'];
    }
    return [r.id, ''];
  }

  function renderRows(s, res) {
    if (!rowsEl) return;
    rowsEl.innerHTML = '';
    res.rows.forEach(function (r) {
      if (r.value <= 0) return;
      var lbl = rowLabel(r, s);
      var li = document.createElement('li');
      var name = document.createElement('span');
      name.className = 'calc__row-name';
      name.textContent = lbl[0];
      if (lbl[1]) { var small = document.createElement('small'); small.textContent = lbl[1]; name.appendChild(small); }
      var val = document.createElement('span');
      val.className = 'calc__row-val';
      val.textContent = i18n.moneyText(r.value);
      li.appendChild(name);
      li.appendChild(val);
      rowsEl.appendChild(li);
    });
  }

  function paint(low, high) {
    var txt = rangeText(low, high);
    totalEl.textContent = txt;
    if (barTotal) barTotal.textContent = txt;
  }

  function animateTo(low, high) {
    if (anim) cancelAnimationFrame(anim);
    if (low == null) { shown = { low: 0, high: 0 }; paint(null, null); return; }
    if (reduce || (shown.low === low && shown.high === high)) { shown = { low: low, high: high }; paint(low, high); return; }
    var from = { low: shown.low || low, high: shown.high || high };
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var k = Math.min(1, (ts - start) / 450);
      var e = 1 - Math.pow(1 - k, 3);
      shown = { low: from.low + (low - from.low) * e, high: from.high + (high - from.high) * e };
      if (k < 1) { paint(shown.low, shown.high); anim = requestAnimationFrame(step); }
      else { shown = { low: low, high: high }; paint(low, high); anim = null; }
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
    root.querySelectorAll('[data-preset]').forEach(function (btn) {
      var p = CALC_PRESETS[btn.getAttribute('data-preset')];
      var same = Object.keys(p).every(function (k) { return p[k] === s[k]; });
      btn.setAttribute('aria-pressed', same ? 'true' : 'false');
    });
    // Показываем параметры только выбранной услуги
    root.querySelectorAll('[data-svc]').forEach(function (el) {
      el.hidden = el.getAttribute('data-svc').split(' ').indexOf(s.service) === -1;
    });
  }

  function update(animate) {
    var s = read();
    var res = computeService(s);
    renderOutputs(s);
    renderRows(s, res);
    if (noteEl) noteEl.hidden = !res.individual;
    if (animate) animateTo(res.low, res.high);
    else { if (anim) cancelAnimationFrame(anim); shown = { low: res.low || 0, high: res.high || 0 }; paint(res.low, res.high); }
    if (closestName && s.service === 'event') {
      lastClosest = closest(res.low);
      var pl = (window.MMM_PLANS || {})[i18n.lang()] || (window.MMM_PLANS || {}).ru || {};
      closestName.textContent = pl[lastClosest] ? pl[lastClosest].name : '';
    }
    if (liveEl) {
      clearTimeout(liveTimer);
      liveTimer = setTimeout(function () { liveEl.textContent = t('calc.liveMsg', { total: rangeText(res.low, res.high) }); }, 500);
    }
  }

  function trackUse() {
    if (usedTracked || !window.MMM_track) return;
    usedTracked = true;
    window.MMM_track('calc_used', { service: read().service });
  }

  form.addEventListener('input', function () { update(true); trackUse(); });
  form.addEventListener('change', function () { update(true); trackUse(); });
  form.addEventListener('submit', function (e) { e.preventDefault(); });

  // Для других скриптов: выбрать услугу и описать текущий расчёт
  api.setService = function (key) { write({ service: key }); update(true); };
  api.current = function () { return read(); };
  api.currentText = function (l) { return describe(read(), l); };

  root.addEventListener('click', function (e) {
    var preset = e.target.closest('[data-preset]');
    if (preset) {
      write(CALC_PRESETS[preset.getAttribute('data-preset')]);
      update(true); trackUse();
      return;
    }
    if (closestBtn && e.target.closest('#calc-closest-open')) {
      if (window.MMM_openPlan && lastClosest) window.MMM_openPlan(lastClosest, closestBtn);
      return;
    }
    if (e.target.closest('[data-calc-chat]')) {
      trackUse();
      var st = read();
      if (window.MMM_openChat) window.MMM_openChat({ calc: describe(st, i18n.lang()), calcRu: describe(st, 'ru'), state: st });
      return;
    }
    if (e.target.closest('[data-calc-send]')) {
      trackUse();
      var kindMap = { event: 'Мероприятие', reels: 'Reels', photo: 'Фотосъёмка', smm: 'SMM на месяц', live: 'Трансляция', aerial: 'Аэросъёмка' };
      var cur = read();
      if (window.MMM_choosePlan) window.MMM_choosePlan({ type: 'calc', state: cur }, cur.service === 'reels' && cur.reel_format === 'ad' ? 'Рекламный ролик' : kindMap[cur.service] || 'Мероприятие');
    }
  });

  i18n.onChange(function () { update(false); });

  // Старт — мероприятие с параметрами «Исторического 2»
  write(CALC_DEFAULTS);
  write(CALC_PRESETS['ev-hist2']);
  // Ссылка из Telegram-бота: ?svc=reels#calculator — сразу нужная услуга
  var svcParam = (location.search.match(/[?&]svc=([a-z]+)/) || [])[1];
  if (svcParam && SERVICE_KEY[svcParam]) write({ service: svcParam });
  update(false);

  return api;
})();

if (typeof module !== 'undefined' && module.exports) module.exports = MMM_CALC;
else window.MMM_CALC = MMM_CALC;
