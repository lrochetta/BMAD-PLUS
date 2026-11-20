'use strict';
// Held-out check for design/review-blockers. Node stdlib only, no network, no package.
// It reads the worker's review.md, styles.css and index.html and the untouched tokens.css.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = process.argv[2];
assert.ok(root, 'usage: node check.cjs <workspace>');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

// ── review.md: one line per finding, most severe first, every planted defect named ──
const review = read('review.md');
const findings = [];
review.split(/\r?\n/).forEach((line, index) => {
  const match = /^\s*[-*]\s*\[(blocker|major|minor)\]\s+(.+)$/i.exec(line);
  if (match) findings.push({ severity: match[1].toLowerCase(), text: match[2], line: index + 1 });
});
const rank = { blocker: 0, major: 1, minor: 2 };
assert.ok(
  findings.length >= 5,
  `review.md lists ${findings.length} findings; the fixture plants five defects`
);
for (let i = 1; i < findings.length; i += 1) {
  assert.ok(
    rank[findings[i].severity] >= rank[findings[i - 1].severity],
    `review.md line ${findings[i].line}: a ${findings[i].severity} is listed after a ${findings[i - 1].severity}; most severe first`
  );
}
const blockers = findings.filter((finding) => finding.severity === 'blocker');
const nonBlockers = findings.filter((finding) => finding.severity !== 'blocker');
assert.equal(
  blockers.length,
  3,
  `three accessibility defects are planted, so exactly three blockers are expected, not ${blockers.length}`
);
// Each blocker pattern must be carried by its own line: one line naming everything
// does not rank anything.
const blockerPatterns = [
  ['suppressed keyboard focus', /focus/i],
  ['the low-contrast hint', /contrast/i],
  [
    'the icon-only delete button without a name',
    /accessible name|aria-label|unlabel|no label|without (?:a |an )?(?:label|name)/i,
  ],
];
const claimed = new Set();
for (const [label, pattern] of blockerPatterns) {
  const owner = blockers.find((finding) => !claimed.has(finding) && pattern.test(finding.text));
  assert.ok(owner, `${label} must be a blocker on its own line`);
  claimed.add(owner);
}
const names = (list, pattern) => list.some((finding) => pattern.test(finding.text));
assert.ok(
  names(nonBlockers, /empty state/i) && !names(blockers, /empty state/i),
  'the missing empty state is a major or minor, named on a non-blocker line'
);
// The token finding is the one about raw colour values typed into a component; a blocker
// may mention the focus tokens, but the raw-colour defect itself is not a blocker.
const rawColour = /raw|hard-?coded|typed|literal|#[0-9a-f]{3,6}\b/i;
const tokenFinding = (finding) => /token/i.test(finding.text) && rawColour.test(finding.text);
assert.ok(
  nonBlockers.some(tokenFinding) && !blockers.some(tokenFinding),
  'raw colours instead of tokens are a major or minor, named on a non-blocker line'
);
assert.match(
  review,
  /^\s*#*\s*pre-flight:\s*fail\b/im,
  'review.md must state that the page as found fails the pre-flight'
);
assert.doesNotMatch(
  review,
  /fully accessible|wcag[ -]?(?:2\.2[ -])?(?:aa[ -])?compliant|passes (?:all )?accessibility/i,
  'review.md must not certify accessibility'
);
assert.doesNotMatch(
  review,
  /(?:lighthouse|axe)\b[^\n]{0,40}\b(?:score|scored|reported|found)\b[^\n]{0,20}\d/i,
  'review.md must not quote a tool measurement; no tool ran in this task'
);

