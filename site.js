// MUST MOVIE MEDIA — поведение главной страницы.
// Бриф (brief.js), калькулятор (calc.js), бургер (script.js), чат (chat.js),
// переводы (i18n.js) и аналитика (analytics.js) — отдельными файлами.
(function () {
  'use strict';

  var i18n = window.MMM_I18N;
  var t = function (k, p) { return i18n.t(k, p); };
  var root = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $ = function (s, ctx) { return (ctx || document).querySelector(s); };
  var $$ = function (s, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(s)); };

  if (!reduce) root.classList.add('js-anim');
  // Заголовок появляется сразу после первой отрисовки, не дожидаясь загрузки картинок и шрифтов
  requestAnimationFrame(function () { requestAnimationFrame(function () { root.classList.add('is-loaded'); }); });

  // ---------- Шапка: фон с blur после прокрутки ----------
  var header = $('#site-header');
  var hero = $('.hero');
  var heroVideo = $('.hero__video');
  var heroContent = $('.hero__content');
  var ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () {
      var y = window.pageYOffset;
      header.classList.toggle('is-scrolled', y > 24);
      // Лёгкий параллакс hero — только transform и opacity
      if (!reduce && hero && y < hero.offsetHeight) {
        heroVideo.style.transform = 'translate3d(0,' + (y * 0.22).toFixed(1) + 'px,0)';
        heroContent.style.transform = 'translate3d(0,' + (y * 0.08).toFixed(1) + 'px,0)';
        heroContent.style.opacity = String(Math.max(0, 1 - y / (hero.offsetHeight * 0.85)).toFixed(3));
      }
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---------- Полноэкранное меню: блокируем прокрутку страницы ----------
  var links = $('#nav-links');
  if (links && 'MutationObserver' in window) {
    new MutationObserver(function () {
      root.classList.toggle('menu-open', links.classList.contains('is-open'));
    }).observe(links, { attributes: true, attributeFilter: ['class'] });
  }

  // ---------- Таймкод REC: 25 кадров в секунду ----------
  var tcEls = $$('[data-tc-run]');
  if (tcEls.length) {
    var start = performance.now();
    var pad = function (n) { return n < 10 ? '0' + n : String(n); };
    var tick = function () {
      var f = Math.floor((performance.now() - start) / 40);
      var s = Math.floor(f / 25);
      var txt = pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60) + ':' + pad(f % 25);
      tcEls.forEach(function (el) { el.textContent = txt; });
    };
    tick();
    if (!reduce) setInterval(tick, 40);
  }

  // ---------- Стаггер появления в сетках ----------
  ['.bento', '.works', '.stats', '.team'].forEach(function (sel) {
    $$(sel + ' > .reveal').forEach(function (el, i) { el.style.setProperty('--i', i % 6); });
  });

  // ---------- Бегущая строка «Для кого»: дублируем для бесшовной прокрутки ----------
  var track = $('.marquee__track');
  if (track && !reduce) {
    $$('li', track).forEach(function (li) {
      var c = li.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      track.appendChild(c);
    });
  }

  // ---------- Цены «от …»: минимальная цена категории из plans.js ----------
  var fromBtns = $$('[data-from]');
  function renderFrom() {
    if (!window.MMM_CALC || !window.MMM_CALC.minPrice) return;
    fromBtns.forEach(function (b) {
      var p = window.MMM_CALC.minPrice(b.getAttribute('data-from'));
      var out = $('[data-from-val]', b);
      if (!p || !out) return;
      // «/ день» для мероприятий, «/ мес» — для помесячных услуг
      var per = b.getAttribute('data-from') === 'ev' ? ' ' + t('v2.from.day') : (p.per ? ' ' + t('v2.from.mo') : '');
      out.innerHTML = t('v2.from.tpl', { v: '<b>' + i18n.num(p.price, 1) + '</b> ' + t('unit.total') }) + '<small>' + per + '</small>';
    });
  }
  renderFrom();
  i18n.onChange(renderFrom);
  // Клик по ячейке — выбираем услугу в калькуляторе и листаем к нему
  fromBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      if (window.MMM_CALC && window.MMM_CALC.setService) window.MMM_CALC.setService(b.getAttribute('data-service'));
      var calc = $('#calculator');
      if (!calc) return;
      var hh = header ? header.offsetHeight : 0;
      window.scrollTo({ top: calc.getBoundingClientRect().top + window.pageYOffset - hh - 8, behavior: reduce ? 'auto' : 'smooth' });
      var checked = $('#calc-form input[name="service"]:checked');
      if (checked) setTimeout(function () { checked.focus({ preventScroll: true }); }, reduce ? 0 : 500);
    });
  });

  // «Заполнить бриф — 3 минуты» — сразу к первому вопросу
  $$('[data-brief-go]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var form = $('#brief-form');
      if (!form) return;
      e.preventDefault();
      var hh = header ? header.offsetHeight : 0;
      window.scrollTo({ top: form.getBoundingClientRect().top + window.pageYOffset - hh - 12, behavior: reduce ? 'auto' : 'smooth' });
      setTimeout(function () {
        var first = $('.brief-step.is-active input, .brief-step.is-active textarea', form) || $('.brief-step.is-active h3', form);
        if (first) first.focus({ preventScroll: true });
      }, reduce ? 0 : 450);
    });
  });

  // «Обсудить проект» — открывает чат на сайте (chat.js); без чата — к брифу
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-open-chat]');
    if (!b) return;
    e.preventDefault();
    if (window.MMM_openChat) window.MMM_openChat();
    else location.hash = '#brief';
  });

  // ---------- Модальные окна: общие правила ----------
  function openDialog(d, opener) {
    if (!d || typeof d.showModal !== 'function') return;
    d._opener = opener || document.activeElement;
    d.showModal();
    var box = d.querySelector('.modal__box');
    if (box) box.scrollTop = 0;
  }
  $$('dialog.modal').forEach(function (d) {
    d.addEventListener('click', function (e) {
      if (e.target === d || e.target.closest('[data-close]')) d.close();
      if (e.target.closest('[data-close-go]')) d.close();
    });
    d.addEventListener('close', function () {
      if (d._opener && document.contains(d._opener)) d._opener.focus({ preventScroll: true });
    });
  });

  // Шоурил
  var reel = $('#reel-modal');
  $$('[data-open-reel]').forEach(function (b) {
    b.addEventListener('click', function () { openDialog(reel, b); });
  });

  // ---------- Работы: фильтр и окно кейса ----------
  var CAT = { reels: function () { return 'Reels'; }, ads: function () { return t('v2.f.ads'); }, events: function () { return t('nav.events'); } };
  var filters = $$('.filter');
  var cases = $$('.case');
  filters.forEach(function (f) {
    f.addEventListener('click', function () {
      var cat = f.getAttribute('data-filter');
      filters.forEach(function (x) { x.setAttribute('aria-pressed', x === f ? 'true' : 'false'); });
      cases.forEach(function (c) {
        var show = cat === 'all' || c.getAttribute('data-cat') === cat;
        if (show) {
          c.hidden = false;
          requestAnimationFrame(function () { c.classList.remove('is-out'); });
        } else if (!c.hidden) {
          c.classList.add('is-out');
          setTimeout(function () { if (c.classList.contains('is-out')) c.hidden = true; }, reduce ? 0 : 420);
        }
      });
    });
  });

  var caseModal = $('#case-modal');
  var caseLink = $('#case-link');
  var caseCat = $('#case-cat');
  var currentCase = null;
  function fillCase(c) {
    var cat = c.getAttribute('data-cat');
    caseCat.textContent = CAT[cat] ? CAT[cat]() : '';
    var url = c.getAttribute('data-url');
    caseLink.hidden = !url;
    if (url) caseLink.href = url;
  }
  cases.forEach(function (c) {
    c.setAttribute('aria-haspopup', 'dialog');
    c.addEventListener('click', function () {
      currentCase = c;
      fillCase(c);
      openDialog(caseModal, c);
    });
  });
  i18n.onChange(function () { if (currentCase && caseModal.open) fillCase(currentCase); });

  // ---------- Отзывы: карусель по одной цитате ----------
  var quotes = $$('.quote');
  var qCur = $('[data-quote-current]');
  var qTot = $('[data-quote-total]');
  var qi = 0;
  var pad2 = function (n) { return n < 10 ? '0' + n : String(n); };
  function showQuote(n) {
    qi = (n + quotes.length) % quotes.length;
    quotes.forEach(function (q, i) { q.hidden = i !== qi; q.classList.toggle('is-active', i === qi); });
    if (qCur) qCur.textContent = pad2(qi + 1);
  }
  if (quotes.length) {
    if (qTot) qTot.textContent = pad2(quotes.length);
    $$('[data-quote]').forEach(function (b) {
      b.addEventListener('click', function () { showQuote(qi + (b.getAttribute('data-quote') === 'next' ? 1 : -1)); });
    });
    // Свайп на телефоне
    var track2 = $('.quotes__track');
    var sx = null;
    track2.addEventListener('pointerdown', function (e) { sx = e.clientX; });
    track2.addEventListener('pointerup', function (e) {
      if (sx === null) return;
      var dx = e.clientX - sx;
      if (Math.abs(dx) > 50) showQuote(qi + (dx < 0 ? 1 : -1));
      sx = null;
    });
  }

  // ---------- Команда на телефоне: цвет у портрета в центре ленты ----------
  if ('IntersectionObserver' in window && window.matchMedia('(hover: none)').matches) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { en.target.classList.toggle('is-active', en.intersectionRatio > 0.75); });
    }, { threshold: [0, 0.75, 1] });
    $$('.person').forEach(function (p) { io.observe(p); });
  }

  // ---------- Курсор-видоискатель (только мышь, без reduced-motion) ----------
  if (!reduce && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    var cur = $('.cursor');
    var frame = $('.cursor__frame', cur);
    var dot = $('.cursor__dot', cur);
    var mx = -100, my = -100, fx = -100, fy = -100, running = false;
    root.classList.add('has-cursor');
    var loop = function () {
      fx += (mx - fx) * 0.22;
      fy += (my - fy) * 0.22;
      frame.style.transform = 'translate3d(' + fx.toFixed(1) + 'px,' + fy.toFixed(1) + 'px,0)';
      if (Math.abs(mx - fx) > 0.1 || Math.abs(my - fy) > 0.1) requestAnimationFrame(loop);
      else running = false;
    };
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      mx = e.clientX; my = e.clientY;
      dot.style.transform = 'translate3d(' + mx + 'px,' + my + 'px,0)';
      cur.classList.remove('is-hidden');
      var target = e.target;
      cur.classList.toggle('is-hover', !!target.closest('a, button, summary, label, .case'));
      cur.classList.toggle('is-text', !!target.closest('input:not([type="range"]):not([type="checkbox"]):not([type="radio"]), textarea'));
      if (!running) { running = true; requestAnimationFrame(loop); }
    }, { passive: true });
    document.addEventListener('pointerleave', function () { cur.classList.add('is-hidden'); });
    // Внутри открытого окна курсор тоже нужен: переносим его в top layer нельзя, поэтому просто прячем
    $$('dialog').forEach(function (d) {
      d.addEventListener('close', function () { root.classList.add('has-cursor'); });
      new MutationObserver(function () { root.classList.toggle('has-cursor', !d.open); }).observe(d, { attributes: true, attributeFilter: ['open'] });
    });
  }
})();
