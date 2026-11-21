// Content: station names (EN), zone titles (EN) and short explanations (RU).
// Edit names of the Founding Crew here — they are drawn on the Crew Wall.

export const PROJECT = {
  brand: 'ASTRAHUB',
  product: 'ASTRA STATION',
};

export const FOUNDING_CREW = [
  'A. KARIMOV', 'D. YUSUPOVA', 'T. RAKHIMOV', 'M. ALIEVA',
  'S. NAZAROV', 'N. TOSHMATOVA', 'B. ERGASHEV', 'L. SULTANOVA',
  'R. ISMOILOV', 'K. ABDULLAEVA', 'F. MIRZAEV', 'Z. KHAMIDOVA',
  'O. SAIDOV', 'G. UMAROVA', 'J. KHOLMATOV', 'V. PAK',
  'E. RASHIDOV', 'I. NURMATOVA', 'U. TURSUNOV', 'Y. KIM',
];

export const STATIONS = {
  tashkent: {
    id: 'tashkent',
    code: 'STATION 01',
    name: 'TASHKENT',
    tab: 'Tashkent',
    short: 'Tashkent',
    specs: ['7 × 10 m', '~25 seats', 'Street level'],
    ru: 'Первый этаж в центре Ташкента, рядом с Tashkent City Park. Фасад — модуль МКС, внутри прямой зал с баром, мини-кухней и тур-деском.',
  },
  astrocity: {
    id: 'astrocity',
    code: 'STATION 02',
    name: 'ASTRO CITY',
    tab: 'ASTRO CITY',
    short: 'Astro',
    specs: ['Dome Ø 11.3 m', '~100 m²', '~35 seats + terrace'],
    ru: 'Купол на плато Устюрт (Каракалпакстан) у обрыва чинка. Длинный шлюз, Island Bar в центре, терраса с телескопом.',
  },
  konyukhov: {
    id: 'konyukhov',
    code: 'STATION 03',
    name: 'N.KONYUKHOV',
    tab: 'N.KONYUKHOV',
    short: 'Konyukhov',
    specs: ['2 trucks 4 × 2.4 m', 'Coffee around the world', 'Ski resort'],
    ru: 'Мобильная кофейня премиум-класса на ГК «Солнечная долина»: бар и кухня в двух траках, лавки для экипировки, стойка для лыж, столы-бочки.',
  },
};