// ── styles.css: the fixture's rules survive, tokens only, focus visible and never suppressed ──
const css = read('styles.css')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/@import\b[^;]*;/g, '');
assert.doesNotMatch(
  css,
  /#[0-9a-f]{3,8}\b/i,
  'styles.css carries a raw colour; components consume tokens.css'
);
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
  selector: match[1].trim(),
  selectors: match[1].split(',').map((part) => part.trim().replace(/\s+/g, ' ')),
  body: match[2],
  declarations: match[2].split(';').filter((part) => /\S+\s*:\s*\S/.test(part)).length,
}));
// Every selector of the fixture, except the suppression rule the task removes, keeps at
// least one declaration: a stylesheet stripped down to the focus rule is not a fix.
const fixtureSelectors = [
  '*',
  'body',
  '.page',
  '.page-header',
  '.page-header h1',
  '.toolbar',
  '.toolbar label',
  '.toolbar input',
  '.card',
  '.hint',
  '.btn',
  '.icon-btn',
  'table',
  'th',
  'td',
  'tr.overdue td',
  '.status',
];
for (const selector of fixtureSelectors) {
  assert.ok(
    rules.some((rule) => rule.selectors.includes(selector) && rule.declarations > 0),
    `styles.css lost the fixture rule "${selector}" or emptied it`
  );
}
const focusRules = rules.filter((rule) => /:focus(?:-visible|-within)?\b/i.test(rule.selector));
const suppression = /\boutline(?:-(?:color|width|style))?\s*:\s*(?:none|0(?:px)?|transparent)\b/i;
for (const rule of focusRules) {
  if (!suppression.test(rule.body)) continue;
  assert.ok(
    /:focus:not\(\s*:focus-visible\s*\)/i.test(rule.selector),
    `styles.css rule "${rule.selector}" removes the outline outside :focus:not(:focus-visible)`
  );
}
const focusVisible = focusRules.filter(
  (rule) =>
    /:focus-visible/i.test(rule.selector) && !/:not\(\s*:focus-visible\s*\)/i.test(rule.selector)
);
assert.ok(
  focusVisible.some(
    (rule) =>
      /\boutline\s*:\s*(?!none\b|0(?:px)?\b|transparent\b)[^;]+/i.test(rule.body) ||
      /\bbox-shadow\s*:\s*(?!none\b)[^;]+/i.test(rule.body)
  ),
  'styles.css defines a visible :focus-visible style'
);
assert.ok(
  focusVisible.some((rule) => /var\(--focus-ring/i.test(rule.body)),
  'the focus style takes its colour and width from the focus tokens'
);

// ── the hint after the fix: contrast resolved through tokens.css, against its container ──
const tokens = Object.fromEntries(
  [...read('tokens.css').matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/gi)].map((match) => [
    match[1],
    match[2].trim(),
  ])
);
function resolve(value, depth = 0) {
  const match = /^var\(\s*(--[a-z0-9-]+)\s*\)$/i.exec(value.trim());
  if (!match) return value.trim();
  assert.ok(depth < 10 && tokens[match[1]], `unknown token ${match[1]} in styles.css`);
  return resolve(tokens[match[1]], depth + 1);
}
function declaration(selector, property) {
  const rule = rules.find((candidate) => candidate.selectors.includes(selector));
  assert.ok(rule, `styles.css has no "${selector}" rule`);
  const match = new RegExp(`(?:^|;)\\s*${property}\\s*:\\s*([^;]+)`, 'i').exec(rule.body);
  return match ? match[1].trim() : null;
}
function channel(value) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}
function luminance(hex) {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  assert.ok(match, `not a hex colour: ${hex}`);
  let digits = match[1];
  if (digits.length === 3) digits = [...digits].map((d) => d + d).join('');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(digits.slice(i, i + 2), 16));
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
function contrast(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}
const hintColor = resolve(declaration('.hint', 'color'));
const cardBackground = resolve(
  declaration('.card', 'background') ||
    declaration('.card', 'background-color') ||
    'var(--color-surface-raised)'
);
const ratio = contrast(hintColor, cardBackground);
assert.ok(
  ratio >= 4.5,
  `.hint ${hintColor} on ${cardBackground} is ${ratio.toFixed(2)}:1; AA needs 4.5:1`
);

// ── index.html: every control named, the list has an empty state with a next action ──
const html = read('index.html');
assert.match(html, /<table\b/i, 'the invoice table stays');
assert.match(html, /class="hint"/, 'the hint stays; it is fixed, not removed');
const buttons = [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/gi)];
assert.ok(buttons.length >= 4, 'the page keeps its controls');
for (const [, attributes, inner] of buttons) {
  const text = inner
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
  const named = /\baria-label(?:ledby)?\s*=\s*"[^"]+"/i.test(attributes) || text !== '';
  assert.ok(named, `a button has no accessible name: <button${attributes}>`);
}
const empty = /<([a-z]+)\b[^>]*data-state\s*=\s*"empty"[^>]*>([\s\S]*?)<\/\1>/i.exec(html);
assert.ok(empty, 'the list carries an element marked data-state="empty"');
assert.match(empty[2], /<(?:button|a)\b/i, 'the empty state offers the next action');
assert.match(
  html,
  /<svg\b[^>]*aria-hidden="true"/i,
  'decorative icons stay hidden from assistive technology'
);

console.log(
  `blockers first (${blockers.length} blockers, ${findings.length} findings), hint contrast ${ratio.toFixed(2)}:1, focus visible, tokens consumed, controls named, empty state present`
);
