/**
 * Path patterns for review scopes and rules. Deliberately small and dependency-free:
 * `**` spans directories, `*` stays within one segment, `?` is one character, and
 * `{a,b}` alternates — every group, nested groups included. Paths use `/`.
 */
'use strict';

const MAX_EXPANSIONS = 256;
const cache = new Map();

/** `src/{a,b{c,d}}/*.js` → four patterns. An unbalanced brace is an error, never a literal. */
function expandBraces(pattern) {
  const open = pattern.indexOf('{');
  if (open < 0) {
    if (pattern.includes('}')) throw new Error(`unbalanced "}" in pattern "${pattern}"`);
    return [pattern];
  }
  let depth = 0;
  let close = -1;
  const commas = [];
  for (let i = open; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === '{') depth++;
    else if (c === '}' && --depth === 0) {
      close = i;
      break;
    } else if (c === ',' && depth === 1) commas.push(i);
  }
  if (close < 0) throw new Error(`unbalanced "{" in pattern "${pattern}"`);
  const head = pattern.slice(0, open);
  const tail = pattern.slice(close + 1);
  const bounds = [open, ...commas, close];
  const results = [];
  for (let i = 0; i < bounds.length - 1; i++) {
    const option = pattern.slice(bounds[i] + 1, bounds[i + 1]);
    for (const expanded of expandBraces(head + option + tail)) {
      results.push(expanded);
      if (results.length > MAX_EXPANSIONS)
        throw new Error(`pattern "${pattern}" expands to more than ${MAX_EXPANSIONS} forms`);
    }
  }
  return results;
}

function toRegExp(glob) {
  let source = '';
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === '*' && glob[i + 1] === '*') {
      const slash = glob[i + 2] === '/';
      source += slash ? '(?:.*/)?' : '.*';
      i += slash ? 2 : 1;
    } else if (c === '*') source += '[^/]*';
    else if (c === '?') source += '[^/]';
    else source += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${source}$`);
}

/** Compiled once per pattern: the same patterns are tested against every changed file. */
function compile(pattern) {
  let compiled = cache.get(pattern);
  if (!compiled) {
    compiled = expandBraces(pattern).map(toRegExp);
    cache.set(pattern, compiled);
  }
  return compiled;
}

const matches = (file, pattern) => compile(pattern).some((re) => re.test(file));
const matchesAny = (file, patterns) => patterns.some((pattern) => matches(file, pattern));

module.exports = { expandBraces, compile, matches, matchesAny };
