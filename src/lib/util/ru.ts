// Latin -> Russian naming. Dictionary first, transliteration as a fallback.

export const LEAGUE_RU: Record<string, string> = {
  'Premier League': 'АПЛ',
  'English Premier League': 'АПЛ',
  'Championship': 'Чемпионшип',
  'La Liga': 'Ла Лига',
  'LaLiga': 'Ла Лига',
  'Primera Division': 'Ла Лига',
  'Serie A': 'Серия А',
  'Bundesliga': 'Бундеслига',
  '2. Bundesliga': '2. Бундеслига',
  'Ligue 1': 'Лига 1',
  'Ligue 2': 'Лига 2',
  'UEFA Champions League': 'Лига чемпионов',
  'UEFA Europa League': 'Лига Европы',
  'UEFA Europa Conference League': 'Лига конференций',
  'UEFA Conference League': 'Лига конференций',
  'Eredivisie': 'Эредивизи',
  'Primeira Liga': 'Примейра Лига',
  'Super Lig': 'Суперлига Турции',
  'Premier League RU': 'РПЛ',
  'Russian Premier League': 'РПЛ',
  'FA Cup': 'Кубок Англии',
  'League Cup': 'Кубок лиги',
  'EFL Cup': 'Кубок лиги',
  'Copa del Rey': 'Кубок Испании',
  'Coppa Italia': 'Кубок Италии',
  'DFB Pokal': 'Кубок Германии',
  'Copa Libertadores': 'Кубок Либертадорес',
  'MLS': 'MLS',
  'Serie B': 'Серия B',
  'Super League': 'Суперлига',
};

export const COUNTRY_RU: Record<string, string> = {
  England: 'Англия', Spain: 'Испания', Italy: 'Италия', Germany: 'Германия',
  France: 'Франция', Netherlands: 'Нидерланды', Portugal: 'Португалия',
  Russia: 'Россия', Turkey: 'Турция', Brazil: 'Бразилия', Argentina: 'Аргентина',
  USA: 'США', Mexico: 'Мексика', Greece: 'Греция', Austria: 'Австрия',
  Belgium: 'Бельгия', Scotland: 'Шотландия', Ukraine: 'Украина',
  Kazakhstan: 'Казахстан', Czechia: 'Чехия', 'Czech-Republic': 'Чехия',
  Poland: 'Польша', Switzerland: 'Швейцария', Denmark: 'Дания',
  Norway: 'Норвегия', Sweden: 'Швеция', Japan: 'Япония', China: 'Китай',
  World: 'Мир', Croatia: 'Хорватия', Serbia: 'Сербия', Romania: 'Румыния',
  Bulgaria: 'Болгария', Israel: 'Израиль', Cyprus: 'Кипр', Hungary: 'Венгрия',
  Wales: 'Уэльс', 'Northern Ireland': 'Северная Ирландия', Ireland: 'Ирландия',
  'Republic of Ireland': 'Ирландия', Iceland: 'Исландия', Finland: 'Финляндия',
  Slovakia: 'Словакия', Slovenia: 'Словения', 'Bosnia-Herzegovina': 'Босния и Герцеговина',
  'Bosnia and Herzegovina': 'Босния и Герцеговина', Montenegro: 'Черногория',
  'North Macedonia': 'Северная Македония', Albania: 'Албания', Kosovo: 'Косово',
  Georgia: 'Грузия', Armenia: 'Армения', Azerbaijan: 'Азербайджан', Belarus: 'Беларусь',
  Moldova: 'Молдова', Lithuania: 'Литва', Latvia: 'Латвия', Estonia: 'Эстония',
  Luxembourg: 'Люксембург', Malta: 'Мальта', Andorra: 'Андорра', 'San Marino': 'Сан-Марино',
  Gibraltar: 'Гибралтар', 'Faroe Islands': 'Фарерские острова', Liechtenstein: 'Лихтенштейн',
  Canada: 'Канада', 'United States': 'США', Panama: 'Панама', 'Costa Rica': 'Коста-Рика',
  Jamaica: 'Ямайка', Honduras: 'Гондурас', 'El Salvador': 'Сальвадор', Guatemala: 'Гватемала',
  Haiti: 'Гаити', 'Trinidad and Tobago': 'Тринидад и Тобаго', Morocco: 'Марокко',
  Egypt: 'Египет', Nigeria: 'Нигерия', Senegal: 'Сенегал', Algeria: 'Алжир', Tunisia: 'Тунис',
  'South Korea': 'Южная Корея', 'Saudi Arabia': 'Саудовская Аравия', Qatar: 'Катар',
  Iran: 'Иран', Australia: 'Австралия', Uruguay: 'Уругвай', Colombia: 'Колумбия',
  Chile: 'Чили', Peru: 'Перу', Ecuador: 'Эквадор', Paraguay: 'Парагвай', Venezuela: 'Венесуэла',
  Bolivia: 'Боливия',
};

