// Interface: start screen, station menu, view/time controls, hotspots, tour, mini-plan, exports.
// All names are English; explanations are Russian.
import * as THREE from 'three';
import { STATIONS, PROJECT, ROADMAP } from '../config.js';
import { Hotspots } from '../core/hotspots.js';
import { Flight } from '../core/tour.js';
import { Minimap } from './minimap.js';
import { screenshot4K, exportGLB } from '../core/exporters.js';

const ICON = {
  orbit: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="9" ry="4" transform="rotate(-20 12 12)"/><circle cx="12" cy="12" r="2.6"/></svg>',
  walk: '<svg viewBox="0 0 24 24"><circle cx="13" cy="4.5" r="1.8"/><path d="M10 21l2-6 2.5 2.5V21M8 12l2.5-4.5 3.5.5 2 3.5 2.5 1M12.5 8l-1 5.5"/></svg>',
  sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>',
  moon: '<svg viewBox="0 0 24 24"><path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/></svg>',
  tour: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l10.5-6.5z"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><rect x="6.5" y="6.5" width="11" height="11" rx="1.5"/></svg>',
  cut: '<svg viewBox="0 0 24 24"><path d="M3 9l9-5 9 5-9 5z"/><path d="M3 14l9 5 9-5" stroke-dasharray="2.5 2.5"/></svg>',
  shot: '<svg viewBox="0 0 24 24"><path d="M4 8h3l1.5-2.5h7L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.4"/></svg>',
  glb: '<svg viewBox="0 0 24 24"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/></svg>',
  help: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.9v.6"/><circle cx="12" cy="17" r=".6"/></svg>',
  home: '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  go: '<svg viewBox="0 0 24 24"><path d="M5 12h13M13 6l6 6-6 6"/></svg>',
  map: '<svg viewBox="0 0 24 24"><path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/></svg>',
  route: '<svg viewBox="0 0 24 24"><circle cx="5" cy="18" r="2"/><circle cx="19" cy="6" r="2"/><path d="M7 18h7a3 3 0 0 0 0-6H10a3 3 0 0 1 0-6h7"/></svg>',
  storm: '<svg viewBox="0 0 24 24"><path d="M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8"/></svg>',
};

const MARK = '<svg class="mark" viewBox="0 0 64 64" aria-hidden="true"><ellipse cx="32" cy="32" rx="25" ry="10" fill="none" stroke="#FF6A1A" stroke-width="3.2" transform="rotate(-24 32 32)"/><circle cx="32" cy="32" r="9" fill="#DDE3EA"/><circle cx="54" cy="21" r="3.6" fill="#F2C230"/></svg>';

