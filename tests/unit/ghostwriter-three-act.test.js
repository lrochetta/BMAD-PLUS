const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const swarm = require('../../tools/cli/lib/swarm');
const { removeTree } = require('../helpers/process-budget');

const installed = '.agents/skills/pack-ghostwriter/workshops/three-act';
const workshop = path.resolve(
  __dirname,
  '../../src/bmad-plus/packs/pack-ghostwriter/workshops/three-act'
);

test('each specialist receives a distinct mandate and a verbatim peer proposal in the second jury', () => {
  const project = fs.mkdtempSync(
    path.join(fs.realpathSync.native(os.tmpdir()), 'ghostwriter-acts-')
  );
  try {
    fs.cpSync(workshop, path.join(project, installed), { recursive: true });
    const folder = path.join(project, 'workshop');
    fs.mkdirSync(folder);
    fs.copyFileSync(path.join(workshop, 'example.md'), path.join(folder, 'story.md'));
    const context = ['story=workshop/story.md'];
    const first = swarm.init(project, { definition: installed + '/proposals.json', context });
    const seats = swarm.briefs(project, first.run).waves.flatMap((wave) => wave.units);
    const ids = ['installation', 'confrontation', 'resolution'];
    expect(seats.map((unit) => unit.id)).toEqual(ids);
    expect(swarm.check(project, first.run).valid).toBe(0);

    for (const unit of seats) {
      expect(fs.readFileSync(unit.brief, 'utf8')).toContain('Noé holds its loose hem.');
      const answer = {
        id: unit.id,
        anchor: 'S2',
        reading: 'The transfer of the key changes who can enter.',
        proposal: 'Candidate scene reading by ' + unit.id,
        cost: 'The audience might miss the earlier choice.',
        handoff: 'Ask how the changed gesture sets up the last image.',
      };
      fs.writeFileSync(unit.answer, JSON.stringify(answer));
      fs.copyFileSync(unit.answer, path.join(folder, unit.id + '.json'));
    }
    expect(swarm.check(project, first.run).valid).toBe(3);

    const definition = installed + '/objections.json';
    expect(() => swarm.init(project, { definition, context })).toThrow(/context/);
    const second = swarm.init(project, {
      definition,
      context: [...context, ...ids.map((id) => id + '=workshop/' + id + '.json')],
    });
    const peers = {
      installation: 'resolution',
      confrontation: 'installation',
      resolution: 'confrontation',
    };
    const objections = swarm.briefs(project, second.run).waves.flatMap((wave) => wave.units);
    expect(objections.map((unit) => unit.id)).toEqual(ids);
    for (const unit of objections) {
      const brief = fs.readFileSync(unit.brief, 'utf8');
      expect(brief).toContain('**' + peers[unit.id] + '**');
      for (const id of ids) expect(brief).toContain('Candidate scene reading by ' + id);
    }
    expect(swarm.check(project, second.run).valid).toBe(0);
    expect(swarm.tally(project, second.run).tally.units.skipped).toHaveLength(3);
  } finally {
    removeTree(project);
  }
});