export const TEAM_RU: Record<string, string> = {
  'Manchester City': 'Манчестер Сити', 'Manchester United': 'Манчестер Юнайтед',
  'Liverpool': 'Ливерпуль', 'Arsenal': 'Арсенал', 'Chelsea': 'Челси',
  'Tottenham': 'Тоттенхэм', 'Tottenham Hotspur': 'Тоттенхэм',
  'Newcastle': 'Ньюкасл', 'Newcastle United': 'Ньюкасл',
  'Aston Villa': 'Астон Вилла', 'West Ham': 'Вест Хэм', 'Everton': 'Эвертон',
  'Brighton': 'Брайтон', 'Brentford': 'Брентфорд', 'Fulham': 'Фулхэм',
  'Crystal Palace': 'Кристал Пэлас', 'Wolves': 'Вулверхэмптон',
  'Nottingham Forest': 'Ноттингем Форест', 'Bournemouth': 'Борнмут',
  'Norwich': 'Норвич', 'Leeds': 'Лидс', 'Leicester': 'Лестер',
  'Southampton': 'Саутгемптон', 'Sunderland': 'Сандерленд', 'Burnley': 'Бернли',
  'Real Madrid': 'Реал Мадрид', 'Barcelona': 'Барселона',
  'Atletico Madrid': 'Атлетико', 'Sevilla': 'Севилья', 'Valencia': 'Валенсия',
  'Villarreal': 'Вильярреал', 'Real Betis': 'Бетис', 'Betis': 'Бетис',
  'Athletic Club': 'Атлетик', 'Real Sociedad': 'Реал Сосьедад',
  'Getafe': 'Хетафе', 'Espanyol': 'Эспаньол', 'Elche': 'Эльче', 'Alaves': 'Алавес',
  'Las Palmas': 'Лас-Пальмас', 'Cadiz': 'Кадис', 'Levante': 'Леванте', 'Celta Vigo': 'Сельта', 'Osasuna': 'Осасуна',
  'Rayo Vallecano': 'Райо Вальекано', 'Mallorca': 'Мальорка', 'Girona': 'Жирона',
  'Juventus': 'Ювентус', 'Inter': 'Интер', 'AC Milan': 'Милан', 'Milan': 'Милан',
  'Napoli': 'Наполи', 'Roma': 'Рома', 'AS Roma': 'Рома', 'Lazio': 'Лацио',
  'Atalanta': 'Аталанта', 'Fiorentina': 'Фиорентина', 'Torino': 'Торино',
  'Bologna': 'Болонья', 'Udinese': 'Удинезе', 'Genoa': 'Дженоа',
  'Bayern Munich': 'Бавария', 'Bayern München': 'Бавария',
  'Borussia Dortmund': 'Боруссия Дортмунд', 'RB Leipzig': 'РБ Лейпциг',
  'Bayer Leverkusen': 'Байер', 'Union Berlin': 'Унион Берлин',
  'Eintracht Frankfurt': 'Айнтрахт', 'Werder Bremen': 'Вердер',
  'Borussia Monchengladbach': 'Боруссия М', 'Hoffenheim': 'Хоффенхайм',
  'Freiburg': 'Фрайбург', 'SC Freiburg': 'Фрайбург', 'Mainz': 'Майнц', 'Augsburg': 'Аугсбург',
  'Venezia': 'Венеция', 'Inter Milan': 'Интер', 'Internazionale': 'Интер', 'Como': 'Комо',
  'Cagliari': 'Кальяри', 'Verona': 'Верона', 'Parma': 'Парма', 'Pisa': 'Пиза',
  'VfB Stuttgart': 'Штутгарт', 'Stuttgart': 'Штутгарт', 'Wolfsburg': 'Вольфсбург',
  'Paris Saint Germain': 'ПСЖ', 'Paris Saint-Germain': 'ПСЖ', 'PSG': 'ПСЖ',
  'Marseille': 'Марсель', 'Lyon': 'Лион', 'Monaco': 'Монако', 'Lille': 'Лилль',
  'Nice': 'Ницца', 'Rennes': 'Ренн', 'Lens': 'Ланс',
  'Ajax': 'Аякс', 'PSV Eindhoven': 'ПСВ', 'PSV': 'ПСВ', 'Feyenoord': 'Фейеноорд',
  'AZ Alkmaar': 'АЗ', 'NEC Nijmegen': 'НЕК Ниджмеген', 'Twente': 'Твенте',
  'Benfica': 'Бенфика', 'Porto': 'Порту', 'Sporting CP': 'Спортинг',
  'Braga': 'Брага',
  'Celtic': 'Селтик', 'Rangers': 'Рейнджерс',
  'Galatasaray': 'Галатасарай', 'Fenerbahce': 'Фенербахче',
  'Besiktas': 'Бешикташ', 'Trabzonspor': 'Трабзонспор',
  'Red Bull Salzburg': 'Ред Булл Зальцбург', 'RB Salzburg': 'Ред Булл Зальцбург',
  'Sturm Graz': 'Штурм', 'Rapid Vienna': 'Рапид Вена',
  'Club Brugge': 'Брюгге', 'Anderlecht': 'Андерлехт',
  'Union St. Gilloise': 'Унион Сент-Жиллуаз', 'Royale Union SG': 'Унион Сент-Жиллуаз',
  'Ferencvaros': 'Ференцварош', 'Slavia Praha': 'Славия Прага',
  'Sparta Praha': 'Спарта Прага', 'Viktoria Plzen': 'Плзень',
  'Sigma Olomouc': 'Сигма Оломоуц',
  'Lech Poznan': 'Лех Познань', 'Legia Warszawa': 'Легия',
  'Levski Sofia': 'Левски София', 'Ludogorets': 'Лудогорец',
  'Dinamo Zagreb': 'Динамо Загреб', 'Red Star Belgrade': 'Црвена Звезда',
  'Shakhtar Donetsk': 'Шахтёр Донецк', 'Dynamo Kyiv': 'Динамо Киев',
  'Zenit': 'Зенит', 'Spartak Moscow': 'Спартак', 'CSKA Moscow': 'ЦСКА',
  'Lokomotiv Moscow': 'Локомотив', 'Dynamo Moscow': 'Динамо Москва',
  'Krasnodar': 'Краснодар', 'Rubin Kazan': 'Рубин',
  'Olympiakos': 'Олимпиакос', 'Panathinaikos': 'Панатинаикос',
  'AEK Athens': 'АЕК Афины', 'PAOK': 'ПАОК', 'OFI Crete': 'ОФИ', 'OFI': 'ОФИ',
  'Panserraikos': 'Пансерраикос',
  'Jagiellonia': 'Ягеллония', 'Lillestrom': 'Лиллестрём',
  'Atletico-MG': 'Атлетико Минейро', 'Chapecoense-SC': 'Шапекоэнсе',
  'Portland Timbers': 'Портленд Тимберс', 'Atlanta United': 'Атланта Юнайтед',
  'Toluca': 'Толука', 'Santos Laguna': 'Сантос Лагуна',
};

