'use strict';

const fs = require('node:fs');
const path = require('node:path');

function select(directory, seats) {
  const definition = JSON.parse(fs.readFileSync(path.join(__dirname, 'jury.json'), 'utf8'));
  const roster = new Map(definition.units.list.map((card) => [card.id, card]));
  if (seats.length < 2 || new Set(seats).size !== seats.length) {
    throw new Error('Choose at least two distinct narrative specialists.');
  }
  definition.units.list = seats.map((id) => {
    if (!roster.has(id)) throw new Error('Unknown narrative specialist: ' + id);
    return roster.get(id);
  });
  const texts = seats.map((id) =>
    fs.readFileSync(path.join(__dirname, '..', id, 'specialist.md'), 'utf8')
  );
  // The native jury caps each string on a card at 2,000 characters.
  // Keep the entire specialist brief even when an author adds more guidance.
  const chunkSize = 1600;
  const parts = Math.ceil(Math.max(...texts.map((text) => text.length)) / chunkSize);
  const slots = [];
  for (let part = 0; part < parts; part += 1) {
    const key = 'instructions' + part;
    slots.push('{{card.' + key + '}}');
    for (const [index, card] of definition.units.list.entries()) {
      const chunk = texts[index].slice(part * chunkSize, (part + 1) * chunkSize);
      card[key] = chunk.trim() ? chunk : '\n<!-- end of specialist card -->';
    }
  }
  const brief = fs
    .readFileSync(path.join(__dirname, 'brief.md'), 'utf8')
    .replace('{{card.focus}}', '{{card.focus}}\n\n' + slots.join(''));
  const work = fs.mkdtempSync(path.join(directory, 'ghostwriter-council-'));
  const base = path.basename(work);
  fs.writeFileSync(path.join(work, 'jury.json'), JSON.stringify(definition, null, 2) + '\n');
  fs.writeFileSync(path.join(work, 'brief.md'), brief);
  fs.copyFileSync(path.join(__dirname, 'opening.md'), path.join(work, 'opening.md'));
  return { definition: base + '/jury.json', opening: base + '/opening.md', seats };
}

if (require.main === module) {
  try {
    process.stdout.write(
      JSON.stringify(select(process.cwd(), process.argv.slice(2)), null, 2) + '\n'
    );
  } catch (error) {
    process.stderr.write(error.message + '\n');
    process.exitCode = 1;
  }
}

module.exports = { select };
