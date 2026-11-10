// MUST MOVIE MEDIA — защита контента от копирования.
// Важно: полностью защитить открытый сайт нельзя — всё, что видно в браузере, можно сохранить
// скриншотом или через инструменты разработчика. Этот файл закрывает простые способы:
//  • выделение и копирование текста (кроме полей ввода, брифа и чата);
//  • «Сохранить изображение / видео» — правая кнопка, долгое нажатие на телефоне, перетаскивание;
//  • сочетания клавиш: сохранить страницу, исходный код, печать, инструменты разработчика;
//  • если текст всё же скопирован — к нему добавляется подпись с адресом сайта.
// Чтобы где-то разрешить копирование, добавьте элементу атрибут data-copy-ok.
(function () {
  'use strict';

  var SITE = 'https://mustmoviemedia.github.io/website/';
  // Где выделять и копировать можно: поля, бриф, чат, FAQ не трогаем ради удобства клиентов
  var ALLOW = 'input, textarea, select, [contenteditable="true"], [data-copy-ok], .brief, #mmm-chat';
  var MEDIA = 'img, video, picture, svg, canvas, .frame, .hero__media, .case__media, .cell__media, .person, .reel-card';

  function allowed(el) { return !!(el && el.closest && el.closest(ALLOW)); }
  function target(e) { var t = e.target; return t && t.nodeType === 3 ? t.parentElement : t; }
  function selAllowed() {
    var s = window.getSelection && window.getSelection();
    var n = s && s.anchorNode;
    if (n && n.nodeType === 3) n = n.parentElement;
    return allowed(n);
  }
  function inField() { var a = document.activeElement; return !!(a && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); }

  document.documentElement.classList.add('is-protected');

  // Правая кнопка мыши: запрещаем на картинках, видео и вообще вне полей ввода
  document.addEventListener('contextmenu', function (e) {
    var t = target(e);
    if (allowed(t) && !(t.closest && t.closest(MEDIA))) return;
    e.preventDefault();
  });

  // Перетаскивание картинок и видео на рабочий стол
  document.addEventListener('dragstart', function (e) {
    var t = target(e);
    if (t && t.closest && t.closest(MEDIA + ', a')) e.preventDefault();
  });

  // Выделение текста мышью
  document.addEventListener('selectstart', function (e) {
    if (!allowed(target(e))) e.preventDefault();
  });

  // Копирование и вырезание: вне разрешённых мест — запрет, в разрешённых крупный кусок получает подпись
  function onCopy(e) {
    var sel = window.getSelection ? String(window.getSelection()) : '';
    var field = inField();
    if (!field && !selAllowed()) { e.preventDefault(); return; }
    // Свой ввод в поле копируется как есть; длинный текст со страницы — с подписью
    if (!field && sel.length > 160 && e.clipboardData) {
      e.preventDefault();
      e.clipboardData.setData('text/plain', sel + '\n\n© MUST MOVIE MEDIA — ' + SITE);
    }
  }
  document.addEventListener('copy', onCopy);
  document.addEventListener('cut', onCopy);

  // Сочетания клавиш
  document.addEventListener('keydown', function (e) {
    var k = (e.key || '').toLowerCase();
    var mod = e.ctrlKey || e.metaKey;
    var block =
      k === 'f12' ||
      (mod && (k === 's' || k === 'u' || k === 'p')) ||                  // сохранить, исходный код, печать
      (mod && e.shiftKey && (k === 'i' || k === 'j' || k === 'c')) ||    // инструменты разработчика
      (e.metaKey && e.altKey && (k === 'i' || k === 'j' || k === 'c' || k === 'u')); // то же на Mac
    // Ctrl+A и Ctrl+C вне полей ввода
    if (!block && mod && !inField()) {
      if (k === 'a') block = true;
      if ((k === 'c' || k === 'x') && !selAllowed()) block = true;
    }
    if (block) { e.preventDefault(); e.stopPropagation(); }
  }, true);
})();
