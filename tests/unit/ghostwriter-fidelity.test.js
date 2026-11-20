const { checkFidelity } = require('../../tools/cli/lib/ghostwriter-fidelity');

const text = (a, b, options = {}) => checkFidelity(a, b, { format: 'text', ...options });
const markdown = (a, b) => checkFidelity(a, b, { format: 'markdown' });
const json = (a, b, fields) => checkFidelity(a, b, { format: 'json', allowedFields: fields });
const yaml = (a, b, fields) => checkFidelity(a, b, { format: 'yaml', allowedFields: fields });

test('unchanged good copy and an economical rewrite can pass the mechanical checks', () => {
  const original = 'Le colis de 7 kg part mardi.';
  for (const revised of [original, 'Le colis pèse 7 kg. Il part mardi.']) {
    expect(text(original, revised)).toEqual({
      status: 'pass',
      coverage: 'complete',
      findings: [],
      semantic: 'unreviewed',
      factual: 'unverified',
    });
  }
});

test.each([
  ['37 complaints.', '37% of complaints.', 'unit'],
  ['Total: 1,200 EUR.', 'Total: 1,200 USD.', 'unit'],
  ['Environ 13 mois.', '13 mois.', 'qualifier'],
  ['Peut réduire le délai jusqu’à 20 %.', 'Réduit le délai de 20 %.', 'qualifier'],
  ['Não publicamos nomes.', 'Publicamos nomes.', 'qualifier'],
  ['Release unless approved.', 'Release if approved.', 'qualifier'],
  ['Selon Élodie Martin, le test dure.', 'Selon Claire Martin, le test dure.', 'attribution'],
  ['She said “paid today”.', 'She said “paid later”.', 'quotation'],
  ['See https://example.org/guide#setup', 'See https://example.org/guide#api', 'link'],
  ['Use --no-scripts before installing.', 'Use --scripts before installing.', 'code'],
  ['Hello ${user.name}.', 'Welcome ${user.id}.', 'placeholder'],
])('detects a protected change in %s', (a, b, rule) => {
  expect(text(a, b)).toMatchObject({
    status: 'findings',
    findings: expect.arrayContaining([expect.objectContaining({ rule })]),
  });
});

test('explicit locales compare values and preserve quantity associations, signs and exact large integers', () => {
  const source = 'Le 31/12/2025, 1\u202f234,50 kg et 10 %.';
  const target = 'On 12/31/2025, 1,234.50 kg and 10%.';
  const policy = { sourceLocale: 'fr-FR', targetLocale: 'en-US' };
  expect(text(source, target, policy).status).toBe('pass');
  expect(text(source, target.replace('kg', 'g'), policy).status).not.toBe('pass');
  expect(text('12 km and 7 m', '12 m and 7 km').status).not.toBe('pass');
  expect(text('−4 kg', '4 kg').status).not.toBe('pass');
  expect(text('9007199254740993 EUR', '9007199254740992 EUR').status).not.toBe('pass');
  expect(text('04/05/2026', '04/05/2026', policy).status).not.toBe('pass');
});

test('explicit terms are per unit and exact spans must be present at preparation', () => {
  expect(text('Keep Néo.', 'Keep Neo.', { protectedTerms: ['Néo'] }).status).toBe('findings');
  expect(text('Keep Néo.', 'Keep Néo.', { protectedSpans: ['Missing'] }).status).toBe('incomplete');
  expect(text('Buy now. Buy now.', 'Buy now.', { protectedSpans: ['Buy now.'] }).status).toBe(
    'findings'
  );
});

test('markdown preserves fenced and inline bytes, format metadata, link targets and the image role', () => {
  const draft =
    '---\ntitle: Guide\n---\nSee [notes](/docs/(old)). Run `npm ci`.\n~~~sh\r\nls -la\r\n~~~\r\n';
  expect(markdown(draft, draft.replace('See [notes]', 'Read [these notes]')).status).toBe('pass');
  for (const [from, to] of [
    ['Guide', 'List'],
    ['/docs/(old)', '/docs/(new)'],
    ['npm ci', 'npm i'],
    ['ls -la\r\n', 'ls -la\n'],
    ['[notes]', '![notes]'],
  ]) {
    expect(markdown(draft, draft.replace(from, to)).status).not.toBe('pass');
  }
  expect(markdown('# Install\n[Go](#install)', '# Setup\n[Go](#install)').status).toBe('findings');
  expect(markdown('See [notes](x).', 'See notes](x).').status).toBe('incomplete');
  expect(markdown('```js\nrun()\n```', '```js\nrun()').status).toBe('incomplete');
});

