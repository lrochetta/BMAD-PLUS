'use strict';

// Amounts and account references may exceed Number.MAX_SAFE_INTEGER.
const conventions = {
  'en-us': { group: ',', decimal: '.', dayFirst: false },
  'en-gb': { group: ',', decimal: '.', dayFirst: true },
  en: { group: ',', decimal: '.' },
  'fr-fr': { group: ' ', decimal: ',', dayFirst: true },
  fr: { group: ' ', decimal: ',', dayFirst: true },
  'pt-br': { group: '.', decimal: ',', dayFirst: true },
  pt: { group: '.', decimal: ',', dayFirst: true },
};

const monthRows = [
  'january jan janvier janv janeiro',
  'february feb février févr fev fevereiro',
  'march mar mars março',
  'april apr avril avr abril abr',
  'may mai maio',
  'june jun juin junho',
  'july jul juillet juil julho',
  'august aug août agosto ago',
  'september sept sep septembre setembro set',
  'october oct octobre outubro out',
  'november nov novembre novembro',
  'december dec décembre déc dezembro dez',
];
const monthNumber = new Map(
  monthRows.flatMap((row, i) => row.split(' ').map((word) => [word, i + 1]))
);
const months = Array.from(monthNumber.keys())
  .sort((a, b) => b.length - a.length)
  .join('|');
const month = String.raw`(?:${months})\.?`;
const day = String.raw`\d{1,2}(?:st|nd|rd|th|er|º)?`;
const space = String.raw`[ \t\u00a0\u202f]`;
const gap = String.raw`${space}+(?:de${space}+)?`;
const namedDate = String.raw`(?<![\p{L}\d])(?:${day}${gap}${month}(?:${gap}\d{4})?|${month}${space}+(?:\d{4}|${day}(?:,?${space}+\d{4})?))(?![\p{L}\d])`;
const numericDate = String.raw`(?<!\d)(?:\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/](?:\d{4}|\d{2}))(?!\d)`;
const number = String.raw`[+\-−±]?(?:\d+(?:(?:[.,]\d+)|(?:[ \u00a0\u202f]\d{3}(?!\d)))*|[.,]\d+)(?:[eE][+\-]?\d+)?`;
const tokens = new RegExp(`(?<date>${numericDate}|${namedDate})|(?<number>${number})`, 'giu');

function calendarDate(year, monthValue, dayValue) {
  const m = Number(monthValue);
  const d = Number(dayValue);
  const leap = !year || (+year % 4 === 0 && (+year % 100 !== 0 || +year % 400 === 0));
  const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (m < 1 || m > 12 || d < 1 || d > lengths[m - 1]) throw new Error('Invalid calendar date.');
  return [year || '--', String(m).padStart(2, '0'), String(d).padStart(2, '0')].join('-');
}

function dateValue(raw, locale) {
  if (!locale) return raw;
  const segments = raw.match(/\d+/g);
  const name = raw
    .toLowerCase()
    .match(/\p{L}+/gu)
    ?.find((word) => monthNumber.has(word));
  if (name) {
    const m = monthNumber.get(name);
    const year = segments.find((part) => part.length === 4);
    const d = segments.find((part) => part.length < 3);
    return d ? calendarDate(year, m, d) : `${year}-${String(m).padStart(2, '0')}`;
  }
  const [first, second, last] = segments;
  if (first.length === 4) return calendarDate(first, second, last);
  // Neither a century nor the region behind bare "en" can be reconstructed.
  if (last.length !== 4 || locale.dayFirst === undefined) return raw;
  return locale.dayFirst ? calendarDate(last, second, first) : calendarDate(last, first, second);
}

