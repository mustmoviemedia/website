// MUST MOVIE MEDIA — Cloudflare Worker «mmm-brief».
//  POST /            — бриф с сайта → сообщение в группу «ЗАЯВКИ» (как и раньше)
//  POST /chat/call   — чат на сайте: позвать менеджера (создаёт тему в группе)
//  POST /chat/send   — чат на сайте: сообщение клиента менеджеру
//  GET  /chat/poll   — чат на сайте: забрать ответы менеджера
//  POST /tg          — вебхук Telegram (группа менеджеров и личные чаты с ботом)
//  GET  /setup       — один раз: подключить вебхук и команды бота (нужен ключ WEBHOOK_SECRET)
//
// Секреты — только в Cloudflare (Settings → Variables and Secrets), в коде их нет:
//   BOT_TOKEN      — токен бота @mmm_brief_bot
//   CHAT_ID        — id группы «ЗАЯВКИ» (-100…)
//   WEBHOOK_SECRET — любая длинная случайная строка; Telegram присылает её в заголовке
//                    X-Telegram-Bot-Api-Secret-Token, без неё вебхук не принимается
// Настройки (wrangler.toml → [vars]): MANAGERS, SITE_URL, EXTRA_ORIGINS, TG_API.
// Диалоги хранятся в Durable Object ChatHub (SQLite).

import KB from '../knowledge.js';
import { TEMPLATES, BUTTON_TEMPLATES, fillTemplate } from './templates.js';

const ALLOWED_ORIGINS = [
  'https://must-movie-media.github.io',
  // добавьте свой домен, когда подключите, например: 'https://mmm.uz'
];

const MAX_FIELD = 1500;   // бриф: символов на одно поле
const MAX_FIELDS = 30;

const LIMITS = {
  msgLen: 600,            // символов в сообщении клиента
  nameLen: 60,
  calcLen: 1500,
  callsPerIpHour: 6,      // «Позвать менеджера» с одного IP в час
  msgsPerSid5min: 20,     // сообщений из одного диалога за 5 минут
  pollsPerSidMin: 40,     // опросов за минуту
  tgPerUser5min: 30,      // сообщений боту в личке за 5 минут
  dialogTtlDays: 7        // открытый диалог без сообщений закрывается сам
};

function origins(env) {
  return ALLOWED_ORIGINS.concat(String(env.EXTRA_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean));
}
function cors(request, env, methods) {
  const origin = request.headers.get('Origin') || '';
  const list = origins(env);
  return {
    allowed: list.includes(origin),
    headers: {
      'Access-Control-Allow-Origin': list.includes(origin) ? origin : list[0],
      'Access-Control-Allow-Methods': methods,
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin'
    }
  };
}
const json = (status, body, headers) =>
  new Response(JSON.stringify(body), { status, headers: { ...(headers || {}), 'Content-Type': 'application/json' } });

function tgApi(env) { return (env.TG_API || 'https://api.telegram.org').replace(/\/$/, ''); }

// Сравнение секрета без утечки по времени
function safeEqual(a, b) {
  a = String(a || ''); b = String(b || '');
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

function hub(env) { return env.CHAT.get(env.CHAT.idFromName('hub')); }

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/tg') return webhook(request, env);
    if (url.pathname === '/setup') return setup(request, env, url);
    if (url.pathname.startsWith('/chat/')) return chat(request, env, url);
    return brief(request, env);
  }
};

