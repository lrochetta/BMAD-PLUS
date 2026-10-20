/**
 * Redaction floor for free text that BMAD+ writes to disk or prints: reviewer notes,
 * tester notes, finding descriptions. It removes credentials that commonly end up pasted
 * into such text; it is a floor, not a scanner, and never a reason to paste secrets.
 */
'use strict';

const MARK = '[REDACTED]';
const MAX_LENGTH = 20000;

/**
 * A value that names where a secret comes from rather than holding it: an environment or
 * secret-store reference, a template placeholder, or an UPPER_SNAKE variable name (an
 * underscore is required, so an all-capitals random key is still masked).
 */
const REFERENCE =
  /^(?:process\.env\b|os\.environ\b|os\.getenv\b|getenv\b|env\.|secrets\.|vars\.|\$|%|<|\{\{|[A-Z][A-Z0-9]*_[A-Z0-9_]*$|\[REDACTED\]$)/;

/** Ordered: whole blocks first, then structured forms, then well-known token shapes. */
const RULES = [
  {
    kind: 'private-key',
    pattern:
      /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/g,
    replace: () => `-----${MARK} PRIVATE KEY-----`,
  },
  {
    kind: 'url-credentials',
    pattern: /\b([a-z][a-z0-9+.-]{1,20}:\/\/)[^\s/?#@:]+:[^\s/?#@]+@/gi,
    replace: (_, scheme) => `${scheme}${MARK}@`,
  },
  {
    kind: 'authorization',
    pattern:
      /\b((?:authorization|proxy-authorization)\s*[:=]\s*)(bearer|basic|token|digest)\s+[A-Za-z0-9._~+/=-]{8,}/gi,
    replace: (_, lead, scheme) => `${lead}${scheme} ${MARK}`,
  },
  {
    kind: 'bearer',
    pattern: /\b(bearer\s+)[A-Za-z0-9._~+/=-]{16,}/gi,
    replace: (_, lead) => `${lead}${MARK}`,
  },
  {
    kind: 'assignment',
    // name = value where the name says it holds a credential; the name stays readable.
    pattern:
      /\b([A-Za-z0-9_.-]*(?:passw(?:or)?d|pwd|secret|token|api[_-]?key|access[_-]?key|private[_-]?key|client[_-]?secret|auth[_-]?key|credentials?)[A-Za-z0-9_.-]*["']?\s*[:=]\s*)(["']?)([^\s"',;]{6,})\2/gi,
    replace: (whole, lead, quote, value) =>
      REFERENCE.test(value) ? whole : `${lead}${quote}${MARK}${quote}`,
  },
  {
    kind: 'known-token',
    pattern: new RegExp(
      [
        'gh[pousr]_[A-Za-z0-9]{30,}',
        'github_pat_[A-Za-z0-9_]{40,}',
        'glpat-[A-Za-z0-9_-]{20,}',
        'npm_[A-Za-z0-9]{30,}',
        'sk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}',
        'xox[abprs]-[A-Za-z0-9-]{10,}',
        'AKIA[0-9A-Z]{16}',
        'AIza[0-9A-Za-z_-]{35}',
        'eyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}',
      ]
        .map((source) => `\\b${source}`)
        .join('|'),
      'g'
    ),
    replace: () => MARK,
  },
];

/** Control characters other than tab, line feed and carriage return are dropped. */
function stripControl(text) {
  let out = '';
  for (const char of text) {
    const code = char.codePointAt(0);
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127)) out += char;
  }
  return out;
}

/**
 * Returns the text with credentials replaced by a marker, and what was replaced by kind.
 * Non-strings pass through untouched so callers can map over mixed records.
 */
function redact(value, { maxLength = MAX_LENGTH } = {}) {
  if (typeof value !== 'string') return { text: value, found: {} };
  let text = stripControl(value);
  const found = {};
  for (const rule of RULES) {
    text = text.replace(rule.pattern, (...match) => {
      found[rule.kind] = (found[rule.kind] || 0) + 1;
      return rule.replace(...match);
    });
  }
  if (text.length > maxLength) {
    text = `${text.slice(0, maxLength)} […${text.length - maxLength} characters cut]`;
    found.truncated = 1;
  }
  return { text, found };
}

/** Redacts the listed string fields of a record in place; returns the number of replacements. */
function redactFields(record, fields, options) {
  let count = 0;
  for (const field of fields) {
    if (typeof record[field] !== 'string') continue;
    const { text, found } = redact(record[field], options);
    record[field] = text;
    count += Object.entries(found).reduce((n, [kind, k]) => (kind === 'truncated' ? n : n + k), 0);
  }
  return count;
}

module.exports = { MARK, redact, redactFields };
