// MUST MOVIE MEDIA — база знаний для чата на сайте и Telegram-бота.
// Один файл на всё: сайт подключает его как window.MMM_KB, воркер (telegram-worker) — через require.
// Цены берутся из plans.js, поэтому при изменении цен здесь ничего править не нужно.
//
// ─────────────────────────────────────────────────────────────────────────────
// КАК ДОБАВИТЬ ВОПРОС (без программиста)
//  1. Найдите ниже список ITEMS и скопируйте любой блок от «{ id:» до «},».
//  2. Поменяйте id — одно слово латиницей, например 'parking'. Id не должны повторяться.
//  3. q — как вопрос выглядит на кнопке (ru / uz / en).
//  4. keys — слова, по которым вопрос находится, когда клиент пишет сам. Пишите строчными
//     буквами и можно только начало слова: 'парков' найдёт «парковка», «парковку».
//     Слова на всех трёх языках — в одном списке. Знак ~ в начале слова — «слабое» слово
//     (весит вдвое меньше): так «сколько стоит» у разных услуг не перебивает главное слово.
//  5. a — ответ (ru / uz / en). Цены вставляются сами:
//       {min:foto}  {min:video}  {min:smm}  {min:ev}  — «от …» по категории;
//       {price:video-pro}  — цена конкретного пакета из plans.js.
//  6. act — кнопки под ответом: 'calc:event' | 'calc:reels' | 'calc:photo' | 'calc:smm' |
//     'calc:live' | 'calc:aerial' (калькулятор), 'brief' (бриф), 'manager' (позвать менеджера),
//     'ig' (Instagram), 'date' (спросить дату).
//  7. Чтобы вопрос стал кнопкой быстрого ответа — впишите его id в QUICK.
//  8. Сохраните и закоммитьте. Чат на сайте обновится сразу, бот — после `npx wrangler deploy`.
// Кавычки в тексте — «ёлочки» или \' (обратная косая перед апострофом, как в uz-текстах).
// ─────────────────────────────────────────────────────────────────────────────
var MMM_KB = (function () {
  'use strict';

  var PLANS = (typeof window !== 'undefined' && window.MMM_PLANS) ||
    (typeof require === 'function' ? require('./plans.js') : {});

  // Рабочее время менеджеров (Ташкент, UTC+5). days: 0 — воскресенье … 6 — суббота.
  var HOURS = { utcOffset: 5, from: 10, to: 20, days: [0, 1, 2, 3, 4, 5, 6] };

  var LINKS = {
    tg: 'https://t.me/mmm_brief_bot',
    ig: 'https://www.instagram.com/mmm_creative_production/',
    direct: 'https://ig.me/m/mmm_creative_production'
  };

  // Какие вопросы показываем кнопками сразу
  var QUICK = ['price_event', 'price_reels', 'dates', 'deadlines', 'revisions', 'clients', 'process', 'travel'];

  var ITEMS = [
    { id: 'price_event',
      q: { ru: 'Сколько стоит съёмка мероприятия?', uz: 'Tadbirni suratga olish qancha turadi?', en: 'How much does event filming cost?' },
      keys: ['мероприят', 'ивент', 'event', 'свадьб', 'конференц', 'форум', 'корпоратив', 'праздник', 'юбилей', 'tadbir', 'toy', 'bayram', 'konferens', 'wedding', 'conference', '~стоит', '~цен', '~сколько', '~narx', '~qancha', '~cost', '~price', '~how much'],
      a: {
        ru: 'Мероприятия — от {min:ev} за день: «Исторический 3», до 100 гостей, 2 оператора и 2 фотографа, до 6 часов. Крупнее — «Исторический 2» {price:ev-hist2}, «Исторический 1» {price:ev-hist1} и «Блокбастер» с прямым эфиром {price:ev-blockbuster}. Точную смету считаем после брифа.',
        uz: 'Tadbirlar — kuniga {min:ev} dan: «Tarixiy 3», 100 tagacha mehmon, 2 operator va 2 fotograf, 6 soatgacha. Kattaroq — «Tarixiy 2» {price:ev-hist2}, «Tarixiy 1» {price:ev-hist1} va jonli efirli «Blokbaster» {price:ev-blockbuster}. Aniq smetani brifdan keyin hisoblaymiz.',
        en: 'Events start from {min:ev} per day: “Historic 3” — up to 100 guests, 2 camera operators and 2 photographers, up to 6 hours. Bigger: “Historic 2” {price:ev-hist2}, “Historic 1” {price:ev-hist1} and “Blockbuster” with a live stream {price:ev-blockbuster}. We calculate the exact estimate after the brief.'
      },
      act: ['calc:event', 'brief'] },

    { id: 'price_reels',
      q: { ru: 'Сколько стоит Reels / реклама?', uz: 'Reels / reklama qancha turadi?', en: 'How much do Reels / ads cost?' },
      keys: ['reels', 'рилс', 'рилз', 'ролик', 'реклам', 'видео', 'клип', 'stories', 'сторис', 'reklama', 'rolik', 'video', 'ad', 'ads', 'commercial', '~стоит', '~цен', '~сколько', '~narx', '~qancha', '~cost', '~price', '~how much'],
      a: {
        ru: 'Reels — пакетом на месяц: Video Start {price:video-start} (4 Reels + 8 Stories), Video Pro {price:video-pro} (6 Reels + сюжет со сценарием), Video Premium {price:video-premium} (9 Reels + имиджевый ролик). Рекламный ролик считаем индивидуально: всё зависит от сценария, актёров и локаций.',
        uz: 'Reels — oylik paket: Video Start {price:video-start} (4 Reels + 8 Stories), Video Pro {price:video-pro} (6 Reels + ssenariyli syujet), Video Premium {price:video-premium} (9 Reels + imidj rolik). Reklama rolikini alohida hisoblaymiz: hammasi ssenariy, aktyorlar va lokatsiyalarga bog\'liq.',
        en: 'Reels come as a monthly package: Video Start {price:video-start} (4 Reels + 8 Stories), Video Pro {price:video-pro} (6 Reels + a scripted story), Video Premium {price:video-premium} (9 Reels + a brand film). A commercial is quoted individually — it depends on the script, cast and locations.'
      },
      act: ['calc:reels', 'brief'] },

    { id: 'dates',
      q: { ru: 'Какие даты свободны?', uz: 'Qaysi sanalar bo\'sh?', en: 'Which dates are available?' },
      keys: ['дат', 'свобод', 'числ', 'календар', 'занят', 'когда можете', 'sana', 'bo\'sh', 'band', 'date', 'available', 'free', 'calendar', 'booking'],
      a: {
        ru: 'Календарь съёмок ведёт менеджер. Напишите желаемую дату — проверим и вернёмся с ответом.',
        uz: 'Suratga olish taqvimini menejer yuritadi. Kerakli sanani yozing — tekshirib, javob beramiz.',
        en: 'Our manager keeps the shooting calendar. Tell us the date you have in mind — we\'ll check and get back to you.'
      },
      act: ['date'] },

    // TODO: общие сроки сдачи не утверждены (на сайте — заглушка faq.a6). Сейчас ответ собран из сроков в пакетах plans.js.
    { id: 'deadlines',
      q: { ru: 'Сроки готовности', uz: 'Tayyor bo\'lish muddati', en: 'Turnaround time' },
      keys: ['срок', 'готов', 'быстро', 'сколько дней', 'когда будет', 'сдач', 'muddat', 'tayyor', 'qachon', 'deadline', 'turnaround', 'ready', 'how long', 'when'],
      a: {
        ru: 'Зависит от формата: Reels — 3–5 рабочих дней после съёмки, фото — 5–7 рабочих дней (превью — через 48 часов), вертикальные ролики с мероприятия — от 24–48 часов, отчётный ролик — 7–14 дней. Точные сроки согласуем до старта.',
        uz: 'Formatga bog\'liq: Reels — suratga olishdan keyin 3–5 ish kuni, foto — 5–7 ish kuni (prevyu — 48 soatda), tadbirdan vertikal roliklar — 24–48 soatdan, hisobot rolik — 7–14 kun. Aniq muddatlarni boshlashdan oldin kelishamiz.',
        en: 'It depends on the format: Reels — 3–5 working days after the shoot, photos — 5–7 working days (preview within 48 hours), vertical event clips — from 24–48 hours, event recap film — 7–14 days. We agree exact dates before we start.'
      },
      act: ['brief', 'manager'] },

    // TODO: общая политика правок не утверждена (заглушка faq.a7). Ответ — по условиям пакетов в plans.js.
    { id: 'revisions',
      q: { ru: 'Сколько правок?', uz: 'Nechta tuzatish?', en: 'How many revisions?' },
      keys: ['правк', 'правок', 'исправ', 'переделат', 'доработ', 'tuzatish', 'o\'zgartir', 'revision', 'edits', 'changes', 'fix'],
      a: {
        ru: 'По видео — 1 круг правок на каждый ролик в пакетах Start и 2 круга в Pro и Premium. По фото — 1–2 круга правок по ретуши. В индивидуальных проектах количество правок фиксируем в договоре.',
        uz: 'Video bo\'yicha — Start paketlarida har bir rolikka 1 bosqich tuzatish, Pro va Premiumda 2 bosqich. Foto bo\'yicha — retush bo\'yicha 1–2 bosqich. Individual loyihalarda tuzatishlar soni shartnomada belgilanadi.',
        en: 'Video: 1 round of revisions per clip in Start packages and 2 rounds in Pro and Premium. Photos: 1–2 rounds of retouching revisions. For custom projects the number of revisions is set in the contract.'
      },
      act: ['brief', 'manager'] },

    // TODO: список клиентов и кейсов не заполнен. Когда появится — перечислите здесь (только реальных клиентов с их согласия).
    { id: 'clients',
      q: { ru: 'С кем работали?', uz: 'Kim bilan ishlagansiz?', en: 'Who have you worked with?' },
      keys: ['работали', 'клиент', 'кейс', 'портфолио', 'пример', 'отзыв', 'mijoz', 'keys', 'portfolio', 'misol', 'client', 'case', 'example', 'work'],
      a: {
        ru: 'Снимаем для брендов, бизнеса и частных мероприятий — от Reels и рекламы до ивентов на 250+ гостей с прямым эфиром. Кейсы для сайта сейчас собираем, а свежие работы — в Instagram @mmm_creative_production. Менеджер пришлёт примеры именно под вашу задачу.',
        uz: 'Brendlar, biznes va xususiy tadbirlar uchun suratga olamiz — Reels va reklamadan tortib, jonli efirli 250+ mehmonli tadbirlargacha. Sayt uchun keyslarni hozir yig\'yapmiz, yangi ishlarimiz — Instagram\'da @mmm_creative_production. Menejer aynan sizning vazifangizga mos misollarni yuboradi.',
        en: 'We film for brands, businesses and private events — from Reels and ads to 250+ guest events with a live stream. We\'re putting the case studies together for the site; our latest work is on Instagram @mmm_creative_production. A manager will send examples that match your task.'
      },
      act: ['ig', 'manager'] },

    { id: 'process',
      q: { ru: 'Как проходит работа?', uz: 'Ish qanday o\'tadi?', en: 'How does it work?' },
      keys: ['процесс', 'этап', 'как работа', 'как проход', 'начать', 'с чего', 'порядок', 'jarayon', 'bosqich', 'qanday', 'boshla', 'process', 'steps', 'start', 'how does', 'workflow'],
      a: {
        ru: 'Пять шагов: бриф → идея и смета → съёмка → монтаж и цвет → сдача. Проще всего начать с брифа — 3 минуты, и мы вернёмся с идеей, сметой и сроками.',
        uz: 'Besh qadam: brif → g\'oya va smeta → suratga olish → montaj va rang → topshirish. Brifdan boshlash eng oson — 3 daqiqa, biz g\'oya, smeta va muddatlar bilan qaytamiz.',
        en: 'Five steps: brief → idea and estimate → shoot → edit and colour → delivery. The easiest start is the brief — 3 minutes, and we\'ll come back with an idea, an estimate and timing.'
      },
      act: ['brief'] },

    // TODO: границы «зоны» и тариф на выезд не указаны. Сейчас ответ опирается только на строку «Транспорт за пределами зоны» из доп. услуг.
    { id: 'travel',
      q: { ru: 'Выезжаете за город?', uz: 'Shahar tashqarisiga chiqasizmi?', en: 'Do you travel outside the city?' },
      keys: ['выезд', 'выезжа', 'за город', 'регион', 'област', 'другой город', 'самарканд', 'бухар', 'транспорт', 'viloyat', 'shahar tashqari', 'safar', 'travel', 'outside', 'region', 'another city', 'trip'],
      a: {
        ru: 'Да. По Ташкенту выезжаем без доплаты, за город и в другие регионы Узбекистана — тоже: транспорт (и проживание, если съёмка на несколько дней) посчитаем отдельно в смете. Напишите, куда и когда нужно ехать.',
        uz: 'Ha. Toshkent bo\'ylab qo\'shimcha to\'lovsiz boramiz, shahar tashqarisiga va O\'zbekistonning boshqa viloyatlariga ham: transport (va bir necha kunlik suratga olishda yashash) smetada alohida hisoblanadi. Qayerga va qachon borish kerakligini yozing.',
        en: 'Yes. Anywhere in Tashkent at no extra charge, and we also travel out of town and to other regions of Uzbekistan: transport (and accommodation for multi-day shoots) is listed separately in the estimate. Tell us where and when.'
      },
      act: ['manager', 'brief'] },

    { id: 'price_photo',
      q: { ru: 'Сколько стоит фотосъёмка?', uz: 'Fotosurat qancha turadi?', en: 'How much is a photo shoot?' },
      keys: ['фото', 'фотосъём', 'фотограф', 'снимк', 'каталог', 'предметн', 'портрет', 'surat', 'foto', 'photo', 'photographer', '~стоит', '~цен', '~сколько', '~narx', '~qancha', '~cost', '~price', '~how much'],
      a: {
        ru: 'Фото — от {min:foto}: Foto Start {price:foto-start} — смена до 4 часов, 25–30 обработанных фото; Foto Pro {price:foto-pro} — до 2 смен, 50 фото. Каталог, команду и интерьеры считаем индивидуально.',
        uz: 'Foto — {min:foto} dan: Foto Start {price:foto-start} — 4 soatgacha smena, 25–30 ta ishlov berilgan surat; Foto Pro {price:foto-pro} — 2 smenagacha, 50 ta surat. Katalog, jamoa va interyerlarni alohida hisoblaymiz.',
        en: 'Photo starts from {min:foto}: Foto Start {price:foto-start} — one shift up to 4 hours, 25–30 edited photos; Foto Pro {price:foto-pro} — up to 2 shifts, 50 photos. Catalogues, team portraits and interiors are quoted individually.'
      },
      act: ['calc:photo', 'brief'] },

    { id: 'price_smm',
      q: { ru: 'Сколько стоит SMM?', uz: 'SMM qancha turadi?', en: 'How much is SMM?' },
      keys: ['smm', 'смм', 'соцсет', 'инстаграм вест', 'ведение', 'контент', 'ijtimoiy', 'kontent', 'social', 'content', '~стоит', '~цен', '~сколько', '~narx', '~qancha', '~cost', '~price', '~how much'],
      a: {
        ru: 'SMM (фото + видео) — от {min:smm}: Start {price:smm-start}, Pro {price:smm-pro}, Premium {price:smm-premium}. За предоплату — скидка 7% / 12% / 18% за 3 / 6 / 12 месяцев.',
        uz: 'SMM (foto + video) — {min:smm} dan: Start {price:smm-start}, Pro {price:smm-pro}, Premium {price:smm-premium}. Oldindan to\'lovda — 3 / 6 / 12 oy uchun 7% / 12% / 18% chegirma.',
        en: 'SMM (photo + video) starts from {min:smm}: Start {price:smm-start}, Pro {price:smm-pro}, Premium {price:smm-premium}. Prepay 3 / 6 / 12 months and save 7% / 12% / 18%.'
      },
      act: ['calc:smm', 'brief'] },

    { id: 'price_general',
      q: { ru: 'Сколько стоит съёмка?', uz: 'Suratga olish qancha turadi?', en: 'How much does it cost?' },
      keys: ['стоит', 'стоимост', 'цен', 'прайс', 'бюджет', 'сколько', 'narx', 'qancha', 'byudjet', 'price', 'cost', 'budget', 'how much'],
      a: {
        ru: 'Фото — от {min:foto}, видео для соцсетей — от {min:video}, SMM — от {min:smm}, мероприятия — от {min:ev} за день. Точную смету считаем после брифа, а ориентир покажет калькулятор.',
        uz: 'Foto — {min:foto} dan, ijtimoiy tarmoqlar uchun video — {min:video} dan, SMM — {min:smm} dan, tadbirlar — kuniga {min:ev} dan. Aniq smetani brifdan keyin hisoblaymiz, taxminiy narxni kalkulyator ko\'rsatadi.',
        en: 'Photo from {min:foto}, social media video from {min:video}, SMM from {min:smm}, events from {min:ev} per day. We calculate the exact estimate after the brief; the calculator gives you a guide.'
      },
      act: ['calc:event', 'brief'] },

    { id: 'live',
      q: { ru: 'Делаете прямые трансляции?', uz: 'Jonli efir qilasizmi?', en: 'Do you do live streams?' },
      keys: ['эфир', 'трансляц', 'стрим', 'онлайн', 'live', 'stream', 'efir', 'jonli', 'translyats'],
      a: {
        ru: 'Да, делаем прямой эфир с режиссёром и техником — отдельно или в пакете «Блокбастер». Ориентир по бюджету покажет калькулятор.',
        uz: 'Ha, rejissyor va texnik bilan jonli efir qilamiz — alohida yoki «Blokbaster» paketida. Taxminiy byudjetni kalkulyator ko\'rsatadi.',
        en: 'Yes, we run live streams with a director and a technician — on their own or as part of the “Blockbuster” package. The calculator gives a budget guide.'
      },
      act: ['calc:live', 'brief'] },

    { id: 'aerial',
      q: { ru: 'Есть аэросъёмка?', uz: 'Havodan suratga olish bormi?', en: 'Do you do aerial filming?' },
      keys: ['дрон', 'аэро', 'квадро', 'fpv', 'сверху', 'коптер', 'dron', 'havodan', 'drone', 'aerial'],
      a: {
        ru: 'Да: классический дрон и FPV, с лицензией на аэросъёмку. Можно отдельно или как опцию к любой съёмке.',
        uz: 'Ha: klassik dron va FPV, havodan suratga olish litsenziyasi bilan. Alohida yoki istalgan suratga olishga qo\'shimcha sifatida.',
        en: 'Yes: a classic drone and FPV, with an aerial filming licence. On its own or as an add-on to any shoot.'
      },
      act: ['calc:aerial', 'brief'] },

    { id: 'discounts',
      q: { ru: 'Есть скидки?', uz: 'Chegirmalar bormi?', en: 'Any discounts?' },
      keys: ['скидк', 'акци', 'дешевл', 'предоплат', 'chegirma', 'arzon', 'aksiya', 'discount', 'cheaper', 'deal'],
      a: {
        ru: 'Да: −7% / −12% / −18% при предоплате SMM за 3 / 6 / 12 месяцев.',
        uz: 'Ha: SMM uchun 3 / 6 / 12 oy oldindan to\'lovda −7% / −12% / −18%.',
        en: 'Yes: −7% / −12% / −18% when you prepay SMM for 3 / 6 / 12 months.'
      },
      act: ['calc:smm', 'manager'] },

    { id: 'extras',
      q: { ru: 'Что оплачивается отдельно?', uz: 'Nima alohida to\'lanadi?', en: 'What is charged separately?' },
      keys: ['отдельно', 'дополнит', 'доплат', 'модел', 'локац', 'визаж', 'стилист', 'реквизит', 'таргет', 'alohida', 'qo\'shimcha', 'model', 'lokats', 'separately', 'extra', 'additional', 'props'],
      a: {
        ru: 'Отдельно оплачиваются: модели и блогеры, аренда локаций, сложный реквизит, визажисты и стилисты, транспорт за пределами зоны, таргет и рекламный бюджет.',
        uz: 'Alohida to\'lanadi: modellar va blogerlar, lokatsiya ijarasi, murakkab rekvizit, vizajistlar va stilistlar, hududdan tashqariga transport, target va reklama byudjeti.',
        en: 'Charged separately: models and influencers, location rental, complex props, make-up artists and stylists, transport outside the zone, targeting and ad budget.'
      },
      act: ['brief'] },

    { id: 'team',
      q: { ru: 'Кто в команде?', uz: 'Jamoada kimlar bor?', en: 'Who is on the team?' },
      keys: ['команд', 'кто вы', 'основател', 'оператор', 'сценарист', 'jamoa', 'kimlar', 'team', 'founder', 'who are you'],
      a: {
        ru: 'Сооснователи — Georgis Georgiadi и Vladimir Zalesskiy, сценарист (Story developer) — Aleksandr Veselov, фотограф — Azamat Djavadov, видеограф — Ibragim Kamilov.',
        uz: 'Hammuassislar — Georgis Georgiadi va Vladimir Zalesskiy, ssenariynavis (Story developer) — Aleksandr Veselov, fotograf — Azamat Djavadov, videograf — Ibragim Kamilov.',
        en: 'Co-founders Georgis Georgiadi and Vladimir Zalesskiy, story developer Aleksandr Veselov, photographer Azamat Djavadov, videographer Ibragim Kamilov.'
      },
      act: ['brief'] },

    // TODO: условия договора и порядок оплаты не заполнены (заглушки guar.1 и guar.4).
    { id: 'payment',
      q: { ru: 'Как оплатить?', uz: 'Qanday to\'lash mumkin?', en: 'How do I pay?' },
      keys: ['оплат', 'платит', 'договор', 'счёт', 'счет', 'перечисл', 'наличн', 'to\'lov', 'to\'la', 'shartnoma', 'hisob', 'pay', 'payment', 'contract', 'invoice'],
      a: {
        ru: 'Условия договора и порядок оплаты менеджер пришлёт вместе со сметой.',
        uz: 'Shartnoma shartlari va to\'lov tartibini menejer smeta bilan birga yuboradi.',
        en: 'A manager will send the contract terms and payment details together with the estimate.'
      },
      act: ['manager'] },

    { id: 'contact',
      q: { ru: 'Как с вами связаться?', uz: 'Siz bilan qanday bog\'lanish mumkin?', en: 'How can I reach you?' },
      keys: ['телефон', 'номер', 'позвон', 'звонок', 'созвон', 'связат', 'адрес', 'офис', 'где наход', 'telefon', 'raqam', 'qo\'ng\'iroq', 'manzil', 'phone', 'call', 'address', 'office', 'contact'],
      a: {
        ru: 'Удобнее всего прямо здесь: оставьте имя и контакт — менеджер напишет или договорится о созвоне. Ещё можно в Telegram @mmm_brief_bot или в Direct.',
        uz: 'Eng qulayi — shu yerda: ism va kontaktingizni qoldiring — menejer yozadi yoki qo\'ng\'iroqni kelishadi. Telegram @mmm_brief_bot yoki Direct orqali ham mumkin.',
        en: 'The easiest way is right here: leave your name and contact — a manager will message you or set up a call. You can also use Telegram @mmm_brief_bot or Instagram Direct.'
      },
      act: ['manager'] },

    { id: 'human',
      q: { ru: 'Позвать менеджера', uz: 'Menejerni chaqirish', en: 'Call a manager' },
      keys: ['менеджер', 'человек', 'оператор чата', 'живой', 'сотрудник', 'menejer', 'odam', 'xodim', 'manager', 'human', 'person', 'agent'],
      a: {
        ru: 'Конечно, подключу менеджера.',
        uz: 'Albatta, menejerni ulayman.',
        en: 'Of course, I\'ll bring in a manager.'
      },
      act: ['manager'] },

    // Примерные ответы (добавлены 28.09) — уточнить у команды и поправить при необходимости.
    { id: 'script',
      q: { ru: 'Поможете с идеей и сценарием?', uz: 'G\'oya va ssenariyda yordam berasizmi?', en: 'Can you help with the idea and script?' },
      keys: ['сценар', 'иде', 'концепц', 'креатив', 'придума', 'сюжет', 'ssenariy', 'g\'oya', 'kontseps', 'script', 'idea', 'concept', 'creative', 'story'],
      a: {
        ru: 'Да, это наша сильная сторона: в команде свой сценарист (Story developer). Придумаем концепцию, напишем сценарий и раскадровку — ролики строятся на истории, а не на случайных кадрах.',
        uz: 'Ha, bu bizning kuchli tomonimiz: jamoada o\'z ssenaristimiz (Story developer) bor. Konsepsiyani o\'ylab topamiz, ssenariy va raskadrovka yozamiz — roliklar tasodifiy kadrlarga emas, hikoyaga quriladi.',
        en: 'Yes, that\'s our strength: we have our own story developer. We\'ll come up with the concept, write the script and storyboard — our videos are built on a story, not on random shots.'
      },
      act: ['brief', 'manager'] },

    { id: 'event_team',
      q: { ru: 'Сколько операторов и фото на мероприятии?', uz: 'Tadbirda nechta operator va foto?', en: 'How many camera operators and photos at an event?' },
      keys: ['сколько оператор', 'сколько фото', 'сколько человек', 'масштаб', 'крупн', 'гостей', 'nechta operator', 'mehmon', 'how many', 'guests', 'crew'],
      a: {
        ru: 'Команду подбираем под масштаб: на небольшом событии — 2 оператора и 2 фотографа, на крупном — до 8 операторов, 3 фотографов и режиссёр трансляции. С большого мероприятия — 200+ обработанных фото, вертикальные ролики и отчётный фильм.',
        uz: 'Jamoani ko\'lamga qarab tanlaymiz: kichik tadbirda — 2 operator va 2 fotograf, katta tadbirda — 8 tagacha operator, 3 fotograf va efir rejissyori. Katta tadbirdan — 200+ ishlov berilgan foto, vertikal roliklar va hisobot filmi.',
        en: 'We size the crew to the event: a small one gets 2 camera operators and 2 photographers, a large one up to 8 operators, 3 photographers and a live-stream director. From a big event you get 200+ edited photos, vertical clips and a recap film.'
      },
      act: ['calc:event', 'brief'] },

    { id: 'urgent',
      q: { ru: 'Можно срочно?', uz: 'Shoshilinch mumkinmi?', en: 'Can you do it urgently?' },
      keys: ['срочн', 'быстрее', 'завтра', 'сегодня', 'горит', 'asap', 'shoshilinch', 'tez', 'ertaga', 'bugun', 'urgent', 'rush', 'tomorrow', 'today'],
      a: {
        ru: 'Постараемся. Если дата свободна, выезжаем даже в короткий срок, а с мероприятия отдаём первые вертикальные ролики за 24–48 часов. Ускоренная сдача монтажа — с наценкой, её видно в калькуляторе. Напишите дату — проверим прямо сейчас.',
        uz: 'Harakat qilamiz. Sana bo\'sh bo\'lsa, qisqa muddatda ham chiqamiz, tadbirdan birinchi vertikal roliklarni 24–48 soatda beramiz. Tezlashtirilgan montaj — qo\'shimcha to\'lov bilan, uni kalkulyatorda ko\'rasiz. Sanani yozing — hozir tekshiramiz.',
        en: 'We\'ll do our best. If the date is free we can come at short notice, and from an event you get the first vertical clips within 24–48 hours. Rush editing has a surcharge — you\'ll see it in the calculator. Tell us the date and we\'ll check right away.'
      },
      act: ['date', 'manager'] },

    { id: 'sources',
      q: { ru: 'Отдаёте исходники?', uz: 'Iskhodniklarni berasizmi?', en: 'Do you hand over raw footage?' },
      keys: ['исходн', 'сырые', 'raw', 'все файлы', 'все кадры', 'без обработ', 'iskhodnik', 'xom', 'barcha fayl', 'source', 'footage', 'raw files'],
      a: {
        ru: 'Да, передача всех исходников — отдельная опция, она есть в калькуляторе. В готовые пакеты входят обработанные фото и смонтированные ролики.',
        uz: 'Ha, barcha iskhodniklarni topshirish — alohida opsiya, u kalkulyatorda bor. Tayyor paketlarga ishlov berilgan foto va montaj qilingan roliklar kiradi.',
        en: 'Yes, handing over all the raw files is a separate option — you\'ll find it in the calculator. Packages include edited photos and finished videos.'
      },
      act: ['calc:event', 'manager'] },

    { id: 'languages',
      q: { ru: 'На каком языке работаете?', uz: 'Qaysi tilda ishlaysiz?', en: 'What languages do you work in?' },
      keys: ['язык', 'узбекск', 'английск', 'русск', 'til', 'o\'zbek', 'ingliz', 'rus', 'language', 'english', 'uzbek', 'russian'],
      a: {
        ru: 'Общаемся и снимаем на русском, узбекском и английском — подписи и субтитры тоже делаем на этих языках.',
        uz: 'Rus, o\'zbek va ingliz tillarida muloqot qilamiz va suratga olamiz — yozuvlar va subtitrlarni ham shu tillarda tayyorlaymiz.',
        en: 'We work and film in Russian, Uzbek and English — captions and subtitles too.'
      },
      act: ['brief'] },

    { id: 'hello',
      q: { ru: 'Здравствуйте', uz: 'Assalomu alaykum', en: 'Hello' },
      keys: ['привет', 'здравств', 'добрый', 'салам', 'салом', 'assalom', 'salom', 'hello', 'hi', 'hey', 'good morning', 'good afternoon'],
      a: {
        ru: 'Здравствуйте! Чем помочь? Выберите вопрос или напишите свой.',
        uz: 'Assalomu alaykum! Qanday yordam beray? Savolni tanlang yoki o\'zingiznikini yozing.',
        en: 'Hello! How can I help? Pick a question or type your own.'
      },
      act: ['quick'] },

    { id: 'thanks',
      q: { ru: 'Спасибо', uz: 'Rahmat', en: 'Thank you' },
      keys: ['спасиб', 'благодар', 'рахмат', 'rahmat', 'raxmat', 'thank', 'thx'],
      a: {
        ru: 'Рады помочь! Если появятся вопросы — пишите, мы на связи.',
        uz: 'Yordam berganimizdan xursandmiz! Savollar bo\'lsa — yozing, aloqadamiz.',
        en: 'Happy to help! If anything else comes up, just write — we\'re here.'
      },
      act: [] }
  ];

  // Тексты чата и бота (одинаковые на сайте и в Telegram)
  var TEXT = {
    title: { ru: 'MUST MOVIE MEDIA · на связи', uz: 'MUST MOVIE MEDIA · aloqada', en: 'MUST MOVIE MEDIA · online' },
    greeting: {
      ru: 'Здравствуйте! Я помощник MUST MOVIE MEDIA. Выберите вопрос или напишите свой',
      uz: 'Assalomu alaykum! Men MUST MOVIE MEDIA yordamchisiman. Savolni tanlang yoki o\'zingiznikini yozing',
      en: 'Hello! I\'m the MUST MOVIE MEDIA assistant. Pick a question or type your own'
    },
    noMatch: { ru: 'Хороший вопрос — лучше ответит менеджер', uz: 'Yaxshi savol — menejer yaxshiroq javob beradi', en: 'Good question — a manager will answer it best' },
    askDate: { ru: 'На какую дату планируете съёмку?', uz: 'Suratga olishni qaysi sanaga rejalashtiryapsiz?', en: 'What date are you planning the shoot for?' },
    gotDate: { ru: 'Записал: {date}. Позвать менеджера, чтобы он проверил дату?', uz: 'Yozib oldim: {date}. Sanani tekshirishi uchun menejerni chaqiraymi?', en: 'Noted: {date}. Shall I call a manager to check the date?' },
    askName: { ru: 'Как к вам обращаться?', uz: 'Sizga qanday murojaat qilaylik?', en: 'What\'s your name?' },
    askContact: { ru: 'Оставьте контакт для связи — @ник в Telegram или телефон', uz: 'Bog\'lanish uchun kontakt qoldiring — Telegram\'dagi @nik yoki telefon', en: 'Leave a contact — your Telegram @username or phone number' },
    badContact: { ru: 'Похоже, это не контакт. Напишите @ник в Telegram или номер телефона', uz: 'Bu kontaktga o\'xshamaydi. Telegram @nik yoki telefon raqamini yozing', en: 'That doesn\'t look like a contact. Please send a Telegram @username or a phone number' },
    connecting: { ru: 'Подключаю менеджера. Обычно отвечаем в течение 15 минут в рабочее время', uz: 'Menejerni ulayapman. Odatda ish vaqtida 15 daqiqa ichida javob beramiz', en: 'Connecting you to a manager. We usually reply within 15 minutes during working hours' },
    offHours: { ru: 'Сейчас мы не на связи — ответим утром. Оставьте контакт', uz: 'Hozir aloqada emasmiz — ertalab javob beramiz. Kontaktingizni qoldiring', en: 'We\'re offline right now — we\'ll reply in the morning. Leave your contact' },
    offHoursSent: { ru: 'Сейчас мы не на связи — ответим утром. Сообщение уже у менеджера', uz: 'Hozir aloqada emasmiz — ertalab javob beramiz. Xabaringiz menejerda', en: 'We\'re offline right now — we\'ll reply in the morning. Your message is with the manager' },
    sendFail: { ru: 'Не получилось отправить. Напишите нам в Telegram или Direct — ответим там', uz: 'Yuborib bo\'lmadi. Bizga Telegram yoki Direct\'ga yozing — o\'sha yerda javob beramiz', en: 'Couldn\'t send that. Message us on Telegram or Instagram Direct — we\'ll reply there' },
    closed: { ru: 'Менеджер завершил диалог. Если появятся вопросы — пишите, мы на связи', uz: 'Menejer suhbatni yakunladi. Savollar bo\'lsa — yozing, aloqadamiz', en: 'The manager has closed the chat. If anything comes up, just write — we\'re here' },
    calcReply: { ru: 'Спасибо! Менеджер уточнит детали и посчитает точную смету. Позвать менеджера?', uz: 'Rahmat! Menejer tafsilotlarni aniqlab, aniq smetani hisoblaydi. Menejerni chaqiraymi?', en: 'Thank you! A manager will check the details and prepare an exact estimate. Shall I call one?' },
    tooFast: { ru: 'Чуть медленнее, пожалуйста — сообщения уходят слишком часто', uz: 'Biroz sekinroq, iltimos — xabarlar juda tez ketyapti', en: 'A little slower, please — messages are going out too fast' },
    placeholder: { ru: 'Напишите вопрос…', uz: 'Savolingizni yozing…', en: 'Type your question…' },
    fab: { ru: 'Спросить', uz: 'So\'rash', en: 'Ask' },
    send: { ru: 'Отправить', uz: 'Yuborish', en: 'Send' },
    close: { ru: 'Закрыть чат', uz: 'Chatni yopish', en: 'Close chat' },
    open: { ru: 'чат с MUST MOVIE MEDIA', uz: 'MUST MOVIE MEDIA bilan chat', en: 'chat with MUST MOVIE MEDIA' },
    unread: { ru: 'новых сообщений: {n}', uz: 'yangi xabarlar: {n}', en: 'new messages: {n}' },
    you: { ru: 'Вы', uz: 'Siz', en: 'You' },
    assistant: { ru: 'Помощник', uz: 'Yordamchi', en: 'Assistant' },
    managerSign: { ru: '{name} — MUST MOVIE MEDIA', uz: '{name} — MUST MOVIE MEDIA', en: '{name} — MUST MOVIE MEDIA' },
    online: { ru: 'Менеджеры на связи 10:00–20:00', uz: 'Menejerlar 10:00–20:00 aloqada', en: 'Managers online 10:00–20:00' },
    offline: { ru: 'Сейчас не рабочее время — ответим утром', uz: 'Hozir ish vaqti emas — ertalab javob beramiz', en: 'Outside working hours — we\'ll reply in the morning' },
    inDialog: { ru: 'Менеджер подключён — пишите сюда', uz: 'Menejer ulangan — shu yerga yozing', en: 'A manager is connected — write here' },
    restart: { ru: 'Начать заново', uz: 'Qaytadan boshlash', en: 'Start over' },
    // Кнопки под ответами
    'act.calc': { ru: 'Рассчитать в калькуляторе', uz: 'Kalkulyatorda hisoblash', en: 'Open the calculator' },
    'act.brief': { ru: 'Заполнить бриф', uz: 'Brifni to\'ldirish', en: 'Fill in the brief' },
    'act.manager': { ru: 'Позвать менеджера', uz: 'Menejerni chaqirish', en: 'Call a manager' },
    'act.ig': { ru: 'Открыть Instagram', uz: 'Instagram\'ni ochish', en: 'Open Instagram' },
    'act.tg': { ru: 'Написать в Telegram', uz: 'Telegram\'da yozish', en: 'Message on Telegram' },
    'act.direct': { ru: 'Написать в Direct', uz: 'Direct\'ga yozish', en: 'Message on Direct' },
    'act.date': { ru: 'Указать дату', uz: 'Sanani ko\'rsatish', en: 'Give a date' },
    'act.quick': { ru: 'Частые вопросы', uz: 'Ko\'p so\'raladigan savollar', en: 'Common questions' },
    // Бот в Telegram
    'bot.site': { ru: 'Открыть сайт', uz: 'Saytni ochish', en: 'Open the website' },
    'bot.calcLink': { ru: 'Калькулятор на сайте', uz: 'Saytdagi kalkulyator', en: 'Calculator on the website' },
    'bot.briefLink': { ru: 'Бриф на сайте — 3 минуты', uz: 'Saytdagi brif — 3 daqiqa', en: 'Brief on the website — 3 minutes' }
  };

  // ---------- Форматирование цен ----------
  var UNIT = { ru: 'млн сум', uz: 'mln so\'m', en: 'M UZS' };
  var PER = { ru: '/ мес', uz: '/ oy', en: '/ mo' };
  var DAY = { ru: 'за день', uz: 'kuniga', en: 'per day' };
  function lang(l) { return l === 'uz' || l === 'en' ? l : 'ru'; }
  function num(v, l) {
    var s = (Math.round(v * 10) / 10).toFixed(1);
    return l === 'en' ? s : s.replace('.', ',');
  }
  function money(p, l) {
    return num(p.price, l) + ' ' + UNIT[l] + (p.per ? ' ' + PER[l] : '');
  }
  function plans(l) { return PLANS[l] || PLANS.ru || {}; }
  function minOf(prefix, l) {
    var all = plans(l), best = null;
    Object.keys(all).forEach(function (id) {
      var p = all[id];
      if (id.indexOf(prefix + '-') === 0 && p.price != null && (!best || p.price < best.price)) best = p;
    });
    return best;
  }
  function fill(text, l) {
    return String(text)
      .replace(/\{min:([a-z]+)\}/g, function (m, k) {
        var p = minOf(k, l);
        // «от» / «dan» / «from» пишет сам текст ответа (в uz оно стоит после числа)
        return p ? money(p, l) : '—';
      })
      .replace(/\{price:([a-z0-9-]+)\}/g, function (m, id) {
        var p = plans(l)[id];
        return p && p.price != null ? money(p, l) : '—';
      });
  }

  // ---------- Поиск по словам (RU / UZ / EN) ----------
  function norm(s) {
    return String(s || '').toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/[ʻʼ‘’`´]/g, '\'')
      .replace(/[^a-zа-я0-9'ўқғҳ\s-]/g, ' ')
      .replace(/\s+/g, ' ').trim();
  }
  var INDEX = ITEMS.map(function (it) {
    return { it: it, keys: it.keys.map(function (k) { return { w: k.charAt(0) === '~' ? 0.5 : 1, k: norm(k.replace(/^~/, '')) }; }) };
  });
  // Побеждает вопрос с наибольшим весом совпавших слов; при равенстве — тот, что выше в списке
  function search(text) {
    var n = ' ' + norm(text) + ' ';
    if (n.trim().length < 2) return null;
    var words = n.trim().split(' ');
    var best = null;
    INDEX.forEach(function (row, order) {
      var score = 0;
      row.keys.forEach(function (key) {
        var k = key.k;
        if (k.indexOf(' ') !== -1) { if (n.indexOf(' ' + k) !== -1) score += key.w; return; }
        var hit = words.some(function (w) { return k.length <= 3 ? w === k : w.indexOf(k) === 0; });
        if (hit) score += key.w;
      });
      if (score > 0 && (!best || score > best.score)) best = { score: score, item: row.it, order: order };
    });
    return best ? best.item : null;
  }

  function get(id) {
    for (var i = 0; i < ITEMS.length; i++) if (ITEMS[i].id === id) return ITEMS[i];
    return null;
  }
  function answer(id, l) {
    l = lang(l);
    var it = get(id);
    if (!it) return null;
    return { id: it.id, q: it.q[l], text: fill(it.a[l], l), act: it.act.slice() };
  }
  function text(key, l, params) {
    l = lang(l);
    var e = TEXT[key];
    var s = e ? (e[l] || e.ru) : key;
    if (params) s = s.replace(/\{(\w+)\}/g, function (m, k) { return params[k] != null ? params[k] : m; });
    return s;
  }
  function quick(l) {
    l = lang(l);
    return QUICK.map(function (id) { var it = get(id); return { id: id, q: it.q[l] }; });
  }
  // Рабочее ли сейчас время (по Ташкенту)
  function isOpen(date) {
    var d = new Date((date || new Date()).getTime() + HOURS.utcOffset * 3600e3);
    var h = d.getUTCHours() + d.getUTCMinutes() / 60;
    return HOURS.days.indexOf(d.getUTCDay()) !== -1 && h >= HOURS.from && h < HOURS.to;
  }

  return {
    items: ITEMS, quickIds: QUICK, hours: HOURS, links: LINKS,
    search: search, answer: answer, text: text, quick: quick, isOpen: isOpen, lang: lang, norm: norm
  };
})();

if (typeof window !== 'undefined') window.MMM_KB = MMM_KB;
if (typeof module !== 'undefined' && module.exports) module.exports = MMM_KB;
