// MUST MOVIE MEDIA — статистика посещений (Google Analytics 4).
// Пока GA_ID пустой, скрипт ничего не загружает и ничего не отправляет.
(function () {
  'use strict';

  var GA_ID = 'G-7J48M4FL71'; // ID потока данных, вида G-XXXXXXXXXX

  // Безопасная заглушка: код сайта может вызывать MMM_track всегда
  window.MMM_track = function () {};
  if (!GA_ID) return;

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', GA_ID);

  window.MMM_track = function (name, params) {
    try { window.gtag('event', name, params || {}); } catch (e) { /* статистика не должна ломать сайт */ }
  };

  // Клики по контактам: Instagram, Telegram
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('instagram.com') !== -1) window.MMM_track('contact_click', { method: 'instagram' });
    else if (href.indexOf('t.me/') !== -1) window.MMM_track('contact_click', { method: 'telegram' });
  }, true);
})();
