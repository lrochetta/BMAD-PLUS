#!/usr/bin/env node
/**
 * Egress gate: every place the npm payload, or a maintainer service deployed from this
 * repository, can reach the network, listen on a port or start a process is declared in the
 * data-handling doctrine of registry.yaml, and every declared place still exists.
 *
 * Static and deterministic, like verify-action-pins.js is to workflow actions. Each scanned
 * source file (package.json `files` tracked by git, plus the files of each declared service)
 * has its comments and string bodies blanked; imports of the capability modules below are
 * resolved to their local names, and every reference to a capability is one site, keyed by
 * file and call (`child_process.spawn`, `requests.post`). The doctrine states how many sites
 * each file holds, so a new call in an already covered file fails too. A declared wrapper
 * (npm-runner.js, _http.py…) is a capability as a whole: each caller of anything it offers,
 * except the names its entry lists as pure, is a new site, and every name it offers must be
 * listed. Markup that makes a browser load a remote resource, network tools and interpreters
 * in shell scripts, and module loads the scan cannot resolve are counted as well.
 *
 * Deliberately conservative: a local name that shadows an imported capability still counts.
 * Out of sight: Python f-string expressions, third-party code, and capabilities reached by
 * name at run time; the dependency lists are pinned by the doctrine for that reason.
 *
 *   node tools/build/verify-egress.js            check the doctrine and the SECURITY.md table
 *   node tools/build/verify-egress.js --list     print the observed sites
 *   node tools/build/verify-egress.js --write    rewrite the SECURITY.md table from the doctrine
 *
 * Idea taken from the open-code-review study (docs/research/open-code-review-2026-09-25, P12).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const yaml = require('js-yaml');
const { matchesAny } = require('../cli/lib/glob');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SCANNED = /\.(?:c?js|mjs|py|html?|sh|ps1)$/;
const BEGIN =
  '<!-- data-handling:begin — generated from registry.yaml by tools/build/verify-egress.js --write -->';
const END = '<!-- data-handling:end -->';

const EGRESS = ['none', 'direct', 'delegated'];
const CONSENT = ['invocation', 'opt-in', 'opt-out', 'credential'];
const FLOW_KEYS = [
  'id',
  'component',
  'egress',
  'purpose',
  'sends',
  'recipients',
  'trigger',
  'consent',
  'sites',
];
const SERVICE_KEYS = ['id', 'root', 'purpose', 'requirements', 'dependencies', 'exclude'];
const KEBAB = /^[a-z][a-z0-9-]*$/;

// ── Capabilities ─────────────────────────────────────────────────────────────

// `module` makes require functions (createRequire) and `inspector` opens a debugging port.
const NODE_MODULES = [
  'child_process',
  'cluster',
  'dgram',
  'dns',
  'http',
  'http2',
  'https',
  'inspector',
  'module',
  'net',
  'tls',
];
const PYTHON_MODULES = [
  ['subprocess'],
  ['socket'],
  ['socketserver'],
  ['http.client'],
  ['http.server'],
  ['urllib.request'],
  ['urllib3'],
  ['requests'],
  ['httpx'],
  ['aiohttp'],
  ['ftplib'],
  ['smtplib'],
  ['xmlrpc.client'],
  ['webbrowser'],
  ['playwright'],
  ['selenium'],
  ['uvicorn'],
  // GitPython runs git, which clones, pulls and pushes.
  ['git'],
  ['google.genai'],
  // Downloads its model from the Hugging Face Hub on first use.
  ['sentence_transformers'],
  ['huggingface_hub'],
  ['chromadb', /^(?:HttpClient|AsyncHttpClient|CloudClient)$/],
  ['os', /^(?:system|popen|exec\w*|spawn\w*|posix_spawn\w*|startfile)$/],
  ['asyncio', /^(?:create_subprocess_\w+|open_(?:unix_)?connection|start_(?:unix_)?server)$/],
  ['pty', /^spawn$/],
];
const WEB_GLOBALS =
  /(?<![\w$.])(?:(?:window|globalThis|self)\s*\.\s*)?(fetch|XMLHttpRequest|WebSocket|EventSource)(?![\w$])|(?<![\w$.])navigator\s*\.\s*(sendBeacon)(?![\w$])/g;
// Network tools send; interpreters and launchers run code this scan does not see.
const SHELL_TOOLS = [
  'curl',
  'wget',
  'Invoke-WebRequest',
  'Invoke-RestMethod',
  'iwr',
  'irm',
  'Start-BitsTransfer',
  'nc',
  'ncat',
  'ssh',
  'scp',
  'sftp',
  'rsync',
  'git',
  'npm',
  'npx',
  'pip',
  'pip3',
  'pipx',
  'uv',
  'python',
  'python3',
  'py',
  'node',
  'bash',
  'sh',
  'zsh',
  'pwsh',
  'powershell',
  'cmd',
  'Start-Process',
  'saps',
  'Invoke-Expression',
  'iex',
  'eval',
].join('|');
const SHELL_TOOL = new RegExp(`(?<![\\w.$-])(${SHELL_TOOLS})(?![\\w.-])`, 'gi');
// PowerShell's call operator `& <command>`, unless the command is a tool counted above.
const POWERSHELL_CALL = new RegExp(
  `(?<![&\\w>])&(?!&)[ \\t]*(?=[^\\s|;&#])(?!(?:${SHELL_TOOLS})(?![\\w.-]))`,
  'gi'
);

const REMOTE = String.raw`(?:https?:)?\/\/`;
const LINK_LOADS =
  /\brel\s*=\s*["']?[^"'>]*\b(?:stylesheet|icon|preload|modulepreload|prefetch|preconnect|prerender|manifest)\b/i;
const EMBEDDED = new RegExp(
  String.raw`<(?:script|img|iframe|frame|source|track|video|audio|embed|object|input)\b[^>]*?\b(?:(?:src|data|poster)\s*=\s*["']?|srcset\s*=\s*["']?[^"'>]*?)${REMOTE}`,
  'gi'
);
const CSS_URL = new RegExp(String.raw`(?<![\w$.])url\(\s*["']?${REMOTE}`, 'g');
const CSS_IMPORT = new RegExp(String.raw`@import\s+["']${REMOTE}`, 'gi');
const META_REFRESH = new RegExp(
  String.raw`<meta\b[^>]*\bhttp-equiv\s*=\s*["']?refresh\b[^>]*\burl\s*=\s*${REMOTE}`,
  'gi'
);
// A script that points an element or the page at a remote address loads it (`new Image().src`).
const REMOTE_ASSIGNMENT = new RegExp(
  String.raw`\.\s*(?:src|srcset|href|poster)\s*=(?![=>])\s*["'\x60]${REMOTE}|\bsetAttribute\s*\(\s*["'](?:src|srcset|href|poster|data|action)["']\s*,\s*["'\x60]${REMOTE}`,
  'g'
);
const SCRIPT_BLOCK = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
const INLINE_SCRIPT =
  /\son[a-z]+\s*=\s*(?:"([^"]*)"|'([^']*)')|\s(?:href|src|action|formaction)\s*=\s*(?:"\s*javascript:([^"]*)"|'\s*javascript:([^']*)')/gi;

// Classes named like constants: they connect.
const CAPITAL_CLASSES = new Set(['SMTP', 'SMTP_SSL', 'LMTP', 'FTP', 'FTP_TLS']);

/** Exception classes, constants and exception namespaces are names, not network or process use. */
const notACapability = (segment) =>
  !CAPITAL_CLASSES.has(segment) &&
  (segment === 'exceptions' ||
    /^_*[A-Z][A-Z0-9_]*$/.test(segment) ||
    /(?:error|exception|expired|warning|timeout)$/i.test(segment));

