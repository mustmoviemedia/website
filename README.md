# MUST MOVIE MEDIA — сайт-визитка

Статический сайт без сборки: `index.html` + `styles.css` + `script.js`, бриф — `brief.html` + `brief.js`, картинки в `assets/`.

## Что заменить перед запуском

- `assets/logo-white.svg` — сейчас временный логотип, замените на фирменный (то же имя файла).
- `assets/og-image.png` — картинка для превью ссылки в соцсетях (1200×630).
- Все заглушки размечены классом `todo` — найдите их поиском `class="todo` / `todo"` в `index.html`.
- Плашка «Черновая версия сайта» — блок `<div class="draft-bar">` в начале `index.html`, просто удалите его.

## Локальный просмотр

Откройте `index.html` в браузере или запустите `python3 -m http.server` и зайдите на http://localhost:8000.

## Публикация

**GitHub Pages:** Settings → Pages → Source: *Deploy from a branch* → ветка `main`, папка `/ (root)` → Save. Сайт появится по адресу `https://<аккаунт>.github.io/<репозиторий>/`.

**Netlify:** Add new site → Import from GitHub → выбрать репозиторий. Build command — пусто, Publish directory — `/`.

**Свой домен:**
- GitHub Pages: Settings → Pages → Custom domain. У регистратора домена: для `www` — CNAME на `<аккаунт>.github.io`; для корня — A-записи `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`. Включите *Enforce HTTPS*.
- Netlify: Domain management → Add domain, затем DNS-записи, которые покажет Netlify (или перенесите DNS на Netlify). HTTPS выдаётся автоматически.
