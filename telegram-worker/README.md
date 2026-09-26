# Заявки с сайта → Telegram

Бриф на сайте отправляет ответы в Cloudflare Worker, а Worker пересылает их ботом `@mmm_brief_bot` в группу команды. Токен бота хранится только в Cloudflare, на сайте его нет.

## Настройка (один раз)

1. **Узнать id группы.** Добавьте `@mmm_brief_bot` в группу и отправьте там `/start@mmm_brief_bot`. Откройте в браузере `https://api.telegram.org/bot<ТОКЕН>/getUpdates` и найдите `"chat":{"id":-100…`. Это число с минусом и есть `CHAT_ID`.
2. **Создать Worker.** Cloudflare → Workers & Pages → Create → Worker → Deploy. Затем Edit code, вставить содержимое `worker.js`, Deploy.
3. **Добавить секреты.** Worker → Settings → Variables and Secrets → Add:
   - `BOT_TOKEN` — токен бота (тип Secret);
   - `CHAT_ID` — id группы (тип Secret).
4. **Подключить сайт.** Скопировать адрес Worker (`https://….workers.dev`) и вписать его в `BRIEF_ENDPOINT` в начале `brief.js`.

## Защита

- принимаются запросы только с сайта (`ALLOWED_ORIGINS` в `worker.js`, добавьте туда свой домен, если подключите);
- скрытое поле-ловушка и проверка времени заполнения отсекают ботов;
- если отправка не прошла, клиент видит кнопки «Скопировать» и «Direct».
