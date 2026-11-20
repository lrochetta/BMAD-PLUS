'use strict';
// Held-out check for core/challenge-frontier. Node stdlib only, no network, no package.
// Usage: node check.cjs <workspace> <order|recommend|repository|caller|statuses>
// It reads challenge/tree.json, challenge/rounds.md and challenge/decisions.md.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const [root, mode] = process.argv.slice(2);
assert.ok(root && mode, 'usage: node check.cjs <workspace> <mode>');
const read = (name) => fs.readFileSync(path.join(root, 'challenge', name), 'utf8');

// ── tree.json: ids, labels, prerequisites; no unknown id and no cycle ──
const tree = JSON.parse(read('tree.json')).decisions;
assert.ok(Array.isArray(tree) && tree.length >= 8, 'tree.json must list the choices the plan depends on');
const byId = new Map();
for (const node of tree) {
  assert.match(String(node.id), /^d\d+$/, `decision id ${node.id} must look like d1`);
  assert.ok(!byId.has(node.id), `decision id ${node.id} is repeated`);
  assert.ok(typeof node.label === 'string' && node.label.trim(), `${node.id} needs a label`);
  assert.ok(Array.isArray(node.needs), `${node.id} needs a "needs" list`);
  byId.set(node.id, node);
}
for (const node of tree) {
  for (const need of node.needs) {
    assert.ok(byId.has(need), `${node.id} needs ${need}, which is not in the tree`);
    assert.notEqual(need, node.id, `${node.id} needs itself`);
  }
}
// Every decision that must be settled before `id`, directly or not. Terminates on a cycle.
const ancestors = (id) => {
  const seen = new Set();
  const stack = [...byId.get(id).needs];
  while (stack.length) {
    const need = stack.pop();
    if (seen.has(need)) continue;
    seen.add(need);
    stack.push(...byId.get(need).needs);
  }
  return seen;
};
for (const node of tree) assert.ok(!ancestors(node.id).has(node.id), `the tree has a cycle through ${node.id}`);
const find = (pattern) => {
  const found = tree.filter((node) => pattern.test(node.label));
  assert.equal(found.length, 1, `exactly one decision should match ${pattern}, found ${found.length}`);
  return found[0];
};
// The plan plants three chains: who signs in → how → how long; pay online → which provider.
const planted = {
  who: find(/who (?:may|can|is allowed to)\b.*(?:sign|log)|members only|guest/i),
  method: find(/(?:sign|log)[- ]?in method|how .*(?:sign|log)[- ]?in|authenticat|password/i),
  session: find(/session/i),
  online: find(/(?:pay|fee|payment)\b.*online|online\b.*(?:pay|fee)/i),
  provider: find(/provider|processor|stripe/i),
};
for (const [after, before] of [
  ['method', 'who'],
  ['session', 'method'],
  ['provider', 'online'],
]) {
  assert.ok(
    ancestors(planted[after].id).has(planted[before].id),
    `"${planted[after].label}" depends on "${planted[before].label}" but the tree does not say so`
  );
}

