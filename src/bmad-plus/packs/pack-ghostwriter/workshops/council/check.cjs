'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function loadRound(directory, id) {
  if (!/^ghostwriter-council-\d{8}-[a-z0-9]{4}$/.test(id))
    throw new Error('Invalid council run ID.');
  const project = fs.realpathSync(directory);
  const base = path.join(project, '.bmad-plus', 'swarm', 'runs', id);
  function read(file) {
    const target = path.join(base, file);
    if (fs.realpathSync(target) !== target) throw new Error('Linked evidence is unsupported.');
    if (fs.statSync(target).size > 16 * 1024 * 1024) throw new Error('Evidence exceeds 16 MiB.');
    return fs.readFileSync(target, 'utf8');
  }
  const run = JSON.parse(read('run.json'));
  const cards = JSON.parse(read('cards.json'));
  if (
    run.id !== id ||
    run.pack !== 'ghostwriter' ||
    run.kind !== 'jury' ||
    cards.length !== run.n
  ) {
    throw new Error('The evidence does not describe this Ghostwriter jury.');
  }
  const scene = read('context/scene.md');
  const hash = crypto.createHash('sha256').update(scene, 'utf8').digest('hex');
  if (hash !== run.contexts.scene.sha256) throw new Error('The frozen scene has changed.');
  const notice = read('context/round.md');
  if (
    crypto.createHash('sha256').update(notice, 'utf8').digest('hex') !== run.contexts.round.sha256
  ) {
    throw new Error('The frozen round notice has changed.');
  }
  const answers = new Map();
  for (const card of cards) {
    if (!/^[a-z][a-z0-9-]*$/.test(card.id) || answers.has(card.id))
      throw new Error('Invalid seat.');
    try {
      answers.set(card.id, JSON.parse(read('answers/' + card.id + '.json')));
    } catch (error) {
      if (error.code !== 'ENOENT' && !(error instanceof SyntaxError)) throw error;
      answers.set(card.id, null);
    }
  }
  return { id, scene, hash, notice, answers };
}

const nonempty = (value) => typeof value === 'string' && value.trim().length > 0;

function assess(opening, reply) {
  if (opening.id === reply.id || opening.hash !== reply.hash) {
    throw new Error('Use two different rounds of the same frozen scene.');
  }
  if (!reply.notice.split(/[^a-zA-Z0-9-]+/).includes(opening.id)) {
    throw new Error('The reply notice must identify the exact opening run.');
  }
  const speakers = [];
  const issues = [];
  for (const [id, answer] of opening.answers) {
    if (
      answer?.id === id &&
      nonempty(answer.anchor) &&
      opening.scene.includes(answer.anchor) &&
      nonempty(answer.reading) &&
      nonempty(answer.proposal) &&
      nonempty(answer.cost) &&
      answer.peer === '' &&
      answer.peer_quote === '' &&
      answer.response === ''
    )
      speakers.push(id);
    else issues.push({ seat: id, reason: 'Missing, invalid or unanchored opening.' });
  }
  if (speakers.length < 2) issues.push({ reason: 'Fewer than two supported opening readings.' });
  for (const id of reply.answers.keys()) {
    if (!speakers.includes(id))
      issues.push({ seat: id, reason: 'Reply seat lacks an eligible opening.' });
  }
  let supportedReplies = 0;
  for (const [index, id] of speakers.entries()) {
    const peer = speakers[(index + 1) % speakers.length];
    const answer = reply.answers.get(id);
    if (
      peer !== id &&
      answer?.id === id &&
      answer.peer === peer &&
      nonempty(answer.anchor) &&
      opening.scene.includes(answer.anchor) &&
      nonempty(answer.peer_quote) &&
      opening.answers.get(peer).proposal.includes(answer.peer_quote) &&
      nonempty(answer.response) &&
      nonempty(answer.reading) &&
      nonempty(answer.proposal) &&
      nonempty(answer.cost)
    )
      supportedReplies += 1;
    else
      issues.push({
        seat: id,
        reason: 'Missing reply, wrong peer, absent scene anchor or unmatched peer quotation.',
      });
  }
  return {
    status: issues.length ? 'incomplete' : 'references-complete',
    requestedSeats: opening.answers.size,
    supportedReadings: speakers.length,
    supportedReplies,
    issues,
    hostParticipation: 'Confirm actual session identities in the moderator record.',
  };
}

if (require.main === module) {
  try {
    const [opening, reply] = process.argv.slice(2);
    const result = assess(loadRound(process.cwd(), opening), loadRound(process.cwd(), reply));
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exitCode = result.status === 'references-complete' ? 0 : 2;
  } catch (error) {
    process.stderr.write(error.message + '\n');
    process.exitCode = 2;
  }
}

module.exports = { assess, loadRound };
