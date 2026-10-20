/** Counts valid answers by group; quotes stay verbatim and the disclosure comes first. */
'use strict';

const round = (value) => Math.round(value * 10000) / 10000;

function stats(values) {
  if (!values.length) return { count: 0, median: null, mean: null, min: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  const median = sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
  return {
    count: sorted.length,
    median: round(median),
    mean: round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length),
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

function rateOf(rows, field) {
  const of = rows.length;
  const yes = rows.filter(({ answer }) => answer[field] === true).length;
  return { yes, of, rate: of ? round(yes / of) : null };
}

function countsOf(rows, field, values) {
  const counts = Object.fromEntries(values.map((value) => [value, 0]));
  for (const { answer } of rows) if (Object.hasOwn(answer, field)) counts[answer[field]] += 1;
  return counts;
}

function quotesOf(rows, field, keep) {
  return rows
    .filter(({ answer }) => typeof answer[field] === 'string' && answer[field].trim())
    .slice(0, keep)
    .map(({ card, answer }) => ({ unit: card.id, text: answer[field] }));
}

function numbersOf(rows, field) {
  return stats(
    rows.map(({ answer }) => answer[field]).filter((value) => typeof value === 'number')
  );
}

/**
 * @param rows valid answers in unit order: [{ card, answer }]
 * @param skipped units without a valid answer: [{ unit, reason }]
 */
function tally({ run, definition, cards, rows, skipped }) {
  const { groupBy } = definition.tally;
  const groupValues = Object.fromEntries(
    groupBy.map((field) => [field, [...new Set(cards.map((card) => String(card[field])))]])
  );
  const partition = (compute) => ({
    all: compute(rows),
    groups: Object.fromEntries(
      groupBy.map((field) => [
        field,
        Object.fromEntries(
          groupValues[field].map((value) => [
            value,
            compute(rows.filter(({ card }) => String(card[field]) === value)),
          ])
        ),
      ])
    ),
  });
  const { rate, counts, quotes, numbers } = definition.tally;
  return {
    schemaVersion: 1,
    run: run.id,
    definition: definition.id,
    kind: definition.kind,
    title: definition.title,
    disclosure: definition.disclosure,
    units: { total: cards.length, valid: rows.length, skipped },
    groupBy,
    rate: rate ? { field: rate, ...partition((set) => rateOf(set, rate)) } : null,
    counts: Object.fromEntries(
      counts.map((field) => [
        field,
        partition((set) => countsOf(set, field, definition.answer.fields[field].values)),
      ])
    ),
    quotes: Object.fromEntries(
      Object.entries(quotes).map(([field, keep]) => [
        field,
        { keep, ...partition((set) => quotesOf(set, field, keep)) },
      ])
    ),
    numbers: Object.fromEntries(
      numbers.map((field) => [field, partition((set) => numbersOf(set, field))])
    ),
  };
}

const percent = (rate) => (rate === null ? 'n/a' : (rate * 100).toFixed(1) + '%');
const cell = (value) => (value === null ? 'n/a' : String(value));

function sections(section, render) {
  const lines = render('all', section.all);
  for (const [field, values] of Object.entries(section.groups))
    for (const [value, subset] of Object.entries(values))
      lines.push(...render(field + ' = ' + value, subset));
  return lines;
}

function renderTally(result) {
  const lines = [
    '> ' + result.disclosure,
    '',
    '# ' + result.title + ' (run ' + result.run + ')',
    '',
  ];
  const skipped = result.units.skipped;
  lines.push(
    result.units.valid +
      ' of ' +
      result.units.total +
      ' units gave a valid answer; ' +
      skipped.length +
      ' skipped' +
      (skipped.length
        ? ': ' + skipped.map((entry) => entry.unit + ' (' + entry.reason + ')').join(', ')
        : '') +
      '.'
  );
  if (result.rate) {
    lines.push(
      '',
      '## Rate: ' + result.rate.field,
      '',
      '| group | yes | of | rate |',
      '|---|---|---|---|'
    );
    lines.push(
      ...sections(result.rate, (name, value) => [
        '| ' + name + ' | ' + value.yes + ' | ' + value.of + ' | ' + percent(value.rate) + ' |',
      ])
    );
  }
  for (const [field, section] of Object.entries(result.counts)) {
    const values = Object.keys(section.all);
    lines.push(
      '',
      '## Counts: ' + field,
      '',
      '| group | ' + values.join(' | ') + ' |',
      '|---|' + values.map(() => '---|').join('')
    );
    lines.push(
      ...sections(section, (name, value) => [
        '| ' + name + ' | ' + values.map((key) => value[key]).join(' | ') + ' |',
      ])
    );
  }
  for (const [field, section] of Object.entries(result.quotes)) {
    lines.push('', '## Quotes: ' + field + ' (up to ' + section.keep + ' per group, verbatim)');
    lines.push(
      ...sections(section, (name, value) => [
        '',
        '**' + name + '**',
        ...(value.length
          ? value.map((quote) => '- ' + quote.unit + ': ' + JSON.stringify(quote.text))
          : ['- (no quote)']),
      ])
    );
  }
  for (const [field, section] of Object.entries(result.numbers)) {
    lines.push(
      '',
      '## Numbers: ' + field,
      '',
      '| group | count | median | mean | min | max |',
      '|---|---|---|---|---|---|'
    );
    lines.push(
      ...sections(section, (name, value) => [
        '| ' +
          [
            name,
            value.count,
            cell(value.median),
            cell(value.mean),
            cell(value.min),
            cell(value.max),
          ].join(' | ') +
          ' |',
      ])
    );
  }
  return lines.join('\n') + '\n';
}

module.exports = { tally, renderTally, stats };