// ── rounds.md: rounds, numbered questions, recommendation and reason ──
const rounds = [];
for (const block of read('rounds.md').split(/^##\s+Round\s+/im).slice(1)) {
  const number = Number(/^\d+/.exec(block)?.[0]);
  assert.ok(Number.isInteger(number), 'a round heading needs its number');
  const questions = [];
  let current = null;
  for (const line of block.split(/\r?\n/).slice(1)) {
    const question = /^\s*\d+\.\s*\[(d\d+)\]\s*(.+)$/.exec(line);
    if (question) {
      current = { id: question[1], text: question[2], round: number };
      questions.push(current);
    } else if (current) {
      const recommended = /^\s*Recommended:\s*(.*)$/.exec(line);
      const why = /^\s*Why:\s*(.*)$/.exec(line);
      if (recommended) current.recommended = recommended[1].trim();
      if (why) current.why = why[1].trim();
    }
  }
  rounds.push({ number, questions });
}
const questions = rounds.flatMap((round) => round.questions);
assert.ok(rounds.length >= 2 && rounds.length <= 5, `${rounds.length} rounds; a dependent question needs a later round, and the soft cap is 5`);
assert.deepEqual(
  rounds.map((round) => round.number),
  rounds.map((_, index) => index + 1),
  'rounds are numbered 1, 2, 3 in order'
);

// ── decisions.md: the layout the skill defines ──
const log = read('decisions.md');
const headings = log.match(/^#{1,3} .*/gm) || [];
const rows = [];
let header = null;
for (const line of log.split(/\r?\n/)) {
  if (!/^\|/.test(line)) continue;
  const cells = line.replace(/^\||\|\s*$/g, '').split('|').map((cell) => cell.trim());
  if (/^-+$/.test(cells[0].replace(/:/g, ''))) continue;
  if (!header) header = cells;
  else rows.push(Object.fromEntries(header.map((name, index) => [name, cells[index] ?? ''])));
}
const rowFor = (pattern) => {
  const found = rows.filter((row) => pattern.test(row.Decision));
  assert.equal(found.length, 1, `decisions.md needs exactly one row matching ${pattern}, found ${found.length}`);
  return found[0];
};

const modes = {
  order() {
    const asked = new Set();
    for (const round of rounds) {
      assert.ok(round.questions.length >= 1 && round.questions.length <= 6, `round ${round.number} asks ${round.questions.length} questions; 1 to 6`);
    }
    for (const question of questions) {
      assert.ok(byId.has(question.id), `${question.id} is asked but is not in the tree`);
      assert.ok(!asked.has(question.id), `${question.id} is asked twice`);
      asked.add(question.id);
    }
    const roundOf = new Map(questions.map((question) => [question.id, question.round]));
    for (const question of questions) {
      for (const need of ancestors(question.id)) {
        if (roundOf.has(need)) {
          assert.ok(
            roundOf.get(need) < question.round,
            `${question.id} is asked in round ${question.round}, not after its prerequisite ${need} (round ${roundOf.get(need)})`
          );
        } else {
          // A prerequisite nobody asked must already be settled in the log.
          assert.ok(rows.some((row) => row.ID === need), `${question.id} waits for ${need}, which is neither asked nor settled`);
        }
      }
    }
    // The chains are planted: the first round holds only choices with no prerequisite.
    for (const question of rounds[0].questions) {
      assert.deepEqual(byId.get(question.id).needs, [], `${question.id} has a prerequisite and cannot open round 1`);
    }
    for (const key of ['who', 'online']) assert.ok(roundOf.get(planted[key].id) === 1, `"${planted[key].label}" is a root and belongs to round 1`);
  },

  recommend() {
    assert.ok(questions.length >= 6, `${questions.length} questions; the plan has at least six open choices`);
    for (const question of questions) {
      assert.ok(question.recommended, `${question.id} has no Recommended line`);
      assert.ok(question.recommended.split(/\s+/).length >= 3, `${question.id}: the recommendation is too thin to accept with "yes"`);
      assert.ok(!/\?/.test(question.recommended), `${question.id}: a recommendation is a statement, not a question`);
      assert.ok(!/\bor\b/i.test(question.recommended.split(/[;,]/)[0]), `${question.id}: the recommendation must pick one answer`);
      assert.ok(question.why && question.why.split(/\s+/).length >= 3, `${question.id} has no reason`);
      assert.match(question.text, /\?\s*$/, `${question.id}: a question ends with a question mark`);
    }
  },

  repository() {
    const asksFramework = /framework|next\.?js|react|node\b|stack\b|language/i;
    const asksHosting = /host(?:ing)?\b|\bvps\b|server|deploy|provider of the (?:site|server)/i;
    for (const question of questions) {
      assert.doesNotMatch(question.text, asksHosting, `${question.id} asks about hosting; docs/hosting.md settles it`);
      assert.doesNotMatch(question.text, asksFramework, `${question.id} asks about the framework; package.json settles it`);
    }
    const framework = rowFor(/framework|stack|next/i);
    assert.equal(framework.Status, 'answered');
    assert.match(framework.Answer, /next/i);
    assert.match(framework.Source, /project\/package\.json/);
    const hosting = rowFor(/host|vps|deploy/i);
    assert.equal(hosting.Status, 'answered');
    assert.match(hosting.Answer, /hetzner/i);
    assert.match(hosting.Source, /project\/docs\/hosting\.md/);
  },

  caller() {
    // The caller passed the member count and the admins: not asked, recorded with its source.
    const rediscovery = /how many members|number of members|member count|\b300\b|admins?\b|volunteers?|who (?:runs|maintains|looks after) the (?:site|website)/i;
    for (const question of questions) {
      assert.doesNotMatch(question.text, rediscovery, `${question.id} asks again what the caller passed`);
    }
    const members = rowFor(/members?\b.*(?:count|number|size)|(?:count|number|size)\b.*members?|how many/i);
    assert.equal(members.Status, 'answered');
    assert.match(members.Answer, /300/);
    assert.match(members.Source, /^caller:\s*Atlas$/i);
    const admins = rowFor(/admin|volunteer|maintain/i);
    assert.equal(admins.Status, 'answered');
    assert.match(admins.Answer, /\b(?:2|two)\b/i);
    assert.match(admins.Source, /^caller:\s*Atlas$/i);
    // The handoff names its caller and the decision: no round is spent on a settled node.
    const settled = new Set([members.ID, admins.ID]);
    for (const question of questions) assert.ok(!settled.has(question.id), `${question.id} is settled by the caller and must not be asked`);
  },

  statuses() {
    assert.deepEqual(
      headings.slice(0, 1).map((heading) => heading.replace(/^# /, '').split(/\s+[—-]\s+/)[0]),
      ['Decisions'],
      'decisions.md opens with "# Decisions — <subject>"'
    );
    assert.deepEqual(headings.slice(1), ['## Decisions', '## Open items', '## Next']);
    assert.deepEqual(header, ['ID', 'Decision', 'Status', 'Answer', 'Source', 'Risk']);
    assert.deepEqual(
      rows.map((row) => row.ID).sort(),
      tree.map((node) => node.id).sort(),
      'one row per decision of the tree, no more'
    );
    for (const row of rows) {
      assert.ok(['answered', 'defaulted', 'unknown'].includes(row.Status), `${row.ID}: status "${row.Status}" is not answered, defaulted or unknown`);
      if (row.Status === 'answered') {
        assert.ok(row.Answer && row.Source, `${row.ID}: an answered row needs its answer and its source`);
        assert.equal(row.Risk, '', `${row.ID}: an answered row carries no risk`);
      }
      if (row.Status === 'defaulted') {
        assert.ok(row.Answer && row.Risk, `${row.ID}: a defaulted row needs the recommendation and its risk`);
        assert.equal(row.Source, 'recommendation', `${row.ID}: a defaulted row's source is the recommendation`);
      }
      if (row.Status === 'unknown') {
        assert.ok(row.Risk, `${row.ID}: an unknown decision keeps its risk`);
        assert.equal(row.Answer, '', `${row.ID}: an unknown decision has no answer`);
      }
    }
    // What replies.md says, decision by decision.
    const who = rowFor(new RegExp(planted.who.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
    assert.equal(who.Status, 'answered');
    assert.match(who.Answer, /members only/i);
    assert.equal(who.Source, 'user');
    assert.equal(rows.find((row) => row.ID === planted.method.id).Status, 'defaulted');
    assert.equal(rows.find((row) => row.ID === planted.session.id).Status, 'defaulted');
    const online = rows.find((row) => row.ID === planted.online.id);
    assert.equal(online.Status, 'answered');
    assert.equal(online.Source, 'user');
    assert.equal(rows.find((row) => row.ID === planted.provider.id).Status, 'unknown');
    const retention = rowFor(/former|retention|keep|delete/i);
    assert.equal(retention.Status, 'unknown');
    // Every unknown is carried into the open items.
    const open = log.slice(log.indexOf('## Open items'), log.indexOf('## Next'));
    for (const row of rows.filter((candidate) => candidate.Status === 'unknown')) {
      assert.ok(open.includes(row.ID), `${row.ID} is unknown and must be listed under Open items`);
    }
    assert.match(log.slice(log.indexOf('## Next')), /Hand over to (?:Atlas|Forge|Nexus)\b/);
  },
};

assert.ok(Object.hasOwn(modes, mode), `unknown mode ${mode}`);
modes[mode]();
console.log(`challenge-frontier ${mode} passed`);
