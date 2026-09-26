// MUST MOVIE MEDIA — скрипты главной страницы
(function () {
  'use strict';

  var i18n = window.MMM_I18N;

  // Бургер-меню
  var burger = document.querySelector('.burger');
  var links = document.getElementById('nav-links');
  if (burger && links) {
    var setOpen = function (open) {
      links.classList.toggle('is-open', open);
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('data-i18n-aria-label', open ? 'nav.close' : 'nav.open');
      burger.setAttribute('aria-label', i18n.t(open ? 'nav.close' : 'nav.open'));
    };
    burger.addEventListener('click', function () {
      setOpen(burger.getAttribute('aria-expanded') !== 'true');
    });
    links.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && links.classList.contains('is-open')) {
        setOpen(false);
        burger.focus();
      }
    });
  }

  // Окно «Подробнее о пакете»
  (function () {
    var ALL = window.MMM_PLANS || {};
    var modal = document.getElementById('plan-modal');
    if (!modal || typeof modal.showModal !== 'function') return;
    function plansFor(l) { return ALL[l] || ALL.ru || {}; }
    var $ = function (id) { return document.getElementById(id); };
    var opener = null;
    var currentId = null;
    var KIND = { smm: 'SMM на месяц', foto: 'Фотосъёмка', video: 'Reels', ev: 'Мероприятие' };

    function fillList(el, items, tag) {
      el.innerHTML = '';
      (items || []).forEach(function (t) {
        var li = document.createElement(tag || 'li');
        li.textContent = t;
        el.appendChild(li);
      });
    }

    // Заполняет окно текстами пакета на текущем языке
    function fill(id) {
      var p = plansFor(i18n.lang())[id];
      if (!p) return false;
      $('pm-group').textContent = p.group;
      $('pm-title').textContent = p.name;
      if (p.price == null) $('pm-price').textContent = p.priceText;
      else $('pm-price').innerHTML = i18n.moneyHtml(p.price, p.per);
      $('pm-lead').textContent = p.lead;

      var facts = $('pm-facts');
      facts.innerHTML = '';
      p.facts.forEach(function (f) {
        var d = document.createElement('div');
        d.className = 'pm__fact';
        var s = document.createElement('span'); s.textContent = f[0];
        var b = document.createElement('b'); b.textContent = f[1];
        d.appendChild(s); d.appendChild(b);
        facts.appendChild(d);
      });

      fillList($('pm-includes'), p.includes);
      fillList($('pm-team'), p.team);
      fillList($('pm-gear'), p.gear);
      fillList($('pm-terms'), p.terms);
      fillList($('pm-fit'), p.fit);

      var tl = $('pm-timeline');
      tl.innerHTML = '';
      $('pm-timeline-wrap').hidden = !p.timeline;
      (p.timeline || []).forEach(function (t) {
        var li = document.createElement('li');
        var s = document.createElement('span'); s.textContent = t[0];
        li.appendChild(s); li.appendChild(document.createTextNode(t[1]));
        tl.appendChild(li);
      });

      modal.classList.toggle('is-hot', !!p.hot);
      return true;
    }

    function open(id, from) {
      if (!fill(id)) return;
      currentId = id;
      opener = from || null;
      modal.showModal();
      modal.querySelector('.pm').scrollTop = 0;
      modal.querySelector('.pm__close').focus();
    }

    function close() {
      modal.close();
    }

    modal.addEventListener('close', function () {
      if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    });

    // Открытие: по кнопке «Подробнее» или клику по карточке
    document.addEventListener('click', function (e) {
      var card = e.target.closest('[data-plan]');
      if (!card || e.target.closest('a')) return;
      var btn = card.querySelector('.plan__more');
      open(card.getAttribute('data-plan'), btn || card);
    });

    modal.addEventListener('click', function (e) {
      if (e.target === modal || e.target.closest('[data-close]')) close();
    });

    $('pm-choose').addEventListener('click', function () {
      if (!currentId) return;
      opener = null;
      close();
      if (window.MMM_choosePlan) window.MMM_choosePlan({ type: 'plan', id: currentId }, KIND[currentId.split('-')[0]]);
    });

    // Смена языка при открытом окне — перерисовываем
    i18n.onChange(function () {
      if (modal.open && currentId) fill(currentId);
    });

    // Для калькулятора: открыть окно пакета по id
    window.MMM_openPlan = open;
  })();

  // Появление блоков при скролле
  var items = document.querySelectorAll('.reveal');
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  items.forEach(function (el) { io.observe(el); });
})();
