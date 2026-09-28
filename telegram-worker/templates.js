// MUST MOVIE MEDIA — шаблоны ответов менеджера.
// Отправляются клиенту на его языке: кнопками под уведомлением или командой /t <код> в теме диалога.
// Подстановки: {клиент} — имя клиента, {менеджер} — имя менеджера, {расчёт} — расчёт калькулятора,
// {бриф} — ссылка на бриф на сайте.
// Чтобы добавить шаблон: скопируйте блок, придумайте новый код латиницей и заполните ru / uz / en.
// Команда /templates в группе покажет все коды.

export const TEMPLATES = {
  greet: {
    title: '👋 Приветствие',
    ru: 'Здравствуйте, {клиент}! Меня зовут {менеджер}, я менеджер MUST MOVIE MEDIA. Спасибо, что написали — с удовольствием помогу с проектом. Расскажите в двух словах, что хотите снять?',
    uz: 'Assalomu alaykum, {клиент}! Mening ismim {менеджер}, men MUST MOVIE MEDIA menejeriman. Yozganingiz uchun rahmat — loyihangizda mamnuniyat bilan yordam beraman. Nimani suratga olmoqchi ekaningizni qisqacha aytib bering?',
    en: 'Hello, {клиент}! I\'m {менеджер}, a manager at MUST MOVIE MEDIA. Thank you for reaching out — I\'d be glad to help with your project. Could you tell me in a few words what you\'d like to film?'
  },
  details: {
    title: '📋 Уточнить детали',
    ru: '{клиент}, чтобы посчитать точно, подскажите, пожалуйста: дату и место съёмки, сколько по времени и что нужно на выходе — ролики, фото, эфир. Если есть референсы, пришлите ссылки — так мы быстрее попадём в ваше видение.',
    uz: '{клиент}, aniq hisoblash uchun iltimos, ayting: suratga olish sanasi va joyi, qancha vaqt va natijada nima kerak — roliklar, foto, efir. Namunalar bo\'lsa, havolalarni yuboring — shunda g\'oyangizni tezroq tushunamiz.',
    en: '{клиент}, to give you an exact quote, could you share the date and location, how long the shoot is, and what you need at the end — clips, photos, a live stream? If you have references, send the links — it helps us match your vision faster.'
  },
  calc: {
    title: '💰 Отправить расчёт',
    ru: '{клиент}, по вашему расчёту в калькуляторе: {расчёт}. Это ориентир — точную смету пришлю после пары уточнений. Удобнее обсудить детали здесь или созвониться?',
    uz: '{клиент}, kalkulyatordagi hisobingiz bo\'yicha: {расчёт}. Bu taxminiy narx — aniq smetani bir-ikki savoldan keyin yuboraman. Tafsilotlarni shu yerda muhokama qilamizmi yoki qo\'ng\'iroq qilamizmi?',
    en: '{клиент}, based on your calculator estimate: {расчёт}. That\'s a guide — I\'ll send the exact estimate after a couple of questions. Would you prefer to discuss the details here or on a call?'
  },
  call: {
    title: '📅 Предложить созвон',
    ru: '{клиент}, давайте созвонимся на 10–15 минут — так быстрее обсудить идею и бюджет. Напишите удобное время и номер телефона, я наберу.',
    uz: '{клиент}, keling, 10–15 daqiqaga qo\'ng\'iroqlashamiz — g\'oya va byudjetni shunday tezroq muhokama qilamiz. Qulay vaqt va telefon raqamingizni yozing, o\'zim qo\'ng\'iroq qilaman.',
    en: '{клиент}, let\'s have a quick 10–15 minute call — it\'s the fastest way to talk through the idea and budget. Send me a convenient time and your phone number and I\'ll call you.'
  },
  brief: {
    title: '📝 Прислать бриф',
    ru: '{клиент}, чтобы ничего не упустить, заполните, пожалуйста, короткий бриф — 3 минуты: {бриф}',
    uz: '{клиент}, hech narsani o\'tkazib yubormaslik uchun qisqa brifni to\'ldiring — 3 daqiqa: {бриф}',
    en: '{клиент}, so we don\'t miss anything, please fill in our short brief — it takes 3 minutes: {бриф}'
  },
  bye: {
    title: '🙏 Попрощаться',
    ru: 'Спасибо за разговор, {клиент}! Если появятся вопросы — пишите в любое время. Хорошего дня! {менеджер}, MUST MOVIE MEDIA',
    uz: 'Suhbat uchun rahmat, {клиент}! Savollar bo\'lsa — istalgan vaqtda yozing. Kuningiz xayrli o\'tsin! {менеджер}, MUST MOVIE MEDIA',
    en: 'Thank you for the chat, {клиент}! If anything comes up, write any time. Have a great day! {менеджер}, MUST MOVIE MEDIA'
  }
};

// Кнопки под уведомлением о новом диалоге
export const BUTTON_TEMPLATES = ['greet', 'details', 'calc', 'call'];

export function fillTemplate(code, lang, vars) {
  const t = TEMPLATES[code];
  if (!t) return null;
  const text = t[lang] || t.ru;
  return text
    .replace(/\{клиент\}/g, vars.client || '')
    .replace(/\{менеджер\}/g, vars.manager || 'MUST MOVIE MEDIA')
    .replace(/\{расчёт\}/g, vars.calc || '—')
    .replace(/\{бриф\}/g, vars.brief || '');
}
