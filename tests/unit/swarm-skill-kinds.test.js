/** The swarm skills state how many kinds there are, and the tables below list exactly that many. */
const fs = require('node:fs');
const path = require('node:path');

const skills = path.resolve(__dirname, '../../src/bmad-plus/skills');
const NUMBER = { two: 2, three: 3, four: 4, five: 5 };

const kindRows = (text) =>
  text.split('\n').filter((line) => /^\| `(panel|jury|fanout)` \|/.test(line));

describe('swarm kinds', () => {
  test.each([
    ['bmad-plus-parallel', /\b(two|three|four|five) kinds, one runtime/i],
    ['bmad-plus-swarm', /^## The (two|three|four|five) kinds$/im],
  ])('%s says as many kinds as its table lists', (skill, pattern) => {
    const text = fs.readFileSync(path.join(skills, skill, 'SKILL.md'), 'utf8');
    const stated = text.match(pattern);
    expect(stated).not.toBeNull();
    expect(kindRows(text)).toHaveLength(NUMBER[stated[1].toLowerCase()]);
  });
});
