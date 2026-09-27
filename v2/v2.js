// MUST MOVIE MEDIA — v2: поведение новой главной.
// Бриф (brief.js), калькулятор (calc.js), окно пакета и бургер (script.js),
// переводы (i18n.js) и аналитика (analytics.js) подключаются из корня без изменений.
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

  // ---------- Пакеты: карточки из plans.js ----------
  var KIND = { smm: 'SMM на месяц', foto: 'Фотосъёмка', video: 'Reels', ev: 'Мероприятие' };
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function renderPlans() {
    var all = window.MMM_PLANS || {};
    var plans = all[i18n.lang()] || all.ru || {};
    $$('[data-plans]').forEach(function (box) {
      box.innerHTML = '';
      box.getAttribute('data-plans').split(',').forEach(function (id, n) {
        var p = plans[id];
        if (!p) return;
        var card = el('article', 'pcard' + (p.hot ? ' is-hot' : ''));
        card.setAttribute('data-plan', id);

        var top = el('div', 'pcard__top');
        top.appendChild(el('span', 'pcard__idx', (n < 9 ? '0' : '') + (n + 1)));
        if (p.hot) top.appendChild(el('span', 'pcard__badge', t(id.indexOf('ev-') === 0 ? 'badge.max' : 'badge.popular')));
        card.appendChild(top);

        card.appendChild(el('h3', 'pcard__name', p.name));
        var price = el('p', 'pcard__price');
        if (p.price == null) price.textContent = p.priceText;
        else price.innerHTML = i18n.moneyHtml(p.price, p.per);
        card.appendChild(price);
        card.appendChild(el('p', 'pcard__lead', p.lead));

        var facts = el('ul', 'pcard__facts');
        (p.facts || []).slice(0, 3).forEach(function (f) {
          var li = el('li');
          li.appendChild(el('span', null, f[0]));
          li.appendChild(el('b', null, f[1]));
          facts.appendChild(li);
        });
        card.appendChild(facts);

        var actions = el('div', 'pcard__actions');
        var moreText = t('plan.more').split('<')[0].trim();
        var more = el('button', 'btn btn--ghost plan__more', moreText);
        more.type = 'button';
        more.setAttribute('aria-label', moreText + ': ' + p.name);
        actions.appendChild(more);
        var choose = el('a', 'btn ' + (p.hot ? 'btn--red' : 'btn--outline'), t('v2.plan.choose'));
        choose.href = '#brief';
        choose.setAttribute('data-choose', id);
        choose.setAttribute('aria-label', t('v2.plan.choose') + ': ' + p.name);
        actions.appendChild(choose);
        card.appendChild(actions);
        box.appendChild(card);
      });
    });
  }
  renderPlans();
  i18n.onChange(renderPlans);

  // «Выбрать» — подставляем пакет в бриф (карточку при этом не открываем: script.js игнорирует клики по ссылкам)
  document.addEventListener('click', function (e) {
    var a = e.target.closest('[data-choose]');
    if (!a || !window.MMM_choosePlan) return;
    e.preventDefault();
    var id = a.getAttribute('data-choose');
    window.MMM_choosePlan({ type: 'plan', id: id }, KIND[id.split('-')[0]]);
  });

  // ---------- Вкладки пакетов ----------
  var tabs = $$('.tab');
  function selectTab(tab, focus) {
    tabs.forEach(function (tb) {
      var on = tb === tab;
      tb.setAttribute('aria-selected', on ? 'true' : 'false');
      tb.tabIndex = on ? 0 : -1;
      document.getElementById(tb.getAttribute('aria-controls')).hidden = !on;
    });
    if (focus) tab.focus();
  }
  tabs.forEach(function (tab, i) {
    tab.addEventListener('click', function () { selectTab(tab); });
    tab.addEventListener('keydown', function (e) {
      var n = null;
      if (e.key === 'ArrowRight') n = tabs[(i + 1) % tabs.length];
      if (e.key === 'ArrowLeft') n = tabs[(i - 1 + tabs.length) % tabs.length];
      if (e.key === 'Home') n = tabs[0];
      if (e.key === 'End') n = tabs[tabs.length - 1];
      if (n) { e.preventDefault(); selectTab(n, true); }
    });
  });
  // Из калькулятора «Посмотреть пакет» и ссылки на #calculator — открываем нужную вкладку
  if (location.hash === '#calculator') selectTab($('#tab-ev'));
  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[href="#calculator"]');
    if (a) selectTab($('#tab-ev'));
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
      cur.classList.toggle('is-hover', !!target.closest('a, button, summary, label, .pcard, .case, [role="tab"]'));
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