function capabilitySpecs(wrappers, python) {
  const modules = python
    ? PYTHON_MODULES.map(([name, members]) => ({ segments: name.split('.'), name, members }))
    : NODE_MODULES.map((name) => ({ segments: [name], name }));
  return [
    ...modules,
    ...wrappers
      .filter((wrapper) => wrapper.file.endsWith('.py') === python)
      .map((wrapper) => ({
        segments: [`@${wrapper.file}`],
        name: wrapperName(wrapper.file),
        pure: new Set(wrapper.pure || []),
      })),
  ];
}

const wrapperName = (file) => path.posix.basename(file).replace(/\.[^.]+$/, '');

/** The capability a dotted reference reaches, or null when it reaches none. */
function classify(segments, specs) {
  for (const spec of specs) {
    const size = spec.segments.length;
    if (segments.length < size || spec.segments.some((part, k) => part !== segments[k])) continue;
    const rest = segments.slice(size);
    if (spec.pure) {
      // A wrapper is a capability as a whole: every name it offers but the declared pure ones.
      if (!rest.length) return spec.name;
      return spec.pure.has(rest[0]) || notACapability(rest[0]) ? null : `${spec.name}.${rest[0]}`;
    }
    if (rest.some(notACapability)) return null;
    if (spec.members && !(rest.length && spec.members.test(rest[0]))) return null;
    return [spec.name, ...rest].join('.');
  }
  return null;
}

/** `from os import *`, `export * from 'node:child_process'`: the whole module, every member. */
function starSite(segments, specs) {
  const exact = specs.find((spec) => spec.segments.join('\0') === segments.join('\0'));
  const capability = exact ? exact.name : classify(segments, specs);
  return capability && `${capability}.*`;
}

// ── Lexers: blank comments and string bodies, keep every offset ─────────────

const REGEX_AFTER = new Set([
  'return',
  'typeof',
  'instanceof',
  'in',
  'of',
  'new',
  'delete',
  'void',
  'throw',
  'case',
  'do',
  'else',
  'yield',
  'await',
  'control)',
]);
// `if (a) /re/.test(b)`: a slash after the condition of these statements starts a regex.
const CONDITION_HEAD = new Set(['if', 'while', 'for', 'with']);

/** JavaScript with comments, strings, regex and template text blanked; `strings` maps quote offsets to values. */
function blankJs(text) {
  const out = text.split('');
  const strings = new Map();
  const blank = (from, to) => {
    for (let k = from; k < to; k++) if (out[k] !== '\n' && out[k] !== '\r') out[k] = ' ';
  };
  const braces = [];
  const parens = [];
  let last = '';
  let i = 0;
  const templateText = (from) => {
    let j = from;
    while (j < text.length && text[j] !== '`' && !(text[j] === '$' && text[j + 1] === '{'))
      j += text[j] === '\\' ? 2 : 1;
    blank(from, Math.min(j, text.length));
    if (text[j] === '$') {
      braces.push('template');
      last = '{';
      return j + 2;
    }
    last = 'x';
    return j + 1;
  };
  while (i < text.length) {
    const c = text[i];
    if (c === '/' && text[i + 1] === '/') {
      const end = text.indexOf('\n', i);
      const stop = end < 0 ? text.length : end;
      blank(i, stop);
      i = stop;
    } else if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end < 0 ? text.length : end + 2;
      blank(i, stop);
      i = stop;
    } else if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < text.length && text[j] !== c && text[j] !== '\n') j += text[j] === '\\' ? 2 : 1;
      strings.set(i, text.slice(i + 1, j));
      blank(i + 1, j);
      i = j + 1;
      last = 'x';
    } else if (c === '`') {
      i = templateText(i + 1);
    } else if (c === '{') {
      braces.push('brace');
      last = c;
      i++;
    } else if (c === '}') {
      if (braces.pop() === 'template') i = templateText(i + 1);
      else {
        last = c;
        i++;
      }
    } else if (c === '(') {
      parens.push(last);
      last = c;
      i++;
    } else if (c === ')') {
      last = CONDITION_HEAD.has(parens.pop()) ? 'control)' : c;
      i++;
    } else if ((c === '+' || c === '-') && text[i + 1] === c) {
      // `i++ / 2` divides: an increment or a decrement ends an operand.
      last = 'x';
      i += 2;
    } else if (
      c === '/' &&
      (last === '' || /^[(,=:[!&|?{};+\-*%<>~^]$/.test(last) || REGEX_AFTER.has(last))
    ) {
      let j = i + 1;
      let inClass = false;
      while (j < text.length && text[j] !== '\n' && (inClass || text[j] !== '/')) {
        if (text[j] === '\\') j++;
        else if (text[j] === '[') inClass = true;
        else if (text[j] === ']') inClass = false;
        j++;
      }
      if (text[j] !== '/') {
        last = c;
        i++;
        continue;
      }
      blank(i + 1, j);
      i = j + 1;
      while (/[a-z]/.test(text[i] || '')) i++;
      last = 'x';
    } else if (/[\w$]/.test(c)) {
      const word = /^[\w$]+/.exec(text.slice(i, i + 64))[0];
      last = word;
      i += word.length;
    } else {
      if (!/\s/.test(c)) last = c;
      i++;
    }
  }
  return { code: out.join(''), strings };
}