test('structured JSON scopes protect raw values, duplicate fields, order, paths and ICU expressions', () => {
  const draft = '{"meta":9007199254740993,"nested":[{"a/b":"Bonjour {name}"}]}';
  const path = ['/nested/0/a~1b'];
  const edited = draft.replace('Bonjour', 'Salut');
  expect(json(draft, edited, path).status).toBe('pass');
  expect(json(draft, edited.replace('993', '992'), path).status).toBe('findings');
  expect(json(draft, edited.replace('{name}', '{user}'), path).status).toBe('findings');
  expect(json(draft, edited.replace('"meta":', '"meta":1,"meta":'), path).status).toBe(
    'incomplete'
  );
  expect(json(draft, edited, ['/missing']).status).toBe('incomplete');
  expect(json(draft, edited, []).status).toBe('incomplete');
  expect(json(draft, edited, ['/meta']).status).toBe('incomplete');
  const icu = '{"copy":"{n, plural, one {1 item} other {# items}}"}';
  expect(json(icu, icu.replace('plural', 'select'), ['/copy']).status).toBe('findings');
});

test('YAML allows only the selected single-line string, protecting comments and quoting', () => {
  const draft = 'labels:\n  title: Bonjour  # conserver\nversion: 1\n';
  const fields = ['/labels/title'];
  expect(yaml(draft, draft.replace('Bonjour', 'Salut'), fields).status).toBe('pass');
  expect(yaml(draft, draft.replace('conserver', 'retirer'), fields).status).toBe('findings');
  expect(yaml(draft, draft.replace('1', '2'), fields).status).toBe('findings');
  expect(yaml(draft, draft.replace('Bonjour', 'false'), fields).status).toBe('incomplete');
  expect(yaml(draft, draft.replace('Bonjour', '|\n    Salut'), fields).status).toBe('incomplete');
});

test('a localised string retains its embedded relative Markdown destination', () => {
  expect(
    json('{"copy":"See [docs](/help)"}', '{"copy":"Voir [aide](/aide)"}', ['/copy'])
  ).toMatchObject({
    status: 'findings',
    findings: expect.arrayContaining([expect.objectContaining({ rule: 'link' })]),
  });
});

test('long-scale French billion differs from milliard and from the English short scale', () => {
  const fr = { sourceLocale: 'fr-FR', targetLocale: 'fr-FR' };
  expect(text('1 billion', '1 milliard', fr).status).not.toBe('pass');
  expect(text('1 billion', '1 billion', { ...fr, targetLocale: 'en-US' }).status).not.toBe('pass');
  expect(text('1 million EUR', '1 million USD', fr).status).not.toBe('pass');
});

test('locale-specific dates and Portuguese articles do not introduce a modal or a negation', () => {
  expect(
    text('Le 1er mai 2026.', 'May 1, 2026.', { sourceLocale: 'fr-FR', targetLocale: 'en-US' })
      .status
  ).toBe('pass');
  expect(
    text('In Brazil.', 'No Brasil.', { sourceLocale: 'en-US', targetLocale: 'pt-BR' }).status
  ).toBe('pass');
});

test('unsupported formats, absent output and excessive input yield partial coverage', () => {
  expect(checkFidelity('test', 'test', { format: 'docx' })).toMatchObject({
    status: 'incomplete',
    coverage: 'partial',
  });
  expect(text('Source', '  ').status).toBe('incomplete');
  expect(text('x'.repeat(1048577), 'Text').status).toBe('incomplete');
});

test('scope of the mechanical verdict is explicit even when a semantic reversal goes undetected', () => {
  expect(text('Alice paid Bob.', 'Bob paid Alice.')).toMatchObject({
    status: 'pass',
    semantic: 'unreviewed',
    factual: 'unverified',
  });
});