const MAP: [RegExp, string][] = [
  // word-initial latin "e" reads as Э — applied first, while the text is still latin
  [/\be/gi, 'Э'],
  // frequent English/Spanish club words, handled before the letter rules
  [/\bcity\b/gi, 'Сити'], [/\bunited\b/gi, 'Юнайтед'], [/\btown\b/gi, 'Таун'],
  [/\bnew\b/gi, 'Нью'], [/\bwanderers\b/gi, 'Уондерерс'], [/\brovers\b/gi, 'Роверс'],
  [/\bathletic\b/gi, 'Атлетик'], [/\batletico\b/gi, 'Атлетико'], [/\breal\b/gi, 'Реал'],
  [/\bsporting\b/gi, 'Спортинг'], [/\bdeportivo\b/gi, 'Депортиво'], [/\bracing\b/gi, 'Расинг'],
  [/\bjunior(s)?\b/gi, 'Хуниорс'], [/\bcounty\b/gi, 'Каунти'], [/\balbion\b/gi, 'Альбион'],
  [/\byork\b/gi, 'Йорк'], [/\bmoscow\b/gi, 'Москва'], [/\bsaint\b/gi, 'Сент'],
  [/\by\b/gi, 'и'], [/\bde\b/gi, 'де'], [/\bdel\b/gi, 'дель'], [/\bla\b/gi, 'ла'],
  [/shch/gi, 'щ'], [/sch/gi, 'ш'], [/tsch/gi, 'ч'], [/sh/gi, 'ш'], [/ch/gi, 'ч'],
  [/ts/gi, 'ц'], [/zh/gi, 'ж'], [/kh/gi, 'х'], [/ph/gi, 'ф'], [/th/gi, 'т'],
  [/ce/gi, 'се'], [/ci/gi, 'си'], [/cy/gi, 'си'], [/ck/gi, 'к'], [/qu/gi, 'кв'],
  [/ya/gi, 'я'], [/yu/gi, 'ю'], [/yo/gi, 'ё'], [/ye/gi, 'е'], [/ee/gi, 'и'],
  [/oo/gi, 'у'], [/ou/gi, 'у'], [/au/gi, 'ау'],
  [/a/gi, 'а'], [/b/gi, 'б'], [/c/gi, 'к'], [/d/gi, 'д'], [/e/gi, 'е'],
  [/f/gi, 'ф'], [/g/gi, 'г'], [/h/gi, 'х'], [/i/gi, 'и'], [/j/gi, 'дж'],
  [/k/gi, 'к'], [/l/gi, 'л'], [/m/gi, 'м'], [/n/gi, 'н'], [/o/gi, 'о'],
  [/p/gi, 'п'], [/q/gi, 'к'], [/r/gi, 'р'], [/s/gi, 'с'], [/t/gi, 'т'],
  [/u/gi, 'у'], [/v/gi, 'в'], [/w/gi, 'в'], [/x/gi, 'кс'], [/y/gi, 'й'],
  [/z/gi, 'з'],
];

