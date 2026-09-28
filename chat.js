// MUST MOVIE MEDIA — чат на сайте.
// Ответы — из базы знаний knowledge.js (window.MMM_KB), без платного ИИ.
// «Позвать менеджера» отправляет диалог в Telegram-группу через воркер (telegram-worker),
// ответы менеджера приходят сюда же. Секретов во фронтенде нет: только адрес воркера.
(function () {
  'use strict';

  var KB = window.MMM_KB;
  if (!KB || !document.body) return;

  // Адрес воркера. Для локальной проверки можно задать window.MMM_CHAT_API до подключения chat.js.
  var API = (window.MMM_CHAT_API || 'https://mmm-brief.spotifyibrawkee.workers.dev').replace(/\/$/, '');
  var STORE = 'mmm_chat_v1';
  var MAX_LEN = 600;          // символов в сообщении
  var MAX_NAME = 60;
  var BURST = { n: 6, ms: 30000 }; // не больше 6 сообщений за 30 секунд
  var MIN_GAP = 800;          // и не чаще, чем раз в 0,8 с
  var POLL = { open: 4000, closed: 12000, hidden: 30000 };

  var i18n = window.MMM_I18N;
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function L() { return i18n ? i18n.lang() : 'ru'; }
  function T(k, p) { return KB.text(k, L(), p); }
  function track(name, params) { if (window.MMM_track) window.MMM_track(name, params || {}); }

  // ---------- Состояние (localStorage; без него чат тоже работает) ----------
  function newId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    var s = '';
    for (var i = 0; i < 32; i++) s += Math.floor(Math.random() * 16).toString(16);
    return s;
  }
  var state = null;
  try { state = JSON.parse(localStorage.getItem(STORE) || 'null'); } catch (e) { state = null; }
  if (!state || !state.sid) state = { sid: newId(), msgs: [], stage: null, name: '', contact: '', date: '', calc: '', dialog: false, after: 0, unread: 0 };
  function save() {
    if (state.msgs.length > 80) state.msgs = state.msgs.slice(-80);
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* приватный режим */ }
  }

  // ---------- Разметка ----------
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'class') e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  var ICON_SEND = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h14M12 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  var ICON_CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>';
  var ICON_TG = '<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 4.5 2.8 11.4c-.9.4-.9 1.6.1 1.9l4.5 1.4 1.7 5.3c.2.7 1.1.9 1.6.4l2.5-2.4 4.6 3.4c.6.4 1.4.1 1.6-.6L22.3 5.6c.2-.8-.6-1.4-1.3-1.1zM9.6 14.2l8.2-6.6-6.9 7.9-.3 3-1-4.3z" fill="currentColor"/></svg>';

  var fab = h('button', { type: 'button', class: 'chat-fab', 'aria-haspopup': 'dialog', 'aria-controls': 'mmm-chat', 'aria-expanded': 'false' });
  fab.innerHTML = '<span class="chat-fab__ring" aria-hidden="true"><span class="rec-dot"></span></span><span class="chat-fab__label"></span><span class="chat-fab__badge" hidden></span>';
  var fabLabel = fab.querySelector('.chat-fab__label');
  var badge = fab.querySelector('.chat-fab__badge');

  var panel = h('section', { class: 'chat', id: 'mmm-chat', role: 'dialog', 'aria-modal': 'false', 'aria-labelledby': 'mmm-chat-title', hidden: '' });
  panel.innerHTML =
    '<span class="vf vf--tl" aria-hidden="true"></span><span class="vf vf--tr" aria-hidden="true"></span>' +
    '<header class="chat__head">' +
      '<div class="chat__head-text">' +
        '<h2 class="chat__title" id="mmm-chat-title" tabindex="-1"><span class="chat__rec" aria-hidden="true"><span class="rec-dot"></span>REC</span> <span data-t="title"></span></h2>' +
        '<p class="chat__status"></p>' +
      '</div>' +
      '<button type="button" class="chat__close">' + ICON_CLOSE + '</button>' +
    '</header>' +
    '<div class="chat__log" role="log" aria-live="polite" aria-relevant="additions"></div>' +
    '<form class="chat__form" novalidate>' +
      '<div class="hp" aria-hidden="true"><label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label></div>' +
      '<label class="visually-hidden" for="mmm-chat-input" data-t="placeholder"></label>' +
      '<textarea id="mmm-chat-input" rows="1" maxlength="' + MAX_LEN + '" enterkeyhint="send" autocomplete="off"></textarea>' +
      '<button type="submit" class="chat__send">' + ICON_SEND + '</button>' +
    '</form>' +
    '<div class="chat__foot">' +
      '<button type="button" class="btn btn--red btn--sm chat__mgr" data-chat-act="manager" data-t="act.manager"></button>' +
      '<a class="chat__tg" href="' + KB.links.tg + '" target="_blank" rel="noopener">' + ICON_TG + '<span data-t="act.tg"></span></a>' +
    '</div>';
  document.body.appendChild(fab);
  document.body.appendChild(panel);

  var log = panel.querySelector('.chat__log');
  var form = panel.querySelector('.chat__form');
  var input = panel.querySelector('textarea');
  var hp = panel.querySelector('input[name="website"]');
  var closeBtn = panel.querySelector('.chat__close');
  var sendBtn = panel.querySelector('.chat__send');
  var statusEl = panel.querySelector('.chat__status');
  var title = panel.querySelector('.chat__title');

  function paintStatic() {
    fabLabel.textContent = T('fab');
    fab.setAttribute('aria-label', T('fab') + ' — ' + T('open') + (state.unread ? ' — ' + T('unread', { n: state.unread }) : ''));
    closeBtn.setAttribute('aria-label', T('close'));
    sendBtn.setAttribute('aria-label', T('send'));
    input.placeholder = T('placeholder');
    panel.querySelectorAll('[data-t]').forEach(function (el) { el.textContent = T(el.getAttribute('data-t')); });
    statusEl.textContent = state.dialog ? T('inDialog') : KB.isOpen() ? T('online') : T('offline');
    panel.classList.toggle('is-live', !!state.dialog);
  }

  // ---------- Сообщения ----------
  // В истории храним ссылки на тексты базы знаний, чтобы при смене языка ответы перевелись
  function botText(m) {
    if (m.kb) { var a = KB.answer(m.kb, L()); return a ? a.text : ''; }
    if (m.t) return T(m.t, m.p);
    return m.text || '';
  }
  function actButton(act) {
    var kind = act.split(':')[0];
    var labelKey = { calc: 'act.calc', brief: 'act.brief', manager: 'act.manager', ig: 'act.ig', tg: 'act.tg', direct: 'act.direct', date: 'act.date', quick: 'act.quick' }[kind];
    if (!labelKey) return null;
    if (kind === 'ig' || kind === 'tg' || kind === 'direct') {
      var href = kind === 'ig' ? KB.links.ig : kind === 'tg' ? KB.links.tg : KB.links.direct;
      return h('a', { class: 'chat__act', href: href, target: '_blank', rel: 'noopener', text: T(labelKey) });
    }
    return h('button', { type: 'button', class: 'chat__act' + (kind === 'brief' || kind === 'manager' ? ' chat__act--red' : ''), 'data-chat-act': act, text: T(labelKey) });
  }
  function renderMsg(m, isLast) {
    var who = m.k === 'me' ? 'me' : m.k === 'mgr' ? 'mgr' : 'bot';
    var wrap = h('div', { class: 'msg msg--' + who + (m.fail ? ' is-failed' : '') });
    var sign = who === 'mgr' ? T('managerSign', { name: m.name || 'MUST MOVIE MEDIA' }) : who === 'me' ? T('you') : T('assistant');
    wrap.appendChild(h('span', { class: who === 'bot' ? 'msg__who visually-hidden' : 'msg__who', text: sign }));
    var bubble = h('p', { class: 'msg__text' });
    bubble.textContent = who === 'me' || who === 'mgr' ? m.text : botText(m);
    wrap.appendChild(bubble);
    var acts = (m.act || []).filter(function (a) { return a !== 'quick'; });
    // Кнопки показываем только у последнего ответа, чтобы лента не пестрила
    if (isLast && acts.length) {
      var row = h('div', { class: 'msg__acts' });
      acts.forEach(function (a) { var b = actButton(a); if (b) row.appendChild(b); });
      wrap.appendChild(row);
    }
    if (isLast && (m.act || []).indexOf('quick') !== -1) wrap.appendChild(quickList());
    return wrap;
  }
  function quickList() {
    var box = h('div', { class: 'chat__quick', role: 'group', 'aria-label': T('act.quick') });
    KB.quick(L()).forEach(function (q) {
      box.appendChild(h('button', { type: 'button', class: 'chat__chip', 'data-chat-q': q.id, text: q.q }));
    });
    return box;
  }
  function renderAll() {
    log.innerHTML = '';
    state.msgs.forEach(function (m, i) { log.appendChild(renderMsg(m, i === state.msgs.length - 1)); });
    scrollDown();
  }
  function scrollDown() {
    requestAnimationFrame(function () { log.scrollTop = log.scrollHeight; });
  }
  function push(m) {
    state.msgs.push(m);
    save();
    // Убираем кнопки у предыдущего сообщения и дорисовываем новое
    var prev = log.lastElementChild;
    if (prev && state.msgs.length > 1) log.replaceChild(renderMsg(state.msgs[state.msgs.length - 2], false), prev);
    log.appendChild(renderMsg(m, true));
    scrollDown();
  }
  function bot(m) { m.k = 'bot'; push(m); }

  function greet() {
    if (state.msgs.length) return;
    bot({ t: 'greeting', act: ['quick'] });
  }

  // ---------- Открыть / закрыть ----------
  var opener = null;
  var openedAt = 0;
  function isOpen() { return !panel.hidden; }
  function open(src) {
    if (isOpen()) return;
    opener = document.activeElement;
    panel.hidden = false;
    fab.setAttribute('aria-expanded', 'true');
    root.classList.add('chat-open');
    openedAt = openedAt || Date.now();
    greet();
    renderAll();
    state.unread = 0; save(); paintBadge(); paintStatic();
    fitViewport();
    requestAnimationFrame(function () { panel.classList.add('is-in'); });
    // На телефоне не поднимаем клавиатуру сразу — фокус на заголовок
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) input.focus({ preventScroll: true });
    else title.focus({ preventScroll: true });
    track('chat_open', { source: src || 'button' });
    schedulePoll(0);
  }
  function close() {
    if (!isOpen()) return;
    panel.classList.remove('is-in');
    panel.hidden = true;
    fab.setAttribute('aria-expanded', 'false');
    root.classList.remove('chat-open');
    panel.style.height = ''; panel.style.transform = '';
    var back = opener && document.contains(opener) && opener !== document.body ? opener : fab;
    back.focus({ preventScroll: true });
  }
  fab.addEventListener('click', function () { if (isOpen()) close(); else open('button'); });
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen()) {
      // Если открыто модальное окно поверх — Esc закрывает его, а не чат
      if (document.querySelector('dialog[open]')) return;
      e.preventDefault(); close();
    }
  });

  // Телефон: окно на весь экран и не под клавиатурой
  var vv = window.visualViewport;
  function fitViewport() {
    if (!isOpen() || !vv || window.innerWidth >= 600) { panel.style.height = ''; panel.style.transform = ''; return; }
    panel.style.height = vv.height + 'px';
    panel.style.transform = 'translateY(' + vv.offsetTop + 'px)';
    scrollDown();
  }
  if (vv) { vv.addEventListener('resize', fitViewport); vv.addEventListener('scroll', fitViewport); }
  window.addEventListener('resize', fitViewport);

  // Кнопка поднимается над нижней панелью калькулятора
  var calcBar = document.querySelector('.calc__bar');
  var calcBlock = document.getElementById('calculator');
  if (calcBar && calcBlock && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      fab.classList.toggle('is-raised', en[0].isIntersecting);
    }).observe(calcBlock);
  }

  // ---------- Сеть ----------
  function api(path, body) {
    var opts = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { method: 'GET' };
    return fetch(API + path, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || !j || j.ok === false) { var err = new Error((j && j.error) || ('HTTP ' + r.status)); err.code = j && j.error; throw err; }
        return j;
      });
    });
  }

  // ---------- Менеджер ----------
  function historyForManager() {
    return state.msgs.slice(-12).map(function (m) {
      return { from: m.k, text: (m.k === 'me' || m.k === 'mgr' ? m.text : botText(m)).slice(0, 400) };
    });
  }
  function askManager() {
    if (state.dialog) { bot({ t: 'inDialog' }); return; }
    if (!KB.isOpen()) bot({ t: 'offHours' });
    if (!state.name) { state.stage = 'name'; bot({ t: 'askName' }); }
    else if (!state.contact) { state.stage = 'contact'; bot({ t: 'askContact' }); }
    else callManager();
    save();
    input.focus({ preventScroll: true });
  }
  function validContact(s) {
    var v = s.trim();
    if (/^@[a-z0-9_]{4,32}$/i.test(v)) return v;
    var tme = v.match(/t(?:elegram)?\.me\/([a-z0-9_]{4,32})/i);
    if (tme) return '@' + tme[1];
    var digits = v.replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15 && /^[+\d\s()-]+$/.test(v)) return v;
    return null;
  }
  var calling = false;
  function callManager() {
    if (calling) return;
    calling = true;
    state.stage = null;
    var body = {
      sid: state.sid, name: state.name, contact: state.contact, lang: L(),
      calc: state.calc || '', date: state.date || '', page: location.href.split('#')[0],
      history: historyForManager(), website: hp.value, ms: Date.now() - (openedAt || Date.now())
    };
    api('/chat/call', body).then(function (res) {
      state.dialog = true; state.after = state.after || 0;
      bot({ t: res.open === false || !KB.isOpen() ? 'offHoursSent' : 'connecting' });
      track('manager_called', { lang: L(), with_calc: state.calc ? 1 : 0 });
      paintStatic(); save(); schedulePoll(POLL.open);
    }).catch(function () {
      bot({ t: 'sendFail', act: ['tg', 'direct'] });
    }).then(function () { calling = false; });
  }

  // ---------- Отправка сообщения ----------
  var sentAt = [];
  function tooFast() {
    var now = Date.now();
    sentAt = sentAt.filter(function (t) { return now - t < BURST.ms; });
    if (sentAt.length && now - sentAt[sentAt.length - 1] < MIN_GAP) return true;
    if (sentAt.length >= BURST.n) return true;
    sentAt.push(now);
    return false;
  }
  function handleText(raw) {
    var text = raw.replace(/\s+\n/g, '\n').trim().slice(0, MAX_LEN);
    if (!text) return;
    if (tooFast()) { bot({ t: 'tooFast' }); return; }
    push({ k: 'me', text: text });

    if (state.stage === 'date') {
      state.date = text.slice(0, 80); state.stage = null;
      bot({ t: 'gotDate', p: { date: state.date }, act: ['manager'] });
      return;
    }
    if (state.stage === 'name') {
      state.name = text.slice(0, MAX_NAME); state.stage = 'contact';
      bot({ t: 'askContact' });
      return;
    }
    if (state.stage === 'contact') {
      var c = validContact(text);
      if (!c) { bot({ t: 'badContact' }); return; }
      state.contact = c;
      callManager();
      return;
    }
    if (state.dialog) {
      if (hp.value) return;
      var m = state.msgs[state.msgs.length - 1];
      api('/chat/send', { sid: state.sid, text: text, website: hp.value }).catch(function (err) {
        m.fail = true; save();
        if (err.code === 'closed' || err.code === 'unknown') { state.dialog = false; paintStatic(); save(); askManager(); return; }
        bot({ t: 'sendFail', act: ['tg', 'direct'] });
      });
      schedulePoll(POLL.open);
      return;
    }
    // Вопрос к базе знаний
    var hit = KB.search(text);
    track('chat_question', { question: hit ? hit.id : 'none', source: 'text' });
    if (!hit) { bot({ t: 'noMatch', act: ['manager'] }); return; }
    if (hit.id === 'human') { askManager(); return; }
    answer(hit.id);
  }
  function answer(id) {
    var a = KB.answer(id, L());
    if (!a) return;
    if (id === 'dates') { state.stage = 'date'; bot({ kb: id }); bot({ t: 'askDate' }); save(); input.focus({ preventScroll: true }); return; }
    bot({ kb: id, act: a.act });
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var v = input.value;
    input.value = '';
    autoGrow();
    handleText(v);
  });
  input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit', { cancelable: true })); }
  });
  function autoGrow() {
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';
  }
  input.addEventListener('input', autoGrow);

  // Быстрые вопросы и кнопки под ответами
  panel.addEventListener('click', function (e) {
    var q = e.target.closest('[data-chat-q]');
    if (q) {
      var id = q.getAttribute('data-chat-q');
      if (tooFast()) { bot({ t: 'tooFast' }); return; }
      push({ k: 'me', text: q.textContent });
      track('chat_question', { question: id, source: 'quick' });
      answer(id);
      return;
    }
    var b = e.target.closest('[data-chat-act]');
    if (!b) return;
    var act = b.getAttribute('data-chat-act');
    var kind = act.split(':')[0];
    if (kind === 'manager') { askManager(); return; }
    if (kind === 'date') { state.stage = 'date'; bot({ t: 'askDate' }); save(); input.focus({ preventScroll: true }); return; }
    if (kind === 'quick') { bot({ t: 'greeting', act: ['quick'] }); return; }
    if (kind === 'calc') {
      close();
      if (window.MMM_CALC && window.MMM_CALC.setService) window.MMM_CALC.setService(act.split(':')[1] || 'event');
      goTo('calculator');
      return;
    }
    if (kind === 'brief') {
      close();
      var go = document.querySelector('[data-brief-go]');
      if (go) go.click(); else goTo('brief');
    }
  });
  function goTo(id) {
    var el = document.getElementById(id);
    if (!el) { location.href = 'index.html#' + id; return; }
    var header = document.querySelector('.site-header');
    window.scrollTo({ top: el.getBoundingClientRect().top + window.pageYOffset - (header ? header.offsetHeight : 0) - 8, behavior: reduce ? 'auto' : 'smooth' });
  }

  // ---------- Ответы менеджера ----------
  var pollTimer = null;
  var polling = false;
  function schedulePoll(delay) {
    clearTimeout(pollTimer);
    if (!state.dialog) return;
    var d = delay != null ? delay : document.hidden ? POLL.hidden : isOpen() ? POLL.open : POLL.closed;
    pollTimer = setTimeout(poll, d);
  }
  function poll() {
    if (!state.dialog || polling) return;
    polling = true;
    api('/chat/poll?sid=' + encodeURIComponent(state.sid) + '&after=' + (state.after || 0)).then(function (res) {
      (res.msgs || []).forEach(function (m) {
        if (m.id <= (state.after || 0)) return;
        state.after = m.id;
        push({ k: 'mgr', text: String(m.text || '').slice(0, 4000), name: m.name });
        if (!isOpen()) state.unread++;
      });
      if (res.closed) { state.dialog = false; bot({ t: 'closed', act: ['quick'] }); if (!isOpen()) state.unread++; }
      save(); paintBadge(); paintStatic();
    }).catch(function (err) {
      if (err.code === 'unknown') { state.dialog = false; save(); paintStatic(); }
    }).then(function () { polling = false; schedulePoll(); });
  }
  document.addEventListener('visibilitychange', function () { schedulePoll(document.hidden ? POLL.hidden : 500); });
  function paintBadge() {
    badge.hidden = !state.unread;
    badge.textContent = state.unread > 9 ? '9+' : String(state.unread);
    fab.classList.toggle('has-unread', !!state.unread);
    fab.setAttribute('aria-label', T('fab') + ' — ' + T('open') + (state.unread ? ' — ' + T('unread', { n: state.unread }) : ''));
  }

  // ---------- Для других скриптов ----------
  // MMM_openChat() — открыть; MMM_openChat({calc, calcRu}) — открыть и передать расчёт калькулятора
  window.MMM_openChat = function (opts) {
    opts = opts || {};
    var src = opts.calc ? 'calculator' : 'cta';
    if (opts.calc) {
      state.calc = opts.calcRu || opts.calc;
      open(src);
      var line = opts.calc;
      var dup = state.msgs.some(function (m) { return m.k === 'me' && m.text === line; });
      if (dup && !state.dialog) return;
      push({ k: 'me', text: line });
      // Менеджер уже на связи — расчёт уходит ему сразу
      if (state.dialog) { api('/chat/send', { sid: state.sid, text: opts.calcRu || line, website: hp.value }).catch(function () {}); return; }
      bot({ t: 'calcReply', act: ['manager'] });
      return;
    }
    open(src);
  };

  if (i18n && i18n.onChange) i18n.onChange(function () { paintStatic(); if (isOpen()) renderAll(); });
  paintStatic();
  paintBadge();
  if (state.dialog) schedulePoll(1500);
})();