/** Python with comments and every string body blanked (f-string expressions included). */
function blankPython(text) {
  const out = text.split('');
  const blank = (from, to) => {
    for (let k = from; k < to; k++) if (out[k] !== '\n' && out[k] !== '\r') out[k] = ' ';
  };
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (c === '#') {
      const end = text.indexOf('\n', i);
      const stop = end < 0 ? text.length : end;
      blank(i, stop);
      i = stop;
      continue;
    }
    let quote = i;
    if (/[A-Za-z_]/.test(c)) {
      const word = /^\w+/.exec(text.slice(i, i + 64))[0];
      if (!/^(?:[rubf]|br|rb|fr|rf)$/i.test(word) || !/["']/.test(text[i + word.length] || '')) {
        i += word.length;
        continue;
      }
      quote = i + word.length;
    } else if (c !== '"' && c !== "'") {
      i++;
      continue;
    }
    const q = text[quote];
    const triple = text.slice(quote, quote + 3) === q.repeat(3);
    const close = triple ? q.repeat(3) : q;
    let j = quote + close.length;
    while (j < text.length && !text.startsWith(close, j) && (triple || text[j] !== '\n'))
      j += text[j] === '\\' ? 2 : 1;
    blank(quote + close.length, j);
    i = j + close.length;
  }
  return out.join('');
}

/**
 * Shell or PowerShell with comments and literal text blanked. Command substitutions (`$(...)`,
 * and backticks in sh) stay code inside double quotes, and a quoted script handed to `-c`,
 * `-e`, `-Command` or `/c` stays code whole: that is where install scripts hide commands.
 */
function blankShell(text, powershell) {
  const out = text.split('');
  const blank = (from, to) => {
    for (let k = from; k < to; k++) if (out[k] !== '\n' && out[k] !== '\r') out[k] = ' ';
  };
  const escape = powershell ? '`' : '\\';
  const scriptFlag = /^(?:-c|-e|-Command|\/c)$/i;
  const single = (open, keep, terminator) => {
    const end = text.indexOf(terminator, open + 1);
    const stop = end < 0 ? text.length : end;
    if (!keep) blank(open + 1, stop);
    return stop + terminator.length;
  };
  const double = (open, keep, terminator) => {
    let i = open + 1;
    let from = i;
    const flush = (to) => keep || blank(from, to);
    while (i < text.length && !text.startsWith(terminator, i)) {
      if (text[i] === escape) i += 2;
      else if (text[i] === '$' && text[i + 1] === '(') {
        flush(i);
        i = code(i + 2, ')') + 1;
        from = i;
      } else if (!powershell && text[i] === '`') {
        flush(i);
        i = code(i + 1, '`') + 1;
        from = i;
      } else i++;
    }
    flush(Math.min(i, text.length));
    return i + terminator.length;
  };
  // Code from `start` up to `close` at depth zero (the end of a substitution); returns its offset.
  function code(start, close) {
    let i = start;
    let word = '';
    let previous = '';
    let depth = 0;
    while (i < text.length) {
      const c = text[i];
      if (c === close && depth === 0) return i;
      if (c === escape) {
        word += text.slice(i, i + 2);
        i += 2;
      } else if (powershell && c === '<' && text[i + 1] === '#') {
        const end = text.indexOf('#>', i + 2);
        const stop = end < 0 ? text.length : end + 2;
        blank(i, stop);
        i = stop;
      } else if (c === '#' && !word) {
        const end = text.indexOf('\n', i);
        const stop = end < 0 ? text.length : end;
        blank(i, stop);
        i = stop;
      } else if (powershell && c === '@' && /^@["']\r?\n/.test(text.slice(i, i + 4))) {
        const quote = text[i + 1];
        const reader = quote === '"' ? double : single;
        i = reader(i + 1, scriptFlag.test(previous), `\n${quote}@`);
        word = 'x';
      } else if (c === '"' || c === "'") {
        i = (c === '"' ? double : single)(i, scriptFlag.test(previous), c);
        word = 'x';
      } else if (!powershell && c === '`') {
        i = code(i + 1, '`') + 1;
        word = 'x';
      } else if (/[\s;|&()]/.test(c)) {
        if (c === '(') depth++;
        else if (c === ')') depth--;
        previous = /[\n;|&]/.test(c) ? '' : word || previous;
        word = '';
        i++;
      } else {
        word += c;
        i++;
      }
    }
    return i;
  }
  code(0);
  return out.join('');
}

// ── Scanners ─────────────────────────────────────────────────────────────────

const IDENT = '[A-Za-z_$][\\w$]*';
const occurrences = (text, globalPattern) => (text.match(globalPattern) || []).length;
const chainAt = (code, from) => {
  const re = new RegExp(`\\s*\\??\\.\\s*(${IDENT})`, 'y');
  const members = [];
  re.lastIndex = from;
  let match;
  while ((match = re.exec(code))) members.push(match[1]);
  return members;
};

const DECLARED = /\b(?:let|var)\s+$/;

/** Count references to each binding outside the import statements that created it. */
function countReferences(code, bindings, spans, specs, add) {
  const inSpan = (at) => spans.some(([from, to]) => at >= from && at < to);
  for (const { local, segments } of bindings) {
    const name = local
      .split('.')
      .map((part) => part.replace(/\$/g, '\\$'))
      .join('\\s*\\.\\s*');
    const re = new RegExp(`(?<![\\w$.])${name}(?![\\w$])`, 'g');
    let match;
    while ((match = re.exec(code))) {
      // `let cp;` declares the name that a later `cp = require(...)` binds.
      if (
        inSpan(match.index) ||
        DECLARED.test(code.slice(Math.max(0, match.index - 12), match.index))
      )
        continue;
      const capability = classify([...segments, ...chainAt(code, re.lastIndex)], specs);
      if (capability) add(capability);
    }
  }
}

function jsModule(file, specifier, wrapperFiles) {
  const bare = specifier.replace(/^node:/, '');
  if (!specifier.startsWith('.')) return [bare];
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
  const hit = [base, `${base}.js`, `${base}.mjs`, `${base}.cjs`, `${base}/index.js`].find(
    (candidate) => wrapperFiles.has(candidate)
  );
  return hit ? [`@${hit}`] : [`./${base}`];
}

function namedBindings(list, segments) {
  return list
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, local] = part.split(/\s*(?::|\bas\b)\s*/);
      return { local: (local || name).split('=')[0].trim(), segments: [...segments, name.trim()] };
    })
    .filter(({ local }) => /^[A-Za-z_$][\w$]*$/.test(local));
}