function decimalValue(raw, locale) {
  if (!locale) return raw;
  const [, sign, body, exponent] = /^([+\-−±]?)([\d., \u00a0\u202f]+)([eE][+-]?\d+)?$/.exec(raw);
  const parts = body.replace(/[\u00a0\u202f]/g, ' ').split(locale.decimal);
  const groups = (parts[0] || '0').split(locale.group);
  const validGrouping =
    groups.length === 1 || (groups[0].length <= 3 && groups.slice(1).every((g) => g.length === 3));
  if (
    parts.length > 2 ||
    !groups.every((g) => /^\d+$/.test(g)) ||
    !validGrouping ||
    (parts.length === 2 && !/^\d+$/.test(parts[1]))
  ) {
    // A dotted version, address or unexpected numeric convention keeps its exact spelling.
    return `literal:${raw}`;
  }
  const fraction = parts[1]?.replace(/0+$/, '');
  return (
    sign.replace('−', '-') + groups.join('') + (fraction ? `.${fraction}` : '') + (exponent || '')
  );
}

const currency = String.raw`(?:US\$|CA\$|A\$|R\$|[$€£¥₹₽₩₺₫₴₦₱₡]|(?:USD|EUR|GBP|BRL|CAD|AUD|JPY|CHF|CNY|INR|MXN|NZD|SEK|NOK|DKK|PLN|ZAR|KRW)(?!\p{L}))`;
const prefix = new RegExp(String.raw`(?<!\p{L})([+\-−±]?)(${currency})${space}*$`, 'u');
const suffix = new RegExp(String.raw`^${space}*(${currency})`, 'u');
const unitRows = {
  '%': ['%', 'percent', 'per cent', 'pour cent', 'por cento'],
  '‰': ['‰'],
  second: ['second', 'seconds', 'seconde', 'secondes', 'segundo', 'segundos'],
  minute: ['minute', 'minutes', 'minuto', 'minutos'],
  hour: ['hour', 'hours', 'heure', 'heures', 'hora', 'horas'],
  day: ['day', 'days', 'jour', 'jours', 'dia', 'dias'],
  week: ['week', 'weeks', 'semaine', 'semaines', 'semana', 'semanas'],
  month: ['month', 'months', 'mois', 'mês', 'meses'],
  year: ['year', 'years', 'an', 'ans', 'année', 'années', 'ano', 'anos'],
  gram: ['gram', 'grams', 'gramme', 'grammes', 'grama', 'gramas'],
  kilogram: ['kilogram', 'kilograms', 'kilogramme', 'kilogrammes', 'quilograma', 'quilogramas'],
  milligram: ['milligram', 'milligrams', 'milligramme', 'milligrammes', 'miligrama', 'miligramas'],
  metre: ['meter', 'meters', 'metre', 'metres', 'mètre', 'mètres', 'metro', 'metros'],
  kilometre: [
    'kilometer',
    'kilometers',
    'kilometre',
    'kilometres',
    'kilomètre',
    'kilomètres',
    'quilômetro',
    'quilômetros',
  ],
  mile: ['mile', 'miles', 'milha', 'milhas'],
  litre: ['liter', 'liters', 'litre', 'litres', 'litro', 'litros'],
  euro: ['euro', 'euros'],
  dollar: ['dollar', 'dollars', 'dólar', 'dólares'],
  pound: ['pound', 'pounds', 'livre', 'livres', 'libra', 'libras'],
};
const unitNames = new Map(
  Object.entries(unitRows).flatMap(([key, names]) => names.map((n) => [n, key]))
);
const namedUnit = new RegExp(
  String.raw`^${space}*(${[...unitNames.keys()].sort((a, b) => b.length - a.length).join('|')})(?!\p{L})`,
  'iu'
);
const symbolUnit = new RegExp(
  String.raw`^${space}*((?:°[CF]|[μµnumcdkMGT]?(?:g|m|s|L|l|W|V|A|Pa|Hz|J)|(?:[kKMGTPE]i?)?[bB](?:/s|ps)?|h|min|bps|rpm|kcal|mol)(?:[²³])?(?:\/[\p{L}]+[²³]?)?)(?![\p{L}\d])`,
  'u'
);