// ─────────────────────────── Бриф (без изменений в логике) ───────────────────────────
async function brief(request, env) {
  const c = cors(request, env, 'POST, OPTIONS');
  const reply = (status, body) => json(status, body, c.headers);

  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: c.headers });
  if (request.method !== 'POST') return reply(405, { ok: false, error: 'method' });
  if (!c.allowed) return reply(403, { ok: false, error: 'origin' });
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

  const tgRes = await fetch(`${tgApi(env)}/bot${env.BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.CHAT_ID,
      text: lines.join('\n').slice(0, 4000),
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  });

  // Текст ошибки Telegram клиенту не отдаём
  if (!tgRes.ok) return reply(502, { ok: false, error: 'telegram' });
  return reply(200, { ok: true });
}

// ─────────────────────────── Чат на сайте → Durable Object ───────────────────────────
async function chat(request, env, url) {
  const c = cors(request, env, 'GET, POST, OPTIONS');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: c.headers });
  if (!c.allowed) return json(403, { ok: false, error: 'origin' }, c.headers);
  if (!env.BOT_TOKEN || !env.CHAT_ID || !env.CHAT) return json(500, { ok: false, error: 'config' }, c.headers);
  const route = url.pathname;
  const isPost = route === '/chat/call' || route === '/chat/send';
  if (!isPost && route !== '/chat/poll') return json(404, { ok: false, error: 'route' }, c.headers);
  if (isPost && request.method !== 'POST') return json(405, { ok: false, error: 'method' }, c.headers);
  if (!isPost && request.method !== 'GET') return json(405, { ok: false, error: 'method' }, c.headers);

  let body = null;
  if (isPost) {
    const raw = await request.text();
    if (raw.length > 12000) return json(413, { ok: false, error: 'size' }, c.headers);
    body = raw;
  }
  const res = await hub(env).fetch('https://hub' + route + url.search, {
    method: request.method,
    headers: { 'Content-Type': 'application/json', 'X-IP': request.headers.get('CF-Connecting-IP') || '' },
    body
  });
  return new Response(res.body, { status: res.status, headers: { ...c.headers, 'Content-Type': 'application/json' } });
}

// ─────────────────────────── Вебхук Telegram ───────────────────────────
async function webhook(request, env) {
  if (request.method !== 'POST') return new Response('method', { status: 405 });
  // Принимаем только запросы, подписанные секретом, который мы сами передали в setWebhook
  if (!env.WEBHOOK_SECRET || !safeEqual(request.headers.get('X-Telegram-Bot-Api-Secret-Token'), env.WEBHOOK_SECRET)) {
    return new Response('forbidden', { status: 403 });
  }
  const raw = await request.text();
  if (raw.length > 200000) return new Response('ok');
  // Telegram повторяет запрос при ошибке, поэтому всегда отвечаем 200
  try { await hub(env).fetch('https://hub/tg', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw }); } catch (e) { /* пропускаем */ }
  return new Response('ok');
}

// Один раз после деплоя: https://<worker>/setup?key=<WEBHOOK_SECRET>
async function setup(request, env, url) {
  const key = request.headers.get('X-Setup-Key') || url.searchParams.get('key');
  if (!env.WEBHOOK_SECRET || !safeEqual(key, env.WEBHOOK_SECRET)) return new Response('forbidden', { status: 403 });
  const call = async (method, params) => {
    const r = await fetch(`${tgApi(env)}/bot${env.BOT_TOKEN}/${method}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params)
    });
    const j = await r.json().catch(() => ({}));
    return { ok: !!j.ok, description: j.description || '' };
  };
  const out = {};
  out.webhook = await call('setWebhook', {
    url: `${url.origin}/tg`,
    secret_token: env.WEBHOOK_SECRET,
    allowed_updates: ['message', 'callback_query'],
    drop_pending_updates: true
  });
  out.privateCommands = await call('setMyCommands', {
    commands: [{ command: 'start', description: 'Частые вопросы и связь с менеджером' }],
    scope: { type: 'all_private_chats' }
  });
  out.groupCommands = await call('setMyCommands', {
    commands: [
      { command: 'templates', description: 'Шаблоны ответов' },
      { command: 't', description: 'Отправить шаблон клиенту: /t greet' },
      { command: 'close', description: 'Закрыть диалог' }
    ],
    scope: { type: 'chat', chat_id: env.CHAT_ID }
  });
  const chat = await call('getChat', { chat_id: env.CHAT_ID });
  out.group = chat.ok ? 'ok' : chat.description;
  return json(200, out);
}

// ─────────────────────────── Durable Object: все диалоги ───────────────────────────
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const clip = (s, n) => String(s == null ? '' : s).replace(/\u0000/g, '').trim().slice(0, n);
const LANG_NAME = { ru: 'RU', uz: 'UZ', en: 'EN' };

function validContact(s) {
  const v = String(s || '').trim();
  if (/^@[a-z0-9_]{4,32}$/i.test(v)) return v;
  const tme = v.match(/t(?:elegram)?\.me\/([a-z0-9_]{4,32})/i);
  if (tme) return '@' + tme[1];
  const digits = v.replace(/\D/g, '');
  if (digits.length >= 7 && digits.length <= 15 && /^[+\d\s()-]+$/.test(v)) return v;
  return null;
}
function tgLang(code) {
  code = String(code || '').toLowerCase();
  if (code.indexOf('uz') === 0) return 'uz';
  if (code.indexOf('ru') === 0 || !code) return 'ru';
  return 'en';
}
function dateTag() {
  return new Date().toLocaleDateString('ru-RU', { timeZone: 'Asia/Tashkent', day: '2-digit', month: '2-digit' });
}