// `require`, `module.require`, `process.mainModule.require` and `process.getBuiltinModule`.
const LOAD_CALL = new RegExp(
  String.raw`(?<![\w$.])(?:(?:${IDENT}\s*\.\s*)*(?:(?:module|mainModule)\s*\.\s*require|getBuiltinModule)|require)\s*\(\s*`,
  'g'
);
const ASSIGNED = new RegExp(String.raw`(?<![\w$.])(${IDENT}(?:\s*\.\s*${IDENT})*)\s*=\s*$`);
const DESTRUCTURED = /(?:(?:const|let|var)\s*)?\{([^{}]*)\}\s*=\s*$/;
const IMPORT_FROM =
  /(?<![\w$.])import\s+(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\*\s*as\s+([A-Za-z_$][\w$]*)|\{([^}]*)\})?\s*from\s*(?=["'])/g;
const EXPORT_FROM =
  /(?<![\w$.])export\s+(?:(\*)(?:\s*as\s+[A-Za-z_$][\w$]*)?|\{([^}]*)\})\s*from\s*(?=["'])/g;
// What these reach is decided at run time: a loader handed on, a computed import, code from text.
const COMPUTED_LOADS = [
  /(?<![\w$])require(?![\w$])(?!\s*(?:\(|\.\s*(?:resolve|main|cache)(?![\w$])))/g,
  /(?<![\w$])getBuiltinModule(?![\w$])(?!\s*\()/g,
  /(?<![\w$.])import\s*\(/g,
  /(?<![\w$.])eval\s*\(/g,
  /(?<![\w$.])(?:new\s+)?Function\s*\(/g,
  /(?<![\w$.])process\s*\.\s*(?:binding|_linkedBinding|dlopen)(?![\w$])/g,
];

function scanJs(file, text, specs, wrapperFiles, add, dynamic) {
  const { code, strings } = blankJs(text);
  const bindings = [];
  const spans = [];
  const specifierAt = (quote) => (strings.has(quote) ? strings.get(quote) : null);

  const closing = /\s*\)/y;
  let match;
  LOAD_CALL.lastIndex = 0;
  while ((match = LOAD_CALL.exec(code))) {
    const quote = LOAD_CALL.lastIndex;
    const specifier = /["']/.test(code[quote]) ? specifierAt(quote) : null;
    if (specifier !== null) closing.lastIndex = quote + specifier.length + 2;
    if (specifier === null || !closing.test(code)) {
      dynamic();
      continue;
    }
    const end = closing.lastIndex;
    const segments = jsModule(file, specifier, wrapperFiles);
    const before = code.slice(Math.max(0, match.index - 400), match.index);
    const assigned = ASSIGNED.exec(before);
    const destructured = DESTRUCTURED.exec(before);
    const reached = [...segments, ...chainAt(code, end)];
    if (assigned) {
      bindings.push({ local: assigned[1].replace(/\s+/g, ''), segments: reached });
      spans.push([match.index - assigned[0].length, end]);
    } else if (destructured) {
      bindings.push(...namedBindings(destructured[1], reached));
      spans.push([match.index - destructured[0].length, end]);
    } else {
      const capability = classify(reached, specs);
      if (capability) add(capability);
    }
  }

  for (const found of code.matchAll(IMPORT_FROM)) {
    const after = found.index + found[0].length;
    const specifier = specifierAt(after);
    if (specifier === null) continue;
    const segments = jsModule(file, specifier, wrapperFiles);
    if (found[1]) bindings.push({ local: found[1], segments });
    if (found[2]) bindings.push({ local: found[2], segments });
    if (found[3]) bindings.push(...namedBindings(found[3], segments));
    spans.push([found.index, after + specifier.length + 2]);
  }
  // A re-export hands the capability to every importer of this file.
  for (const found of code.matchAll(EXPORT_FROM)) {
    const specifier = specifierAt(found.index + found[0].length);
    if (specifier === null) continue;
    const segments = jsModule(file, specifier, wrapperFiles);
    const reached = found[1]
      ? [starSite(segments, specs)]
      : namedBindings(found[2], segments).map((named) => classify(named.segments, specs));
    for (const capability of reached) if (capability) add(capability);
  }
  for (const pattern of COMPUTED_LOADS) dynamic(occurrences(code, pattern));

  countReferences(code, bindings, spans, specs, add);
  scanWebGlobals(text, code, add);
}

function scanWebGlobals(text, code, add) {
  for (const match of code.matchAll(WEB_GLOBALS))
    add(`global.${match[1] || `navigator.${match[2]}`}`);
  for (const match of text.matchAll(REMOTE_ASSIGNMENT))
    if (code[match.index] === text[match.index]) add('markup.remote-load');
}

// One logical line (backslash continuations joined); a parenthesised name list may span lines.
const PY_LOGICAL = String.raw`[^\n;]*(?:\\\r?\n[^\n;]*)*`;
const PY_FROM_IMPORT = new RegExp(
  String.raw`^[ \t]*from[ \t]+([\w.]+)[ \t]+import[ \t]+(\([^)]*\)|${PY_LOGICAL})`,
  'gm'
);
const PY_IMPORT = new RegExp(String.raw`^[ \t]*import[ \t]+(${PY_LOGICAL})`, 'gm');

function pyModule(file, dotted, wrapperFiles) {
  if (dotted.startsWith('.') || !dotted.includes('.')) {
    const sibling = path.posix.join(path.posix.dirname(file), `${dotted.replace(/^\.+/, '')}.py`);
    if (wrapperFiles.has(sibling)) return [`@${sibling}`];
  }
  return dotted.split('.');
}

function scanPython(file, text, specs, wrapperFiles, add) {
  const code = blankPython(text);
  const bindings = [];
  const spans = [];
  const names = (list) => list.replace(/[()\\]/g, ' ').replace(/\s+/g, ' ');
  for (const match of code.matchAll(PY_FROM_IMPORT)) {
    const segments = pyModule(file, match[1], wrapperFiles);
    spans.push([match.index, match.index + match[0].length]);
    if (match[2].trim() === '*') {
      const site = starSite(segments, specs);
      if (site) add(site);
      continue;
    }
    bindings.push(...namedBindings(names(match[2]), segments));
  }
  for (const match of code.matchAll(PY_IMPORT)) {
    spans.push([match.index, match.index + match[0].length]);
    for (const part of names(match[1]).split(',')) {
      const [dotted, alias] = part.trim().split(/\s+as\s+/);
      if (!dotted) continue;
      const segments = pyModule(file, dotted, wrapperFiles);
      // `import a.b` binds `a`; `a.b.member` then resolves through the dotted chain.
      const first = dotted.split('.')[0];
      if (alias) bindings.push({ local: alias, segments });
      else
        bindings.push({ local: first, segments: segments[0].startsWith('@') ? segments : [first] });
    }
  }
  countReferences(code, bindings, spans, specs, add);
}

/** Markup that makes a browser fetch a remote resource as soon as a page is opened. */
function scanMarkup(text, add) {
  for (const tag of text.matchAll(/<link\b[^>]*>/gi))
    if (
      LINK_LOADS.test(tag[0]) &&
      new RegExp(String.raw`\bhref\s*=\s*["']?${REMOTE}`, 'i').test(tag[0])
    )
      add('markup.remote-load');
  for (const pattern of [EMBEDDED, CSS_URL, CSS_IMPORT, META_REFRESH])
    add('markup.remote-load', occurrences(text, pattern));
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodeEntities = (value) =>
  value.replace(/&(?:#(\d+)|#x([\da-f]+)|(\w+));/gi, (whole, decimal, hex, name) => {
    if (name) return ENTITIES[name.toLowerCase()] ?? whole;
    const point = decimal ? Number(decimal) : parseInt(hex, 16);
    return point <= 0x10ffff ? String.fromCodePoint(point) : whole;
  });

function scanHtml(file, text, specs, wrapperFiles, add, dynamic) {
  for (const script of text.matchAll(SCRIPT_BLOCK))
    scanJs(file, script[1], specs, wrapperFiles, add, dynamic);
  // Event-handler attributes and `javascript:` addresses are scripts too.
  const markup = text.replace(SCRIPT_BLOCK, '');
  for (const inline of markup.matchAll(INLINE_SCRIPT))
    scanJs(
      file,
      decodeEntities(inline.slice(1).find((value) => value !== undefined)),
      specs,
      wrapperFiles,
      add,
      dynamic
    );
}

function scanShell(text, powershell, add) {
  const code = blankShell(text, powershell);
  for (const match of code.matchAll(SHELL_TOOL)) add(`shell.${match[1].toLowerCase()}`);
  if (powershell) add('shell.call', occurrences(code, POWERSHELL_CALL));
}

/** Sites of one file: { sites: {capability: count}, dynamic: count }. */
function scanFile(file, text, wrappers = []) {
  const python = file.endsWith('.py');
  const specs = capabilitySpecs(wrappers, python);
  const wrapperFiles = new Set(wrappers.map((wrapper) => wrapper.file));
  const sites = {};
  let dynamic = 0;
  const add = (capability, count = 1) => {
    if (count) sites[capability] = (sites[capability] || 0) + count;
  };
  const computed = (count = 1) => {
    dynamic += count;
  };
  if (/\.(?:c?js|mjs)$/.test(file)) scanJs(file, text, specs, wrapperFiles, add, computed);
  else if (python) scanPython(file, text, specs, wrapperFiles, add);
  else if (/\.html?$/.test(file)) scanHtml(file, text, specs, wrapperFiles, add, computed);
  else if (/\.(?:sh|ps1)$/.test(file)) scanShell(text, file.endsWith('.ps1'), add);
  scanMarkup(text, add);
  return { sites, dynamic };
}

// ── Wrapper surface ──────────────────────────────────────────────────────────

/** Top-level entries of the object literal opening at `open`, or null when one is not a plain name. */
function objectKeys(code, strings, open) {
  const keys = [];
  let depth = 0;
  let from = open + 1;
  for (let i = open; i < code.length; i++) {
    const c = code[i];
    if ('([{'.includes(c)) depth++;
    else if (')]}'.includes(c)) depth--;
    if ((c === ',' && depth === 1) || depth === 0) {
      const raw = code.slice(from, i);
      const start = from + raw.length - raw.trimStart().length;
      const entry = raw.trim();
      from = i + 1;
      if (entry) {
        const key = /["']/.test(code[start])
          ? strings.get(start)
          : /^(?:(?:async|get|set)\s+(?=[\w$*]))?\*?\s*([A-Za-z_$][\w$]*)/.exec(entry)?.[1];
        if (!key || entry.startsWith('...')) return null;
        keys.push(key);
      }
      if (depth === 0) return keys;
    }
  }
  return null;
}

/**
 * Every name a wrapper offers its callers: the keys of `module.exports` (and `exports.name`
 * assignments), or the top-level functions, classes and variables of a Python module.
 * Returns { names } or { problem } when the surface cannot be read statically.
 */
function wrapperSurface(file, source) {
  const names = new Set();
  const offer = (name) => {
    if (!notACapability(name) && !/^__\w+__$/.test(name)) names.add(name);
  };
  if (file.endsWith('.py')) {
    const code = blankPython(source);
    for (const match of code.matchAll(/^(?:async[ \t]+)?(?:def|class)[ \t]+(\w+)/gm))
      offer(match[1]);
    for (const match of code.matchAll(/^([A-Za-z_]\w*)[ \t]*(?::[^=\n]*)?=(?!=)/gm))
      offer(match[1]);
    return { names };
  }
  const { code, strings } = blankJs(source);
  for (const match of code.matchAll(
    /(?<![\w$.])(?:module\s*\.\s*)?exports\s*\.\s*([A-Za-z_$][\w$]*)\s*=(?!=)/g
  ))
    offer(match[1]);
  for (const match of code.matchAll(/(?<![\w$.])module\s*\.\s*exports\s*=(?!=)\s*/g)) {
    const open = match.index + match[0].length;
    const keys = code[open] === '{' ? objectKeys(code, strings, open) : null;
    if (!keys) return { problem: 'module.exports is not an object literal of plain names' };
    keys.forEach(offer);
  }
  return { names };
}

// ── Doctrine ─────────────────────────────────────────────────────────────────

const filled = (value) => typeof value === 'string' && value.trim().length > 0;
const plainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const names = (value) => Array.isArray(value) && value.every(filled);

function checkCounts(value, where, problems) {
  if (!plainObject(value) || !Object.keys(value).length) {
    problems.push(`${where}: sites must map each call to its count`);
    return;
  }
  for (const [call, count] of Object.entries(value))
    if (!Number.isSafeInteger(count) || count < 1)
      problems.push(`${where}: "${call}" needs a positive integer count`);
}

function sameList(declared, actual, where, source, advice) {
  const [a, b] = [[...declared].sort(), [...actual].sort()];
  return a.join('\n') === b.join('\n')
    ? []
    : [`${where}: [${a.join(', ')}] differs from ${source} [${b.join(', ')}] — ${advice}`];
}

/** Schema problems of registry.yaml `data_handling`; an empty list means it is well formed. */
function validateDoctrine(doctrine, { packs = [], dependencies = [] } = {}) {
  const problems = [];
  if (!plainObject(doctrine)) return ['data_handling: missing mapping'];
  const keys = ['runtime_dependencies', 'wrappers', 'dynamic_loads', 'services', 'flows'];
  for (const key of Object.keys(doctrine))
    if (!keys.includes(key)) problems.push(`data_handling: unknown key "${key}"`);
  problems.push(
    ...sameList(
      doctrine.runtime_dependencies || [],
      dependencies,
      'data_handling.runtime_dependencies',
      'package.json dependencies',
      'review what a new dependency sends before listing it'
    )
  );

  const wrapperNames = new Set();
  for (const [index, wrapper] of (doctrine.wrappers || []).entries()) {
    const where = `data_handling.wrappers[${index}]`;
    if (!filled(wrapper?.file)) {
      problems.push(`${where}: file is required`);
      continue;
    }
    const name = wrapperName(wrapper.file);
    if (wrapperNames.has(name)) problems.push(`${where}: a second wrapper named "${name}"`);
    wrapperNames.add(name);
    if (!names(wrapper.exports) || !wrapper.exports.length)
      problems.push(`${where}: exports must list the names that reach a capability`);
    if (wrapper.pure !== undefined && !names(wrapper.pure))
      problems.push(`${where}: pure must list names`);
    for (const shared of (wrapper.pure || []).filter((pure) => wrapper.exports?.includes(pure)))
      problems.push(`${where}: "${shared}" is listed both as an export and as pure`);
    checkCounts(wrapper.sites, `${where} (${wrapper.file})`, problems);
  }
  for (const [index, load] of (doctrine.dynamic_loads || []).entries()) {
    const where = `data_handling.dynamic_loads[${index}]`;
    if (
      !filled(load?.file) ||
      !filled(load?.loads) ||
      !Number.isSafeInteger(load?.count) ||
      load.count < 1
    )
      problems.push(`${where}: needs file, a positive count and what it loads`);
  }

  const components = new Set(['cli', ...packs]);
  for (const [index, service] of (doctrine.services || []).entries()) {
    const where = `data_handling.services[${index}]`;
    if (!plainObject(service)) {
      problems.push(`${where}: must be a mapping`);
      continue;
    }
    for (const key of Object.keys(service))
      if (!SERVICE_KEYS.includes(key)) problems.push(`${where}: unknown key "${key}"`);
    if (!KEBAB.test(service.id || '')) problems.push(`${where}: id must be kebab-case`);
    else if (components.has(service.id)) problems.push(`${where}: id "${service.id}" is taken`);
    components.add(service.id);
    if (!filled(service.root) || !filled(service.purpose) || !filled(service.requirements))
      problems.push(`${where}: root, purpose and requirements are required`);
    if (!names(service.dependencies))
      problems.push(`${where}: dependencies must list the requirements by name`);
    if (service.exclude !== undefined && !names(service.exclude))
      problems.push(`${where}: exclude must list path patterns`);
  }

  const ids = new Set();
  if (!Array.isArray(doctrine.flows) || !doctrine.flows.length)
    problems.push('data_handling.flows: must list at least one flow');
  for (const [index, flow] of (doctrine.flows || []).entries()) {
    const where = `data_handling.flows[${index}]${flow?.id ? ` "${flow.id}"` : ''}`;
    if (!plainObject(flow)) {
      problems.push(`${where}: must be a mapping`);
      continue;
    }
    for (const key of Object.keys(flow))
      if (!FLOW_KEYS.includes(key)) problems.push(`${where}: unknown key "${key}"`);
    if (!KEBAB.test(flow.id || '')) problems.push(`${where}: id must be kebab-case`);
    else if (ids.has(flow.id)) problems.push(`${where}: duplicate id`);
    ids.add(flow.id);
    if (!components.has(flow.component))
      problems.push(
        `${where}: component "${flow.component}" is neither cli, a registry pack nor a declared service`
      );
    if (!EGRESS.includes(flow.egress))
      problems.push(`${where}: egress must be one of ${EGRESS.join(', ')}`);
    if (!filled(flow.purpose) || !filled(flow.trigger))
      problems.push(`${where}: purpose and trigger are required`);
    if (flow.egress === 'none') {
      if ('sends' in flow || 'recipients' in flow || 'consent' in flow)
        problems.push(`${where}: a local flow declares no sends, recipients or consent`);
    } else if (EGRESS.includes(flow.egress)) {
      if (!filled(flow.sends)) problems.push(`${where}: sends must say what leaves the machine`);
      if (!names(flow.recipients) || !flow.recipients.length)
        problems.push(`${where}: recipients must name who receives it`);
      if (
        !plainObject(flow.consent) ||
        !CONSENT.includes(flow.consent.basis) ||
        !filled(flow.consent.how)
      )
        problems.push(`${where}: consent needs a basis (${CONSENT.join(', ')}) and how`);
    }
    if (!plainObject(flow.sites) || !Object.keys(flow.sites).length)
      problems.push(`${where}: sites must map files to calls`);
    else
      for (const [file, calls] of Object.entries(flow.sites))
        checkCounts(calls, `${where} ${file}`, problems);
  }
  return problems;
}

/** Declared sites keyed by file and call, with the flow or wrapper that owns each. */
function declaredSites(doctrine) {
  const sites = new Map();
  const problems = [];
  const claim = (file, call, count, owner) => {
    const key = `${file}\0${call}`;
    if (sites.has(key))
      problems.push(`${file}: ${call} is claimed by ${sites.get(key).owner} and ${owner}`);
    else sites.set(key, { file, call, count, owner });
  };
  for (const wrapper of doctrine.wrappers || [])
    for (const [call, count] of Object.entries(wrapper.sites))
      claim(wrapper.file, call, count, `wrapper ${wrapper.file}`);
  for (const flow of doctrine.flows)
    for (const [file, calls] of Object.entries(flow.sites))
      for (const [call, count] of Object.entries(calls))
        claim(file, call, count, `flow "${flow.id}"`);
  return { sites, problems };
}

/** The service whose root holds `file`, or undefined for the npm payload. */
const serviceOf = (doctrine, file) =>
  (doctrine.services || []).find((service) => file.startsWith(`${service.root}/`));

/** Requirement names of a requirements.txt, normalised the way pip compares them. */
const requirementNames = (text) =>
  text
    .split(/\r?\n/)
    .map((line) => line.replace(/#.*/, '').trim())
    .filter((line) => line && !line.startsWith('-'))
    .map((line) =>
      /^[A-Za-z0-9][A-Za-z0-9._-]*/.exec(line)?.[0].toLowerCase().replace(/[._]/g, '-')
    )
    .filter(Boolean);

/**
 * Differences between the doctrine and what the scan observed in `sources` ({file: text});
 * `requirements` maps each service's requirements file to its text.
 */
function compare(doctrine, sources, { requirements = {} } = {}) {
  const wrappers = doctrine.wrappers || [];
  const { sites: declared, problems } = declaredSites(doctrine);
  const observed = new Map();
  const dynamic = new Map();
  for (const [file, content] of Object.entries(sources)) {
    const scan = scanFile(file, content, wrappers);
    for (const [call, count] of Object.entries(scan.sites))
      observed.set(`${file}\0${call}`, { file, call, count });
    if (scan.dynamic) dynamic.set(file, scan.dynamic);
  }
  for (const [key, site] of observed) {
    const entry = declared.get(key);
    if (!entry)
      problems.push(
        `${site.file}: ${site.call} ×${site.count} is not declared in registry.yaml data_handling`
      );
    else if (entry.count !== site.count)
      problems.push(
        `${site.file}: ${site.call} — ${entry.owner} declares ${entry.count}, the code holds ${site.count}`
      );
  }
  for (const [key, entry] of declared)
    if (!observed.has(key))
      problems.push(
        `${entry.file}: ${entry.call} — declared by ${entry.owner}, no longer in the shipped code`
      );

  const flowCalls = doctrine.flows.flatMap((flow) =>
    Object.values(flow.sites).flatMap(Object.keys)
  );
  for (const wrapper of wrappers) {
    // A wrapper's own sites are described by the flows that call it: one caller at least.
    const prefix = `${wrapperName(wrapper.file)}.`;
    if (!flowCalls.some((call) => call.startsWith(prefix)))
      problems.push(`${wrapper.file}: no flow declares a caller of this wrapper`);
    const source = sources[wrapper.file];
    if (source === undefined) continue;
    const surface = wrapperSurface(wrapper.file, source);
    if (surface.problem) {
      problems.push(`${wrapper.file}: ${surface.problem}`);
      continue;
    }
    const listed = [...wrapper.exports, ...(wrapper.pure || [])];
    for (const name of listed)
      if (!surface.names.has(name))
        problems.push(`${wrapper.file}: wrapper lists "${name}", which it does not offer`);
    for (const name of surface.names)
      if (!listed.includes(name))
        problems.push(
          `${wrapper.file}: offers "${name}", listed neither in exports nor as pure — callers of it are unseen until it is`
        );
  }

  const loads = new Map((doctrine.dynamic_loads || []).map((load) => [load.file, load]));
  for (const [file, count] of dynamic) {
    const load = loads.get(file);
    if (!load)
      problems.push(
        `${file}: ${count} module load(s) the scan cannot resolve (computed require/import, a loader handed on, eval), not declared in data_handling.dynamic_loads`
      );
    else if (load.count !== count)
      problems.push(
        `${file}: dynamic_loads declares ${load.count} unresolved module loads, the code holds ${count}`
      );
  }
  for (const file of loads.keys())
    if (!dynamic.has(file))
      problems.push(`${file}: declared in dynamic_loads, no unresolved module load found`);

  // A flow of a service names that service's files; a flow of the package names shipped files.
  for (const flow of doctrine.flows)
    for (const file of Object.keys(flow.sites)) {
      const owner = serviceOf(doctrine, file)?.id;
      const isService = (doctrine.services || []).some((service) => service.id === flow.component);
      if (isService ? owner !== flow.component : owner !== undefined)
        problems.push(
          `${file}: flow "${flow.id}" (${flow.component}) names a file of ${owner || 'the npm payload'}`
        );
    }
  for (const service of doctrine.services || []) {
    const text = requirements[service.requirements];
    if (text === undefined) continue;
    problems.push(
      ...sameList(
        (service.dependencies || []).map((name) => name.toLowerCase().replace(/[._]/g, '-')),
        requirementNames(text),
        `data_handling.services "${service.id}" dependencies`,
        service.requirements,
        'review what a new requirement sends before listing it'
      )
    );
  }
  return { problems, observed: [...observed.values()], dynamic: [...dynamic] };
}

// ── SECURITY.md table ────────────────────────────────────────────────────────

const cell = (value) => String(value).replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim();

function flowTable(flows, column) {
  return [
    `| Flow | ${column} | Leaves the machine | What | To whom | When | Consent |`,
    '|---|---|---|---|---|---|---|',
    ...flows.map((flow) =>
      [
        '',
        `\`${flow.id}\``,
        flow.component,
        flow.egress === 'direct' ? 'directly' : 'through a started program',
        cell(flow.sends),
        cell(flow.recipients.join(', ')),
        cell(flow.trigger),
        `**${flow.consent.basis}**: ${cell(flow.consent.how)}`,
        '',
      ]
        .join(' | ')
        .trim()
    ),
  ];
}

const localList = (flows) =>
  flows.map(
    (flow) =>
      `- \`${flow.id}\` (${flow.component}): ${cell(flow.purpose)} When: ${cell(flow.trigger)}`
  );

function renderDoctrine(doctrine) {
  const services = doctrine.services || [];
  const serviceIds = new Set(services.map((service) => service.id));
  const payload = doctrine.flows.filter((flow) => !serviceIds.has(flow.component));
  const hosted = doctrine.flows.filter((flow) => serviceIds.has(flow.component));
  const lines = [
    BEGIN,
    '',
    ...flowTable(
      payload.filter((flow) => flow.egress !== 'none'),
      'Component'
    ),
    '',
    'Stays on the machine:',
    '',
    ...localList(payload.filter((flow) => flow.egress === 'none')),
  ];
  if (services.length) {
    const local = hosted.filter((flow) => flow.egress === 'none');
    lines.push(
      '',
      'Maintainer services, deployed from this repository and not part of the npm package:',
      '',
      ...services.map(
        (service) => `- \`${service.id}\` (\`${service.root}/\`): ${cell(service.purpose)}`
      ),
      '',
      ...flowTable(
        hosted.filter((flow) => flow.egress !== 'none'),
        'Service'
      )
    );
    if (local.length) lines.push('', 'Stays on the service host:', '', ...localList(local));
  }
  lines.push('', END);
  return lines.join('\n');
}

/** The document with its generated block replaced; throws when the markers are missing. */
function spliceDoctrine(document, block) {
  const from = document.indexOf(BEGIN);
  const to = document.indexOf(END);
  if (from < 0 || to < from) throw new Error('SECURITY.md has no data-handling block markers');
  return document.slice(0, from) + block + document.slice(to + END.length);
}

// ── Repository ───────────────────────────────────────────────────────────────

function trackedFiles(root) {
  return execFileSync('git', ['ls-files', '-z'], {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
    .split('\0')
    .filter((file) => SCANNED.test(file));
}

/** The npm payload (package.json `files`, negations applied) and each service's own files. */
function scannedFiles(root, pkg, services) {
  const include = pkg.files.filter((entry) => !entry.startsWith('!'));
  const exclude = pkg.files.filter((entry) => entry.startsWith('!')).map((entry) => entry.slice(1));
  const inside = (file, entry) => file === entry || file.startsWith(`${entry}/`);
  return trackedFiles(root)
    .filter((file) => {
      const service = services.find((candidate) => inside(file, candidate.root));
      if (service) return !matchesAny(file.slice(service.root.length + 1), service.exclude || []);
      return include.some((entry) => inside(file, entry)) && !matchesAny(file, exclude);
    })
    .sort();
}

function verifyRepository(root = REPO_ROOT, { write = false } = {}) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const registry = yaml.load(fs.readFileSync(path.join(root, 'registry.yaml'), 'utf8'));
  const doctrine = registry.data_handling;
  const problems = validateDoctrine(doctrine, {
    packs: Object.keys(registry.packs || {}),
    dependencies: Object.keys(pkg.dependencies || {}),
  });
  if (problems.length) return { problems, files: 0, observed: [], dynamic: [] };
  const services = doctrine.services || [];
  const files = scannedFiles(root, pkg, services);
  const sources = Object.fromEntries(
    files.map((file) => [file, fs.readFileSync(path.join(root, file), 'utf8')])
  );
  const requirements = {};
  for (const service of services) {
    const file = path.join(root, service.requirements);
    if (fs.existsSync(file)) requirements[service.requirements] = fs.readFileSync(file, 'utf8');
    else
      problems.push(`${service.requirements}: requirements of service "${service.id}" not found`);
  }
  const result = compare(doctrine, sources, { requirements });
  result.problems.unshift(...problems);
  for (const flow of doctrine.flows)
    for (const file of Object.keys(flow.sites))
      if (!(file in sources))
        result.problems.push(`${file}: named by flow "${flow.id}" but not a scanned source file`);
  for (const entry of [...(doctrine.wrappers || []), ...(doctrine.dynamic_loads || [])])
    if (!(entry.file in sources))
      result.problems.push(`${entry.file}: named in data_handling but not a scanned source file`);

  const securityPath = path.join(root, 'SECURITY.md');
  const security = fs.readFileSync(securityPath, 'utf8');
  const rendered = spliceDoctrine(security.replace(/\r\n/g, '\n'), renderDoctrine(doctrine));
  if (write) fs.writeFileSync(securityPath, rendered);
  else if (rendered !== security.replace(/\r\n/g, '\n'))
    result.problems.push(
      'SECURITY.md: the data-handling table differs from registry.yaml — run node tools/build/verify-egress.js --write'
    );
  return { ...result, files: files.length, flows: doctrine.flows.length };
}

if (require.main === module) {
  const write = process.argv.includes('--write');
  try {
    const result = verifyRepository(REPO_ROOT, { write });
    if (process.argv.includes('--list')) {
      for (const site of result.observed) console.log(`${site.file}  ${site.call}  ${site.count}`);
      for (const [file, count] of result.dynamic)
        console.log(`${file}  <unresolved module load>  ${count}`);
    }
    if (result.problems.length) {
      console.error(
        `Egress sites out of step with the data-handling doctrine (${result.problems.length}):`
      );
      for (const problem of result.problems) console.error(`  - ${problem}`);
      process.exit(1);
    }
    console.log(
      `OK — ${result.observed.length} egress and process sites in ${result.files} scanned files match ${result.flows} declared flows${write ? '; SECURITY.md rewritten' : ''}.`
    );
  } catch (error) {
    console.error(`verify-egress: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  blankJs,
  blankPython,
  blankShell,
  scanFile,
  wrapperSurface,
  requirementNames,
  validateDoctrine,
  compare,
  renderDoctrine,
  spliceDoctrine,
  verifyRepository,
};
