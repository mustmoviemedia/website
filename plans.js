// MUST MOVIE MEDIA — подробности пакетов для окна «Подробнее».
// Структура: MMM_PLANS[язык][id пакета]. Языки: ru, uz, en.
// Цены и флаги (hot — выделенный красный пакет) общие для всех языков — они в META ниже.
// Цифры по часам, срокам и правкам — рабочие значения, поправьте под ваши реальные условия.
var MMM_PLANS = (function () {
  'use strict';

  // price — в млн сум, per: true — цена за месяц.
  // reels / photos — сколько роликов или фото входит (нужно калькулятору и боту)
  var META = {
    'smm-start': { price: 18.0, per: true, reels: 4, photos: 30 },
    'smm-pro': { price: 26.0, per: true, hot: true, reels: 6, photos: 50 },
    'smm-premium': { price: 39.5, per: true, reels: 9, photos: 70 },
    'foto-start': { price: 5.5, photos: 30 },
    'foto-pro': { price: 9.0, hot: true, photos: 50 },
    'foto-custom': { price: null },
    'video-start': { price: 13.0, per: true, reels: 4 },
    'video-pro': { price: 19.5, per: true, hot: true, reels: 6 },
    'video-premium': { price: 29.0, per: true, reels: 9 },
    'ev-blockbuster': { price: 188.0, hot: true },
    'ev-hist1': { price: 107.5 },
    'ev-hist2': { price: 64.0 },
    'ev-hist3': { price: 31.0 }
  };

  /* ======================== RU ======================== */
  var RU_GEAR = {
    photo: ['Полнокадровая беззеркальная камера', 'Портретная и широкоугольная оптика', 'Импульсный и LED-свет, софтбоксы', 'Отражатели, фоны, стойки'],
    video: ['Камеры 4K с кинопрофилем', 'Стабилизатор (гимбал)', 'LED-свет с софтбоксами', 'Петличные и накамерные микрофоны'],
    drone: 'Дрон с лицензией на аэросъёмку',
    fpv: 'FPV-дрон для динамичных пролётов',
    gopro: 'GoPro для экшн-ракурсов',
    stream: 'Видеомикшер и стрим-оборудование для эфира'
  };
  var ru = {
    'smm-start': {
      group: 'SMM · фото + видео', name: 'Start',
      lead: 'Стартовый пакет для аккаунта, который только начинает выходить в регулярный контент: кофейня, салон, небольшой магазин.',
      facts: [['Съёмочные дни', '2 в месяц'], ['Длительность', 'до 4 ч каждый'], ['Контент', '4 Reels · 8 Stories · 25–30 фото'], ['Первый контент', 'через 5–7 дней']],
      includes: ['Контент-план на месяц под ваши цели', '4 Reels с монтажом, цветом и музыкой', '8 Stories', '25–30 обработанных фото', '1 видео-поздравление (праздник, акция, открытие)', 'Подписи и хэштеги к публикациям'],
      team: ['Оператор-монтажёр', 'Фотограф', 'SMM-менеджер'],
      gear: RU_GEAR.video.concat(RU_GEAR.photo.slice(0, 2)),
      terms: ['Reels — 3–5 рабочих дней после съёмки', 'Фото — до 5 рабочих дней', '1 круг правок на каждый ролик'],
      fit: ['Кофейни и рестораны', 'Салоны и студии', 'Небольшие магазины']
    },
    'smm-pro': {
      group: 'SMM · фото + видео', name: 'Pro',
      lead: 'Самый популярный формат: регулярный контент плюс мини-сюжет, который работает на узнаваемость бренда.',
      facts: [['Съёмочные дни', '3 в месяц'], ['Длительность', 'до 5 ч каждый'], ['Контент', '6 Reels · 12 Stories · 45–50 фото'], ['Сюжет', 'до 1,5 мин']],
      includes: ['Контент-план и идеи роликов от сценариста', '6 Reels с монтажом, цветом и звуком', '12 Stories', '45–50 обработанных фото', '1 мини-сюжет до 1,5 минуты со сценарием', 'Подписи, хэштеги, рекомендации по публикации', 'Отчёт по охватам в конце месяца'],
      team: ['Оператор', 'Фотограф', 'Сценарист (Story developer)', 'Монтажёр-колорист', 'SMM-менеджер'],
      gear: RU_GEAR.video.concat(RU_GEAR.photo.slice(0, 3), [RU_GEAR.gopro]),
      terms: ['Reels — 3–5 рабочих дней после съёмки', 'Мини-сюжет — 7–10 рабочих дней', '2 круга правок на каждый ролик'],
      fit: ['Растущие бренды', 'Сети кофеен и ресторанов', 'Спортклубы', 'Личные бренды']
    },
    'smm-premium': {
      group: 'SMM · фото + видео', name: 'Premium',
      lead: 'Полный продакшен для бренда, которому нужен максимум: регулярный контент, имиджевое видео и репортаж с вашего события.',
      facts: [['Съёмочные дни', '4 в месяц + мероприятие'], ['Длительность', 'до 6 ч каждый'], ['Контент', '9 Reels · 15 Stories · 65–70 фото'], ['Бонус', 'имиджевое видео и репортаж']],
      includes: ['Стратегия и контент-план на месяц', '9 Reels', '15 Stories', '65–70 обработанных фото', '1 имиджевое видео со сценарием', '1 репортаж с мероприятия', 'Аэросъёмка по необходимости', 'Ежемесячный отчёт и планёрка по результатам'],
      team: ['2 оператора', 'Фотограф', 'Сценарист', 'Монтажёр-колорист', 'SMM-менеджер', 'Пилот дрона'],
      gear: RU_GEAR.video.concat(RU_GEAR.photo.slice(0, 3), [RU_GEAR.drone, RU_GEAR.gopro]),
      terms: ['Reels — 3–5 рабочих дней', 'Имиджевое видео — 10–14 рабочих дней', 'Репортаж — 5–7 рабочих дней', '2 круга правок'],
      fit: ['Крупные бренды', 'Девелоперы и производство', 'Сети и франшизы']
    },
    'foto-start': {
      group: 'Только фото', name: 'Foto Start',
      lead: 'Одна съёмка, после которой у вас есть свежие профессиональные фото для соцсетей, сайта или меню.',
      facts: [['Смена', '1 смена до 4 часов'], ['Вы получаете', '25–30 фото'], ['Готовность', '5 рабочих дней'], ['Превью', '5 фото через 48 ч']],
      includes: ['Короткий созвон и мудборд до съёмки', 'Съёмка на вашей локации', 'Отбор лучших кадров', 'Цветокоррекция всех фото', 'Ретушь (кожа, продукт, лишние предметы)', 'Форматы для Instagram (4:5) и сайта (3:2)', 'Передача по ссылке в полном разрешении'],
      team: ['Фотограф', 'Ассистент по свету'],
      gear: RU_GEAR.photo,
      terms: ['Превью 5 кадров — через 48 часов', 'Все фото — до 5 рабочих дней', '1 круг правок по ретуши'],
      fit: ['Меню и блюда', 'Портреты команды', 'Товары для каталога']
    },
    'foto-pro': {
      group: 'Только фото', name: 'Foto Pro',
      lead: 'Большая съёмка под ключ: несколько локаций или образов, продумываем концепцию вместе с вами.',
      facts: [['Смены', 'до 2 смен по 4 часа'], ['Вы получаете', '50 фото'], ['Готовность', '7 рабочих дней'], ['Превью', '10 фото через 48 ч']],
      includes: ['Концепция и мудборд съёмки', 'Раскадровка: список кадров под ваши задачи', 'До 2 смен: разные дни или локации', 'Работа со светом под интерьер и продукт', 'Цветокоррекция и детальная ретушь', 'Форматы под соцсети, сайт и печать', 'Отбор 5 кадров для обложек и рекламы'],
      team: ['Фотограф', 'Ассистент по свету', 'Арт-директор съёмки'],
      gear: RU_GEAR.photo.concat(['Макро-объектив для деталей продукта']),
      terms: ['Превью 10 кадров — через 48 часов', 'Все фото — до 7 рабочих дней', '2 круга правок по ретуши'],
      fit: ['Бренды одежды', 'Рестораны и кофейни', 'Имиджевые съёмки']
    },
    'foto-custom': {
      group: 'Только фото', name: 'Индивидуально', priceText: 'По запросу',
      lead: 'Если нужен большой объём или особый формат — соберём съёмку под задачу и посчитаем смету после брифа.',
      facts: [['Объём', 'любой'], ['Смены', 'по задаче'], ['Смета', 'в течение 1 дня'], ['Формат', 'продукт, команда, интерьер']],
      includes: ['Каталожная и предметная съёмка', 'Корпоративные портреты всей команды', 'Интерьеры и архитектура', 'Съёмка с моделями, визажистом и стилистом', 'Своя концепция и сценарий', 'Съёмка в студии или на выезде'],
      team: ['Фотограф', 'Ассистенты', 'Стилист и визажист — по запросу'],
      gear: RU_GEAR.photo.concat([RU_GEAR.drone]),
      terms: ['Сроки и количество правок — по договору'],
      fit: ['Каталоги и маркетплейсы', 'Большие команды', 'Интерьеры']
    },
    'video-start': {
      group: 'Только видео', name: 'Video Start',
      lead: 'Регулярные вертикальные видео для Instagram и TikTok без лишнего: снимаем, монтируем, отдаём готовое.',
      facts: [['Съёмочные дни', '2 в месяц'], ['Длительность', 'до 4 ч каждый'], ['Контент', '4 Reels · 8 Stories'], ['Длина Reels', '15–45 сек']],
      includes: ['Идеи роликов под ваши цели', '4 Reels с монтажом и цветом', '8 Stories', 'Подбор музыки и звуковой дизайн', 'Титры и субтитры', 'Обложки для Reels'],
      team: ['Оператор', 'Монтажёр-колорист'],
      gear: RU_GEAR.video,
      terms: ['Reels — 3–5 рабочих дней после съёмки', '1 круг правок на ролик'],
      fit: ['Кофейни и рестораны', 'Магазины', 'Блогеры']
    },
    'video-pro': {
      group: 'Только видео', name: 'Video Pro',
      lead: 'Больше роликов и один сюжет со сценарием — видео, которое хочется досмотреть и переслать.',
      facts: [['Съёмочные дни', '3 в месяц'], ['Длительность', 'до 5 ч каждый'], ['Контент', '6 Reels · 12 Stories'], ['Сюжет', 'со сценарием']],
      includes: ['Идеи и сценарии от Story developer', '6 Reels', '12 Stories', '1 сюжетный ролик со сценарием', 'Звуковой дизайн и цветокоррекция', 'Субтитры и обложки'],
      team: ['Оператор', 'Сценарист', 'Монтажёр-колорист'],
      gear: RU_GEAR.video.concat([RU_GEAR.gopro]),
      terms: ['Reels — 3–5 рабочих дней', 'Сюжет — 7–10 рабочих дней', '2 круга правок'],
      fit: ['Бренды', 'Спортклубы', 'Личные бренды']
    },
    'video-premium': {
      group: 'Только видео', name: 'Video Premium',
      lead: 'Максимум видео за месяц и имиджевый ролик, который можно поставить на сайт, в рекламу и на LED-экраны.',
      facts: [['Съёмочные дни', '4 в месяц'], ['Длительность', 'до 6 ч каждый'], ['Контент', '9 Reels · 15 Stories'], ['Имиджевый ролик', '1–2 мин, 16:9 + 9:16']],
      includes: ['Сценарии и раскадровки', '9 Reels', '15 Stories', '1 имиджевый ролик в двух форматах', 'Аэросъёмка для ролика', 'Цветокоррекция и звуковой дизайн'],
      team: ['2 оператора', 'Сценарист', 'Монтажёр-колорист', 'Пилот дрона'],
      gear: RU_GEAR.video.concat([RU_GEAR.drone, RU_GEAR.fpv, RU_GEAR.gopro]),
      terms: ['Reels — 3–5 рабочих дней', 'Имиджевый ролик — 10–14 рабочих дней', '2 круга правок'],
      fit: ['Крупные бренды', 'Производство и строительство', 'Отели и курорты']
    },
    'ev-blockbuster': {
      group: 'Мероприятия · цена за 1 день', name: 'Блокбастер',
      lead: 'Ваше событие как премьера фильма. Готовим гостей до начала, ведём прямой эфир, снимаем с воздуха и уже на следующий день выдаём первые ролики.',
      facts: [['Масштаб', 'от 250 гостей'], ['Команда', 'до 8 операторов и 3 фотографа'], ['Работа на площадке', 'весь день, до 12 ч'], ['Эфир', 'прямая трансляция']],
      includes: ['Видео- и фото-приглашение для гостей', 'До 10 LED-заставок для экранов', 'Welcome-фотосессия гостей', 'Прямой эфир с режиссёром и техником', 'Запись всего события с нескольких камер', 'Аэросъёмка с лицензией', 'Отчётный ролик 2–5 минут', '10 вертикальных роликов для соцсетей', 'Фотоотчёт 200+ кадров', 'Все исходники'],
      timeline: [['За 2–3 недели', 'Бриф, сценарий дня, съёмка приглашения'], ['За неделю', 'LED-заставки и тест трансляции на площадке'], ['День события', 'Welcome, эфир, аэро, репортаж — от входа гостей до финала'], ['Через 24–48 ч', 'Первые вертикальные ролики и превью фото'], ['Через 7 дней', 'Фотоотчёт 200+'], ['Через 10–14 дней', 'Отчётный ролик и исходники']],
      team: ['Режиссёр', 'До 8 операторов', '3 фотографа', 'Режиссёр трансляции и техник', 'Пилот дрона', 'Монтажёры'],
      gear: RU_GEAR.video.concat([RU_GEAR.stream, RU_GEAR.drone, RU_GEAR.fpv, RU_GEAR.gopro]),
      terms: ['Вертикальные ролики — 24–48 часов', 'Отчётный ролик — 10–14 дней', '2 круга правок'],
      fit: ['Форумы и конференции', 'Корпоративы', 'Свадьбы от 250 гостей', 'Запуски брендов']
    },
    'ev-hist1': {
      group: 'Мероприятия · цена за 1 день', name: 'Исторический 1',
      lead: 'Большая съёмка без прямого эфира: три оператора, три фотографа, аэросъёмка и анимации. Всё, чтобы о вашем событии говорили после.',
      facts: [['Масштаб', '100–300 гостей'], ['Команда', '3 оператора и 3 фотографа'], ['Работа на площадке', 'до 10 ч'], ['Анимации', '10 штук']],
      includes: ['Приглашение для гостей', 'Съёмка 3 операторами', '3 фотографа', 'GoPro для экшн-ракурсов', 'Аэросъёмка', 'Отчётный ролик', '10 вертикальных роликов', '10 анимаций для соцсетей и экранов', 'Все исходники'],
      timeline: [['За 2 недели', 'Бриф, план съёмки, приглашение'], ['День события', 'Репортаж, аэро, GoPro-ракурсы'], ['Через 3–5 дней', 'Вертикальные ролики и фото'], ['Через 10 дней', 'Отчётный ролик, анимации, исходники']],
      team: ['3 оператора', '3 фотографа', 'Пилот дрона', 'Моушн-дизайнер', 'Монтажёр'],
      gear: RU_GEAR.video.concat([RU_GEAR.drone, RU_GEAR.gopro]),
      terms: ['Вертикальные ролики — 3–5 дней', 'Отчётный ролик — до 10 дней', '2 круга правок'],
      fit: ['Корпоративы', 'Открытия', 'Фестивали', 'Свадьбы']
    },
    'ev-hist2': {
      group: 'Мероприятия · цена за 1 день', name: 'Исторический 2',
      lead: 'Оптимальный вариант: отчётный ролик, фотоотчёт и аэросъёмка. Есть всё, чтобы красиво рассказать о событии в соцсетях.',
      facts: [['Масштаб', 'до 200 гостей'], ['Команда', '2 оператора и 2 фотографа'], ['Работа на площадке', 'до 8 ч'], ['Фото', '200+ кадров']],
      includes: ['Отчётный ролик 2–5 минут', 'Адаптация ролика для соцсетей', '5 вертикальных роликов', 'Фотоотчёт 200+ кадров', 'Аэросъёмка', 'Запись звука (речи, выступления)'],
      timeline: [['За неделю', 'Бриф и план съёмки'], ['День события', 'Репортаж, аэро, запись звука'], ['Через 5 дней', 'Фотоотчёт и вертикальные ролики'], ['Через 7–10 дней', 'Отчётный ролик']],
      team: ['2 оператора', '2 фотографа', 'Пилот дрона', 'Звукорежиссёр', 'Монтажёр'],
      gear: RU_GEAR.video.concat([RU_GEAR.drone, 'Рекордер и микрофоны для записи речей']),
      terms: ['Фотоотчёт — до 5 дней', 'Отчётный ролик — 7–10 дней', '1 круг правок'],
      fit: ['Конференции', 'Презентации', 'Дни рождения компаний']
    },
    'ev-hist3': {
      group: 'Мероприятия · цена за 1 день', name: 'Исторический 3',
      lead: 'Минимальный пакет для небольших событий: всё главное снято, смонтировано и готово к публикации.',
      facts: [['Масштаб', 'до 100 гостей'], ['Команда', '2 оператора и 2 фотографа'], ['Работа на площадке', 'до 6 ч'], ['Роликов', '1 + 5 вертикальных']],
      includes: ['Съёмка 2 операторами', '2 фотографа', 'Монтаж отчётного ролика', '5 вертикальных роликов', 'Обработанные фото'],
      timeline: [['За 3–5 дней', 'Бриф и план съёмки'], ['День события', 'Репортаж'], ['Через 5–7 дней', 'Ролик, вертикальные ролики и фото']],
      team: ['2 оператора', '2 фотографа', 'Монтажёр'],
      gear: RU_GEAR.video.concat(RU_GEAR.photo.slice(0, 2)),
      terms: ['Всё готово — 5–7 дней', '1 круг правок'],
      fit: ['Небольшие праздники', 'Мастер-классы', 'Открытия']
    }
  };

  /* ======================== UZ ======================== */
  var UZ_GEAR = {
    photo: ["To'liq kadrli ko'zgusiz kamera", "Portret va keng burchakli optika", "Impulsli va LED yorug'lik, softbokslar", "Reflektorlar, fonlar, shtativlar"],
    video: ["Kinoprofilli 4K kameralar", "Stabilizator (gimbal)", "Softboksli LED yorug'lik", "Petlichka va kamera mikrofonlari"],
    drone: "Havodan suratga olish litsenziyasiga ega dron",
    fpv: "Dinamik parvozlar uchun FPV-dron",
    gopro: "Ekshn-rakurslar uchun GoPro",
    stream: "Efir uchun videomikser va strim uskunalari"
  };
  var uz = {
    'smm-start': {
      group: "SMM · foto + video", name: "Start",
      lead: "Endigina muntazam kontentga o'tayotgan akkaunt uchun boshlang'ich paket: qahvaxona, salon yoki kichik do'kon.",
      facts: [["Suratga olish kunlari", "oyiga 2 kun"], ["Davomiyligi", "har biri 4 soatgacha"], ["Kontent", "4 Reels · 8 Stories · 25–30 foto"], ["Ilk kontent", "5–7 kundan keyin"]],
      includes: ["Maqsadlaringizga mos oylik kontent-reja", "Montaj, rang va musiqa bilan 4 ta Reels", "8 ta Stories", "25–30 ta ishlangan foto", "1 ta tabrik videosi (bayram, aksiya, ochilish)", "Postlar uchun matn va xeshteglar"],
      team: ["Operator-montajchi", "Fotograf", "SMM-menejer"],
      gear: UZ_GEAR.video.concat(UZ_GEAR.photo.slice(0, 2)),
      terms: ["Reels — suratga olishdan keyin 3–5 ish kuni", "Foto — 5 ish kunigacha", "Har bir rolikka 1 bosqich tuzatish"],
      fit: ["Qahvaxonalar va restoranlar", "Salonlar va studiyalar", "Kichik do'konlar"]
    },
    'smm-pro': {
      group: "SMM · foto + video", name: "Pro",
      lead: "Eng ommabop format: muntazam kontent va brend taniqliligini oshiradigan mini-syujet.",
      facts: [["Suratga olish kunlari", "oyiga 3 kun"], ["Davomiyligi", "har biri 5 soatgacha"], ["Kontent", "6 Reels · 12 Stories · 45–50 foto"], ["Syujet", "1,5 daqiqagacha"]],
      includes: ["Ssenaristdan kontent-reja va rolik g'oyalari", "Montaj, rang va ovoz bilan 6 ta Reels", "12 ta Stories", "45–50 ta ishlangan foto", "Ssenariyli, 1,5 daqiqagacha 1 ta mini-syujet", "Matnlar, xeshteglar va joylash bo'yicha tavsiyalar", "Oy oxirida qamrov bo'yicha hisobot"],
      team: ["Operator", "Fotograf", "Ssenariynavis (Story developer)", "Montajchi-kolorist", "SMM-menejer"],
      gear: UZ_GEAR.video.concat(UZ_GEAR.photo.slice(0, 3), [UZ_GEAR.gopro]),
      terms: ["Reels — suratga olishdan keyin 3–5 ish kuni", "Mini-syujet — 7–10 ish kuni", "Har bir rolikka 2 bosqich tuzatish"],
      fit: ["O'sib borayotgan brendlar", "Qahvaxona va restoran tarmoqlari", "Sport klublari", "Shaxsiy brendlar"]
    },
    'smm-premium': {
      group: "SMM · foto + video", name: "Premium",
      lead: "Maksimal natija kerak bo'lgan brend uchun to'liq prodakshn: muntazam kontent, imidj video va tadbiringizdan reportaj.",
      facts: [["Suratga olish kunlari", "oyiga 4 kun + tadbir"], ["Davomiyligi", "har biri 6 soatgacha"], ["Kontent", "9 Reels · 15 Stories · 65–70 foto"], ["Bonus", "imidj video va reportaj"]],
      includes: ["Oylik strategiya va kontent-reja", "9 ta Reels", "15 ta Stories", "65–70 ta ishlangan foto", "Ssenariyli 1 ta imidj video", "Tadbirdan 1 ta reportaj", "Kerak bo'lsa havodan suratga olish", "Oylik hisobot va natijalar bo'yicha uchrashuv"],
      team: ["2 operator", "Fotograf", "Ssenariynavis", "Montajchi-kolorist", "SMM-menejer", "Dron uchuvchisi"],
      gear: UZ_GEAR.video.concat(UZ_GEAR.photo.slice(0, 3), [UZ_GEAR.drone, UZ_GEAR.gopro]),
      terms: ["Reels — 3–5 ish kuni", "Imidj video — 10–14 ish kuni", "Reportaj — 5–7 ish kuni", "2 bosqich tuzatish"],
      fit: ["Yirik brendlar", "Developerlar va ishlab chiqarish", "Tarmoqlar va franshizalar"]
    },
    'foto-start': {
      group: "Faqat foto", name: "Foto Start",
      lead: "Bitta suratga olish — va sizda ijtimoiy tarmoqlar, sayt yoki menyu uchun yangi professional fotolar bor.",
      facts: [["Smena", "4 soatgacha 1 smena"], ["Siz olasiz", "25–30 ta foto"], ["Tayyor bo'ladi", "5 ish kunida"], ["Prevyu", "48 soatda 5 ta foto"]],
      includes: ["Suratga olishdan oldin qisqa qo'ng'iroq va mudbord", "Sizning lokatsiyangizda suratga olish", "Eng yaxshi kadrlarni saralash", "Barcha fotolarning rang korreksiyasi", "Retush (teri, mahsulot, ortiqcha narsalar)", "Instagram (4:5) va sayt (3:2) formatlari", "To'liq o'lchamda havola orqali topshirish"],
      team: ["Fotograf", "Yorug'lik bo'yicha assistent"],
      gear: UZ_GEAR.photo,
      terms: ["5 ta kadr prevyusi — 48 soatda", "Barcha fotolar — 5 ish kunigacha", "Retush bo'yicha 1 bosqich tuzatish"],
      fit: ["Menyu va taomlar", "Jamoa portretlari", "Katalog uchun mahsulotlar"]
    },
    'foto-pro': {
      group: "Faqat foto", name: "Foto Pro",
      lead: "Kalit topshiriladigan katta suratga olish: bir nechta lokatsiya yoki obraz, konsepsiyani siz bilan birga o'ylaymiz.",
      facts: [["Smenalar", "4 soatdan 2 smenagacha"], ["Siz olasiz", "50 ta foto"], ["Tayyor bo'ladi", "7 ish kunida"], ["Prevyu", "48 soatda 10 ta foto"]],
      includes: ["Suratga olish konsepsiyasi va mudbord", "Kadrlar ro'yxati: vazifalaringizga mos raskadrovka", "2 smenagacha: turli kunlar yoki lokatsiyalar", "Interyer va mahsulotga mos yorug'lik bilan ishlash", "Rang korreksiyasi va batafsil retush", "Ijtimoiy tarmoqlar, sayt va bosma uchun formatlar", "Muqova va reklama uchun 5 ta kadr tanlash"],
      team: ["Fotograf", "Yorug'lik bo'yicha assistent", "Suratga olish art-direktori"],
      gear: UZ_GEAR.photo.concat(["Mahsulot detallari uchun makro-obyektiv"]),
      terms: ["10 ta kadr prevyusi — 48 soatda", "Barcha fotolar — 7 ish kunigacha", "Retush bo'yicha 2 bosqich tuzatish"],
      fit: ["Kiyim brendlari", "Restoran va qahvaxonalar", "Imidj suratga olishlari"]
    },
    'foto-custom': {
      group: "Faqat foto", name: "Individual", priceText: "So'rov bo'yicha",
      lead: "Katta hajm yoki alohida format kerak bo'lsa — suratga olishni vazifangizga moslab yig'amiz va smetani brifdan keyin hisoblaymiz.",
      facts: [["Hajm", "istalgan"], ["Smenalar", "vazifaga qarab"], ["Smeta", "1 kun ichida"], ["Format", "mahsulot, jamoa, interyer"]],
      includes: ["Katalog va predmet suratga olish", "Butun jamoaning korporativ portretlari", "Interyer va arxitektura", "Modellar, vizajist va stilist bilan suratga olish", "O'zingizga xos konsepsiya va ssenariy", "Studiyada yoki joyiga chiqib suratga olish"],
      team: ["Fotograf", "Assistentlar", "Stilist va vizajist — so'rov bo'yicha"],
      gear: UZ_GEAR.photo.concat([UZ_GEAR.drone]),
      terms: ["Muddatlar va tuzatishlar soni — shartnoma bo'yicha"],
      fit: ["Kataloglar va marketpleyslar", "Katta jamoalar", "Interyerlar"]
    },
    'video-start': {
      group: "Faqat video", name: "Video Start",
      lead: "Instagram va TikTok uchun ortiqchasiz muntazam vertikal videolar: suratga olamiz, montaj qilamiz, tayyorini topshiramiz.",
      facts: [["Suratga olish kunlari", "oyiga 2 kun"], ["Davomiyligi", "har biri 4 soatgacha"], ["Kontent", "4 Reels · 8 Stories"], ["Reels uzunligi", "15–45 soniya"]],
      includes: ["Maqsadlaringizga mos rolik g'oyalari", "Montaj va rang bilan 4 ta Reels", "8 ta Stories", "Musiqa tanlash va ovoz dizayni", "Titrlar va subtitrlar", "Reels uchun muqovalar"],
      team: ["Operator", "Montajchi-kolorist"],
      gear: UZ_GEAR.video,
      terms: ["Reels — suratga olishdan keyin 3–5 ish kuni", "Har bir rolikka 1 bosqich tuzatish"],
      fit: ["Qahvaxonalar va restoranlar", "Do'konlar", "Blogerlar"]
    },
    'video-pro': {
      group: "Faqat video", name: "Video Pro",
      lead: "Ko'proq roliklar va ssenariyli bitta syujet — oxirigacha ko'rib, boshqalarga yuborgingiz keladigan video.",
      facts: [["Suratga olish kunlari", "oyiga 3 kun"], ["Davomiyligi", "har biri 5 soatgacha"], ["Kontent", "6 Reels · 12 Stories"], ["Syujet", "ssenariy bilan"]],
      includes: ["Story developer'dan g'oya va ssenariylar", "6 ta Reels", "12 ta Stories", "Ssenariyli 1 ta syujetli rolik", "Ovoz dizayni va rang korreksiyasi", "Subtitrlar va muqovalar"],
      team: ["Operator", "Ssenariynavis", "Montajchi-kolorist"],
      gear: UZ_GEAR.video.concat([UZ_GEAR.gopro]),
      terms: ["Reels — 3–5 ish kuni", "Syujet — 7–10 ish kuni", "2 bosqich tuzatish"],
      fit: ["Brendlar", "Sport klublari", "Shaxsiy brendlar"]
    },
    'video-premium': {
      group: "Faqat video", name: "Video Premium",
      lead: "Oyiga maksimal video hajmi va saytga, reklamaga hamda LED-ekranlarga qo'yish mumkin bo'lgan imidj rolik.",
      facts: [["Suratga olish kunlari", "oyiga 4 kun"], ["Davomiyligi", "har biri 6 soatgacha"], ["Kontent", "9 Reels · 15 Stories"], ["Imidj rolik", "1–2 daqiqa, 16:9 + 9:16"]],
      includes: ["Ssenariylar va raskadrovkalar", "9 ta Reels", "15 ta Stories", "Ikki formatdagi 1 ta imidj rolik", "Rolik uchun havodan suratga olish", "Rang korreksiyasi va ovoz dizayni"],
      team: ["2 operator", "Ssenariynavis", "Montajchi-kolorist", "Dron uchuvchisi"],
      gear: UZ_GEAR.video.concat([UZ_GEAR.drone, UZ_GEAR.fpv, UZ_GEAR.gopro]),
      terms: ["Reels — 3–5 ish kuni", "Imidj rolik — 10–14 ish kuni", "2 bosqich tuzatish"],
      fit: ["Yirik brendlar", "Ishlab chiqarish va qurilish", "Mehmonxona va kurortlar"]
    },
    'ev-blockbuster': {
      group: "Tadbirlar · 1 kunlik narx", name: "Blokbaster",
      lead: "Tadbiringiz — xuddi film premyerasi. Mehmonlarni oldindan tayyorlaymiz, jonli efir o'tkazamiz, havodan suratga olamiz va ertasiga ilk roliklarni topshiramiz.",
      facts: [["Ko'lam", "250 dan ortiq mehmon"], ["Jamoa", "8 tagacha operator va 3 fotograf"], ["Maydonda ish", "kun bo'yi, 12 soatgacha"], ["Efir", "jonli translyatsiya"]],
      includes: ["Mehmonlar uchun video va foto taklifnoma", "Ekranlar uchun 10 tagacha LED-zastavka", "Mehmonlar uchun welcome-fotosessiya", "Rejissyor va texnik bilan jonli efir", "Butun tadbirni bir nechta kameradan yozib olish", "Litsenziyali havodan suratga olish", "2–5 daqiqalik hisobot roligi", "Ijtimoiy tarmoqlar uchun 10 ta vertikal rolik", "200+ kadrli fotohisobot", "Barcha xom materiallar"],
      timeline: [["2–3 hafta oldin", "Brif, kun ssenariysi, taklifnomani suratga olish"], ["Bir hafta oldin", "LED-zastavkalar va maydonda efir sinovi"], ["Tadbir kuni", "Welcome, efir, havodan suratga olish, reportaj — mehmonlar kelishidan finalgacha"], ["24–48 soatdan keyin", "Ilk vertikal roliklar va foto prevyusi"], ["7 kundan keyin", "200+ fotohisobot"], ["10–14 kundan keyin", "Hisobot roligi va xom materiallar"]],
      team: ["Rejissyor", "8 tagacha operator", "3 fotograf", "Efir rejissyori va texnik", "Dron uchuvchisi", "Montajchilar"],
      gear: UZ_GEAR.video.concat([UZ_GEAR.stream, UZ_GEAR.drone, UZ_GEAR.fpv, UZ_GEAR.gopro]),
      terms: ["Vertikal roliklar — 24–48 soat", "Hisobot roligi — 10–14 kun", "2 bosqich tuzatish"],
      fit: ["Forum va konferensiyalar", "Korporativlar", "250 dan ortiq mehmonli to'ylar", "Brend taqdimotlari"]
    },
    'ev-hist1': {
      group: "Tadbirlar · 1 kunlik narx", name: "Tarixiy 1",
      lead: "Jonli efirsiz katta suratga olish: uchta operator, uchta fotograf, havodan suratga olish va animatsiyalar. Tadbiringiz haqida keyin ham gapirishlari uchun hammasi bor.",
      facts: [["Ko'lam", "100–300 mehmon"], ["Jamoa", "3 operator va 3 fotograf"], ["Maydonda ish", "10 soatgacha"], ["Animatsiyalar", "10 ta"]],
      includes: ["Mehmonlar uchun taklifnoma", "3 operator bilan suratga olish", "3 fotograf", "Ekshn-rakurslar uchun GoPro", "Havodan suratga olish", "Hisobot roligi", "10 ta vertikal rolik", "Ijtimoiy tarmoqlar va ekranlar uchun 10 ta animatsiya", "Barcha xom materiallar"],
      timeline: [["2 hafta oldin", "Brif, suratga olish rejasi, taklifnoma"], ["Tadbir kuni", "Reportaj, havodan suratga olish, GoPro rakurslari"], ["3–5 kundan keyin", "Vertikal roliklar va fotolar"], ["10 kundan keyin", "Hisobot roligi, animatsiyalar, xom materiallar"]],
      team: ["3 operator", "3 fotograf", "Dron uchuvchisi", "Moushn-dizayner", "Montajchi"],
      gear: UZ_GEAR.video.concat([UZ_GEAR.drone, UZ_GEAR.gopro]),
      terms: ["Vertikal roliklar — 3–5 kun", "Hisobot roligi — 10 kungacha", "2 bosqich tuzatish"],
      fit: ["Korporativlar", "Ochilish marosimlari", "Festivallar", "To'ylar"]
    },
    'ev-hist2': {
      group: "Tadbirlar · 1 kunlik narx", name: "Tarixiy 2",
      lead: "Optimal variant: hisobot roligi, fotohisobot va havodan suratga olish. Tadbir haqida ijtimoiy tarmoqlarda chiroyli hikoya qilish uchun hammasi bor.",
      facts: [["Ko'lam", "200 tagacha mehmon"], ["Jamoa", "2 operator va 2 fotograf"], ["Maydonda ish", "8 soatgacha"], ["Foto", "200+ kadr"]],
      includes: ["2–5 daqiqalik hisobot roligi", "Rolikni ijtimoiy tarmoqlarga moslashtirish", "5 ta vertikal rolik", "200+ kadrli fotohisobot", "Havodan suratga olish", "Ovoz yozib olish (nutqlar, chiqishlar)"],
      timeline: [["Bir hafta oldin", "Brif va suratga olish rejasi"], ["Tadbir kuni", "Reportaj, havodan suratga olish, ovoz yozish"], ["5 kundan keyin", "Fotohisobot va vertikal roliklar"], ["7–10 kundan keyin", "Hisobot roligi"]],
      team: ["2 operator", "2 fotograf", "Dron uchuvchisi", "Ovoz rejissyori", "Montajchi"],
      gear: UZ_GEAR.video.concat([UZ_GEAR.drone, "Nutqlarni yozish uchun rekorder va mikrofonlar"]),
      terms: ["Fotohisobot — 5 kungacha", "Hisobot roligi — 7–10 kun", "1 bosqich tuzatish"],
      fit: ["Konferensiyalar", "Taqdimotlar", "Kompaniya tug'ilgan kunlari"]
    },
    'ev-hist3': {
      group: "Tadbirlar · 1 kunlik narx", name: "Tarixiy 3",
      lead: "Kichik tadbirlar uchun minimal paket: eng muhimi suratga olingan, montaj qilingan va joylashga tayyor.",
      facts: [["Ko'lam", "100 tagacha mehmon"], ["Jamoa", "2 operator va 2 fotograf"], ["Maydonda ish", "6 soatgacha"], ["Roliklar", "1 + 5 ta vertikal"]],
      includes: ["2 operator bilan suratga olish", "2 fotograf", "Hisobot roligi montaji", "5 ta vertikal rolik", "Ishlangan fotolar"],
      timeline: [["3–5 kun oldin", "Brif va suratga olish rejasi"], ["Tadbir kuni", "Reportaj"], ["5–7 kundan keyin", "Rolik, vertikal roliklar va fotolar"]],
      team: ["2 operator", "2 fotograf", "Montajchi"],
      gear: UZ_GEAR.video.concat(UZ_GEAR.photo.slice(0, 2)),
      terms: ["Hammasi tayyor — 5–7 kun", "1 bosqich tuzatish"],
      fit: ["Kichik bayramlar", "Master-klasslar", "Ochilish marosimlari"]
    }
  };

  /* ======================== EN ======================== */
  var EN_GEAR = {
    photo: ['Full-frame mirrorless camera', 'Portrait and wide-angle lenses', 'Strobe and LED lighting, softboxes', 'Reflectors, backdrops, stands'],
    video: ['4K cameras with cinema log profiles', 'Gimbal stabilizer', 'LED lights with softboxes', 'Lavalier and on-camera microphones'],
    drone: 'Licensed drone for aerial filming',
    fpv: 'FPV drone for dynamic fly-throughs',
    gopro: 'GoPro for action angles',
    stream: 'Video switcher and streaming kit for the live broadcast'
  };
  var en = {
    'smm-start': {
      group: 'SMM · photo + video', name: 'Start',
      lead: 'An entry package for an account that is just starting to post regular content: a coffee shop, a salon, a small store.',
      facts: [['Shoot days', '2 per month'], ['Duration', 'up to 4 h each'], ['Content', '4 Reels · 8 Stories · 25–30 photos'], ['First content', 'in 5–7 days']],
      includes: ['Monthly content plan built around your goals', '4 Reels with editing, color grading and music', '8 Stories', '25–30 edited photos', '1 greeting video (holiday, promo, opening)', 'Captions and hashtags for every post'],
      team: ['Videographer-editor', 'Photographer', 'SMM manager'],
      gear: EN_GEAR.video.concat(EN_GEAR.photo.slice(0, 2)),
      terms: ['Reels — 3–5 business days after the shoot', 'Photos — up to 5 business days', '1 round of revisions per video'],
      fit: ['Coffee shops and restaurants', 'Salons and studios', 'Small stores']
    },
    'smm-pro': {
      group: 'SMM · photo + video', name: 'Pro',
      lead: 'Our most popular format: regular content plus a mini-story that builds brand awareness.',
      facts: [['Shoot days', '3 per month'], ['Duration', 'up to 5 h each'], ['Content', '6 Reels · 12 Stories · 45–50 photos'], ['Story video', 'up to 1.5 min']],
      includes: ['Content plan and video ideas from our scriptwriter', '6 Reels with editing, color grading and sound', '12 Stories', '45–50 edited photos', '1 scripted mini-story up to 1.5 minutes', 'Captions, hashtags and posting recommendations', 'Reach report at the end of the month'],
      team: ['Videographer', 'Photographer', 'Scriptwriter (story developer)', 'Editor and colorist', 'SMM manager'],
      gear: EN_GEAR.video.concat(EN_GEAR.photo.slice(0, 3), [EN_GEAR.gopro]),
      terms: ['Reels — 3–5 business days after the shoot', 'Mini-story — 7–10 business days', '2 rounds of revisions per video'],
      fit: ['Growing brands', 'Coffee shop and restaurant chains', 'Sports clubs', 'Personal brands']
    },
    'smm-premium': {
      group: 'SMM · photo + video', name: 'Premium',
      lead: 'Full production for a brand that wants the maximum: regular content, a brand image video and coverage of your event.',
      facts: [['Shoot days', '4 per month + an event'], ['Duration', 'up to 6 h each'], ['Content', '9 Reels · 15 Stories · 65–70 photos'], ['Bonus', 'brand image video and event coverage']],
      includes: ['Monthly strategy and content plan', '9 Reels', '15 Stories', '65–70 edited photos', '1 scripted brand image video', '1 event coverage video', 'Aerial filming when needed', 'Monthly report and results review meeting'],
      team: ['2 videographers', 'Photographer', 'Scriptwriter', 'Editor and colorist', 'SMM manager', 'Drone pilot'],
      gear: EN_GEAR.video.concat(EN_GEAR.photo.slice(0, 3), [EN_GEAR.drone, EN_GEAR.gopro]),
      terms: ['Reels — 3–5 business days', 'Brand image video — 10–14 business days', 'Event coverage — 5–7 business days', '2 rounds of revisions'],
      fit: ['Large brands', 'Developers and manufacturers', 'Chains and franchises']
    },
    'foto-start': {
      group: 'Photo only', name: 'Foto Start',
      lead: 'One shoot — and you have fresh professional photos for social media, your website or your menu.',
      facts: [['Session', '1 session up to 4 hours'], ['You get', '25–30 photos'], ['Ready in', '5 business days'], ['Preview', '5 photos within 48 h']],
      includes: ['Short call and mood board before the shoot', 'Shoot at your location', 'Selection of the best shots', 'Color correction of every photo', 'Retouching (skin, product, stray objects)', 'Formats for Instagram (4:5) and web (3:2)', 'Full-resolution delivery via link'],
      team: ['Photographer', 'Lighting assistant'],
      gear: EN_GEAR.photo,
      terms: ['Preview of 5 shots — within 48 hours', 'All photos — within 5 business days', '1 round of retouching revisions'],
      fit: ['Menus and dishes', 'Team portraits', 'Catalog products']
    },
    'foto-pro': {
      group: 'Photo only', name: 'Foto Pro',
      lead: 'A large turnkey shoot: several locations or looks, with the concept developed together with you.',
      facts: [['Sessions', 'up to 2 × 4 hours'], ['You get', '50 photos'], ['Ready in', '7 business days'], ['Preview', '10 photos within 48 h']],
      includes: ['Shoot concept and mood board', 'Shot list tailored to your goals', 'Up to 2 sessions: different days or locations', 'Lighting set up for your interior and product', 'Color correction and detailed retouching', 'Formats for social media, web and print', '5 selected shots for covers and ads'],
      team: ['Photographer', 'Lighting assistant', 'Art director'],
      gear: EN_GEAR.photo.concat(['Macro lens for product details']),
      terms: ['Preview of 10 shots — within 48 hours', 'All photos — within 7 business days', '2 rounds of retouching revisions'],
      fit: ['Fashion brands', 'Restaurants and coffee shops', 'Brand image shoots']
    },
    'foto-custom': {
      group: 'Photo only', name: 'Custom', priceText: 'On request',
      lead: 'Need a large volume or a special format? We\'ll build the shoot around your task and prepare an estimate after the brief.',
      facts: [['Volume', 'any'], ['Sessions', 'as needed'], ['Estimate', 'within 1 day'], ['Format', 'product, team, interior']],
      includes: ['Catalog and product photography', 'Corporate portraits of the whole team', 'Interiors and architecture', 'Shoots with models, make-up artist and stylist', 'Your own concept and script', 'In-studio or on-location shoots'],
      team: ['Photographer', 'Assistants', 'Stylist and make-up artist — on request'],
      gear: EN_GEAR.photo.concat([EN_GEAR.drone]),
      terms: ['Timelines and number of revisions — per contract'],
      fit: ['Catalogs and marketplaces', 'Large teams', 'Interiors']
    },
    'video-start': {
      group: 'Video only', name: 'Video Start',
      lead: 'Regular vertical videos for Instagram and TikTok, no frills: we shoot, edit and deliver them ready to post.',
      facts: [['Shoot days', '2 per month'], ['Duration', 'up to 4 h each'], ['Content', '4 Reels · 8 Stories'], ['Reels length', '15–45 sec']],
      includes: ['Video ideas built around your goals', '4 Reels with editing and color grading', '8 Stories', 'Music selection and sound design', 'Titles and subtitles', 'Reels covers'],
      team: ['Videographer', 'Editor and colorist'],
      gear: EN_GEAR.video,
      terms: ['Reels — 3–5 business days after the shoot', '1 round of revisions per video'],
      fit: ['Coffee shops and restaurants', 'Stores', 'Bloggers']
    },
    'video-pro': {
      group: 'Video only', name: 'Video Pro',
      lead: 'More videos plus one scripted story — the kind of video people watch to the end and share.',
      facts: [['Shoot days', '3 per month'], ['Duration', 'up to 5 h each'], ['Content', '6 Reels · 12 Stories'], ['Story video', 'scripted']],
      includes: ['Ideas and scripts from our story developer', '6 Reels', '12 Stories', '1 scripted story video', 'Sound design and color grading', 'Subtitles and covers'],
      team: ['Videographer', 'Scriptwriter', 'Editor and colorist'],
      gear: EN_GEAR.video.concat([EN_GEAR.gopro]),
      terms: ['Reels — 3–5 business days', 'Story video — 7–10 business days', '2 rounds of revisions'],
      fit: ['Brands', 'Sports clubs', 'Personal brands']
    },
    'video-premium': {
      group: 'Video only', name: 'Video Premium',
      lead: 'The most video per month plus a brand image film you can use on your website, in ads and on LED screens.',
      facts: [['Shoot days', '4 per month'], ['Duration', 'up to 6 h each'], ['Content', '9 Reels · 15 Stories'], ['Brand image film', '1–2 min, 16:9 + 9:16']],
      includes: ['Scripts and storyboards', '9 Reels', '15 Stories', '1 brand image film in two formats', 'Aerial footage for the film', 'Color grading and sound design'],
      team: ['2 videographers', 'Scriptwriter', 'Editor and colorist', 'Drone pilot'],
      gear: EN_GEAR.video.concat([EN_GEAR.drone, EN_GEAR.fpv, EN_GEAR.gopro]),
      terms: ['Reels — 3–5 business days', 'Brand image film — 10–14 business days', '2 rounds of revisions'],
      fit: ['Large brands', 'Manufacturing and construction', 'Hotels and resorts']
    },
    'ev-blockbuster': {
      group: 'Events · price per day', name: 'Blockbuster',
      lead: 'Your event as a film premiere. We build anticipation among guests beforehand, run a live stream, film from the air and deliver the first videos the very next day.',
      facts: [['Scale', '250+ guests'], ['Crew', 'up to 8 camera operators and 3 photographers'], ['On site', 'all day, up to 12 h'], ['Broadcast', 'live stream']],
      includes: ['Video and photo invitation for guests', 'Up to 10 LED screen visuals', 'Welcome photo session for guests', 'Live stream with a director and a technician', 'Multi-camera recording of the entire event', 'Licensed aerial filming', 'Highlight film, 2–5 minutes', '10 vertical videos for social media', 'Photo report with 200+ shots', 'All raw files'],
      timeline: [['2–3 weeks before', 'Brief, event-day script, invitation shoot'], ['A week before', 'LED screen visuals and a live-stream test at the venue'], ['Event day', 'Welcome zone, live stream, aerial, coverage — from guest arrival to the finale'], ['24–48 h after', 'First vertical videos and photo previews'], ['7 days after', '200+ photo report'], ['10–14 days after', 'Highlight film and raw files']],
      team: ['Director', 'Up to 8 camera operators', '3 photographers', 'Live-stream director and technician', 'Drone pilot', 'Editors'],
      gear: EN_GEAR.video.concat([EN_GEAR.stream, EN_GEAR.drone, EN_GEAR.fpv, EN_GEAR.gopro]),
      terms: ['Vertical videos — 24–48 hours', 'Highlight film — 10–14 days', '2 rounds of revisions'],
      fit: ['Forums and conferences', 'Corporate events', 'Weddings with 250+ guests', 'Brand launches']
    },
    'ev-hist1': {
      group: 'Events · price per day', name: 'Historic 1',
      lead: 'A large shoot without a live stream: three camera operators, three photographers, aerial filming and animations. Everything to keep people talking about your event afterwards.',
      facts: [['Scale', '100–300 guests'], ['Crew', '3 camera operators and 3 photographers'], ['On site', 'up to 10 h'], ['Animations', '10']],
      includes: ['Invitation for guests', 'Filming with 3 camera operators', '3 photographers', 'GoPro for action angles', 'Aerial filming', 'Highlight film', '10 vertical videos', '10 animations for social media and screens', 'All raw files'],
      timeline: [['2 weeks before', 'Brief, shooting plan, invitation'], ['Event day', 'Coverage, aerial, GoPro angles'], ['3–5 days after', 'Vertical videos and photos'], ['10 days after', 'Highlight film, animations, raw files']],
      team: ['3 camera operators', '3 photographers', 'Drone pilot', 'Motion designer', 'Editor'],
      gear: EN_GEAR.video.concat([EN_GEAR.drone, EN_GEAR.gopro]),
      terms: ['Vertical videos — 3–5 days', 'Highlight film — up to 10 days', '2 rounds of revisions'],
      fit: ['Corporate events', 'Openings', 'Festivals', 'Weddings']
    },
    'ev-hist2': {
      group: 'Events · price per day', name: 'Historic 2',
      lead: 'The best-value option: a highlight film, a photo report and aerial filming. Everything you need to tell your event\'s story beautifully on social media.',
      facts: [['Scale', 'up to 200 guests'], ['Crew', '2 camera operators and 2 photographers'], ['On site', 'up to 8 h'], ['Photos', '200+ shots']],
      includes: ['Highlight film, 2–5 minutes', 'Social media cuts of the film', '5 vertical videos', 'Photo report with 200+ shots', 'Aerial filming', 'Sound recording (speeches, performances)'],
      timeline: [['A week before', 'Brief and shooting plan'], ['Event day', 'Coverage, aerial, sound recording'], ['5 days after', 'Photo report and vertical videos'], ['7–10 days after', 'Highlight film']],
      team: ['2 camera operators', '2 photographers', 'Drone pilot', 'Sound engineer', 'Editor'],
      gear: EN_GEAR.video.concat([EN_GEAR.drone, 'Recorder and microphones for speeches']),
      terms: ['Photo report — up to 5 days', 'Highlight film — 7–10 days', '1 round of revisions'],
      fit: ['Conferences', 'Presentations', 'Company anniversaries']
    },
    'ev-hist3': {
      group: 'Events · price per day', name: 'Historic 3',
      lead: 'The essentials package for smaller events: all the key moments filmed, edited and ready to post.',
      facts: [['Scale', 'up to 100 guests'], ['Crew', '2 camera operators and 2 photographers'], ['On site', 'up to 6 h'], ['Videos', '1 + 5 vertical']],
      includes: ['Filming with 2 camera operators', '2 photographers', 'Highlight film editing', '5 vertical videos', 'Edited photos'],
      timeline: [['3–5 days before', 'Brief and shooting plan'], ['Event day', 'Coverage'], ['5–7 days after', 'Film, vertical videos and photos']],
      team: ['2 camera operators', '2 photographers', 'Editor'],
      gear: EN_GEAR.video.concat(EN_GEAR.photo.slice(0, 2)),
      terms: ['Everything ready — 5–7 days', '1 round of revisions'],
      fit: ['Small celebrations', 'Workshops', 'Openings']
    }
  };

  // Добавляем общие цены и флаги в каждый язык
  [ru, uz, en].forEach(function (lang) {
    Object.keys(META).forEach(function (id) {
      var m = META[id];
      lang[id].price = m.price;
      lang[id].per = !!m.per;
      lang[id].hot = !!m.hot;
      if (m.reels) lang[id].reels = m.reels;
      if (m.photos) lang[id].photos = m.photos;
    });
  });

  return { ru: ru, uz: uz, en: en };
})();

// Браузер: window.MMM_PLANS. Node и Cloudflare Worker (бот): require / import.
if (typeof window !== 'undefined') window.MMM_PLANS = MMM_PLANS;
if (typeof module !== 'undefined' && module.exports) module.exports = MMM_PLANS;
