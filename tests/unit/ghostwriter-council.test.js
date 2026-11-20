const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const swarm = require('../../tools/cli/lib/swarm');
const { removeTree } = require('../helpers/process-budget');
const workshop = '../../src/bmad-plus/packs/pack-ghostwriter/workshops/council';
const { select } = require(workshop + '/select.cjs');
const roster = require(workshop + '/jury.json');

let project;
beforeEach(() => {
  project = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'bmad-council-'));
});
afterEach(() => removeTree(project));

test('each selectable narrative method has its own shipped specialist card', () => {
  const directory = path.join(__dirname, workshop, '..');
  for (const { id } of roster.units.list) {
    expect(fs.statSync(path.join(directory, id, 'specialist.md')).isFile()).toBe(true);
  }
});

test('only the selected seats receive distinct native briefs; unanswered seats stay missing', () => {
  const seats = ['three-act', 'hero-journey'];
  const selected = select(project, seats);
  fs.writeFileSync(path.join(project, 'scene.md'), 'Someone folds the list.');
  const run = swarm.init(project, {
    definition: selected.definition,
    context: ['scene=scene.md', 'round=' + selected.opening],
  });
  expect(run.units).toEqual(seats);
  const wave = swarm.briefs(project, run.run).waves[0].units;
  const texts = wave.map((unit) => fs.readFileSync(unit.brief, 'utf8'));
  for (const brief of texts) expect(brief).toContain('Someone folds the list.');
  for (const [index, id] of seats.entries()) {
    const card = fs.readFileSync(path.join(__dirname, workshop, '..', id, 'specialist.md'), 'utf8');
    expect(texts[index]).toContain(card.trim());
  }
  expect(texts[0]).not.toBe(texts[1]);
  expect(swarm.check(project, run.run).valid).toBe(0);
  expect(swarm.tally(project, run.run).tally.units.skipped).toHaveLength(2);
});

test.each([['three-act'], ['three-act', 'three-act'], ['three-act', 'mystery']])(
  'refuses unusable seat selection beginning with %s before creating a workspace',
  (...seats) => {
    expect(() => select(project, seats)).toThrow();
    expect(fs.readdirSync(project)).toEqual([]);
  }
);

test('cross-references bind two rounds to the same scene and the other seat’s actual proposal', () => {
  const { assess } = require(workshop + '/check.cjs');
  const scene = 'Lina folds the list.';
  function answer(id, proposal) {
    return {
      id,
      anchor: scene,
      reading: 'The broadcast ends.',
      proposal,
      cost: 'Ambiguity.',
      peer: '',
      peer_quote: '',
      response: '',
    };
  }
  const first = answer('three-act', 'Keep the ending.');
  const second = answer('hero-journey', 'Show the choice.');
  const initial = {
    id: 'initial',
    hash: 'A',
    scene,
    answers: new Map([
      [first.id, first],
      [second.id, second],
    ]),
  };
  const response = {
    id: 'reply',
    hash: 'A',
    scene,
    notice: 'Opening run initial.',
    answers: new Map([
      [
        first.id,
        { ...first, peer: second.id, peer_quote: second.proposal, response: 'Which choice?' },
      ],
      [
        second.id,
        { ...second, peer: first.id, peer_quote: first.proposal, response: 'Which ending?' },
      ],
    ]),
  };
  expect(assess(initial, response)).toMatchObject({
    status: 'references-complete',
    supportedReplies: 2,
  });
  expect(() => assess(initial, { ...response, hash: 'B' })).toThrow('same frozen scene');
  expect(() => assess(initial, { ...response, notice: 'Opening run initial-old.' })).toThrow(
    'exact opening'
  );
  response.answers.get(first.id).peer_quote = 'Invented quotation';
  expect(assess(initial, response)).toMatchObject({ status: 'incomplete', supportedReplies: 1 });
  response.answers.delete(second.id);
  expect(assess(initial, response)).toMatchObject({ status: 'incomplete', supportedReplies: 0 });
});