// a trailing latin 'y' reads as -и, not -й


const titleCase = (w: string) => (w ? w[0].toUpperCase() + w.slice(1) : w);

export function translit(input: string): string {
  const deacc = input.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let out = deacc;
  for (const [re, to] of MAP) out = out.replace(re, to);
  return out
    .split(/([\s-]+)/)
    .map((w) => (/^[а-яё]/i.test(w) ? titleCase(w.replace(/й$/, 'и')) : w))
    .join('');
}

/** Club-name noise that carries no meaning once the name is in Russian. */
const NOISE = /\b(FC|CF|SC|AC|FK|SK|BK|AFC|CFC|SV|VfB|VfL|TSG|BSC|CD|CA|US|UC|AS|SS|SSC|RC|RCD|UD|SD|NK|HNK|GNK|MFK|OFK|PFC|FSV|SpVgg|Calcio|Club|Football|Futbol)\b/gi;

function normalizeName(name: string): string {
  return name
    .replace(/\([^)]*\)/g, ' ')        // drop "(Santiago del Estero)"
    .replace(/^\d+\.\s*/, '')          // "1. FC Union" -> "FC Union"
    .replace(NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const key = (s: string) => s.toLowerCase().replace(/[^a-zа-яё0-9]/gi, '');

const DICT_BY_KEY = new Map<string, string>();
for (const [k, v] of Object.entries(TEAM_RU)) {
  DICT_BY_KEY.set(key(k), v);
  DICT_BY_KEY.set(key(normalizeName(k)), v);
}

/** Dictionary hit only — null when we'd have to fall back to transliteration. */
export function teamRuDict(name: string | null | undefined): string | null {
  if (!name) return null;
  return DICT_BY_KEY.get(key(name)) ?? DICT_BY_KEY.get(key(normalizeName(name))) ?? null;
}

export function teamRu(name: string | null | undefined): string {
  if (!name) return '';
  if (/[а-яё]/i.test(name)) return name;
  const direct = DICT_BY_KEY.get(key(name));
  if (direct) return direct;
  // national teams are just country names
  if (COUNTRY_RU[name]) return COUNTRY_RU[name];
  const norm = normalizeName(name);
  const viaNorm = DICT_BY_KEY.get(key(norm));
  if (viaNorm) return viaNorm;
  return translit(norm || name);
}
export function leagueRu(name: string | null | undefined): string {
  if (!name) return '';
  if (/[а-яё]/i.test(name)) return name;
  return LEAGUE_RU[name] || LEAGUE_RU[normalizeName(name)] || name;
}
export function countryRu(name: string | null | undefined): string {
  if (!name) return '';
  if (/[а-яё]/i.test(name)) return name;
  return COUNTRY_RU[name] || name;
}
