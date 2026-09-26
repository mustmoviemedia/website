// MUST MOVIE MEDIA — приём заявок с сайта и отправка в Telegram-группу.
// Разворачивается на Cloudflare Workers. Секреты задаются в настройках Worker:
//   BOT_TOKEN — токен бота от @BotFather
//   CHAT_ID   — id группы (начинается с -100…)

const ALLOWED_ORIGINS = [
  'https://must-movie-media.github.io',
  // добавьте свой домен, когда подключите, например: 'https://mmm.uz'
];

const MAX_FIELD = 1500;   // символов на одно поле
const MAX_FIELDS = 30;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = ALLOWED_ORIGINS.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': allowed ? origin : ALLOWED_ORIGINS[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };
    const reply = (status, body) =>
      new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (request.method !== 'POST') return reply(405, { ok: false, error: 'method' });
    if (!allowed) return reply(403, { ok: false, error: 'origin' });
    if (!env.BOT_TOKEN || !env.CHAT_ID) return reply(500, { ok: false, error: 'config' });

    let data;
    try { data = await request.json(); } catch { return reply(400, { ok: false, error: 'json' }); }

    // Антиспам: скрытое поле должно быть пустым, а форма — заполняться дольше 5 секунд
    if (data.website) return reply(200, { ok: true });
    if (typeof data.elapsed === 'number' && data.elapsed < 5000) return reply(200, { ok: true });

    const fields = Array.isArray(data.fields) ? data.fields.slice(0, MAX_FIELDS) : [];
    const get = (label) => (fields.find((f) => f[0] === label) || [])[1];
    if (!get('Имя') || !get('Телефон / Telegram')) return reply(400, { ok: false, error: 'required' });

    const esc = (s) => String(s).slice(0, MAX_FIELD)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const lines = ['🎬 <b>Новая заявка с сайта</b>', ''];
    for (const [label, value] of fields) {
      if (!value || value === '—') continue;
      lines.push(`<b>${esc(label)}:</b> ${esc(value)}`);
    }
    const contact = String(get('Телефон / Telegram') || '').trim();
    const tg = contact.match(/^@([A-Za-z0-9_]{5,32})$/);
    if (tg) lines.push('', `👉 Написать: https://t.me/${tg[1]}`);
    lines.push('', `🌐 ${esc(data.lang || 'ru').toUpperCase()} · ${new Date().toLocaleString('ru-RU', { timeZone: 'Asia/Tashkent' })}`);

    const tgRes = await fetch(`https://api.telegram.org/bot${env.BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: env.CHAT_ID,
        text: lines.join('\n').slice(0, 4000),
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
    });

    if (!tgRes.ok) return reply(502, { ok: false, error: 'telegram' });
    return reply(200, { ok: true });
  },
};
