// MUST MOVIE MEDIA — пошаговый бриф
(function () {
  'use strict';

  var STORAGE_KEY = 'mmm-brief-draft';
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
  function setPlan(label) {
    planInput.value = label || '';
    planName.textContent = label || '';
    planBox.hidden = !label;
  }
  document.getElementById('brief-plan-clear').addEventListener('click', function () { setPlan(''); save(); });

  // Вызывается из окна пакета: подставляем пакет и тип съёмки, листаем к брифу
  window.MMM_choosePlan = function (label, kind) {
    setPlan(label);
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
  function buildText() {
    var data = collect();
    var lines = ['Бриф для MUST MOVIE MEDIA', ''];
    FIELDS.forEach(function (f) {
      var v = data[f[0]];
      if (Array.isArray(v)) v = v.join(', ');
      lines.push(f[1] + ': ' + (v ? v : '—'));
    });
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
    label.textContent = done ? 'Бриф заполнен' : 'Шаг ' + current + ' из ' + TOTAL;

    prevBtn.disabled = current === 1;
    nextBtn.hidden = done;
    nextBtn.textContent = current === TOTAL ? 'Готово' : 'Далее';

    if (done) {
      var text = buildText();
      summary.textContent = text;
      tgLink.href = 'https://t.me/share/url?url=' + encodeURIComponent('https://www.instagram.com/mmm_creative_production/') +
        '&text=' + encodeURIComponent(text);
      copyStatus.textContent = '';
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
    copyStatus.textContent = ok
      ? 'Ответы скопированы. Вставьте их в сообщение в Direct.'
      : 'Текст выделен — нажмите Ctrl+C (или «Копировать» на телефоне).';
  }
  copyBtn.addEventListener('click', function () {
    var text = buildText();
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () {
        copyStatus.textContent = 'Ответы скопированы. Вставьте их в сообщение в Direct.';
      }, fallbackCopy);
    } else {
      fallbackCopy();
    }
  });

  // ---------- Сброс ----------
  document.getElementById('reset').addEventListener('click', function () {
    if (!window.confirm('Очистить все ответы?')) return;
    form.reset();
    setPlan('');
    form.querySelectorAll('[aria-invalid]').forEach(function (el) { el.setAttribute('aria-invalid', 'false'); });
    form.querySelectorAll('.error').forEach(function (el) { el.classList.remove('is-shown'); });
    storageClear();
    show(1, true);
  });

  // ---------- Старт ----------
  var draft = storageGet();
  if (draft) restore(draft.answers);
  setPlan(planInput.value);
  var startStep = draft && draft.step ? Number(draft.step) : 1;
  // Не пускаем сразу на поздние шаги, если обязательные поля пусты
  if (startStep > 1 && !(document.getElementById('name').value.trim() && document.getElementById('contact').value.trim())) startStep = 1;
  show(startStep, false);
})();
