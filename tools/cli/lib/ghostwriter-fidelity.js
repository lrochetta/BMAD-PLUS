/** Mechanical evidence on the supplied text. Semantic review and source checking run separately. */
const { projectStructured } = require('./ghostwriter-structured');
const { quantities } = require('./ghostwriter-quantities');

const QUALIFIERS = [
  [
    'negative',
    /(?:n['’]t|\b(?:not|never|no|none|neither|without|pas|jamais|aucun(?:e|s|es)?|sans|ni|não|nunca|nenhum[a]?|sem))\b/giu,
  ],
  [
    'possible',
    /(?<![\p{L}])(?:may|might|could|can|peut|peuvent|pourrait|pourraient|possiblement|pode|podem|poderia|poderiam)(?![\p{L}])/giu,
  ],
  [
    'upper limit',
    /(?<![\p{L}])(?:up to|at most|jusqu['’][aà]|au maximum|au plus|até|no máximo)(?![\p{L}])/giu,
  ],
  ['lower limit', /(?<![\p{L}])(?:at least|au moins|pelo menos|no mínimo)(?![\p{L}])/giu],
  [
    'approximate',
    /(?<![\p{L}])(?:about|around|approximately|environ|à peu près|cerca de|aproximadamente)(?![\p{L}])/giu,
  ],
  ['exception', /(?<![\p{L}])(?:unless|sauf|except|exceto)(?![\p{L}])/giu],
  ['conditional', /(?<![\p{L}])(?:if|provided that|si|à condition que|se|desde que)(?![\p{L}])/giu],
  [
    'obligation',
    /(?<![\p{L}])(?:must|shall|doit|doivent|obligatoire|deve|devem|obrigatório)(?![\p{L}])/giu,
  ],
  [
    'guarantee',
    /(?<![\p{L}])(?:guarantee[ds]?|garanti(?:e|t|s|es)?|garantid[oa]s?|sempre|always|toujours)(?![\p{L}])/giu,
  ],
];
const RULES = [
  ['link', /(?:https?:\/\/|mailto:)[^\s<>"'`]+|[\w.+-]{1,64}@[\w.-]{1,253}\.[a-z]{2,63}/giu],
  [
    'code',
    /(?<![\w-])--[a-z][\w-]*(?:=[\w./:-]+)?|\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b|\b\w+(?:_\w+)+\b|(?:\.{1,2}\/|~\/|[A-Za-z]:\\|(?<![\p{L}0-9])\/(?=[\w.-]+\/))[^\s`<>"']+|(?<![\p{L}0-9])\$[A-Za-z_][\w]*/gu,
  ],
  ['placeholder', /%(?:\d+\$)?[sdif]|%[A-Z][A-Z_0-9]*%|:[a-z_]+:(?!\w)/g],
];
const AUTHOR =
  /(?<![\p{L}])(?:[Aa]ccording to|[Aa]ttributed to|[Dd]['’]après|[Ss]elon|[Aa]tribu[ií]d[ao] a|[Ss]egundo|[Cc]onforme)\s+([\p{Lu}][\p{L}\p{M}\d'’-]*(?:[ \t]+(?:d[aeo]s? |de la |van |von )?[\p{Lu}][\p{L}\p{M}\d'’-]*)*)/gu;
const MAX_BYTES = 1024 * 1024;
const FENCE = /^ {0,3}(`{3,}|~{3,})([^\r\n]*)$/;
const COMMAND =
  /^\s*(?:\$ |PS [^>]*> |(?:npm|npx|pnpm|node|git|ssh|curl|docker|kubectl|bmad-plus)\s+[-\w./])/;

function matches(text, pattern) {
  return Array.from(text.matchAll(pattern), (m) => m[0]);
}

function takeBalanced(text, start, open, close) {
  let depth = 1;
  for (let i = start + 1; i < text.length; i++) {
    if (text[i] === '\\') {
      i++;
      continue;
    }
    if (text[i] === open) depth++;
    if (text[i] === close && --depth === 0) return i + 1;
  }
  throw new Error('Unclosed protected expression.');
}

// Replace bounded protected regions with whitespace before running lexical checks.
// Store the exact region independently, including delimiters and original line endings.
function inspectLines(text, markdown, record) {
  const lines = text.match(/[^\r\n]*(?:\r\n|\r|\n)|[^\r\n]+$/g) || [];
  let fence = '';
  let block = '';
  let frontmatter = '';
  const prose = [];
  const hasFragment = markdown && /\]\(\s*#/.test(text);
  for (const [i, line] of lines.entries()) {
    const content = line.replace(/[\r\n]+$/, '');
    if (i === 0 && markdown && /^(?:---|\+\+\+)$/.test(content)) frontmatter = content;
    if (frontmatter) {
      block += line;
      if (i > 0 && (content === frontmatter || (frontmatter === '---' && content === '...'))) {
        record('markup', block);
        block = '';
        frontmatter = '';
      }
      continue;
    }
    const delimiter = content.match(FENCE);
    if (fence) {
      block += line;
      if (
        delimiter &&
        delimiter[1][0] === fence[0] &&
        delimiter[1].length >= fence.length &&
        !delimiter[2].trim()
      ) {
        record('code', block);
        block = '';
        fence = '';
      }
      continue;
    }
    if (delimiter) {
      if (delimiter[1][0] === '`' && delimiter[2].includes('`'))
        throw new Error('Ambiguous code fence.');
      fence = delimiter[1];
      block = line;
      prose.push('\n');
    } else if (
      COMMAND.test(content) ||
      (markdown && /^(?: {4}|\t| {0,3}>| {0,3}\[[^\]]+\]:)/.test(content)) ||
      (hasFragment && /^ {0,3}#{1,6}\s/.test(content))
    ) {
      record('code', line);
      prose.push('\n');
    } else {
      prose.push(line);
    }
  }
  if (block) throw new Error('Unclosed fenced code or front matter.');
  return prose.join('');
}

function inspectInline(text, markdown, record) {
  const prose = [];
  const brackets = [];
  let plain = 0;
  let i = 0;
  const consume = (rule, end) => {
    prose.push(text.slice(plain, i), ' ');
    record(rule, text.slice(i, end));
    i = end;
    plain = end;
  };
  while (i < text.length) {
    const char = text[i];
    if (char === '\\' && markdown && /[\\[\]!`{}()<>]/.test(text[i + 1] || ' ')) {
      consume('markup', i + 2);
    } else if (char === '`') {
      let j = i + 1;
      while (text[j] === '`') j++;
      const ticks = j - i;
      let close = text.indexOf('`', j);
      while (close !== -1) {
        let end = close + 1;
        while (text[end] === '`') end++;
        if (end - close === ticks) {
          consume('code', end);
          break;
        }
        close = text.indexOf('`', end);
      }
      if (close === -1) throw new Error('Unclosed inline code.');
    } else if (char === '{') {
      consume('placeholder', takeBalanced(text, i, '{', '}'));
    } else if (char === '}') {
      throw new Error('Unbalanced placeholder.');
    } else if (markdown && char === '[') {
      if (brackets.length >= 64)
        throw new Error('Markdown label nesting exceeds the supported depth.');
      brackets.push({ start: i, image: i > 0 && text[i - 1] === '!' });
      i++;
    } else if (markdown && char === ']') {
      const opener = brackets.pop();
      if (!opener) throw new Error('Unbalanced Markdown label.');
      record('link', opener.image ? 'image' : 'label');
      if (text[i + 1] === '(') {
        consume('link', takeBalanced(text, i + 1, '(', ')'));
      } else if (text[i + 1] === '[') {
        const end = text.indexOf(']', i + 2);
        if (end < 0) throw new Error('Unclosed Markdown reference.');
        if (end === i + 2) record('link', text.slice(opener.start, i));
        consume('link', end + 1);
      } else {
        record('link', text.slice(opener.start, i + 1));
        i++;
      }
    } else if (char === '<' && /^<[!?/A-Za-z]/.test(text.slice(i, i + 2))) {
      const comment = text.startsWith('<!--', i);
      const end = comment ? text.indexOf('-->', i + 4) : text.indexOf('>', i + 1);
      if (end < 0) throw new Error('Unclosed markup.');
      const markup = text.slice(i, end + 1);
      if (
        !comment &&
        /<(?:script|style|pre|code|textarea)\b|["'][^"']*$/i.test(
          markup.replace(/(["'])(.*?)\1/g, '')
        )
      ) {
        throw new Error('Raw HTML block or ambiguous attribute needs a format-specific review.');
      }
      consume('markup', end + (comment ? 3 : 1));
    } else {
      i++;
    }
  }
  if (brackets.length) throw new Error('Unbalanced Markdown label.');
  prose.push(text.slice(plain));
  return prose.join('');
}

function inventory(value, locale, markdown) {
  const tokens = new Map();
  const record = (rule, token) => {
    if (!tokens.has(rule)) tokens.set(rule, []);
    tokens.get(rule).push(token);
  };
  const lines = inspectLines(value, markdown, record);
  // Localisation catalogues often embed Markdown links inside otherwise plain JSON strings.
  const inlineMarkdown = markdown || lines.includes('](') || lines.includes('][');
  const prose = inspectInline(lines, inlineMarkdown, record);
  for (const [rule, pattern] of RULES) {
    for (const item of matches(prose, pattern)) record(rule, item);
  }
  for (const match of prose.matchAll(
    /«[^«»]*»|“[^“”]*”|‘[^‘’]*’|"[^"]*"|(?<![\p{L}\p{N}])'[^'\r\n]+'(?![\p{L}\p{N}])/gu
  )) {
    record('quotation', match[0].slice(1, -1).trim());
  }
  // Preserve attribution subjects independently of the language used for the reporting phrase.
  for (const match of prose.matchAll(AUTHOR)) record('attribution', match[1]);
  const qualifiers = [];
  // In dated English prose "May" names a month. Portuguese "no" means "in the".
  const qualifierText = prose.replace(/\bMay\b(?=\s+\d)|\b\d{1,2}(?:st|nd|rd|th)?\s+May\b/gi, ' ');
  for (const [kind, pattern] of QUALIFIERS) {
    for (const match of qualifierText.matchAll(pattern)) {
      if (/^pt(?:-|$)/i.test(locale || '') && /^no$/i.test(match[0])) continue;
      qualifiers.push([match.index, kind]);
    }
  }
  for (const [, kind] of qualifiers.sort((a, b) => a[0] - b[0])) record('qualifier', kind);
  const amount = quantities(prose, locale);
  tokens.set('number', amount.numbers);
  tokens.set('date', amount.dates);
  tokens.set('unit', amount.units);
  return tokens;
}

function isStringList(value) {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length > 0);
}

function same(left, right) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function count(text, literal) {
  return text.split(literal).length - 1;
}

function checkFidelity(source, output, options = {}) {
  const findings = [];
  const add = (rule, path, message) => findings.push({ rule, path, message });
  const result = (status, coverage) => ({
    status,
    coverage,
    findings,
    semantic: 'unreviewed',
    factual: 'unverified',
  });
  if (
    typeof source !== 'string' ||
    typeof output !== 'string' ||
    !options ||
    typeof options !== 'object'
  ) {
    add('invalid', '', 'Two strings and a check policy are required.');
    return result('incomplete', 'partial');
  }
  if (
    !source.trim() ||
    !output.trim() ||
    [source, output].some((text) => Buffer.byteLength(text) > MAX_BYTES)
  ) {
    add('scope', '', 'Expected nonempty texts of up to 1 MiB each.');
    return result('incomplete', 'partial');
  }

  const { format = 'text', allowedFields = [], protectedTerms = [], protectedSpans = [] } = options;
  if (!['text', 'markdown', 'json', 'yaml'].includes(format)) {
    add('unsupported', '', 'Unsupported input format.');
    return result('incomplete', 'partial');
  }
  if (
    !isStringList(protectedTerms) ||
    !isStringList(protectedSpans) ||
    !Array.isArray(allowedFields)
  ) {
    add('invalid', '', 'Invalid protected ranges or field list.');
    return result('incomplete', 'partial');
  }

  let path = '';
  try {
    const structured = format === 'json' || format === 'yaml';
    if (structured && !allowedFields.length)
      throw new Error('Select at least one editable string field.');
    if (!structured && allowedFields.length)
      throw new Error('Editable fields require a structured document.');
    const before = structured
      ? projectStructured(source, format, allowedFields)
      : { units: new Map([['', source]]) };
    const after = structured
      ? projectStructured(output, format, allowedFields)
      : { units: new Map([['', output]]) };
    if (before.frame !== after.frame)
      add('structure', '', 'Bytes outside editable strings changed.');
    for (const span of protectedSpans) {
      if (
        !source.includes(span) &&
        ![...before.units.values()].some((text) => text.includes(span))
      ) {
        throw new Error('A declared protected span is absent from the input.');
      }
    }
    for (const [key, original] of before.units) {
      path = key;
      const revised = after.units.get(path);
      if (typeof revised !== 'string' || (original.trim() && !revised.trim()))
        throw new Error('Missing output unit.');
      for (const [rule, literals] of [
        ['protected-term', protectedTerms],
        ['protected-span', protectedSpans],
      ]) {
        for (const literal of literals) {
          if (count(original, literal) !== count(revised, literal))
            add(rule, path, 'The number of exact occurrences changed.');
        }
      }
      const a = inventory(
        original,
        options.sourceLocale || options.language,
        format === 'markdown'
      );
      const b = inventory(revised, options.targetLocale || options.language, format === 'markdown');
      for (const rule of new Set([...a.keys(), ...b.keys()])) {
        if (!same(a.get(rule) || [], b.get(rule) || []))
          add(rule, path, 'Protected content changed in this unit.');
      }
    }
  } catch (error) {
    add(
      'unsupported',
      path,
      error.name === 'SyntaxError' || error.name === 'YAMLException'
        ? 'Invalid structured document.'
        : error.message
    );
    return result('incomplete', 'partial');
  }
  return result(findings.length ? 'findings' : 'pass', 'complete');
}

module.exports = { checkFidelity };