const ART = {
  tashkent: `<svg viewBox="0 0 320 150" class="art" aria-hidden="true">
    <path d="M10 128H310" stroke="#2A3D5C"/>
    <path d="M30 128V20H290V128" stroke="#1E2E48"/>
    <g stroke="#1E2E48">${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => `<rect x="${44 + i * 31}" y="30" width="16" height="18"/>`).join('')}</g>
    <path d="M62 128V92Q62 70 84 68H236Q258 70 258 92V128" stroke="#DDE3EA" stroke-width="1.6"/>
    <path d="M96 68V128M224 68V128" stroke="#5B6B82"/>
    <path d="M144 128V96Q144 84 156 84H164Q176 84 176 96V128" stroke="#FF6A1A" stroke-width="1.6"/>
    ${[80, 116, 204, 240].map((x) => `<circle cx="${x}" cy="102" r="7.5" stroke="#DDE3EA"/>`).join('')}
    <rect x="118" y="74" width="84" height="7" rx="1" fill="#13223A" stroke="#F2C230" stroke-width=".8"/>
    <path d="M62 128H258" stroke="#FF6A1A" stroke-opacity=".7"/>
  </svg>`,
  astrocity: `<svg viewBox="0 0 320 150" class="art" aria-hidden="true">
    <path d="M10 118H190L214 132H310" stroke="#2A3D5C"/>
    <path d="M190 118L200 128L214 132" stroke="#B4482A"/>
    <circle cx="270" cy="34" r="9" stroke="#F2C230"/>
    <path d="M70 118V100A46 46 0 0 1 162 100V118" stroke="#DDE3EA" stroke-width="1.6"/>
    <path d="M70 100H162M80 78L116 56L152 78M92 66L116 100L140 66M116 56V100M80 78L92 100M152 78L140 100" stroke="#5B6B82"/>
    <path d="M70 100H162" stroke="#FF6A1A" stroke-width="1.4"/>
    <path d="M18 118V102Q18 96 24 96H70" stroke="#DDE3EA" stroke-width="1.4"/>
    ${[30, 44, 58].map((x) => `<circle cx="${x}" cy="106" r="3" stroke="#DDE3EA"/>`).join('')}
    <path d="M200 116l10-12M206 108h6" stroke="#5B6B82"/>
  </svg>`,
  konyukhov: `<svg viewBox="0 0 320 150" class="art" aria-hidden="true">
    <path d="M10 70L70 22L110 50L160 8L230 60L262 40L310 76" stroke="#5B6B82"/>
    <path d="M150 16L160 8L172 18M60 30L70 22L80 30" stroke="#DDE3EA"/>
    <path d="M10 128H310" stroke="#2A3D5C"/>
    <path d="M60 120V78Q60 66 74 66H150V120M170 120V66H246Q260 66 260 78V120" stroke="#DDE3EA" stroke-width="1.6"/>
    <path d="M150 74H170" stroke="#5B6B82"/>
    <path d="M86 84H140V100H86ZM180 84H234V100H180Z" stroke="#F2C230"/>
    <path d="M84 84L72 104M142 84L154 104" stroke="#5B6B82"/>
    <rect x="118" y="52" width="84" height="10" rx="2" fill="#13223A" stroke="#F2C230" stroke-width=".8"/>
    ${[80, 104, 216, 240].map((x) => `<circle cx="${x}" cy="124" r="5" stroke="#5B6B82"/>`).join('')}
    <path d="M40 134L40 112M36 116L40 108L44 116M280 134V108M276 112L280 104L284 112" stroke="#5B6B82"/>
    <path d="M60 128H260" stroke="#FF6A1A" stroke-opacity=".7"/>
  </svg>`,
};

const COORDS = { tashkent: '41.316° N · 69.248° E', astrocity: 'USTYURT PLATEAU · KARAKALPAKSTAN', konyukhov: '≈ 55.1° N · 60.2° E' };
const ORDER = ['tashkent', 'astrocity', 'konyukhov'];
const STATUS_LABEL = { now: 'NOW', planned: 'PLANNED', goal: 'GOAL' };

