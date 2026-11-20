/** Swarm runtime: dealing, briefs, answers, tally and plan export on real temporary projects. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const swarm = require('../../tools/cli/lib/swarm');
const contract = require('../../tools/cli/lib/swarm-validate');
const { dealCards, quotas, Dealer } = require('../../tools/cli/lib/swarm-deal');
const { stats } = require('../../tools/cli/lib/swarm-tally');
const { removeTree } = require('../helpers/process-budget');

const FIXTURES = path.resolve(__dirname, '../fixtures/swarm');
const tempParent = fs.realpathSync.native(os.tmpdir());
let project;

const read = (file) => JSON.parse(fs.readFileSync(path.join(FIXTURES, file), 'utf8'));
const fixture = (file) => JSON.parse(JSON.stringify(read(file)));

function write(file, value) {
  const target = path.join(project, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value, null, 2));
  return target;
}

function config(block) {
  write(
    '_bmad/config.yaml',
    'user_name: "laurent"\n' + (block === undefined ? '' : 'swarm:\n' + block)
  );
}

const PANEL = {
  definition: 'swarm/buyer-panel.json',
  profile: 'swarm/profile.json',
  context: ['pitch=swarm/pitch.md'],
};

function panel(options = {}) {
  return swarm.init(project, { ...PANEL, n: 6, seed: 7, ...options });
}

function answer(runId, unit, value) {
  return write('.bmad-plus/swarm/runs/' + runId + '/answers/' + unit + '.json', value);
}

beforeEach(() => {
  project = fs.mkdtempSync(path.join(tempParent, 'bmad-swarm-é space-'));
  fs.cpSync(FIXTURES, path.join(project, 'swarm'), { recursive: true });
});

afterEach(() => {
  removeTree(project);
});

describe('dealing', () => {
  const profile = contract.normalizeProfile(read('profile.json'));

  test('the same profile, n and seed deal the same cards; another seed deals other cards', () => {
    const first = dealCards(profile, 20, 7, 'B');
    expect(dealCards(profile, 20, 7, 'B')).toEqual(first);
    expect(dealCards(profile, 20, 8, 'B')).not.toEqual(first);
    expect(first.map((card) => card.id)).toEqual(
      Array.from({ length: 20 }, (_, i) => 'B' + String(i + 1).padStart(3, '0'))
    );
  });

  test('every dimension follows its shares by exact quota, whatever the seed', () => {
    for (const seed of [1, 2, 3]) {
      const cards = dealCards(profile, 20, seed, 'B');
      const by = (field) =>
        cards.reduce((acc, card) => ({ ...acc, [card[field]]: (acc[card[field]] || 0) + 1 }), {});
      expect(by('segment')).toEqual({ 'early career': 9, 'mid career': 8, 'high earner': 3 });
      expect(by('behaviour')).toEqual({ 'daily regular': 4, explorer: 10, occasional: 6 });
    }
  });

  test('ranges follow the dealt value, pools deal one entry, notes cover the dimension', () => {
    const cards = dealCards(profile, 40, 11, 'B');
    const bands = {
      'early career': [38000, 85000],
      'mid career': [85000, 150000],
      'high earner': [150000, 210000],
    };
    for (const card of cards) {
      const [low, high] = bands[card.segment];
      expect(Number.isInteger(card.income)).toBe(true);
      expect(card.income).toBeGreaterThanOrEqual(low);
      expect(card.income).toBeLessThanOrEqual(high);
      expect(Number.isInteger(card.age)).toBe(true);
      expect(card.age).toBeGreaterThanOrEqual(24);
      expect(card.age).toBeLessThanOrEqual(38);
      expect(card.walk_minutes).toBeGreaterThanOrEqual(1.5);
      expect(card.walk_minutes).toBeLessThanOrEqual(12);
      expect(profile.pools.objection).toContain(card.objection);
      expect(profile.pools.habit).toContain(card.habit);
      expect(card.behaviour_note).toBe(
        card.behaviour === 'explorer'
          ? ''
          : profile.dimensions[1].values.find((v) => v.value === card.behaviour).note
      );
      expect(card).not.toHaveProperty('segment_note');
    }
  });

  test('largest-remainder quotas always add up to n', () => {
    expect(quotas([0.45, 0.4, 0.15], 1)).toEqual([1, 0, 0]);
    expect(quotas([1 / 3, 1 / 3, 1 / 3], 10)).toEqual([4, 3, 3]);
    expect(quotas([0.5, 0.5], 7)).toEqual([4, 3]);
    expect(quotas([0.2, 0.5, 0.3], 1000)).toEqual([200, 500, 300]);
  });

  test('the generator rejects values that would fold the modulus and pads ids to the count', () => {
    const dealer = new Dealer(3);
    const seen = new Set();
    for (let k = 0; k < 500; k += 1) seen.add(dealer.below(3));
    expect([...seen].sort()).toEqual([0, 1, 2]);
    expect(dealCards(profile, 1000, 1, 'B').at(-1).id).toBe('B1000');
    expect(dealCards(profile, 1000, 1, 'B')[0].id).toBe('B0001');
  });
});

describe('definition and profile contracts', () => {
  test('a normalized definition round-trips through the validator unchanged', () => {
    for (const file of ['buyer-panel.json', 'pitch-jury.json', 'page-fanout.json']) {
      const once = contract.normalizeDefinition(read(file));
      expect(contract.normalizeDefinition(JSON.parse(JSON.stringify(once)))).toEqual(once);
    }
  });

  test.each([
    [(d) => (d.kind = 'crowd'), /kind must be panel, jury or fanout/],
    [(d) => (d.units.source = 'list'), /needs units.source "profile"/],
    [(d) => delete d.units.idPrefix, /panel needs units.idPrefix/],
    [(d) => (d.extra = 1), /unknown field "extra"/],
    [(d) => (d.answer.fields.id = { type: 'string' }), /"id" is implicit/],
    [(d) => d.answer.required.push('ghost'), /undeclared field "ghost"/],
    [(d) => (d.answer.fields.reason.type = 'text'), /type must be one of/],
    [(d) => (d.answer.fields.reason_code.values = ['a', 'a']), /must not repeat/],
    [(d) => (d.tally.rate = 'reason'), /must be a declared boolean field/],
    [(d) => (d.tally.counts = ['reason']), /must be a declared enum field/],
    [(d) => (d.tally.quotes = { reason: 11 }), /integer from 1 to 10/],
    [(d) => (d.tally.numbers = ['buys']), /must be a declared integer or number field/],
    [(d) => (d.brief.template = '../outside.md'), /without \. or \.\. parts/],
    [(d) => (d.brief.context = ['Pitch Deck']), /brief.context names must use/],
    [(d) => delete d.disclosure, /disclosure must be a nonempty string/],
  ])('refuses a broken definition (%#)', (mutate, message) => {
    const definition = fixture('buyer-panel.json');
    mutate(definition);
    expect(() => contract.normalizeDefinition(definition)).toThrow(message);
  });

  test.each([
    [(p) => (p.dimensions[0].values[0].share = 0.5), /shares must add up to 1/],
    [(p) => (p.dimensions[0].values[2].ranges = {}), /must declare the same range names/],
    [(p) => (p.ranges.segment = [1, 2]), /collides with another card field/],
    [(p) => (p.pools.id = ['x']), /collides with another card field/],
    [(p) => (p.ranges.age = [38, 24]), /low bound exceeds its high bound/],
    [(p) => (p.dimensions[1].values[0].value = 'explorer'), /values must not repeat/],
  ])('refuses a broken profile (%#)', (mutate, message) => {
    const profile = fixture('profile.json');
    mutate(profile);
    expect(() => contract.normalizeProfile(profile)).toThrow(message);
  });

  test('fanout units need disjoint portable scopes outside .git and the state tree', () => {
    const units = fixture('units.json');
    expect(contract.normalizeUnits(units)).toHaveLength(3);
    units.units[0].scope = 'site/pricing/plans';
    expect(() => contract.normalizeUnits(units)).toThrow(/share a write scope/);
    units.units[0].scope = '.git/hooks';
    expect(() => contract.normalizeUnits(units)).toThrow(/may not reach \.git/);
    units.units[0].scope = '.bmad-plus/swarm/runs';
    expect(() => contract.normalizeUnits(units)).toThrow(/may not reach \.git/);
    units.units[0].scope = 'C:/site';
    expect(() => contract.normalizeUnits(units)).toThrow(/not a portable project-relative path/);
    units.units[0].scope = 'site/../etc';
    expect(() => contract.normalizeUnits(units)).toThrow(/not a portable project-relative path/);
    units.units[0].scope = 'site/about';
    units.units[0].id = 'About';
    expect(() => contract.normalizeUnits(units)).toThrow(/needs an id of 1-64 lowercase/);
  });
});

describe('init', () => {
  test('creates a run with frozen inputs and no brief', () => {
    const result = panel();
    expect(result).toMatchObject({
      status: 'ready',
      kind: 'panel',
      n: 6,
      seed: 7,
      approval: 'not-needed',
    });
    const dir = path.join(project, '.bmad-plus/swarm/runs', result.run);
    expect(fs.readdirSync(dir).sort()).toEqual([
      'cards.json',
      'context',
      'definition.json',
      'run.json',
      'template.md',
    ]);
    const run = JSON.parse(fs.readFileSync(path.join(dir, 'run.json'), 'utf8'));
    expect(run).toMatchObject({
      id: result.run,
      pack: 'marketfit',
      n: 6,
      seed: 7,
      budget: 26,
      wave: 10,
      status: 'ready',
    });
    expect(run.definition.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(run.contexts.pitch.path).toBe('swarm/pitch.md');
    expect(result.run).toMatch(/^buyer-panel-\d{8}-[a-z0-9]{4}$/);
  });

  test('a missing seed is drawn once and recorded', () => {
    const result = panel({ seed: undefined });
    expect(Number.isInteger(result.seed)).toBe(true);
    const run = JSON.parse(fs.readFileSync(path.join(result.directory, 'run.json'), 'utf8'));
    expect(run.seed).toBe(result.seed);
    expect(swarm.briefs(project, result.run).pending).toBe(6);
    const cardsOf = (id) =>
      fs.readFileSync(path.join(project, '.bmad-plus/swarm/runs', id, 'cards.json'), 'utf8');
    const again = panel({ seed: String(result.seed) });
    expect(cardsOf(again.run)).toBe(cardsOf(result.run));
    expect(panel({ seed: 2147483647 }).seed).toBe(2147483647);
    expect(() => panel({ seed: 2147483648 })).toThrow(
      /seed must be an integer from 0 to 2147483647/
    );
  });

  test('a brief placeholder that no card or context can fill fails init', () => {
    write('swarm/briefs/buyer.md', 'Hello {{card.nickname}}');
    expect(() => panel()).toThrow(/\{\{card\.nickname\}\} is absent from unit B001/);
    write('swarm/briefs/buyer.md', 'Hello {{context.deck}}');
    expect(() => panel()).toThrow(/names a context the definition does not declare/);
    write('swarm/briefs/buyer.md', 'Hello {{ whatever }}');
    expect(() => panel()).toThrow(/Unknown placeholder \{\{whatever\}\}/);
    write('swarm/briefs/buyer.md', 'Hello {{card.Segment}}');
    expect(() => panel()).toThrow(/Unknown placeholder/);
  });

  test('contexts must match the declaration, panels need a profile and a count', () => {
    expect(() => panel({ context: [] })).toThrow(/needs --context pitch=FILE/);
    expect(() => panel({ context: ['pitch=swarm/pitch.md', 'deck=swarm/pitch.md'] })).toThrow(
      /not declared/
    );
    expect(() => panel({ context: ['pitch=swarm/pitch.md', 'pitch=swarm/pitch.md'] })).toThrow(
      /given twice/
    );
    expect(() => panel({ profile: undefined })).toThrow(/panel needs --profile/);
    expect(() => panel({ n: undefined })).toThrow(/panel needs --n/);
    expect(() => panel({ n: 0 })).toThrow(/integer from 1 to 1000/);
    expect(() => panel({ n: '1001' })).toThrow(/integer from 1 to 1000/);
    expect(() => panel({ seed: -1 })).toThrow(/seed must be an integer/);
    expect(() => panel({ units: 'swarm/units.json' })).toThrow(/takes --profile, not --units/);
  });

  test('a jury lists its units and a fanout reads them, neither takes n or seed', () => {
    const jury = swarm.init(project, {
      definition: 'swarm/pitch-jury.json',
      context: ['pitch=swarm/pitch.md'],
    });
    expect(jury).toMatchObject({
      kind: 'jury',
      n: 3,
      seed: null,
      units: ['J001', 'J002', 'J-habit'],
    });
    expect(() =>
      swarm.init(project, {
        definition: 'swarm/pitch-jury.json',
        context: ['pitch=swarm/pitch.md'],
        n: 3,
      })
    ).toThrow(/--n does not apply/);
    const fanout = swarm.init(project, {
      definition: 'swarm/page-fanout.json',
      units: 'swarm/units.json',
    });
    expect(fanout).toMatchObject({ kind: 'fanout', n: 3, units: ['about', 'pricing', 'contact'] });
    expect(() =>
      swarm.init(project, {
        definition: 'swarm/page-fanout.json',
        units: 'swarm/units.json',
        seed: 1,
      })
    ).toThrow(/seed only applies/);
    expect(() => swarm.init(project, { definition: 'swarm/page-fanout.json' })).toThrow(
      /fanout needs --units/
    );
  });

  test('jury ids differing only by case collide; a fanout id leaves room for a Nexus run id', () => {
    const jury = fixture('pitch-jury.json');
    jury.units.list[0].id = 'j-habit';
    write('swarm/case-jury.json', jury);
    expect(() =>
      swarm.init(project, { definition: 'swarm/case-jury.json', context: ['pitch=swarm/pitch.md'] })
    ).toThrow(/distinct once dealt, whatever their case/);
    const fanout = fixture('page-fanout.json');
    fanout.id = 'p'.repeat(51);
    write('swarm/long-fanout.json', fanout);
    expect(() =>
      swarm.init(project, { definition: 'swarm/long-fanout.json', units: 'swarm/units.json' })
    ).toThrow(/at most 50 characters/);
    fanout.id = 'p'.repeat(50);
    write('swarm/long-fanout.json', fanout);
    const { run } = swarm.init(project, {
      definition: 'swarm/long-fanout.json',
      units: 'swarm/units.json',
    });
    expect(contract.NEXUS_ID.test(run)).toBe(true);
  });
});

describe('budget', () => {
  test('a run beyond the budget needs approval, writes no brief and says what to do next', () => {
    config('  budget: 5\n  wave: 2\n');
    const result = panel();
    expect(result).toMatchObject({
      status: 'needs-approval',
      approval: 'pending',
      budget: 5,
      wave: 2,
    });
    expect(result.next).toContain('--approved --seed 7');
    expect(swarm.briefs(project, result.run)).toMatchObject({ status: 'needs-approval', seed: 7 });
    expect(swarm.tally(project, result.run).status).toBe('needs-approval');
    expect(fs.existsSync(path.join(result.directory, 'briefs'))).toBe(false);
    expect(swarm.inspect(project, result.run).budget.decision).toMatch(
      /needs approval: 6 units exceed the budget of 5/
    );
  });

  test('--approved records the user and unlocks the same cards', () => {
    config('  budget: 5\n');
    const refused = panel();
    const approved = panel({ approved: true });
    expect(approved).toMatchObject({ status: 'ready', approval: 'user' });
    const cardsOf = (run) =>
      fs.readFileSync(path.join(project, '.bmad-plus/swarm/runs', run, 'cards.json'), 'utf8');
    expect(cardsOf(approved.run)).toBe(cardsOf(refused.run));
    expect(swarm.inspect(project, approved.run).budget.decision).toBe('approved by the user');
    expect(swarm.briefs(project, approved.run).waves).toHaveLength(1);
  });

  test('the configuration block defaults when absent and refuses what it cannot read', () => {
    expect(swarm.SWARM_DEFAULTS).toEqual({ budget: 26, wave: 10, media_credits: 'ask' });
    expect(swarm.readConfig(project)).toEqual(swarm.SWARM_DEFAULTS);
    config();
    expect(swarm.readConfig(project)).toEqual(swarm.SWARM_DEFAULTS);
    config('  budget: 40\n');
    expect(swarm.readConfig(project)).toEqual({ budget: 40, wave: 10, media_credits: 'ask' });
    config('  budget: 0\n');
    expect(() => swarm.readConfig(project)).toThrow(
      /swarm.budget must be an integer from 1 to 1000/
    );
    config('  wave: 1001\n');
    expect(() => swarm.readConfig(project)).toThrow(/swarm.wave must be an integer/);
    config('  wave: "10"\n');
    expect(() => swarm.readConfig(project)).toThrow(/swarm.wave must be an integer/);
    config('  media_credits: pay\n');
    expect(() => swarm.readConfig(project)).toThrow(/media_credits must be "ask"/);
    config('  limit: 3\n');
    expect(() => swarm.readConfig(project)).toThrow(/unknown key "limit"/);
    write('_bmad/config.yaml', 'swarm: [1]\n');
    expect(() => swarm.readConfig(project)).toThrow(/swarm must be a mapping/);
  });
});

describe('briefs and answers', () => {
  test('briefs render every placeholder, split into waves and skip answered units', () => {
    const { run } = panel();
    const result = swarm.briefs(project, run, { wave: 4 });
    expect(result).toMatchObject({ status: 'briefed', wave: 4, units: 6, pending: 6 });
    expect(result.waves.map((wave) => wave.units.length)).toEqual([4, 2]);
    const unit = result.waves[0].units[0];
    expect(unit.id).toBe('B001');
    const brief = fs.readFileSync(unit.brief, 'utf8');
    expect(brief).toContain('# You are unit B001 of run ' + run);
    expect(brief).toContain('Orbit opens at 7');
    expect(brief).toContain('`' + unit.answer + '`');
    expect(brief).toContain('Simulated units are not people.');
    expect(brief).not.toMatch(/\{\{|\}\}/);
    answer(run, 'B001', { id: 'B001', buys: true, reason_code: 'habit', reason: 'On my way.' });
    expect(swarm.briefs(project, run, { wave: 4 }).pending).toBe(5);
    expect(() => swarm.briefs(project, run, { wave: 0 })).toThrow(/wave must be an integer/);
  });

  test('check names every missing or invalid answer with its reason', () => {
    const { run } = panel({ n: 3 });
    swarm.briefs(project, run);
    answer(run, 'B001', { id: 'B001', buys: true, reason_code: 'habit', reason: 'On my way.' });
    answer(run, 'B002', {
      id: 'B003',
      buys: 'yes',
      reason_code: 'luck',
      reason: 'x'.repeat(601),
      price_floor: -1,
    });
    write('.bmad-plus/swarm/runs/' + run + '/answers/B003.json', '{not json');
    const result = swarm.check(project, run);
    expect(result).toMatchObject({ status: 'incomplete', units: 3, valid: 1 });
    expect(result.pending.map((unit) => unit.id)).toEqual(['B002', 'B003']);
    expect(result.pending[0].reason).toContain('id is "B003", expected "B002"');
    expect(result.pending[0].reason).toContain('field "buys" must be true or false');
    expect(result.pending[0].reason).toContain(
      'field "reason_code" must be one of price, habit, need, trust, other'
    );
    expect(result.pending[0].reason).toContain('field "reason" is longer than 600');
    expect(result.pending[0].reason).toContain('field "price_floor" is below 0');
    expect(result.pending[1]).toMatchObject({
      state: 'invalid',
      reason: 'the answer is not valid JSON',
    });
    answer(run, 'B002', {
      id: 'B002',
      buys: false,
      reason_code: 'price',
      reason: 'Too steep.',
      would_tell: ['a', 'b'],
    });
    answer(run, 'B003', {
      id: 'B003',
      buys: false,
      reason_code: 'other',
      reason: 'No.',
      visits_per_week: 2,
    });
    expect(swarm.check(project, run).status).toBe('complete');
  });

  test('answer validation refuses every type and bound breach and unknown fields', () => {
    const definition = contract.normalizeDefinition(read('buyer-panel.json'));
    const ok = { id: 'B001', buys: true, reason_code: 'need', reason: 'Fine.' };
    expect(contract.answerProblems(definition, 'B001', ok)).toEqual([]);
    expect(contract.answerProblems(definition, 'B001', [ok])).toEqual([
      'the answer is not a JSON object',
    ]);
    expect(contract.answerProblems(definition, 'B001', { ...ok, extra: 1 })).toEqual([
      'unknown field "extra"',
    ]);
    expect(contract.answerProblems(definition, 'B001', { id: 'B001' })).toEqual([
      'missing required field "buys"',
      'missing required field "reason_code"',
      'missing required field "reason"',
    ]);
    expect(contract.answerProblems(definition, 'B001', { ...ok, visits_per_week: 1.5 })).toEqual([
      'field "visits_per_week" must be an integer',
    ]);
    expect(contract.answerProblems(definition, 'B001', { ...ok, visits_per_week: 15 })).toEqual([
      'field "visits_per_week" is above 14',
    ]);
    expect(contract.answerProblems(definition, 'B001', { ...ok, price_floor: '4' })).toEqual([
      'field "price_floor" must be a number',
    ]);
    expect(
      contract.answerProblems(definition, 'B001', { ...ok, would_tell: ['a', 'b', 'c', 'd'] })
    ).toEqual(['field "would_tell" has more than 3 items']);
    expect(contract.answerProblems(definition, 'B001', { ...ok, would_tell: [1] })).toEqual([
      'field "would_tell" items must be nonempty strings of at most 1000 characters',
    ]);
    expect(contract.answerProblems(definition, 'B001', { ...ok, would_tell: 'a' })).toEqual([
      'field "would_tell" must be a list of strings',
    ]);
    expect(contract.answerProblems(definition, 'B001', { ...ok, reason: 7 })).toEqual([
      'field "reason" must be a string',
    ]);
    expect(contract.answerProblems(definition, 'B001', { ...ok, reason: null })).toEqual([
      'field "reason" must be a string',
    ]);
  });

  test('save files the object a sub-agent printed and refuses anything else', () => {
    const { run } = panel({ n: 2 });
    swarm.briefs(project, run);
    write(
      'swarm/inbox/B001.txt',
      'Here is my answer as unit B001 {not json}:\n\n```json\n{"id": "B001", "buys": true, "reason_code": "habit", "reason": "It is on my way, {{braces}} and \\"quotes\\" inside."}\n```\nDone.'
    );
    const saved = swarm.save(project, run, 'B001', { input: 'swarm/inbox/B001.txt' });
    expect(saved).toMatchObject({ status: 'saved', unit: 'B001' });
    expect(JSON.parse(fs.readFileSync(saved.answer, 'utf8'))).toEqual({
      id: 'B001',
      buys: true,
      reason_code: 'habit',
      reason: 'It is on my way, {{braces}} and "quotes" inside.',
    });
    expect(() => swarm.save(project, run, 'B001', { input: 'swarm/inbox/B001.txt' })).toThrow(
      /already has a valid answer/
    );
    write(
      'swarm/inbox/B002.txt',
      '{"id": "B001", "buys": false, "reason_code": "price", "reason": "No."}'
    );
    expect(() => swarm.save(project, run, 'B002', { input: 'swarm/inbox/B002.txt' })).toThrow(
      /id is "B001", expected "B002"/
    );
    write('swarm/inbox/B002.txt', 'I refuse to answer. { "lonely brace"');
    expect(() => swarm.save(project, run, 'B002', { input: 'swarm/inbox/B002.txt' })).toThrow(
      /No JSON object found/
    );
    write('swarm/inbox/B002.txt', '[{"id": "B002"}]');
    expect(() => swarm.save(project, run, 'B002', { input: 'swarm/inbox/B002.txt' })).toThrow(
      /missing required field "buys"/
    );
    expect(() => swarm.save(project, run, 'B009', { input: 'swarm/inbox/B002.txt' })).toThrow(
      /Unknown unit B009/
    );
    expect(() => swarm.save(project, run, 'B002', {})).toThrow(/needs --input FILE/);
    expect(swarm.check(project, run).pending.map((unit) => unit.id)).toEqual(['B002']);
  });

  test('extraction takes the first balanced object and gives up on brace floods', () => {
    expect(swarm.extractObject('x {"a": {"b": 1}} y {"c": 2}')).toEqual({ a: { b: 1 } });
    expect(swarm.extractObject('{ broken } then {"c": 2}')).toEqual({ c: 2 });
    expect(swarm.extractObject('{'.repeat(2000))).toBeNull();
    expect(swarm.extractObject('nothing here')).toBeNull();
    expect(swarm.extractObject('{x} '.repeat(25) + '{"late": true}')).toBeNull();
  });

  test('a hostile reply costs milliseconds, not seconds', () => {
    const mebibyte = 1024 * 1024;
    const floods = [
      '{'.repeat(mebibyte),
      '{'.repeat(1000) + '"' + 'x'.repeat(900 * 1024) + '"',
      ('{ "a": "' + 'y'.repeat(40000) + '" ').repeat(25),
    ];
    for (const flood of floods) {
      const started = process.hrtime.bigint();
      expect(swarm.extractObject(flood.slice(0, mebibyte))).toBeNull();
      // Before the bound these replies cost 7-10 s. Coverage instrumentation and the suites
      // running alongside inflate the figure, so the ceiling leaves room for both.
      expect(Number(process.hrtime.bigint() - started) / 1e6).toBeLessThan(1500);
    }
  });

  test('answer keys are own declared fields only, so prototype names are unknown', () => {
    const definition = contract.normalizeDefinition(read('buyer-panel.json'));
    const answer = JSON.parse(
      '{"id":"B001","buys":true,"reason_code":"need","reason":"x","__proto__":{"polluted":1},"constructor":1}'
    );
    expect(contract.answerProblems(definition, 'B001', answer)).toEqual([
      'unknown field "__proto__"',
      'unknown field "constructor"',
    ]);
    const broken = fixture('buyer-panel.json');
    broken.tally.rate = 'constructor';
    expect(() => contract.normalizeDefinition(broken)).toThrow(/must be a declared boolean field/);
  });

  test('answers reached through a linked directory never count', () => {
    const { run } = panel({ n: 1 });
    swarm.briefs(project, run);
    const answers = path.join(project, '.bmad-plus/swarm/runs', run, 'answers');
    fs.rmSync(answers, { recursive: true });
    const outside = fs.mkdtempSync(path.join(tempParent, 'bmad-swarm-outside-'));
    try {
      fs.writeFileSync(
        path.join(outside, 'B001.json'),
        JSON.stringify({ id: 'B001', buys: true, reason_code: 'habit', reason: 'Foreign.' })
      );
      try {
        fs.symlinkSync(outside, answers, 'junction');
      } catch (error) {
        if (error.code === 'EPERM') return;
        throw error;
      }
      const result = swarm.check(project, run);
      expect(result.status).toBe('incomplete');
      expect(result.pending[0]).toMatchObject({ id: 'B001', state: 'invalid' });
      expect(result.pending[0].reason).toMatch(/refused.*symlink or junction/);
      expect(swarm.tally(project, run).tally.units.skipped).toHaveLength(1);
      write(
        'swarm/inbox/B001.txt',
        '{"id": "B001", "buys": true, "reason_code": "habit", "reason": "x"}'
      );
      expect(() => swarm.save(project, run, 'B001', { input: 'swarm/inbox/B001.txt' })).toThrow(
        /Run file refused.*symlink or junction/
      );
      const briefs = path.join(project, '.bmad-plus/swarm/runs', run, 'briefs');
      fs.rmSync(briefs, { recursive: true });
      fs.symlinkSync(outside, briefs, 'junction');
      expect(swarm.inspect(project, run).counts).toMatchObject({ briefed: 0, invalid: 1 });
    } finally {
      removeTree(outside);
    }
  });

  test('save files nothing into a run that still needs approval', () => {
    config('  budget: 2\n');
    const { run } = panel({ n: 3 });
    write(
      'swarm/inbox/B001.txt',
      '{"id": "B001", "buys": true, "reason_code": "habit", "reason": "x"}'
    );
    expect(swarm.save(project, run, 'B001', { input: 'swarm/inbox/B001.txt' })).toMatchObject({
      status: 'needs-approval',
      seed: 7,
    });
    expect(swarm.check(project, run).pending.map((unit) => unit.state)).toEqual([
      'missing',
      'missing',
      'missing',
    ]);
    expect(swarm.inspect(project, run).counts.missing).toBe(3);
  });
});

describe('tally', () => {
  function answered() {
    const { run } = panel({ n: 6 });
    swarm.briefs(project, run);
    const cards = JSON.parse(
      fs.readFileSync(path.join(project, '.bmad-plus/swarm/runs', run, 'cards.json'), 'utf8')
    );
    const replies = {
      B001: { buys: true, reason_code: 'habit', reason: 'On the way.', price_floor: 4 },
      B002: { buys: false, reason_code: 'price', reason: 'Too steep, "really".', price_floor: 3.5 },
      B003: { buys: true, reason_code: 'need', reason: 'I wanted a flat white.' },
      B004: { buys: true, reason_code: 'habit', reason: 'Same street.', price_floor: 5 },
      B005: { buys: false, reason_code: 'price', reason: 'No.', price_floor: 2 },
    };
    for (const [id, reply] of Object.entries(replies)) answer(run, id, { id, ...reply });
    write('.bmad-plus/swarm/runs/' + run + '/answers/B006.json', '{"id": "B006"}');
    return { run, cards, replies };
  }

  test('counts valid answers only, by group, with verbatim quotes and the disclosure first', () => {
    const { run, cards, replies } = answered();
    const result = swarm.tally(project, run);
    expect(result.status).toBe('tallied');
    const { tally } = result;
    expect(tally.units).toEqual({
      total: 6,
      valid: 5,
      skipped: [
        {
          unit: 'B006',
          reason:
            'missing required field "buys"; missing required field "reason_code"; missing required field "reason"',
        },
      ],
    });
    expect(tally.rate.all).toEqual({ yes: 3, of: 5, rate: 0.6 });
    for (const field of ['segment', 'behaviour']) {
      for (const [value, group] of Object.entries(tally.rate.groups[field])) {
        const members = cards.filter((card) => card[field] === value && replies[card.id]);
        expect(group.of).toBe(members.length);
        expect(group.yes).toBe(members.filter((card) => replies[card.id].buys).length);
        expect(group.rate).toBe(
          group.of ? Math.round((group.yes / group.of) * 10000) / 10000 : null
        );
      }
    }
    expect(tally.counts.reason_code.all).toEqual({
      price: 2,
      habit: 2,
      need: 1,
      trust: 0,
      other: 0,
    });
    expect(tally.quotes.reason.keep).toBe(2);
    expect(tally.quotes.reason.all).toEqual([
      { unit: 'B001', text: 'On the way.' },
      { unit: 'B002', text: 'Too steep, "really".' },
    ]);
    for (const groups of Object.values(tally.quotes.reason.groups))
      for (const quotes of Object.values(groups)) {
        expect(quotes.length).toBeLessThanOrEqual(2);
        for (const quote of quotes) expect(quote.text).toBe(replies[quote.unit].reason);
      }
    expect(tally.numbers.price_floor.all).toEqual({
      count: 4,
      median: 3.75,
      mean: 3.625,
      min: 2,
      max: 5,
    });
    const markdown = fs.readFileSync(result.files.markdown, 'utf8');
    expect(markdown.startsWith('> Simulated units are not people.')).toBe(true);
    expect(markdown).toContain('5 of 6 units gave a valid answer; 1 skipped: B006 (');
    expect(markdown).toContain('| all | 3 | 5 | 60.0% |');
    expect(markdown).toContain('- B002: "Too steep, \\"really\\"."');
    expect(JSON.parse(fs.readFileSync(result.files.json, 'utf8'))).toEqual(tally);
    expect(swarm.inspect(project, run)).toMatchObject({
      status: 'tallied',
      counts: { units: 6, briefed: 6, valid: 5, invalid: 1, missing: 0 },
    });
  });

  test('--out writes a report of this run or a free file of its own tree, nothing else', () => {
    const { run } = answered();
    const other = panel({ n: 2 }).run;
    const runs = '.bmad-plus/swarm/runs/';
    const frozen = (id, file) => fs.readFileSync(path.join(project, runs, id, file), 'utf8');
    const before = { run: frozen(other, 'run.json'), cards: frozen(run, 'cards.json') };
    const report = swarm.tally(project, run, {
      out: '.bmad-plus/swarm/reports/' + run + '/buyers.md',
    });
    expect(fs.existsSync(report.files.markdown)).toBe(true);
    const own = swarm.tally(project, run, { out: runs + run + '/notes/summary.md' });
    expect(fs.existsSync(own.files.markdown)).toBe(true);
    const refused = (out, message) =>
      expect(() => swarm.tally(project, run, { out })).toThrow(message);
    refused(runs + other + '/run.json', /must stay under .*reports\/.* or /);
    refused('.bmad-plus/swarm/reports/' + other + '/x.md', /must stay under/);
    refused('.bmad-plus/swarm/x.md', /must stay under/);
    refused('docs/tally.md', /must stay under/);
    refused(runs + run + '/cards.json', /may not replace the run file cards\.json/);
    refused(runs + run + '/definition.json', /may not replace the run file definition\.json/);
    refused(runs + run + '/notes/run.json', /may not replace the run file run\.json/);
    refused(runs + run + '/answers/B001.json', /may not write inside .*answers\//);
    refused(runs + run + '/briefs/x.md', /may not write inside .*briefs\//);
    refused(runs + run + '/context/pitch.md', /may not write inside .*context\//);
    refused(runs + run + '/checks/answer.cjs', /may not write inside .*checks\//);
    refused('.bmad-plus/swarm/../x.md', /not a portable/);
    expect(frozen(other, 'run.json')).toBe(before.run);
    expect(frozen(run, 'cards.json')).toBe(before.cards);
    expect(stats([])).toEqual({ count: 0, median: null, mean: null, min: null, max: null });
    expect(stats([3, 1])).toEqual({ count: 2, median: 2, mean: 2, min: 1, max: 3 });
  });

  test('a jury tallies counts and quotes without a rate', () => {
    const { run } = swarm.init(project, {
      definition: 'swarm/pitch-jury.json',
      context: ['pitch=swarm/pitch.md'],
    });
    swarm.briefs(project, run);
    answer(run, 'J001', { id: 'J001', verdict: 'weak', weakest_claim: 'The tenth one free.' });
    answer(run, 'J-habit', {
      id: 'J-habit',
      verdict: 'unclear',
      weakest_claim: 'Under your name.',
      fixes: ['say how'],
    });
    const { tally } = swarm.tally(project, run);
    expect(tally.rate).toBeNull();
    expect(tally.units.skipped).toEqual([{ unit: 'J002', reason: 'no answer file' }]);
    expect(tally.counts.verdict.all).toEqual({ convincing: 0, unclear: 1, weak: 1 });
    expect(tally.quotes.weakest_claim.all.map((quote) => quote.unit)).toEqual(['J001', 'J-habit']);
  });
});

describe('paths', () => {
  test.each([
    ['../outside.json', /not a portable project-relative path/],
    ['swarm/../swarm/buyer-panel.json', /not a portable project-relative path/],
    ['/etc/passwd', /not a portable project-relative path/],
    ['C:\\swarm\\buyer-panel.json', /not a portable project-relative path/],
    ['.git/config', /may not reach \.git/],
    ['swarm/.GIT/buyer-panel.json', /may not reach \.git/],
    ['.bmad-plus/swarm/buyer-panel.json', /may not come from the BMAD\+ state tree/],
    ['.BMAD-PLUS/nexus/plan.json', /may not come from the BMAD\+ state tree/],
    ['swarm/missing.json', /does not exist/],
    ['swarm', /refused/],
  ])('refuses the definition path %s', (definition, message) => {
    expect(() => panel({ definition })).toThrow(message);
  });

  test('refuses a definition reached through a link and a template that escapes', () => {
    const link = path.join(project, 'linked');
    try {
      fs.symlinkSync(path.join(project, 'swarm'), link, 'junction');
    } catch (error) {
      if (error.code === 'EPERM') return;
      throw error;
    }
    expect(() => panel({ definition: 'linked/buyer-panel.json' })).toThrow(/symlink or junction/);
    const definition = fixture('buyer-panel.json');
    definition.brief.template = 'briefs/../../pitch.md';
    write('swarm/escape.json', definition);
    expect(() => panel({ definition: 'swarm/escape.json' })).toThrow(/without \. or \.\. parts/);
    definition.brief.template = 'deeper/../../pitch.md';
    write('swarm/escape.json', definition);
    expect(() => panel({ definition: 'swarm/escape.json' })).toThrow(/without \. or \.\. parts/);
  });

  test('a run id and its files are checked before anything is read', () => {
    expect(() => swarm.check(project, '../x')).toThrow(/run id reads/);
    expect(() => swarm.check(project, 'buyer-panel-20261016-zzzz')).toThrow(/Run does not exist/);
    const { run } = panel({ n: 2 });
    write('.bmad-plus/swarm/runs/' + run + '/run.json', {
      schemaVersion: 1,
      id: 'other',
      status: 'ready',
    });
    expect(() => swarm.check(project, run)).toThrow(/Run record is not usable/);
    expect(() => swarm.init('/nowhere/at/all', PANEL)).toThrow(/Project directory does not exist/);
  });
});

describe('plan', () => {
  test('exports a fanout as a Nexus plan with disjoint scopes, portable paths and artifacts', () => {
    config('  wave: 2\n');
    const { run } = swarm.init(project, {
      definition: 'swarm/page-fanout.json',
      units: 'swarm/units.json',
    });
    const result = swarm.plan(project, run);
    expect(result).toMatchObject({ status: 'planned', tasks: 3, maxParallel: 2 });
    const plan = JSON.parse(fs.readFileSync(result.plan, 'utf8'));
    const base = '.bmad-plus/swarm/runs/' + run;
    expect(plan.id).toBe(run);
    expect(plan.tasks.map((task) => task.id)).toEqual(['about', 'pricing', 'contact']);
    const pricing = plan.tasks[1];
    expect(pricing.scope).toEqual([
      'site/pricing',
      'site/data/prices.json',
      base + '/answers/pricing.json',
    ]);
    expect(pricing.artifacts).toEqual([base + '/answers/pricing.json']);
    expect(pricing.checks).toEqual([
      {
        id: 'answer',
        command: 'node',
        args: [base + '/checks/answer.cjs', '--unit=pricing'],
        cwd: '.',
        timeoutMs: 30000,
      },
    ]);
    expect(pricing.objective).toContain(
      'Read ' + base + '/briefs/pricing.md and follow it exactly'
    );
    const scopes = plan.tasks.flatMap((task) => task.scope);
    for (const left of scopes)
      for (const right of scopes)
        if (left !== right) expect(left.startsWith(right + '/')).toBe(false);
    for (const task of plan.tasks)
      for (const file of [...task.resources, ...task.artifacts, ...task.scope]) {
        expect(file).not.toMatch(/\\|^[A-Za-z]:|^\/|\.\./);
      }
    for (const task of plan.tasks)
      for (const file of task.resources) {
        expect(fs.existsSync(path.join(project, file))).toBe(true);
        expect(task.scope.some((scope) => file === scope || file.startsWith(scope + '/'))).toBe(
          false
        );
      }
    expect(fs.readFileSync(path.join(project, base, 'checks/swarm-validate.cjs'), 'utf8')).toBe(
      fs.readFileSync(path.resolve(__dirname, '../../tools/cli/lib/swarm-validate.js'), 'utf8')
    );
    expect(fs.readFileSync(path.join(project, base, 'briefs/about.md'), 'utf8')).toContain(
      'under `site/about`, warm in tone'
    );
  });

  test('only a fanout exports, never one that still needs approval', () => {
    const { run } = panel({ n: 2 });
    expect(() => swarm.plan(project, run)).toThrow(/Only a fanout exports a Nexus plan/);
    config('  budget: 2\n');
    const refused = swarm.init(project, {
      definition: 'swarm/page-fanout.json',
      units: 'swarm/units.json',
    });
    expect(swarm.plan(project, refused.run).status).toBe('needs-approval');
    expect(fs.existsSync(path.join(refused.directory, 'checks'))).toBe(false);
  });
});