// Hotspot texts: title — English, text — Russian (1–2 lines)
export const ZONES = {
  tashkent: {
    facade: { title: 'Module Facade', text: 'Фасад — модуль МКС: композитные панели, иллюминаторы, кольца жёсткости. Ночью светится как капсула.' },
    entrance: { title: 'Airlock Entrance', text: 'Вход-шлюз с автоматическими дверями. Оранжевая линия на полу ведёт прямо к бару.' },
    bar: { title: 'Bar', text: 'Напитки MARS, LUNA, EARTH. 5 мест у стойки, витрина десертов, холодильники с напитками и мойка на задней линии.' },
    kitchen: { title: 'Mini Kitchen', text: 'Мини-кухня за стеклом: холодильник, мойка, индукция и вытяжка с воздуховодом. Вход для персонала из-за бара.' },
    merch: { title: 'Space & Merch', text: 'Маленькая витрина: кружки, нашивки миссий, модели ракет и капсул.' },
    tourdesk: { title: 'Tour Desk', text: 'Запись на туры в ASTRO CITY на плато Устюрт. На столе — макет купола Station 02.' },
    crew: { title: 'Crew Wall', text: 'Стена Founding Crew — имена первых участников проекта.' },
    hall: { title: 'Main Hall', text: 'Прямой зал 7 × 10 м, ~25 мест: 4 стола, стойка у иллюминаторов, бар.' },
    earth: { title: 'Earth View', text: 'Иллюминаторы-экраны: живой вид на Землю с орбиты.' },
    park: { title: 'Tashkent City Park', text: 'Через дорогу — парк Tashkent City и башни делового центра.' },
    restrooms: { title: 'Restrooms', text: 'Два санузла за дверью между баром и тур-деском: WC 01 доступный для маломобильных гостей и WC 02. Раковины, сушилки, вытяжка.' },
    hvac: { title: 'Ventilation', text: 'Решётки притока на торцах модуля, диффузоры в потолке зала, вытяжка из санузлов и кухни, блоки кондиционеров на крыше.' },
  },
  astrocity: {
    dome: { title: 'Dome Ø 11.3 m', text: 'Геодезический купол: композитные панели и стеклянный сектор на закат и обрыв.' },
    corridor: { title: 'Airlock Corridor', text: 'Длинный шлюз-коридор 12 м с иллюминаторами — переход с плато внутрь станции.' },
    bar: { title: 'Island Bar', text: 'Круглый бар в центре купола, 8 мест. Напитки MARS, LUNA, EARTH.' },
    merch: { title: 'Space & Merch', text: 'Витрина у стены купола: нашивки, кружки, модели ровера. Рядом — холодильник с напитками.' },
    tourdesk: { title: 'Tour Desk', text: 'Стойка у входа: экскурсии по ASTRO CITY, ночные наблюдения, поездки к чинку.' },
    hall: { title: 'Main Hall', text: '~100 м², ~35 мест: столы по кругу и стойка у панорамного остекления.' },
    terrace: { title: 'Terrace', text: 'Терраса над обрывом чинка: закат над Устюртом и звёздное небо.' },
    telescope: { title: 'Telescope', text: 'Телескоп на террасе для ночных наблюдений: Луна, Сатурн, Млечный Путь.' },
    solar: { title: 'Solar Field', text: 'Солнечное поле питает станцию: ряды панелей к востоку от купола.' },
    antenna: { title: 'Antenna', text: 'Антенна связи и мачта с маяком — ориентир станции ночью.' },
    rover: { title: 'ASTRA Rover', text: 'ASTRA Rover у входа — шестиколёсный ровер для фото и поездок по плато.' },
    gate: { title: 'ASTRO CITY Gate', text: 'Указатели к воротам ASTRO CITY: дорога вдоль плато.' },
    restrooms: { title: 'Restrooms', text: 'Сервисный модуль сбоку от шлюза: две раковины с зеркалами-иллюминаторами и два санузла (WC A доступный).' },
    hvac: { title: 'HVAC', text: 'Наружные блоки вентиляции и кондиционирования: воздуховоды в купол и сервисный модуль, сопла под кольцевой балкой.' },
  },
  konyukhov: {
    truck: { title: 'N.KONYUKHOV Trucks', text: 'Два фудтрака 4 × 2,4 м, соединённые в одну кофейню: слева бар, справа кухня. Брендирование под заказ.' },
    coffee: { title: 'Coffee Around the World', text: 'Эфиопия, Турция, Вьетнам, Италия, Австралия, Колумбия, Аргентина — каждый напиток как авторская реконструкция местной традиции.' },
    kitchen: { title: 'Kitchen Window', text: 'Пицца (5 видов), хот-доги, панини, венские вафли и панкейки, согревающие напитки и чай.' },
    tables: { title: 'Barrel Tables', text: 'Столики-бочки без посадки: быстрый перекус между спусками.' },
    benches: { title: 'Gear Benches', text: 'Лавки для ожидания и снятия экипировки.' },
    skirack: { title: 'Ski & Board Rack', text: 'Стойка для лыж и сноубордов у площадки — оборудование под присмотром.' },
    heaters: { title: 'Heaters & Lights', text: 'Уличные обогреватели и гирлянды: тёплая площадка днём и вечером.' },
    story: { title: 'Founder Story', text: '«Я пил кофе под снежными вершинами, в джунглях и на берегу океана. Каждая чашка — это история».' },
    lift: { title: 'Chairlift', text: 'Кресельный подъёмник рядом с площадкой: поток гостей ГК «Солнечная долина» — около 350 000 человек за 2024 год.' },
    slope: { title: 'Ski Runs', text: 'Трассы со склона спускаются прямо к кофейне; вечером — освещение для катания.' },
    bar: { title: 'Bar', text: 'Кофемашина на 2 группы, кофемолки для эспрессо и фильтра, станция фильтра, холодильники для молока и напитков, мойка.' },
    galley: { title: 'Galley', text: 'Комбинированная печь, панини-пресс, вафельница, гриль для панкейков, микроволновка, вытяжка, морозильная камера.' },
  },
};
