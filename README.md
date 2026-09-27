# MUST MOVIE MEDIA — сайт-визитка

Статический сайт без сборки: `index.html` + `styles.css` + `script.js`, бриф — `brief.html` + `brief.js`, картинки в `assets/`.

## Что заменить перед запуском

- `assets/logo-white.svg` — сейчас временный логотип, замените на фирменный (то же имя файла).
- `assets/og-image.png` — картинка для превью ссылки в соцсетях (1200×630).
- Все заглушки размечены классом `todo` — найдите их поиском `class="todo` / `todo"` в `index.html`.
- Плашка «Черновая версия сайта» — блок `<div class="draft-bar">` в начале `index.html`, просто удалите его.

## Языки: RU / UZ / EN

- Все тексты интерфейса — в `i18n.js`, объект `DICT = { ru, uz, en }`. Чтобы поправить перевод, меняйте строку с нужным ключом во всех трёх языках.
- В `index.html` элементы помечены `data-i18n="ключ"` (текст), `data-i18n-html` (текст с разметкой), `data-i18n-placeholder`, `data-i18n-aria-label`, `data-i18n-alt`, `data-i18n-content`. Русский текст в HTML — запасной вариант.
- Цены: `data-money="16.0"` (+ `data-money-per` для «/ мес») — формат подставляется сам: «16,0 млн / мес», «16,0 mln / oy», «16.0 M UZS / mo».
- Пакеты в окне «Подробнее» — `plans.js`, структура `MMM_PLANS[язык][id]`; цены общие, в блоке `META`.
- Язык при первом заходе: `?lang=ru|uz|en` → сохранённый выбор → язык браузера. Ссылка на английскую версию: `index.html?lang=en`.
- Итоговый текст брифа всегда собирается на русском, со строкой «Язык клиента».

## Калькулятор мероприятия

- Секция `#calculator` (после сравнения «Исторических» пакетов), логика — `calc.js`.
- Все цены — в объекте `CALC_PRICES` в начале `calc.js`, с комментариями, в млн сум. Меняйте только числа.
- `CALC_PRESETS` — параметры кнопок «Как Блокбастер», «Как Исторический 1/2/3». Сейчас они дают ровно 170,7 / 97,7 / 57,9 / 27,9 млн. После изменения цен проверьте эти кнопки.
- Проверка из терминала: `node -e "const c=require('./calc.js'); for (const [k,s] of Object.entries(c.presets)) console.log(k, c.compute(s).total)"`.

## Новая версия /v2/ (предпросмотр)

Адрес: `https://must-movie-media.github.io/website/v2/`. Главная в корне не меняется, пока не скажете «переносим».
- `v2/index.html`, `v2/styles.css`, `v2/v2.js`. Бриф, калькулятор, пакеты, переводы и аналитика подключаются из корня (`../brief.js`, `../calc.js`, `../plans.js`, `../i18n.js`, `../analytics.js`).
- На `/v2/` стоит `noindex`, чтобы Google не посчитал её дублем. При переносе на главную — убрать.
- Новые тексты — ключи `v2.*` в `i18n.js` (RU/UZ/EN).
- Все места под реальный контент помечены `class="todo"` и комментариями `TODO` в `v2/index.html`.

## Локальный просмотр

Откройте `index.html` в браузере или запустите `python3 -m http.server` и зайдите на http://localhost:8000.

## Публикация

**GitHub Pages:** Settings → Pages → Source: *Deploy from a branch* → ветка `main`, папка `/ (root)` → Save. Сайт появится по адресу `https://<аккаунт>.github.io/<репозиторий>/`.

**Netlify:** Add new site → Import from GitHub → выбрать репозиторий. Build command — пусто, Publish directory — `/`.

**Свой домен:**
- GitHub Pages: Settings → Pages → Custom domain. У регистратора домена: для `www` — CNAME на `<аккаунт>.github.io`; для корня — A-записи `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`. Включите *Enforce HTTPS*.
- Netlify: Domain management → Add domain, затем DNS-записи, которые покажет Netlify (или перенесите DNS на Netlify). HTTPS выдаётся автоматически.