// French uses the long scale. Only a known language licenses converting a
// magnitude word to a power of ten (one French billion is one English trillion).
const magnitudes = {
  fr: {
    mille: 3,
    millier: 3,
    milliers: 3,
    million: 6,
    millions: 6,
    milliard: 9,
    milliards: 9,
    billion: 12,
    billions: 12,
    billiard: 15,
    billiards: 15,
    trillion: 18,
    trillions: 18,
  },
  en: {
    thousand: 3,
    thousands: 3,
    million: 6,
    millions: 6,
    billion: 9,
    billions: 9,
    trillion: 12,
    trillions: 12,
    quadrillion: 15,
    quadrillions: 15,
    quintillion: 18,
    quintillions: 18,
  },
  pt: { mil: 3, milhão: 6, milhões: 6, bilhão: 9, bilhões: 9, trilhão: 12, trilhões: 12 },
};
const magnitudeWords = [...new Set(Object.values(magnitudes).flatMap(Object.keys))].join('|');
const magnitudeToken = new RegExp(String.raw`(?<!\p{L})(?:${magnitudeWords})(?!\p{L})`, 'giu');
const magnitudeSuffix = new RegExp(String.raw`^${space}*(${magnitudeWords})(?!\p{L})`, 'iu');
const scaleConnector = /^\s+(?:de\s+|d['’])/iu;

function quantities(text, localeName) {
  if (typeof text !== 'string') throw new TypeError('Expected prose text.');
  if (/(?:(?![0-9])\p{Nd})/u.test(text)) {
    throw new Error('This numerical script requires a separate comparison.');
  }
  const localeKey = localeName?.toLowerCase();
  if (localeKey && !Object.hasOwn(conventions, localeKey)) {
    throw new Error('Unsupported locale for numerical comparison.');
  }
  const locale = conventions[localeKey];
  const numbers = [];
  const dates = [];
  const units = [];
  const digitScales = new Set();
  for (const hit of text.matchAll(tokens)) {
    if (hit.groups.date) {
      dates.push(dateValue(hit[0], locale));
      continue;
    }
    const after = text.slice(hit.index + hit[0].length, hit.index + hit[0].length + 72);
    const before = text.slice(Math.max(0, hit.index - 36), hit.index);
    const leading = prefix.exec(before);
    const trailing = suffix.exec(after);
    const left = leading ? before.slice(0, leading.index) : before;
    const operator = /([<>≤≥≈≠]=?)\s*$/.exec(left)?.[1];
    let unitText = trailing ? after.slice(trailing[0].length) : after;
    const scale = magnitudeSuffix.exec(unitText);
    let scaledCurrency;
    if (scale) {
      const offset = hit.index + hit[0].length + (trailing?.[0].length || 0);
      digitScales.add(offset + scale[0].length - scale[1].length);
      const word = scale[1].toLowerCase();
      const exponent = magnitudes[localeKey?.split('-')[0]]?.[word];
      units.push(`${numbers.length}:scale:${exponent ?? word}`);
      unitText = unitText.slice(scale[0].length).replace(scaleConnector, '');
      scaledCurrency = suffix.exec(unitText);
      if (scaledCurrency) unitText = unitText.slice(scaledCurrency[0].length);
    }
    const longName = namedUnit.exec(unitText);
    const symbol = symbolUnit.exec(unitText);
    const attached = /^[\p{L}°µμ]+/u.exec(unitText);
    const unit = longName ? unitNames.get(longName[1].toLowerCase()) : symbol?.[1] || attached?.[0];
    const index = numbers.length;
    numbers.push((leading?.[1] || '').replace('−', '-') + decimalValue(hit[0], locale));
    if (leading) units.push(`${index}:${leading[2]}`);
    if (trailing) units.push(`${index}:${trailing[1]}`);
    if (scaledCurrency) units.push(`${index}:${scaledCurrency[1]}`);
    if (unit) units.push(`${index}:${unit}`);
    if (operator) units.push(`${index}:${operator}`);
    if ((leading || trailing || scaledCurrency) && /\(\s*$/.test(left) && /^\s*\)/.test(unitText)) {
      units.push(`${index}:accounting-parentheses`);
    }
  }
  for (const occurrence of text.matchAll(magnitudeToken)) {
    if (!digitScales.has(occurrence.index)) {
      throw new Error('A magnitude without a numeric coefficient requires separate comparison.');
    }
  }
  return { numbers, dates, units };
}

module.exports = { quantities };