export function initUI(app) {
  const { engine, rig, quality } = app;
  const root = document.getElementById('ui');
  document.body.classList.toggle('touch', !!quality.touch);
  document.body.classList.toggle('mobile', !!quality.mobile);

  root.innerHTML = `
  <section class="start" id="start" aria-label="Выбор станции">
    <canvas class="start-stars" id="start-stars" aria-hidden="true"></canvas>
    <header class="start-top">
      <div class="logo">${MARK}<span>${PROJECT.brand}</span></div>
      <div class="start-meta mono">INTERACTIVE 3D · 1 UNIT = 1 M</div>
    </header>
    <div class="start-main">
      <p class="kicker mono">SPACE CAFÉ NETWORK</p>
      <h1>ASTRA<br><span>STATION</span></h1>
      <p class="lead">Интерактивные 3D-модели кофеен: станции ASTRA в Ташкенте и на плато Устюрт и мобильная кофейня N.KONYUKHOV на курорте «Солнечная долина».</p>
      <div class="cards">
        ${ORDER.map((id) => {
    const s = STATIONS[id];
    return `<article class="st-card" data-station="${id}">
            ${ART[id]}
            <div class="st-body">
              <p class="mono st-code">${s.code}</p>
              <h2>${s.name}</h2>
              <ul class="chips">${s.specs.map((x) => `<li>${x}</li>`).join('')}</ul>
              <p class="st-ru">${s.ru}</p>
              <div class="st-foot">
                <span class="mono coords">${COORDS[id]}</span>
                <button class="btn btn-launch" data-launch="${id}" type="button">Launch ${ICON.go}</button>
              </div>
              <div class="st-load" aria-hidden="true"><i></i></div>
            </div>
          </article>`;
  }).join('')}
      </div>
      <section class="rm-strip" aria-label="Дорожная карта">
        <div class="rm-head"><p class="kicker mono">ROADMAP · FROM IDEA TO THE FIRST MISSION</p><button class="btn btn-ghost" id="rm-open" type="button">Roadmap ${ICON.route}</button></div>
        <ol class="rm-list">${ROADMAP.map((st) => `<li class="rm-item is-${st.status}" title="${st.ru}"><span class="mono">${String(st.n).padStart(2, '0')}</span><b>${st.title}</b><em class="mono">${STATUS_LABEL[st.status]}</em></li>`).join('')}</ol>
      </section>
      <p class="start-hint">Мышь или палец — вращение, колесо или щипок — масштаб. Режим <b>Walk</b>: WASD + мышь, на телефоне — джойстик.</p>
    </div>
  </section>

  <header class="hud hud-top">
    <button class="brand" id="btn-home" type="button" title="Вернуться к выбору станции">${MARK}<span class="brand-txt"><b>ASTRA STATION</b><span class="mono" id="st-code"></span></span></button>
    <nav class="seg seg-station" id="station-switch" aria-label="Станция">
      ${ORDER.map((id) => `<button type="button" data-station="${id}"><span class="full">${STATIONS[id].tab}</span><span class="short">${STATIONS[id].short || STATIONS[id].tab}</span></button>`).join('')}
    </nav>
    <div class="top-right">
      <button class="icon-btn" id="btn-map" type="button" title="Мини-план" aria-label="Plan">${ICON.map}</button>
      <button class="icon-btn" id="btn-roadmap" type="button" title="Дорожная карта проекта" aria-label="Roadmap">${ICON.route}</button>
      <button class="icon-btn" id="btn-help" type="button" title="Управление" aria-label="Help">${ICON.help}</button>
    </div>
  </header>

  <nav class="hud toolbar" aria-label="Инструменты">
    <div class="seg" id="view-seg">
      <button type="button" data-mode="orbit" title="Орбита: вращение вокруг станции">${ICON.orbit}<span>Orbit</span></button>
      <button type="button" data-mode="walk" title="Прогулка от первого лица">${ICON.walk}<span>Walk</span></button>
    </div>
    <div class="seg" id="time-seg">
      <button type="button" data-time="day" title="День (на Устюрте — закат)">${ICON.sun}<span>Day</span></button>
      <button type="button" data-time="night" title="Ночь">${ICON.moon}<span>Night</span></button>
    </div>
    <span class="tb-sep"></span>
    <button class="tool" id="btn-tour" type="button" title="Тур: фасад → вход → бар → мерч → тур-деск → зал">${ICON.tour}<span>Tour</span></button>
    <button class="tool" id="btn-cut" type="button" title="Разрез: снять крышу и увидеть план сверху">${ICON.cut}<span>Cutaway</span></button>
    <button class="tool" id="btn-shot" type="button" title="Скриншот 3840 × 2160 (PNG)">${ICON.shot}<span>4K</span></button>
    <button class="tool" id="btn-glb" type="button" title="Экспорт модели станции в GLB">${ICON.glb}<span>GLB</span></button>
    <button class="tool" id="btn-storm" type="button" title="Пыльная буря — сценарий первой миссии" hidden>${ICON.storm}<span>Storm</span></button>
  </nav>

  <aside class="hud minimap" id="minimap">
    <div class="mm-head mono"><span>PLAN</span><span id="mm-name"></span></div>
    <canvas id="mm-canvas" title="Нажмите на план, чтобы перейти туда в режиме прогулки"></canvas>
  </aside>

  <div class="hud caption" id="caption" hidden>
    <div class="cap-top mono"><span id="cap-step"></span><span class="cap-dots" id="cap-dots"></span></div>
    <h3 id="cap-title"></h3>
    <p id="cap-text"></p>
    <button class="btn btn-ghost" id="cap-stop" type="button">${ICON.stop}Stop</button>
  </div>

  <div class="hud zone-card" id="zone-card" hidden>
    <button class="icon-btn zc-close" id="zc-close" type="button" aria-label="Close">${ICON.close}</button>
    <p class="mono zc-kicker" id="zc-kicker"></p>
    <h3 id="zc-title"></h3>
    <p id="zc-text"></p>
    <button class="btn" id="zc-go" type="button">Go ${ICON.go}</button>
  </div>

  <div class="hud walk-hint" id="walk-hint" hidden></div>
  <div class="toast" id="toast" role="status"></div>
  <div class="hud stats mono" id="stats" hidden></div>
  <div class="busy" id="busy" hidden><div class="busy-bar"><i id="busy-bar"></i></div><span class="mono" id="busy-txt"></span></div>

  <div class="help" id="roadmap" hidden>
    <div class="help-box rm-box">
      <button class="icon-btn help-close" id="roadmap-close" type="button" aria-label="Close">${ICON.close}</button>
      <p class="mono kicker">ASTRAHUB · ROADMAP</p>
      <h3>Дорожная карта</h3>
      <p>Этапы проекта от идеи до первой миссии. Станции пока нет: всё после поиска партнёра — планы, их сроки зависят от событий.</p>
      <ol class="rm-full">${ROADMAP.map((st) => `<li class="is-${st.status}"><span class="mono rm-n">${String(st.n).padStart(2, '0')}</span><div><b>${st.title}</b> <em class="mono">${STATUS_LABEL[st.status]}</em><p>${st.ru}</p></div></li>`).join('')}</ol>
    </div>
  </div>

  <div class="help" id="help" hidden>
    <div class="help-box">
      <button class="icon-btn help-close" id="help-close" type="button" aria-label="Close">${ICON.close}</button>
      <p class="mono kicker">CONTROLS</p>
      <h3>Управление</h3>
      <div class="help-cols">
        <div>
          <h4>Orbit</h4>
          <p>Левая кнопка / палец — вращение. Колесо / щипок — масштаб. Правая кнопка / два пальца — сдвиг.</p>
          <h4>Walk</h4>
          <p class="desk">Клик по сцене — захват мыши. <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> — ходьба, <kbd>Shift</kbd> — быстрее, <kbd>Esc</kbd> — отпустить мышь.</p>
          <p class="tch">Джойстик слева — ходьба, свайп по экрану — обзор.</p>
        </div>
        <div>
          <h4>Hotspots</h4>
          <p>Оранжевые метки — зоны станции. Нажмите, чтобы прочитать описание и перейти к зоне.</p>
          <h4 class="desk">Shortcuts</h4>
          <p class="desk"><kbd>V</kbd> Orbit/Walk · <kbd>N</kbd> Day/Night · <kbd>T</kbd> Tour · <kbd>C</kbd> Cutaway · <kbd>M</kbd> Plan · <kbd>B</kbd> Storm · <kbd>F</kbd> FPS</p>
          <h4>Storm</h4>
          <p>На ASTRO CITY — пыльная буря, сценарий первой миссии: пыль в воздухе, видимость падает.</p>
          <p>Масштаб 1 : 1 — один юнит = 1 метр, силуэты людей ~1,75 м.</p>
        </div>
      </div>
      <button class="btn btn-ghost help-rm" id="help-rm" type="button">Roadmap ${ICON.route}</button>
    </div>
  </div>`;

  const $ = (id) => document.getElementById(id);
  const start = $('start');
  const hotspots = new Hotspots(document.getElementById('hotspots'), { onSelect: (h) => openZone(h) });
  const minimap = new Minimap($('mm-canvas'), { onPick: (p) => walkTo(p) });
  let flight = null;
  let pendingZone = null;
  let started = false;

  // ---------- start screen stars ----------
  const stars = startStars($('start-stars'));

  // ---------- loading ----------
  async function launch(id, fromStart) {
    if (app.loading) return;
    stopFlight(false);
    closeZone();
    const card = start.querySelector(`.st-card[data-station="${id}"]`);
    const bar = fromStart ? card.querySelector('.st-load i') : $('busy-bar');
    if (fromStart) card.classList.add('is-loading');
    else { $('busy').hidden = false; $('busy-txt').textContent = `LOADING ${STATIONS[id].code} · ${STATIONS[id].name}`; }
    bar.style.width = '4%';
    try {
      await app.load(id, (p) => { bar.style.width = `${Math.round(5 + p * 95)}%`; });
    } catch (e) {
      console.error(e);
      toast('Не удалось загрузить сцену: ' + e.message, 6000);
    }
    card?.classList.remove('is-loading');
    $('busy').hidden = true;
    if (fromStart) {
      start.classList.add('is-hidden');
      document.body.classList.add('is-started');
      stars.stop();
      started = true;
    }
    const url = new URL(location.href);
    url.searchParams.set('station', id);
    history.replaceState(null, '', url);
  }

  app.on((type, data) => {
    if (type === 'station') onStation(data);
    if (type === 'frame') onFrame(data);
  });

  function onStation(st) {
    $('btn-storm').hidden = !st.setStorm;
    $('btn-storm').classList.toggle('is-on', !!st.storm);
    const meta = STATIONS[st.id];
    $('st-code').textContent = `${meta.code} · ${meta.name}`;
    $('mm-name').textContent = meta.code;
    document.querySelectorAll('#station-switch button').forEach((b) => b.classList.toggle('is-on', b.dataset.station === st.id));
    hotspots.setStation(st);
    hotspots.cutaway = app.cutaway;
    minimap.setStation(st);
    fitOrbit(st.orbitView);
    syncMode('orbit');
    document.title = `ASTRA Station 3D — ${meta.name}`;
  }

  // orbit framing: on portrait screens step back so the whole station fits
  function fitOrbit(view) {
    const a = engine.camera.aspect;
    const t = new THREE.Vector3(...view.target), p = new THREE.Vector3(...view.pos);
    if (a < 1) p.sub(t).multiplyScalar(1 + (1 - a) * 0.95).add(t);
    rig.setMode('orbit', { view: { pos: p.toArray(), target: view.target } });
    rig.setOrbitView(p.toArray(), view.target);
  }

  // ---------- modes ----------
  function syncMode(mode) {
    document.querySelectorAll('#view-seg button').forEach((b) => b.classList.toggle('is-on', b.dataset.mode === mode));
    document.body.dataset.mode = mode;
  }
  rig.on((type, data) => {
    if (type === 'mode') syncMode(data);
    if (type === 'interrupt') stopFlight(true);
    if (type === 'pointerlock') document.body.classList.toggle('is-locked', data);
  });

  function setMode(mode) {
    if (!app.station) return;
    stopFlight(false);
    if (mode === 'walk') {
      if (app.cutaway) setCutaway(false);
      rig.setMode('walk');
      showWalkHint();
    } else {
      fitOrbit(app.station.orbitView); // pressing Orbit again resets the view
    }
  }

  function walkTo(p) {
    if (!app.station || flight) return;
    const yaw = rig.mode === 'walk' ? rig.walk.yaw : new THREE.Euler().setFromQuaternion(engine.camera.quaternion, 'YXZ').y;
    if (app.cutaway) setCutaway(false);
    rig.setMode('walk', { spawn: { pos: [p.x, 0, p.z], yaw, pitch: 0 } });
    showWalkHint();
  }

  let hintTimer = 0;
  function showWalkHint() {
    const el = $('walk-hint');
    el.textContent = quality.touch
      ? 'Джойстик слева — ходьба, свайп по экрану — обзор'
      : 'Клик по сцене — управление мышью · WASD — ходьба · Shift — быстрее · Esc — отпустить';
    el.hidden = false;
    el.classList.add('is-on');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => { el.classList.remove('is-on'); setTimeout(() => { el.hidden = true; }, 400); }, 4500);
  }

  function setNight(on) {
    app.setNight(on);
    document.querySelectorAll('#time-seg button').forEach((b) => b.classList.toggle('is-on', (b.dataset.time === 'night') === on));
  }

  function setCutaway(on) {
    app.setCutaway(on);
    hotspots.cutaway = on;
    $('btn-cut').classList.toggle('is-on', on);
    if (on && rig.mode === 'walk') fitOrbit(app.station.orbitView);
    if (on && rig.mode === 'orbit') {
      // look from above at the plan
      const st = app.station;
      const t = new THREE.Vector3(...st.orbitView.target);
      const cam = engine.camera.position.clone();
      const dir = cam.sub(t).setY(0).normalize();
      const pos = t.clone().addScaledVector(dir, st.id === 'tashkent' ? 9 : 13).setY(st.id === 'tashkent' ? 13 : 17);
      flyTo([{ pos: pos.toArray(), look: [t.x, 0.5, st.id === 'tashkent' ? -2.6 : 0.5], move: 1.6, hold: 0 }], 'orbit');
    }
  }

  // ---------- flights (tour + go to zone) ----------
  function flyTo(keys, end = 'auto', opts = {}) {
    stopFlight(false);
    rig.setMode('tour');
    flight = new Flight(engine.camera, keys, {
      onKey: opts.onKey,
      onEnd: () => { finishFlight(end, keys[keys.length - 1]); opts.onEnd?.(); },
      onStop: () => { finishFlight(end, null); opts.onEnd?.(); },
    });
  }

  function finishFlight(end, lastKey) {
    flight = null;
    const st = app.station;
    const inside = st.isInside(engine.camera.position);
    if ((end === 'auto' && inside) || end === 'walk') {
      rig.setMode('walk', { fromCamera: true });
    } else {
      rig.setMode('orbit', { keepCamera: true });
      if (lastKey) { rig.orbit.target.set(...lastKey.look); rig.orbit.update(); }
    }
  }

  function stopFlight(fromUser) {
    if (!flight) return;
    const f = flight;
    flight = null;
    f.stop();
    endTourUI();
    if (fromUser) toast('Тур остановлен');
  }

  function startTour() {
    const st = app.station;
    if (!st) return;
    if (flight) { stopFlight(true); return; }
    closeZone();
    if (app.cutaway) setCutaway(false);
    const keys = st.tour;
    $('caption').hidden = false;
    $('btn-tour').classList.add('is-on');
    $('btn-tour').innerHTML = `${ICON.stop}<span>Stop</span>`;
    $('cap-dots').innerHTML = keys.map(() => '<i></i>').join('');
    const show = (k, i) => {
      const hs = k.hotspot ? st.hotspots.find((h) => h.id === k.hotspot) : null;
      const title = k.title || hs?.title;
      const text = k.text || hs?.text;
      if (!title) return;
      $('cap-step').textContent = `${String(i).padStart(2, '0')} / ${String(keys.length).padStart(2, '0')}`;
      $('cap-title').textContent = title;
      $('cap-text').textContent = text || '';
      [...$('cap-dots').children].forEach((d, j) => d.classList.toggle('is-on', j < i));
      hotspots.highlight(k.hotspot || null);
      $('caption').classList.remove('pulse'); void $('caption').offsetWidth; $('caption').classList.add('pulse');
    };
    show({ title: keys[0].title, text: keys[0].text }, 1);
    flyTo(keys, 'auto', { onKey: (k, i) => show(k, i), onEnd: () => endTourUI() });
  }

  function endTourUI() {
    $('caption').hidden = true;
    $('btn-tour').classList.remove('is-on');
    $('btn-tour').innerHTML = `${ICON.tour}<span>Tour</span>`;
    hotspots.highlight(null);
  }

  // ---------- zones ----------
  function openZone(h) {
    if (flight) return;
    pendingZone = h;
    $('zc-kicker').textContent = `${STATIONS[app.station.id].code} · ${h.zone === 'in' ? 'INSIDE' : 'OUTSIDE'}`;
    $('zc-title').textContent = h.title;
    $('zc-text').textContent = h.text;
    $('zone-card').hidden = false;
    hotspots.highlight(h.id);
  }
  function closeZone() { $('zone-card').hidden = true; pendingZone = null; hotspots.highlight(null); }

  function goZone() {
    const h = pendingZone;
    const st = app.station;
    if (!h || !st) return;
    closeZone();
    if (app.cutaway && h.zone === 'in') setCutaway(false);
    const zv = st.zoneViews?.[h.id];
    const tk = zv || st.tour.find((k) => k.hotspot === h.id);
    let target;
    if (tk) target = { pos: tk.pos, look: tk.look, move: 2.6, hold: 0 };
    else {
      const p = new THREE.Vector3(...h.pos);
      const dir = engine.camera.position.clone().sub(p).setY(0).normalize();
      const pos = p.clone().addScaledVector(dir, 9).setY(p.y + 2.5);
      target = { pos: pos.toArray(), look: h.pos, move: 2.6, hold: 0 };
    }
    const inside = st.isInside(engine.camera.position);
    let keys = [target];
    if (h.zone === 'in' && !inside) keys = [...(zv?.path || st.doorPath), { ...target, move: 2.2 }];
    if (h.zone === 'out' && inside) keys = [...st.doorPath].reverse().map((k, i, arr) => ({ ...k, look: (arr[i + 1] || target).pos })).concat([target]);
    flyTo(keys, h.zone === 'in' ? 'walk' : 'orbit');
  }

  // ---------- exports ----------
  async function doShot() {
    if (!app.station) return;
    toast('Рендер 4K…', 20000);
    await new Promise((r) => setTimeout(r, 60));
    try {
      const r = await screenshot4K(engine, `astra-${app.station.id}-${app.night > 0.5 ? 'night' : 'day'}`);
      toast(`Скриншот сохранён · ${r.width} × ${r.height} PNG`);
    } catch (e) { console.error(e); toast('Скриншот не удался: ' + e.message, 5000); }
  }
  async function doGLB() {
    if (!app.station) return;
    toast('Экспорт GLB…', 60000);
    await new Promise((r) => setTimeout(r, 60));
    try {
      const r = await exportGLB(app.station.exportRoot, `astra-station-${app.station.id}`);
      toast(`GLB сохранён · ${(r.size / 1048576).toFixed(1)} MB`);
    } catch (e) { console.error(e); toast('Экспорт не удался: ' + e.message, 5000); }
  }

  // ---------- frame ----------
  let statT = 0;
  const statsEl = $('stats');
  function onFrame({ dt }) {
    if (flight) flight.update(dt);
    hotspots.update(engine.camera, app.station, rig.mode, innerWidth, innerHeight);
    if (!$('minimap').classList.contains('is-off')) minimap.draw(engine.camera, rig.mode);
    statT += dt;
    if (!statsEl.hidden && statT > 0.5) {
      statT = 0;
      const s = engine.stats;
      statsEl.textContent = `FPS ${engine.fps.toFixed(0)} · ${s.calls} calls · ${(s.triangles / 1000).toFixed(0)}k tris · DPR ${engine.dpr.toFixed(2)} · ${quality.tier}`;
    }
  }

  // ---------- toast ----------
  let toastTimer = 0;
  function toast(msg, ms = 2600) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('is-on'), ms);
  }

  // ---------- wiring ----------
  start.querySelectorAll('[data-launch]').forEach((b) => b.addEventListener('click', () => launch(b.dataset.launch, true)));
  start.querySelectorAll('.st-card').forEach((c) => c.addEventListener('click', (e) => { if (!e.target.closest('button')) launch(c.dataset.station, true); }));
  document.querySelectorAll('#station-switch button').forEach((b) => b.addEventListener('click', () => { if (b.dataset.station !== app.stationId) launch(b.dataset.station, false); }));
  document.querySelectorAll('#view-seg button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  document.querySelectorAll('#time-seg button').forEach((b) => b.addEventListener('click', () => setNight(b.dataset.time === 'night')));
  $('btn-tour').addEventListener('click', startTour);
  $('cap-stop').addEventListener('click', () => stopFlight(true));
  $('btn-cut').addEventListener('click', () => setCutaway(!app.cutaway));
  $('btn-shot').addEventListener('click', doShot);
  $('btn-glb').addEventListener('click', doGLB);
  $('btn-help').addEventListener('click', () => { $('help').hidden = false; });
  const openRoadmap = () => { $('roadmap').hidden = false; };
  $('btn-roadmap').addEventListener('click', openRoadmap);
  $('rm-open').addEventListener('click', openRoadmap);
  $('help-rm').addEventListener('click', () => { $('help').hidden = true; openRoadmap(); });
  start.querySelectorAll('.rm-item').forEach((li) => li.addEventListener('click', openRoadmap));
  $('roadmap-close').addEventListener('click', () => { $('roadmap').hidden = true; });
  $('roadmap').addEventListener('click', (e) => { if (e.target === $('roadmap')) $('roadmap').hidden = true; });
  $('btn-storm').addEventListener('click', () => {
    const st = app.station;
    if (!st?.setStorm) return;
    const on = !st.storm;
    st.setStorm(on);
    $('btn-storm').classList.toggle('is-on', on);
    if (on) toast('Пыльная буря — сценарий первой миссии');
  });
  $('help-close').addEventListener('click', () => { $('help').hidden = true; });
  $('help').addEventListener('click', (e) => { if (e.target === $('help')) $('help').hidden = true; });
  $('btn-map').addEventListener('click', () => { $('minimap').classList.toggle('is-off'); $('btn-map').classList.toggle('is-on', !$('minimap').classList.contains('is-off')); });
  $('btn-home').addEventListener('click', () => {
    stopFlight(false);
    if (document.pointerLockElement) document.exitPointerLock();
    start.classList.remove('is-hidden');
    document.body.classList.remove('is-started');
    stars.start();
  });
  $('zc-close').addEventListener('click', closeZone);
  $('zc-go').addEventListener('click', goZone);
  addEventListener('resize', () => minimap.layout());
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && !$('roadmap').hidden) { $('roadmap').hidden = true; return; }
    if (!started || e.target.tagName === 'INPUT' || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.code;
    if (k === 'KeyV') setMode(rig.mode === 'walk' ? 'orbit' : 'walk');
    else if (k === 'KeyN') setNight(app.nightTarget < 0.5);
    else if (k === 'KeyT') startTour();
    else if (k === 'KeyC') setCutaway(!app.cutaway);
    else if (k === 'KeyM') $('btn-map').click();
    else if (k === 'KeyF') { statsEl.hidden = !statsEl.hidden; }
    else if (k === 'KeyB') $('btn-storm').click();
    else if (k === 'Escape') { if (flight) stopFlight(true); closeZone(); $('help').hidden = true; $('roadmap').hidden = true; }
  });
  if (matchMedia('(max-width: 640px)').matches) $('minimap').classList.add('is-off');
  $('btn-map').classList.toggle('is-on', !$('minimap').classList.contains('is-off'));
  syncMode('orbit');
  setNight(false);

  // ---------- deep link: ?station=astrocity&night=1&fps=1 ----------
  const params = new URLSearchParams(location.search);
  if (params.get('fps') === '1') statsEl.hidden = false;
  const direct = params.get('station');
  if (direct && STATIONS[direct]) {
    launch(direct, true).then(() => {
      if (params.get('night') === '1') { setNight(true); app.night = 1; app.station.setNight(1); }
      if (params.get('mode') === 'walk') setMode('walk');
      window.__ready = true;
    });
  } else {
    window.__ready = 'start';
  }

  // test hooks
  app.ui = { launch, setMode, setNight, startTour, setCutaway, openZone, goZone, doShot, doGLB, stopFlight, toast };
}

// lightweight animated star field for the start screen
function startStars(canvas) {
  const ctx = canvas.getContext('2d');
  let raf = 0, stars = [];
  const resize = () => {
    const dpr = Math.min(2, devicePixelRatio || 1);
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars = Array.from({ length: Math.round((innerWidth * innerHeight) / 5200) }, () => ({ x: Math.random() * innerWidth, y: Math.random() * innerHeight, r: Math.random() ** 3 * 1.4 + 0.3, p: Math.random() * 6.28, s: 0.4 + Math.random() }));
  };
  const draw = (t) => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const s of stars) {
      const a = 0.35 + 0.45 * Math.sin(t * 0.001 * s.s + s.p) ** 2;
      ctx.fillStyle = `rgba(221,227,234,${a.toFixed(3)})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
    }
    raf = requestAnimationFrame(draw);
  };
  resize();
  addEventListener('resize', resize);
  const api = { start() { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); }, stop() { cancelAnimationFrame(raf); } };
  api.start();
  return api;
}
