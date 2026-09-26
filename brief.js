// MUST MOVIE MEDIA — пошаговый бриф
(function () {
  'use strict';

  // Адрес Cloudflare Worker, который пересылает заявку в Telegram-группу.
  // Пока пусто — кнопка «Отправить заявку» скрыта, работают копирование и Direct.
  var BRIEF_ENDPOINT = '';

  var i18n = window.MMM_I18N;
  var STORAGE_KEY = 'mmm-brief-draft';
  var startedAt = Date.now();
  var TOTAL = 10; // вопросов; шаг 11 — итог

  var form = document.getElementById('brief-form');
  if (!form) return;
  var section = document.getElementById('brief');
  var planBox = document.getElementById('brief-plan');
  var planName = document.getElementById('brief-plan-name');
  var planInput = document.getElementById('package');
  var steps = Array.prototype.slice.call(form.querySelectorAll('.brief-step'));
  var prevBtn = document.getElementById('prev');
  var nextBtn = document.getElementById('next');
  var label = document.getElementById('step-label');
  var bar = document.getElementById('progress-bar');
  var progress = form.querySelector('.progress');
  var summary = document.getElementById('summary');
  var copyBtn = document.getElementById('copy');
  var copyStatus = document.getElementById('copy-status');
  var tgLink = document.getElementById('tg');
  var current = 1;

  // Порядок и подписи полей в итоговом тексте
  var FIELDS = [
    ['package', 'Пакет'],
    ['name', 'Имя'],
    ['company', 'Компания'],
    ['contact', 'Телефон / Telegram'],
    ['what', 'Что снять'],
    ['goal', 'Цель'],
    ['message', 'Главная мысль'],
    ['platforms', 'Площадки'],
    ['orientation', 'Ориентация'],
    ['amount', 'Количество роликов / фото'],
    ['mood', 'Настроение'],
    ['refs', 'Референсы'],
    ['date', 'Дата съёмки'],
    ['location', 'Локация'],
    ['cast', 'Кто в кадре'],
    ['deadline', 'Дедлайн'],
    ['approver', 'Кто утверждает'],
    ['budget', 'Бюджет'],
    ['comment', 'Комментарий']
  ];

  // ---------- Хранилище (может быть недоступно — тогда просто не сохраняем) ----------
  function storageGet() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { return null; }
  }
  function storageSet(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }
  function storageClear() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
  }

  function collect() {
    var data = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name) return;
      if (el.type === 'checkbox') {
        if (!data[el.name]) data[el.name] = [];
        if (el.checked) data[el.name].push(el.value);
      } else if (el.type === 'radio') {
        if (el.checked) data[el.name] = el.value;
        else if (!(el.name in data)) data[el.name] = '';
      } else {
        data[el.name] = el.value.trim();
      }
    });
    return data;
  }

  function restore(data) {
    if (!data) return;
    Array.prototype.forEach.call(form.elements, function (el) {
      if (!el.name || !(el.name in data)) return;
      var v = data[el.name];
      if (el.type === 'checkbox') el.checked = Array.isArray(v) && v.indexOf(el.value) !== -1;
      else if (el.type === 'radio') el.checked = v === el.value;
      else el.value = v || '';
    });
  }

  // ---------- Выбранный пакет ----------
  // В скрытом поле хранится ссылка на выбор в JSON: {type:'plan', id} или {type:'calc', state}.
  // По ней строим подпись на языке посетителя и русский текст для итогового брифа.
  function parseRef(value) {
    if (!value) return null;
    try { var r = JSON.parse(value); if (r && r.type) return r; } catch (e) { /* старый черновик — просто текст */ }
    return { type: 'text', text: value };
  }
  function describe(ref, lang) {
    if (!ref) return '';
    if (ref.type === 'plan') {
      var all = window.MMM_PLANS || {};
      var p = (all[lang] || all.ru || {})[ref.id];
      if (!p) return '';
      var price = p.price == null ? p.priceText : i18n.moneyText(p.price, p.per, lang);
      return p.name + ' — ' + price + ' (' + p.group + ')';
    }
    if (ref.type === 'calc' && window.MMM_CALC) return window.MMM_CALC.describe(ref.state, lang);
    return ref.text || '';
  }
  function renderPlan() {
    var ref = parseRef(planInput.value);
    planName.textContent = describe(ref, i18n.lang());
    planBox.hidden = !ref;
  }
  function setPlan(ref) {
    planInput.value = ref ? (typeof ref === 'string' ? ref : JSON.stringify(ref)) : '';
    renderPlan();
  }
  document.getElementById('brief-plan-clear').addEventListener('click', function () { setPlan(null); save(); });

  // Вызывается из окна пакета и из калькулятора: подставляем выбор и тип съёмки, листаем к брифу
  window.MMM_choosePlan = function (ref, kind) {
    setPlan(ref);
    if (kind) {
      form.querySelectorAll('input[name="what"]').forEach(function (el) {
        if (el.value === kind) el.checked = true;
      });
    }
    save();
    var header = document.querySelector('.site-header');
    window.scrollTo({ top: section.getBoundingClientRect().top + window.pageYOffset - (header ? header.offsetHeight : 0), behavior: 'smooth' });
    setTimeout(function () {
      var first = current === 1 ? document.getElementById('name') : form.querySelector('.brief-step.is-active h3');
      if (first) first.focus({ preventScroll: true });
    }, 450);
  };

  function save() {
    storageSet({ answers: collect(), step: current });
  }

  // ---------- Итоговый текст ----------
  // Всегда на русском — так удобнее команде. Значения чипов в HTML тоже русские.
  function buildFields() {
    var data = collect();
    return FIELDS.map(function (f) {
      var v = f[0] === 'package' ? describe(parseRef(data.package), 'ru') : data[f[0]];
      if (Array.isArray(v)) v = v.join(', ');
      return [f[1], v || '—'];
    });
  }

  function buildText() {
    var lines = ['Бриф для MUST MOVIE MEDIA', 'Язык клиента: ' + i18n.lang().toUpperCase(), ''];
    buildFields().forEach(function (f) { lines.push(f[0] + ': ' + f[1]); });
    return lines.join('\n');
  }

  // ---------- Валидация первого шага ----------
  function validateStep(n) {
    if (n !== 1) return true;
    var ok = true;
    var firstBad = null;
    ['name', 'contact'].forEach(function (id) {
      var input = document.getElementById(id);
      var err = document.getElementById(id + '-error');
      var bad = !input.value.trim();
      input.setAttribute('aria-invalid', bad ? 'true' : 'false');
      err.classList.toggle('is-shown', bad);
      if (bad) { ok = false; if (!firstBad) firstBad = input; }
    });
    if (firstBad) firstBad.focus();
    return ok;
  }

  // ---------- Тексты, зависящие от языка ----------
  function renderLabels() {
    var done = current > TOTAL;
    label.textContent = done ? i18n.t('brief.done') : i18n.t('brief.step', { n: current, total: TOTAL });
    nextBtn.textContent = i18n.t(current === TOTAL ? 'brief.finish' : 'brief.next');
  }
  function renderSummary() {
    var text = buildText();
    summary.textContent = text;
    tgLink.href = 'https://t.me/share/url?url=' + encodeURIComponent('https://www.instagram.com/mmm_creative_production/') +
      '&text=' + encodeURIComponent(text);
  }
  i18n.onChange(function () {
    renderLabels();
    renderPlan();
    if (current > TOTAL) { renderSummary(); renderSend(); }
    copyStatus.textContent = '';
  });

  // ---------- Показ шага ----------
  function show(n, focus) {
    current = Math.max(1, Math.min(TOTAL + 1, n));
    steps.forEach(function (s) {
      s.classList.toggle('is-active', Number(s.dataset.step) === current);
    });

    var done = current > TOTAL;
    var pct = Math.round(((done ? TOTAL : current - 1) / TOTAL) * 100);
    bar.style.width = pct + '%';
    progress.setAttribute('aria-valuenow', String(pct));
    renderLabels();
    prevBtn.disabled = current === 1;
    nextBtn.hidden = done;

    if (done) {
      renderSummary();
      copyStatus.textContent = '';
      if (BRIEF_ENDPOINT && !sent) {
        sendState = 'idle';
        renderSend();
      }
    }

    if (focus) {
      var heading = form.querySelector('.brief-step.is-active h3');
      if (heading) heading.focus({ preventScroll: true });
      var top = form.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.6) {
        var header = document.querySelector('.site-header');
        window.scrollTo({ top: window.pageYOffset + top - (header ? header.offsetHeight : 0) - 16, behavior: 'smooth' });
      }
    }
    save();
  }

  nextBtn.addEventListener('click', function () {
    if (!validateStep(current)) return;
    show(current + 1, true);
  });
  prevBtn.addEventListener('click', function () { show(current - 1, true); });

  // Enter в однострочном поле = «Далее»
  form.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && e.target.type !== 'radio') {
      e.preventDefault();
      nextBtn.click();
    }
  });
  form.addEventListener('submit', function (e) { e.preventDefault(); });

  form.addEventListener('input', function (e) {
    if (e.target.getAttribute('aria-invalid') === 'true' && e.target.value.trim()) {
      e.target.setAttribute('aria-invalid', 'false');
      var err = document.getElementById(e.target.id + '-error');
      if (err) err.classList.remove('is-shown');
    }
    save();
  });
  form.addEventListener('change', save);

  // ---------- Отправка в Telegram через Worker ----------
  var sendBox = document.getElementById('send-box');
  var sendBtn = document.getElementById('send');
  var sendStatus = document.getElementById('send-status');
  var finalHint = document.getElementById('final-hint');
  var sent = false;
  var sendState = 'idle'; // idle | sending | sent | failed

  // Тексты кнопки и статуса — на языке посетителя
  function renderSend() {
    if (!BRIEF_ENDPOINT) return;
    sendBox.hidden = false;
    finalHint.textContent = i18n.t('brief.doneHintSend');
    var btn = { idle: 'brief.send', sending: 'brief.sending', sent: 'brief.sentBtn', failed: 'brief.retry' }[sendState];
    var status = { sent: 'brief.sentMsg', failed: 'brief.sendFail' }[sendState];
    sendBtn.textContent = i18n.t(btn);
    sendBtn.disabled = sendState === 'sending';
    sendStatus.textContent = status ? i18n.t(status) : '';
  }

  sendBtn.addEventListener('click', function () {
    if (sent || !BRIEF_ENDPOINT) return;
    sendState = 'sending';
    renderSend();
    var hp = form.querySelector('input[name="website"]');
    fetch(BRIEF_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: buildFields(),
        lang: document.documentElement.lang || 'ru',
        website: hp ? hp.value : '',
        elapsed: Date.now() - startedAt
      })
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok || !j.ok) throw new Error(j.error || r.status);
      });
    }).then(function () {
      sent = true;
      sendState = 'sent';
      renderSend();
      sendBox.classList.add('is-sent');
      storageClear();
    }).catch(function () {
      sendState = 'failed';
      renderSend();
    });
  });

  // ---------- Копирование ----------
  function selectSummary() {
    var range = document.createRange();
    range.selectNodeContents(summary);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }
  function fallbackCopy() {
    selectSummary();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    copyStatus.textContent = i18n.t(ok ? 'brief.copied' : 'brief.selected');
  }
  copyBtn.addEventListener('click', function () {
    var text = buildText();
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () {
        copyStatus.textContent = i18n.t('brief.copied');
      }, fallbackCopy);
    } else {
      fallbackCopy();
    }
  });

  // ---------- Сброс ----------
  document.getElementById('reset').addEventListener('click', function () {
    if (!window.confirm(i18n.t('brief.confirmReset'))) return;
    form.reset();
    setPlan(null);
    sent = false;
    sendState = 'idle';
    sendBox.classList.remove('is-sent');
    startedAt = Date.now();
    form.querySelectorAll('[aria-invalid]').forEach(function (el) { el.setAttribute('aria-invalid', 'false'); });
    form.querySelectorAll('.error').forEach(function (el) { el.classList.remove('is-shown'); });
    storageClear();
    show(1, true);
  });

  // ---------- Старт ----------
  var draft = storageGet();
  if (draft) restore(draft.answers);
  renderPlan();
  var startStep = draft && draft.step ? Number(draft.step) : 1;
  // Не пускаем сразу на поздние шаги, если обязательные поля пусты
  if (startStep > 1 && !(document.getElementById('name').value.trim() && document.getElementById('contact').value.trim())) startStep = 1;
  show(startStep, false);
})();