export class ChatHub {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS dialogs (
        sid TEXT PRIMARY KEY, kind TEXT NOT NULL, tg_user INTEGER, name TEXT, contact TEXT, lang TEXT,
        calc TEXT, date TEXT, topic_id INTEGER, head_id INTEGER, head_text TEXT,
        taken_by TEXT, status TEXT NOT NULL DEFAULT 'open', created INTEGER, updated INTEGER
      );
      CREATE INDEX IF NOT EXISTS dialogs_topic ON dialogs(topic_id);
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT, sid TEXT NOT NULL, who TEXT NOT NULL, name TEXT, text TEXT, ts INTEGER
      );
      CREATE INDEX IF NOT EXISTS messages_sid ON messages(sid, id);
      CREATE TABLE IF NOT EXISTS msgmap (group_msg INTEGER PRIMARY KEY, sid TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS rate (k TEXT PRIMARY KEY, n INTEGER, start INTEGER);
      CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
    `);
  }

  // ---------- SQL ----------
  one(q, ...a) { return this.sql.exec(q, ...a).toArray()[0] || null; }
  all(q, ...a) { return this.sql.exec(q, ...a).toArray(); }
  run(q, ...a) { this.sql.exec(q, ...a); }
  kvGet(k) { const r = this.one('SELECT v FROM kv WHERE k = ?', k); return r ? r.v : null; }
  kvSet(k, v) {
    if (v == null) this.run('DELETE FROM kv WHERE k = ?', k);
    else this.run('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, String(v));
  }
  // Не больше limit событий за windowMs
  rate(key, limit, windowMs) {
    const now = Date.now();
    const r = this.one('SELECT n, start FROM rate WHERE k = ?', key);
    if (!r || now - r.start > windowMs) {
      this.run('INSERT INTO rate (k, n, start) VALUES (?, 1, ?) ON CONFLICT(k) DO UPDATE SET n = 1, start = excluded.start', key, now);
      return true;
    }
    if (r.n >= limit) return false;
    this.run('UPDATE rate SET n = n + 1 WHERE k = ?', key);
    return true;
  }
  dialog(sid) { return this.one('SELECT * FROM dialogs WHERE sid = ?', sid); }
  addMsg(sid, who, name, text) {
    this.run('INSERT INTO messages (sid, who, name, text, ts) VALUES (?, ?, ?, ?, ?)', sid, who, name || null, text, Date.now());
    this.run('UPDATE dialogs SET updated = ? WHERE sid = ?', Date.now(), sid);
  }

  // ---------- Telegram ----------
  async tg(method, params) {
    try {
      const r = await fetch(`${tgApi(this.env)}/bot${this.env.BOT_TOKEN}/${method}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params)
      });
      const j = await r.json().catch(() => ({}));
      return j && j.ok ? j : { ok: false, description: (j && j.description) || 'HTTP ' + r.status };
    } catch (e) {
      return { ok: false, description: 'network' };
    }
  }
  group() { return this.env.CHAT_ID; }
  // Отправить в группу: в тему диалога или (запасной вариант) обычным сообщением, на которое отвечают реплаем
  async toGroup(d, html, extra) {
    const params = { chat_id: this.group(), text: html.slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true, ...(extra || {}) };
    if (d && d.topic_id) params.message_thread_id = d.topic_id;
    else if (d && d.head_id && !params.reply_markup) params.reply_parameters = { message_id: d.head_id, allow_sending_without_reply: true };
    const r = await this.tg('sendMessage', params);
    if (r.ok && d) this.run('INSERT OR REPLACE INTO msgmap (group_msg, sid) VALUES (?, ?)', r.result.message_id, d.sid);
    return r;
  }
  managerName(from) {
    let map = {};
    try { map = JSON.parse(this.env.MANAGERS || '{}'); } catch (e) { map = {}; }
    return map[String(from && from.id)] || clip([from && from.first_name, from && from.last_name].filter(Boolean).join(' '), 40) || 'MUST MOVIE MEDIA';
  }
  siteUrl() { return (this.env.SITE_URL || 'https://must-movie-media.github.io/website/').replace(/#.*$/, ''); }

  // ---------- Маршруты ----------
  async fetch(request) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/tg') { await this.onUpdate(await request.json()); return json(200, { ok: true }); }
      if (url.pathname === '/chat/poll') return this.poll(url);
      const body = await request.json().catch(() => null);
      if (!body || typeof body !== 'object') return json(400, { ok: false, error: 'json' });
      const ip = request.headers.get('X-IP') || '';
      if (url.pathname === '/chat/call') return await this.siteCall(body, ip);
      if (url.pathname === '/chat/send') return await this.siteSend(body);
      return json(404, { ok: false, error: 'route' });
    } catch (e) {
      return json(500, { ok: false, error: 'server' });
    }
  }

  validSid(sid) { return typeof sid === 'string' && /^[a-z0-9-]{16,64}$/i.test(sid); }

  // Сайт: «Позвать менеджера»
  async siteCall(b, ip) {
    if (b.website) return json(200, { ok: true, open: KB.isOpen() }); // ловушка для ботов
    if (!this.validSid(b.sid)) return json(400, { ok: false, error: 'sid' });
    const name = clip(b.name, LIMITS.nameLen);
    const contact = validContact(clip(b.contact, 60));
    if (!name || !contact) return json(400, { ok: false, error: 'required' });
    if (ip && !this.rate('call:' + ip, LIMITS.callsPerIpHour, 3600e3)) return json(429, { ok: false, error: 'rate' });
    if (!this.rate('callsid:' + b.sid, 3, 600e3)) return json(429, { ok: false, error: 'rate' });
    const history = Array.isArray(b.history) ? b.history.slice(-12).map((m) => ({
      who: m && m.from === 'me' ? 'client' : m && m.from === 'mgr' ? 'mgr' : 'bot',
      text: clip(m && m.text, 400)
    })).filter((m) => m.text) : [];
    const r = await this.openDialog({
      sid: b.sid, kind: 'site', name, contact, lang: KB.lang(b.lang),
      calc: clip(b.calc, LIMITS.calcLen), date: clip(b.date, 80), page: clip(b.page, 200), history
    });
    if (!r.ok) return json(502, { ok: false, error: 'telegram' });
    return json(200, { ok: true, open: KB.isOpen() });
  }

  // Сайт: сообщение клиента в открытый диалог
  async siteSend(b) {
    if (b.website) return json(200, { ok: true });
    if (!this.validSid(b.sid)) return json(400, { ok: false, error: 'sid' });
    const text = clip(b.text, LIMITS.msgLen);
    if (!text) return json(400, { ok: false, error: 'empty' });
    const d = this.dialog(b.sid);
    if (!d) return json(404, { ok: false, error: 'unknown' });
    if (d.status !== 'open') return json(409, { ok: false, error: 'closed' });
    if (!this.rate('send:' + b.sid, LIMITS.msgsPerSid5min, 300e3)) return json(429, { ok: false, error: 'rate' });
    this.addMsg(d.sid, 'client', d.name, text);
    const r = await this.toGroup(d, `💬 <b>${esc(d.name)}:</b> ${esc(text)}`);
    if (!r.ok) return json(502, { ok: false, error: 'telegram' });
    return json(200, { ok: true });
  }

  // Сайт: ответы менеджера
  poll(url) {
    const sid = url.searchParams.get('sid');
    if (!this.validSid(sid)) return json(400, { ok: false, error: 'sid' });
    if (!this.rate('poll:' + sid, LIMITS.pollsPerSidMin, 60e3)) return json(429, { ok: false, error: 'rate' });
    const d = this.dialog(sid);
    if (!d) return json(404, { ok: false, error: 'unknown' });
    const after = Math.max(0, parseInt(url.searchParams.get('after'), 10) || 0);
    const msgs = this.all("SELECT id, name, text FROM messages WHERE sid = ? AND who = 'mgr' AND id > ? ORDER BY id LIMIT 50", sid, after);
    let closed = d.status !== 'open';
    if (!closed && Date.now() - d.updated > LIMITS.dialogTtlDays * 864e5) {
      this.run("UPDATE dialogs SET status = 'closed' WHERE sid = ?", sid);
      closed = true;
    }
    return json(200, { ok: true, msgs, closed });
  }

  // ---------- Диалог в группе ----------
  keyboard(sid) {
    const rows = [[{ text: '✋ Беру', callback_data: 'take|' + sid }]];
    const tpl = BUTTON_TEMPLATES.map((code) => ({ text: TEMPLATES[code].title, callback_data: 't|' + code + '|' + sid }));
    for (let i = 0; i < tpl.length; i += 2) rows.push(tpl.slice(i, i + 2));
    rows.push([{ text: '✅ Закрыть диалог', callback_data: 'close|' + sid }]);
    return { inline_keyboard: rows };
  }
  contactHtml(d) {
    const c = String(d.contact || '');
    if (/^@[a-z0-9_]{4,32}$/i.test(c)) return `<a href="https://t.me/${esc(c.slice(1))}">${esc(c)}</a>`;
    if (d.kind === 'tg' && d.tg_user) return `<a href="tg://user?id=${d.tg_user}">профиль в Telegram</a>`;
    return esc(c);
  }
  headHtml(d, o) {
    const lines = [
      `🔴 <b>Новый диалог</b> · ${esc(d.name)} · ${this.contactHtml(d)} · ${LANG_NAME[d.lang] || 'RU'}`,
      d.kind === 'site' ? '🌐 Чат на сайте' : '✈️ Личные сообщения бота'
    ];
    if (d.calc) lines.push(`🧮 <b>Расчёт:</b> ${esc(d.calc)}`);
    if (d.date) lines.push(`📅 <b>Дата:</b> ${esc(d.date)}`);
    if (o && o.history && o.history.length) {
      lines.push('', '💬 <b>Последние сообщения:</b>');
      o.history.forEach((m) => lines.push(`${m.who === 'client' ? '👤' : m.who === 'mgr' ? '🎬' : '🤖'} ${esc(m.text)}`));
    }
    lines.push('', d.topic_id
      ? '↩️ Пишите в этой теме — сообщение уйдёт клиенту от вашего имени.'
      : '↩️ Ответьте реплаем на это сообщение — ответ уйдёт клиенту от вашего имени.');
    if (!KB.isOpen()) lines.push('🌙 Клиент написал в нерабочее время — ему показали «ответим утром».');
    return lines.join('\n').slice(0, 3800);
  }
  async openDialog(o) {
    const now = Date.now();
    const prev = this.dialog(o.sid);
    // Уже открыт — просто сообщаем, что клиент снова зовёт
    if (prev && prev.status === 'open') {
      this.run('UPDATE dialogs SET calc = COALESCE(NULLIF(?, \'\'), calc), date = COALESCE(NULLIF(?, \'\'), date), updated = ? WHERE sid = ?', o.calc || '', o.date || '', now, o.sid);
      const r = await this.toGroup(prev, `🔁 <b>${esc(prev.name)}</b> снова зовёт менеджера${o.calc ? '\n🧮 ' + esc(o.calc) : ''}`);
      return { ok: r.ok };
    }
    const d = {
      sid: o.sid, kind: o.kind, tg_user: o.tgUser || null, name: o.name, contact: o.contact, lang: o.lang,
      calc: o.calc || '', date: o.date || '', topic_id: null, head_id: null
    };
    // Основная схема — отдельная тема на клиента. Если темы выключены или нет прав — отвечают реплаем.
    const offUntil = Number(this.kvGet('topics_off_until') || 0);
    if (offUntil < now) {
      const src = o.kind === 'site' ? 'Сайт' : 'Telegram';
      const t = await this.tg('createForumTopic', { chat_id: this.group(), name: clip(`${src} · ${o.name} · ${dateTag()}`, 120), icon_color: 16478047 });
      if (t.ok) { d.topic_id = t.result.message_thread_id; this.kvSet('topics_error', null); }
      else { this.kvSet('topics_off_until', now + 10 * 60e3); this.kvSet('topics_error', t.description); }
    }
    const head = this.headHtml(d, o);
    const params = { chat_id: this.group(), text: head, parse_mode: 'HTML', disable_web_page_preview: true, reply_markup: this.keyboard(d.sid) };
    if (d.topic_id) params.message_thread_id = d.topic_id;
    const r = await this.tg('sendMessage', params);
    if (!r.ok) return { ok: false };
    d.head_id = r.result.message_id;
    this.run(`INSERT INTO dialogs (sid, kind, tg_user, name, contact, lang, calc, date, topic_id, head_id, head_text, taken_by, status, created, updated)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'open', ?, ?)
      ON CONFLICT(sid) DO UPDATE SET kind = excluded.kind, tg_user = excluded.tg_user, name = excluded.name, contact = excluded.contact,
        lang = excluded.lang, calc = excluded.calc, date = excluded.date, topic_id = excluded.topic_id, head_id = excluded.head_id,
        head_text = excluded.head_text, taken_by = NULL, status = 'open', updated = excluded.updated`,
    d.sid, d.kind, d.tg_user, d.name, d.contact, d.lang, d.calc, d.date, d.topic_id, d.head_id, head, now, now);
    this.run('INSERT OR REPLACE INTO msgmap (group_msg, sid) VALUES (?, ?)', d.head_id, d.sid);
    if (o.kind === 'site') (o.history || []).forEach((m) => this.addMsg(d.sid, m.who === 'client' ? 'client' : 'bot', null, m.text));
    return { ok: true, dialog: this.dialog(d.sid) };
  }
  async refreshHead(d, status) {
    if (!d.head_id) return;
    const params = { chat_id: this.group(), message_id: d.head_id, text: (d.head_text + '\n\n' + status).slice(0, 4000), parse_mode: 'HTML', disable_web_page_preview: true };
    if (d.status === 'open') params.reply_markup = this.keyboard(d.sid);
    await this.tg('editMessageText', params);
  }
  async take(d, who) {
    this.run('UPDATE dialogs SET taken_by = ? WHERE sid = ?', who, d.sid);
    d.taken_by = who;
    await this.refreshHead(d, `✋ <b>Взял: ${esc(who)}</b>`);
  }
  // Сообщение менеджера → клиенту
  async deliver(d, who, text) {
    if (!d.taken_by) await this.take(d, who);
    if (d.kind === 'site') {
      this.addMsg(d.sid, 'mgr', who, clip(text, 4000));
      return true;
    }
    const r = await this.tg('sendMessage', {
      chat_id: d.tg_user, text: `<b>${esc(who)} — MUST MOVIE MEDIA</b>\n${esc(clip(text, 3900))}`, parse_mode: 'HTML', disable_web_page_preview: true
    });
    if (r.ok) this.addMsg(d.sid, 'mgr', who, clip(text, 4000));
    return r.ok;
  }
  async closeDialog(d, who) {
    if (d.status !== 'open') return;
    this.run("UPDATE dialogs SET status = 'closed', updated = ? WHERE sid = ?", Date.now(), d.sid);
    d.status = 'closed';
    this.addMsg(d.sid, 'sys', who, 'closed');
    if (d.kind === 'tg') await this.tg('sendMessage', { chat_id: d.tg_user, text: KB.text('closed', d.lang) });
    await this.refreshHead(d, `✅ <b>Диалог закрыт · ${esc(who)}</b>`);
    if (d.topic_id) {
      await this.toGroup(d, `✅ Диалог закрыл(а) ${esc(who)}. Клиент может написать снова — откроется новая тема.`);
      await this.tg('closeForumTopic', { chat_id: this.group(), message_thread_id: d.topic_id });
    }
  }
  templateText(code, d, who) {
    return fillTemplate(code, d.lang, { client: d.name, manager: who, calc: d.calc, brief: this.siteUrl() + '#brief' });
  }
  async sendTemplate(d, code, who) {
    const text = this.templateText(code, d, who);
    if (!text) return 'unknown';
    if (code === 'calc' && !d.calc) return 'nocalc';
    if (d.status !== 'open') return 'closed';
    const ok = await this.deliver(d, who, text);
    if (!ok) return 'fail';
    await this.toGroup(d, `📤 <b>${esc(who)}</b> → клиенту (${esc(TEMPLATES[code].title)}):\n${esc(text)}`);
    return 'ok';
  }

  // ---------- Входящие от Telegram ----------
  async onUpdate(u) {
    if (!u || typeof u !== 'object') return;
    if (u.callback_query) return this.onCallback(u.callback_query);
    const msg = u.message;
    if (!msg || !msg.chat || (msg.from && msg.from.is_bot)) return;
    if (String(msg.chat.id) === String(this.group())) return this.onGroup(msg);
    if (msg.chat.type === 'private') return this.onPrivate(msg);
    // Любые другие группы и каналы игнорируем
  }

  findDialog(msg) {
    if (msg.message_thread_id) {
      const d = this.one('SELECT * FROM dialogs WHERE topic_id = ? ORDER BY updated DESC LIMIT 1', msg.message_thread_id);
      if (d) return d;
    }
    const reply = msg.reply_to_message;
    if (reply && reply.message_id) {
      const m = this.one('SELECT sid FROM msgmap WHERE group_msg = ?', reply.message_id);
      if (m) return this.dialog(m.sid);
    }
    return null;
  }
  async replyIn(msg, html) {
    const params = { chat_id: this.group(), text: html, parse_mode: 'HTML', disable_web_page_preview: true };
    if (msg.message_thread_id && msg.is_topic_message) params.message_thread_id = msg.message_thread_id;
    params.reply_parameters = { message_id: msg.message_id, allow_sending_without_reply: true };
    return this.tg('sendMessage', params);
  }
  templatesHelp() {
    return ['📋 <b>Шаблоны</b> — отправьте в теме диалога <code>/t код</code> (или реплаем на сообщение клиента):', '']
      .concat(Object.keys(TEMPLATES).map((code) => `<code>/t ${code}</code> — ${esc(TEMPLATES[code].title)}`))
      .concat(['', '<code>/close</code> — закрыть диалог', 'Подстановки: {клиент}, {менеджер}, {расчёт}. Тексты — в telegram-worker/templates.js'])
      .join('\n');
  }
  async onGroup(msg) {
    const text = msg.text || msg.caption || '';
    const who = this.managerName(msg.from);
    const cmd = text.match(/^\/([a-z_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/i);
    const d = this.findDialog(msg);
    if (cmd) {
      const name = cmd[1].toLowerCase();
      if (name === 'templates' || name === 'help') { await this.replyIn(msg, this.templatesHelp()); return; }
      if (name === 't') {
        const code = clip(cmd[2], 30).toLowerCase();
        if (!code || !TEMPLATES[code]) { await this.replyIn(msg, this.templatesHelp()); return; }
        if (!d) { await this.replyIn(msg, 'Команду нужно отправить в теме диалога или реплаем на сообщение клиента.'); return; }
        const res = await this.sendTemplate(d, code, who);
        if (res === 'nocalc') await this.replyIn(msg, 'Клиент не присылал расчёт калькулятора.');
        else if (res === 'closed') await this.replyIn(msg, 'Диалог уже закрыт.');
        else if (res === 'fail') await this.replyIn(msg, '⚠️ Не удалось доставить клиенту.');
        return;
      }
      if (name === 'close') {
        if (!d) { await this.replyIn(msg, 'Команду нужно отправить в теме диалога или реплаем на сообщение клиента.'); return; }
        await this.closeDialog(d, who);
        return;
      }
      return; // чужие команды
    }
    if (!d) return; // обычная переписка в группе
    if (d.status !== 'open') { await this.replyIn(msg, 'Диалог закрыт — клиент это сообщение не увидит.'); return; }
    if (!text.trim()) { await this.replyIn(msg, 'Клиенту доставляется только текст. Файлы и фото отправьте ссылкой.'); return; }
    const ok = await this.deliver(d, who, text);
    if (ok) await this.tg('setMessageReaction', { chat_id: this.group(), message_id: msg.message_id, reaction: [{ type: 'emoji', emoji: '👍' }] });
    else await this.replyIn(msg, '⚠️ Не удалось доставить клиенту (возможно, он заблокировал бота).');
  }

  async onCallback(cq) {
    const data = String(cq.data || '');
    const msg = cq.message;
    const answer = (text, alert) => this.tg('answerCallbackQuery', { callback_query_id: cq.id, text: text || '', show_alert: !!alert });
    if (!msg || !msg.chat) return answer();
    if (msg.chat.type === 'private') return this.onPrivateCallback(cq, answer);
    if (String(msg.chat.id) !== String(this.group())) return answer();

    const parts = data.split('|');
    const sid = parts[parts.length - 1];
    const d = this.dialog(sid);
    if (!d) return answer('Диалог не найден', true);
    const who = this.managerName(cq.from);
    if (parts[0] === 'take') {
      if (d.taken_by && d.taken_by !== who) return answer(`Уже взял(а): ${d.taken_by}`, true);
      await this.take(d, who);
      return answer('Диалог ваш — отвечайте в теме');
    }
    if (parts[0] === 't') {
      const res = await this.sendTemplate(d, parts[1], who);
      const txt = { ok: 'Отправлено клиенту', nocalc: 'Клиент не присылал расчёт', closed: 'Диалог закрыт', fail: 'Не удалось доставить', unknown: 'Нет такого шаблона' }[res];
      return answer(txt, res !== 'ok');
    }
    if (parts[0] === 'close') {
      await this.closeDialog(d, who);
      return answer('Диалог закрыт');
    }
    return answer();
  }

  // ---------- Личные сообщения боту (клиенты) ----------
  sendPrivate(chatId, text, buttons) {
    const p = { chat_id: chatId, text: text.slice(0, 4000), disable_web_page_preview: true };
    if (buttons && buttons.length) p.reply_markup = { inline_keyboard: buttons };
    return this.tg('sendMessage', p);
  }
  quickButtons(lang) {
    const rows = KB.quick(lang).map((q) => [{ text: q.q, callback_data: 'q|' + q.id }]);
    rows.push([{ text: '👤 ' + KB.text('act.manager', lang), callback_data: 'm' }]);
    return rows;
  }
  actButtons(acts, lang) {
    const site = this.siteUrl();
    const rows = [];
    (acts || []).forEach((a) => {
      const [kind, svc] = a.split(':');
      if (kind === 'calc') rows.push([{ text: '🧮 ' + KB.text('bot.calcLink', lang), url: `${site}?svc=${svc || 'event'}&lang=${lang}#calculator` }]);
      else if (kind === 'brief') rows.push([{ text: '📝 ' + KB.text('bot.briefLink', lang), url: `${site}?lang=${lang}#brief` }]);
      else if (kind === 'manager') rows.push([{ text: '👤 ' + KB.text('act.manager', lang), callback_data: 'm' }]);
      else if (kind === 'ig') rows.push([{ text: KB.text('act.ig', lang), url: KB.links.ig }]);
      else if (kind === 'date') rows.push([{ text: '📅 ' + KB.text('act.date', lang), callback_data: 'd' }]);
      else if (kind === 'quick') rows.push([{ text: KB.text('act.quick', lang), callback_data: 'quick' }]);
    });
    return rows;
  }
  async privateAnswer(chatId, id, lang, uid) {
    const a = KB.answer(id, lang);
    if (!a) return;
    if (id === 'human') return this.privateManager(chatId, uid, null, lang);
    if (id === 'dates') {
      this.kvSet('stage:' + uid, 'date');
      await this.sendPrivate(chatId, a.text + '\n\n' + KB.text('askDate', lang));
      return;
    }
    await this.sendPrivate(chatId, a.text, this.actButtons(a.act, lang));
  }
  async privateManager(chatId, uid, from, lang) {
    const sid = 'tg:' + uid;
    const d = this.dialog(sid);
    if (d && d.status === 'open') { await this.sendPrivate(chatId, KB.text('inDialog', lang)); return; }
    const saved = JSON.parse(this.kvGet('user:' + uid) || '{}');
    const name = saved.name || clip([from && from.first_name, from && from.last_name].filter(Boolean).join(' '), LIMITS.nameLen) || 'Клиент';
    const contact = saved.contact || (from && from.username ? '@' + from.username : null);
    this.kvSet('user:' + uid, JSON.stringify({ name, contact }));
    if (!contact) {
      this.kvSet('stage:' + uid, 'contact');
      await this.sendPrivate(chatId, (KB.isOpen() ? '' : KB.text('offHours', lang) + '\n\n') + KB.text('askContact', lang));
      return;
    }
    if (!this.rate('tgcall:' + uid, 3, 600e3)) return;
    const history = this.all("SELECT who, text FROM messages WHERE sid = ? ORDER BY id DESC LIMIT 8", sid).reverse();
    const r = await this.openDialog({ sid, kind: 'tg', tgUser: uid, name, contact, lang, calc: '', date: saved.date || '', history });
    await this.sendPrivate(chatId, r.ok ? KB.text(KB.isOpen() ? 'connecting' : 'offHoursSent', lang) : KB.text('sendFail', lang));
  }
  async onPrivate(msg) {
    const uid = msg.from.id;
    const chatId = msg.chat.id;
    const lang = tgLang(msg.from.language_code);
    const text = clip(msg.text || msg.caption || '', LIMITS.msgLen);
    if (!this.rate('tg:' + uid, LIMITS.tgPerUser5min, 300e3)) return;
    const sid = 'tg:' + uid;
    const d = this.dialog(sid);

    if (/^\/start\b/.test(text)) {
      this.kvSet('stage:' + uid, null);
      await this.sendPrivate(chatId, KB.text('greeting', lang), this.quickButtons(lang));
      return;
    }
    // Открыт диалог с менеджером — пересылаем в группу
    if (d && d.status === 'open') {
      if (!text) { await this.sendPrivate(chatId, KB.text('sendFail', lang)); return; }
      this.addMsg(sid, 'client', d.name, text);
      await this.toGroup(d, `💬 <b>${esc(d.name)}:</b> ${esc(text)}`);
      return;
    }
    if (!text) return;
    // Храним сообщения клиента, чтобы показать их менеджеру при вызове
    if (!d) this.run("INSERT OR IGNORE INTO dialogs (sid, kind, tg_user, name, lang, status, created, updated) VALUES (?, 'tg', ?, ?, ?, 'new', ?, ?)", sid, uid, clip(msg.from.first_name, 40), lang, Date.now(), Date.now());
    this.addMsg(sid, 'client', null, text);
    this.run('DELETE FROM messages WHERE sid = ? AND id NOT IN (SELECT id FROM messages WHERE sid = ? ORDER BY id DESC LIMIT 40)', sid, sid);

    const stage = this.kvGet('stage:' + uid);
    if (stage === 'date') {
      this.kvSet('stage:' + uid, null);
      const saved = JSON.parse(this.kvGet('user:' + uid) || '{}');
      saved.date = clip(text, 80);
      this.kvSet('user:' + uid, JSON.stringify(saved));
      await this.sendPrivate(chatId, KB.text('gotDate', lang, { date: saved.date }), this.actButtons(['manager'], lang));
      return;
    }
    if (stage === 'contact') {
      const c = validContact(text);
      if (!c) { await this.sendPrivate(chatId, KB.text('badContact', lang)); return; }
      this.kvSet('stage:' + uid, null);
      const saved = JSON.parse(this.kvGet('user:' + uid) || '{}');
      saved.contact = c;
      this.kvSet('user:' + uid, JSON.stringify(saved));
      await this.privateManager(chatId, uid, msg.from, lang);
      return;
    }
    const hit = KB.search(text);
    if (!hit) { await this.sendPrivate(chatId, KB.text('noMatch', lang), this.actButtons(['manager'], lang)); return; }
    if (hit.id === 'hello') { await this.sendPrivate(chatId, KB.text('greeting', lang), this.quickButtons(lang)); return; }
    await this.privateAnswer(chatId, hit.id, lang, uid);
  }
  async onPrivateCallback(cq, answer) {
    const uid = cq.from.id;
    const chatId = cq.message.chat.id;
    const lang = tgLang(cq.from.language_code);
    const data = String(cq.data || '');
    await answer();
    if (!this.rate('tg:' + uid, LIMITS.tgPerUser5min, 300e3)) return;
    if (data.indexOf('q|') === 0) return this.privateAnswer(chatId, data.slice(2), lang, uid);
    if (data === 'm') return this.privateManager(chatId, uid, cq.from, lang);
    if (data === 'd') { this.kvSet('stage:' + uid, 'date'); return this.sendPrivate(chatId, KB.text('askDate', lang)); }
    if (data === 'quick') return this.sendPrivate(chatId, KB.text('greeting', lang), this.quickButtons(lang));
  }
}
