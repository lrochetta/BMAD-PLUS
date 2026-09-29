/**
 * Every address a page template would reach on an origin other than its own.
 *
 * The template is read the way a browser reads it rather than matched as raw text: markup is
 * split into tags, comments and raw text by the HTML tokenizer's own rules, attributes have
 * their character references decoded, style sheets their escapes, script string literals
 * theirs, and a data: document or script is decoded and read in turn. Where the tokenizer's
 * state depends on the tree (a style or script inside svg, math or select), the template is
 * refused rather than guessed at. Each address a browser would load is resolved
 * against the page's own address under every scheme the page is opened from (https in a
 * host, http from the local server, a file), because `https:host`, `\\host` and `/\host`
 * resolve differently from each. What a script assembles from pieces at run time is beyond
 * any reading of the text: the jsdom and Chromium checks watch those requests.
 */
'use strict';

const { URL } = require('node:url');

const BASES = ['https://page.invalid/uat/', 'http://127.0.0.1:4173/uat/', 'file:///uat/'].map(
  (base) => new URL(base)
);
/** Schemes whose address never leaves the browser. */
const LOCAL = new Set(['data:', 'blob:', 'about:']);
/** Attributes a browser follows by itself when the element is parsed, shown or submitted. */
const LOADING = new Set([
  'src',
  'href',
  'srcset',
  'imagesrcset',
  'poster',
  'data',
  'action',
  'formaction',
  'background',
  'lowsrc',
  'codebase',
  'manifest',
  'icon',
  'xlink:href',
  'ping',
  'attributionsrc',
]);
/** Loading attributes that hold a list of addresses rather than one. */
const ADDRESS_LISTS = new Set(['srcset', 'imagesrcset', 'ping', 'attributionsrc']);
/** Elements that only ever show what they load as an image or media, which loads nothing more. */
const MEDIA = new Set(['img', 'source', 'picture', 'video', 'audio', 'track', 'input', 'image']);
/** SVG animation elements, whose values can replace the address of the element they animate. */
const ANIMATION = new Set(['set', 'animate', 'animatecolor', 'animatemotion', 'animatetransform']);
/** Start tags after which the tokenizer stops reading markup until the matching end tag. */
const RAW_TEXT = new Set(['style', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript']);
const ESCAPABLE_RAW_TEXT = new Set(['title', 'textarea']);
const SWITCHING = new Set([...RAW_TEXT, ...ESCAPABLE_RAW_TEXT, 'script', 'plaintext']);
/** Foreign elements whose content is HTML again, by namespace. */
const INTEGRATION = {
  svg: new Set(['foreignobject', 'desc', 'title']),
  math: new Set(['mi', 'mo', 'mn', 'ms', 'mtext']),
};
/** HTML start tags that close every open foreign element up to the nearest integration point. */
const BREAKOUT = new Set(
  (
    'b big blockquote body br center code dd div dl dt em embed h1 h2 h3 h4 h5 h6 head hr i img ' +
    'li listing menu meta nobr ol p pre ruby s small span strong strike sub sup table tt u ul var'
  ).split(' ')
);
/** Charsets in which every ASCII byte is the ASCII character, so a byte-wise reading holds. */
const ASCII_CHARSET = /^(?:utf-?8|us-ascii|ascii|iso-8859-1|latin1|windows-125\d)$/i;
/** Following a link is the reader's act; the ping it carries is not. */
const NAVIGATION = new Set(['a', 'area']);
/** Namespace names identify a vocabulary and load nothing. */
const NAMESPACES = new Set([
  'http://www.w3.org/1999/xhtml',
  'http://www.w3.org/2000/svg',
  'http://www.w3.org/1999/xlink',
  'http://www.w3.org/1998/Math/MathML',
  'http://www.w3.org/XML/1998/namespace',
  'http://www.w3.org/2000/xmlns/',
]);
const NAMED_REFERENCES = {
  amp: '&',
  AMP: '&',
  lt: '<',
  LT: '<',
  gt: '>',
  GT: '>',
  quot: '"',
  QUOT: '"',
  apos: "'",
  num: '#',
  quest: '?',
  commat: '@',
  percnt: '%',
  excl: '!',
  equals: '=',
  plus: '+',
  semi: ';',
  lowbar: '_',
  ast: '*',
  lsqb: '[',
  lbrack: '[',
  rsqb: ']',
  rbrack: ']',
  lcub: '{',
  lbrace: '{',
  rcub: '}',
  rbrace: '}',
  verbar: '|',
  vert: '|',
  grave: '`',
  Hat: '^',
  dollar: '$',
  sol: '/',
  bsol: '\\',
  colon: ':',
  period: '.',
  comma: ',',
  lpar: '(',
  rpar: ')',
  Tab: '\t',
  NewLine: '\n',
};
const SCRIPT_ESCAPES = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', 0: '\0' };
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
]);

const codePoint = (code) =>
  code > 0 && code <= 0x10ffff && (code < 0xd800 || code > 0xdfff)
    ? String.fromCodePoint(code)
    : '\uFFFD';

function decodeMarkup(value) {
  return value.replace(/&(?:#x([\da-f]+)|#(\d+)|([a-z][a-z\d]*));?/gi, (whole, hex, dec, name) => {
    if (hex || dec) return codePoint(Number.parseInt(hex || dec, hex ? 16 : 10));
    return Object.hasOwn(NAMED_REFERENCES, name) ? NAMED_REFERENCES[name] : whole;
  });
}

function decodeCss(value) {
  return value.replace(/\\(?:([\da-f]{1,6})[ \t\n\r\f]?|\r\n|([\s\S]))/gi, (_, hex, char) => {
    if (hex) return codePoint(Number.parseInt(hex, 16));
    return char === undefined || /[\n\r\f]/.test(char) ? '' : char;
  });
}

function decodeScript(value) {
  return value.replace(
    /\\(?:x([\da-f]{2})|u\{([\da-f]+)\}|u([\da-f]{4})|(\r\n|[\n\r\u2028\u2029])|([\s\S]))/gi,
    (_, hex, braced, unicode, continuation, char) => {
      if (hex || braced || unicode) return codePoint(Number.parseInt(hex || braced || unicode, 16));
      if (continuation) return '';
      return Object.hasOwn(SCRIPT_ESCAPES, char) ? SCRIPT_ESCAPES[char] : char;
    }
  );
}

/** True when a browser would fetch `address` from somewhere other than the page's origin. */
function leavesOrigin(address) {
  for (const base of BASES) {
    let resolved;
    try {
      resolved = new URL(address, base);
    } catch {
      return true; // an address the check cannot read is not one it can vouch for
    }
    if (LOCAL.has(resolved.protocol)) return false;
    if (resolved.protocol !== base.protocol || resolved.host !== base.host) return true;
  }
  return false;
}

/**
 * The part of a string that names another host, if any: an opening `//` or `\\`, a network
 * scheme (with or without its slashes), or any `scheme://` inside it. Namespace names are not
 * addresses. Used where the text is not yet an address: a script string, a data attribute.
 */
function namedHost(text) {
  const value = text.replace(/[\t\n\r]/g, '').replace(/^[\0- ]+/, '');
  if (/^[\\/]{2}|^(?:https?|wss?|ftp|file):/i.test(value) && !NAMESPACES.has(value)) return value;
  for (const [found] of value.matchAll(/[a-z][a-z\d+.-]*:[\\/]{2}[^\s"'`<>()]*/gi))
    if (!NAMESPACES.has(found)) return found;
  return null;
}

/** String literal and template chunk contents of a script, comments and regex literals left out. */
function scriptStrings(source) {
  const strings = [];
  const substitutions = []; // open `${` of template literals, with the braces opened inside each
  let last = '';
  let i = 0;
  const readTemplate = () => {
    let chunk = '';
    while (i < source.length) {
      const char = source[i];
      if (char === '\\') {
        chunk += source.slice(i, i + 2);
        i += 2;
      } else if (char === '`') {
        i += 1;
        break;
      } else if (char === '$' && source[i + 1] === '{') {
        i += 2;
        substitutions.push(0);
        break;
      } else {
        chunk += char;
        i += 1;
      }
    }
    strings.push(chunk);
    last = '`';
  };
  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];
    if (char === '/' && next === '/') {
      const end = source.indexOf('\n', i);
      i = end < 0 ? source.length : end;
    } else if (char === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end < 0 ? source.length : end + 2;
    } else if (char === '"' || char === "'") {
      let chunk = '';
      i += 1;
      while (i < source.length && source[i] !== char && source[i] !== '\n') {
        const step = source[i] === '\\' ? 2 : 1;
        chunk += source.slice(i, i + step);
        i += step;
      }
      i += 1;
      strings.push(chunk);
      last = char;
    } else if (char === '`') {
      i += 1;
      readTemplate();
    } else if (char === '}' && substitutions.length && substitutions.at(-1) === 0) {
      substitutions.pop();
      i += 1;
      readTemplate();
    } else if (
      char === '/' &&
      (last === '' || REGEX_AFTER.has(last) || /^[(,=:[!&|?{};+\-*%<>~^}]$/.test(last))
    ) {
      let inClass = false;
      i += 1;
      while (i < source.length && source[i] !== '\n' && (inClass || source[i] !== '/')) {
        if (source[i] === '\\') i += 1;
        else if (source[i] === '[') inClass = true;
        else if (source[i] === ']') inClass = false;
        i += 1;
      }
      i += 1;
      while (/[a-z]/i.test(source[i] || '')) i += 1;
      last = '/re/';
    } else if (/\s/.test(char)) {
      i += 1;
    } else if (/[\w$]/.test(char)) {
      const word = /^[\w$]+/.exec(source.slice(i, i + 64))[0];
      i += word.length;
      last = word;
    } else {
      if (substitutions.length && char === '{') substitutions[substitutions.length - 1] += 1;
      if (substitutions.length && char === '}') substitutions[substitutions.length - 1] -= 1;
      last = char;
      i += 1;
    }
  }
  return strings.map(decodeScript);
}

function scanScript(where, source, found) {
  for (const literal of scriptStrings(source)) {
    const host = namedHost(literal);
    if (host) found.push(`an address on another origin in ${where}: ${host}`);
  }
  // Behind the reading, the raw text: a scheme with its slashes anywhere, comments included.
  for (const [address] of source.matchAll(/\b[a-z][a-z\d+.-]*:[\\/]{2}[^\s"'`<>()]*/gi))
    if (!NAMESPACES.has(address)) found.push(`an absolute address in ${where}: ${address}`);
}

function scanCss(where, css, found) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  if (/@import\b/i.test(decodeCss(text))) found.push(`a stylesheet import in ${where}`);
  const escape = String.raw`\\[\da-f]{1,6}[ \t\n\r\f]?|\\[\s\S]`;
  const tokens = new RegExp(
    String.raw`"((?:[^"\\\n]|\\[\s\S])*)"|'((?:[^'\\\n]|\\[\s\S])*)'|((?:[\w-]|${escape})+)\(\s*((?:[^)\\\s"']|${escape})*)\s*\)`,
    'gi'
  );
  for (const [, double, single, name, bare] of text.matchAll(tokens)) {
    // A quoted string may be an address (url("…"), image-set("…"), @import "…") or plain text
    // (content: "Note: "): it is refused when it names a host. A bare url() is an address.
    const quoted = double ?? single;
    const host =
      quoted === undefined
        ? /^url$/i.test(decodeCss(name)) && leavesOrigin(decodeCss(bare)) && decodeCss(bare)
        : namedHost(decodeCss(quoted));
    if (host) found.push(`an address on another origin in ${where}: ${host.trim()}`);
  }
}

/**
 * The bytes behind a data: address as a browser reads them, or why they cannot be read. The
 * URL parser drops tabs and newlines and ends the body at `#`; the body is percent-decoded,
 * then base64-decoded when the type says so. A charset that is not ASCII-compatible (UTF-16,
 * or its byte order mark) would hide ASCII markup from a byte-wise reading: it is refused.
 */
function dataPayload(address) {
  const url = address.replace(/[\t\n\r]/g, '').replace(/^[\0- ]+|[\0- ]+$/g, '');
  const comma = url.indexOf(',');
  if (comma < 0) return { text: '' }; // no body: the browser loads nothing
  const type = url.slice(url.indexOf(':') + 1, comma).trim();
  const raw = Buffer.from(url.slice(comma + 1).split('#')[0], 'utf8');
  const bytes = [];
  for (let i = 0; i < raw.length; i += 1) {
    const hex = raw[i] === 0x25 ? raw.toString('latin1', i + 1, i + 3) : '';
    if (/^[\da-f]{2}$/i.test(hex)) {
      bytes.push(Number.parseInt(hex, 16));
      i += 2;
    } else bytes.push(raw[i]);
  }
  let body = Buffer.from(bytes);
  if (/;\s*base64$/i.test(type)) {
    let text = body.toString('latin1').replace(/[\t\n\f\r ]/g, '');
    if (text.length % 4 === 0) text = text.replace(/==?$/, '');
    if (text.length % 4 === 1 || /[^A-Za-z\d+/]/.test(text)) return { unreadable: 'bad base64' };
    body = Buffer.from(text, 'base64');
  }
  const charset = /;\s*charset="?([^;"]*)/i.exec(type)?.[1].trim();
  if (charset && !ASCII_CHARSET.test(charset)) return { unreadable: `charset ${charset}` };
  if ((body[0] === 0xfe && body[1] === 0xff) || (body[0] === 0xff && body[1] === 0xfe))
    return { unreadable: 'a UTF-16 byte order mark' };
  return { text: body.toString('latin1') };
}

/**
 * A data: document, stylesheet or script reaches the network like any page: it is decoded and
 * read as what the element that loads it makes of it.
 */
function scanData(tag, where, address, found) {
  const payload = dataPayload(address);
  const label = `the data: address of ${where}`;
  if (payload.unreadable) {
    found.push(`${label}, which the check cannot read (${payload.unreadable})`);
    return;
  }
  if (tag === 'script') return scanScript(label, payload.text, found);
  if (tag === 'link') {
    // A stylesheet, or a manifest whose JSON strings name the icons it loads.
    scanCss(label, payload.text, found);
    return scanScript(label, payload.text, found);
  }
  for (const entry of scanMarkup(payload.text, [])) found.push(`${entry}, in ${label}`);
}

const scheme = (address) =>
  /^([a-z][a-z\d+.-]*):/i.exec(address.replace(/[\t\n\r]/g, '').replace(/^[\0- ]+/, ''))?.[1];

function scanAttribute(tag, name, value, found) {
  const where = `<${tag} ${name}>`;
  if (name === 'xmlns' || name.startsWith('xmlns:')) return;
  if (name === 'style') return scanCss(where, value, found);
  if (name.startsWith('on')) return scanScript(where, value, found);
  if (name === 'srcdoc') return scanMarkup(value, found);
  if (name === 'href' && NAVIGATION.has(tag)) return;
  if (LOADING.has(name)) {
    const trimmed = value.replace(/^[\0- ]+/, '');
    if (/^javascript:/i.test(trimmed)) return scanScript(where, trimmed.slice(11), found);
    const addresses = ADDRESS_LISTS.has(name) ? trimmed.split(/[\s,]+/).filter(Boolean) : [value];
    for (const address of addresses) {
      if (leavesOrigin(address)) found.push(`an address on another origin in ${where}: ${address}`);
      else if (!MEDIA.has(tag) && scheme(address)?.toLowerCase() === 'data')
        scanData(tag, where, address, found);
    }
    return;
  }
  // An SVG animation sets the attribute it animates, an address included, to these values.
  if (ANIMATION.has(tag) && ['to', 'from', 'by', 'values'].includes(name))
    for (const address of value.split(';'))
      if (leavesOrigin(address.trim()))
        found.push(`an address on another origin in ${where}: ${address.trim()}`);
  // A presentation attribute (mask, filter, cursor, fill…) loads what its url() names.
  if (value.includes('(')) scanCss(where, `x:${value}`, found);
  // Not loaded by the browser, but a script may read it: it must not name another host either.
  const host = namedHost(value);
  if (host) found.push(`an address on another origin in ${where}: ${host}`);
}

/**
 * The tag that opens at `start`, read by the tokenizer's tag and attribute states: its name,
 * its attributes in order with their references decoded, and where it ends. A repeated name
 * is kept and read, though a browser keeps only the first. Null when the text ends inside it:
 * a browser then drops it.
 */
function readTag(html, start) {
  const next = (pattern, index) => {
    pattern.lastIndex = index;
    return pattern.exec(html)[0];
  };
  let i = start + (html[start + 1] === '/' ? 2 : 1);
  const rawName = next(/[^\t\n\f\r />]*/y, i);
  i += rawName.length;
  const attributes = [];
  let selfClosing = false;
  while (i < html.length) {
    const char = html[i];
    if (char === '>') return { name: rawName.toLowerCase(), attributes, selfClosing, end: i + 1 };
    selfClosing = char === '/' && html[i + 1] === '>';
    if (/[\t\n\f\r /]/.test(char)) {
      i += 1;
      continue;
    }
    const key = next(/[\s\S][^\t\n\f\r />=]*/y, i); // a leading `=` belongs to the name
    i += key.length;
    while (/[\t\n\f\r ]/.test(html[i])) i += 1;
    let value = '';
    if (html[i] === '=') {
      i += 1;
      while (/[\t\n\f\r ]/.test(html[i])) i += 1;
      const quote = html[i];
      if (quote === '"' || quote === "'") {
        const close = html.indexOf(quote, i + 1);
        if (close < 0) return null;
        value = html.slice(i + 1, close);
        i = close + 1;
      } else {
        value = next(/[^\t\n\f\r >]*/y, i);
        i += value.length;
      }
    }
    attributes.push([key.toLowerCase(), decodeMarkup(value)]);
  }
  return null;
}

/** Where the raw text of a <style>, <title>… that starts at `from` ends: its end tag. */
function rawTextEnd(html, from, tag) {
  const end = new RegExp(String.raw`</${tag}[\t\n\f\r />]`, 'gi');
  end.lastIndex = from;
  return end.exec(html)?.index ?? html.length;
}

/**
 * Where a script that starts at `from` ends. Inside `<!--`, a `<script` defers the end until
 * `</script>` has closed it or `-->` has closed the escape: the tokenizer's script data
 * escaped and double escaped states.
 */
function scriptEnd(html, from) {
  const token = /<!--|-->|<(\/?)script[\t\n\f\r />]/gi;
  token.lastIndex = from;
  let state = 'data';
  for (let match; (match = token.exec(html));) {
    const [text, closing] = match;
    if (text === '<!--') {
      if (state === 'data') {
        let after = token.lastIndex;
        while (html[after] === '-') after += 1;
        if (html[after] === '>') token.lastIndex = after + 1;
        else state = 'escaped';
      } else token.lastIndex = match.index + 2; // `<!-->` in an escape still ends it
    } else if (text === '-->') state = 'data';
    else if (closing === '/') {
      if (state !== 'double') return match.index;
      state = 'escaped';
    } else if (state === 'escaped') state = 'double';
  }
  return html.length;
}

/**
 * Every address in markup, found by the HTML tokenizer's rules: a comment ends at `-->`,
 * `--!>`, or at once on `<!-->` and `<!--->`; a bogus comment at the next `>`; the text of a
 * style, script, title, textarea and the like at its own end tag. Whether a <style> or a
 * <script> switches the tokenizer depends on the tree around it: inside svg or math it does
 * not, inside select or after a frameset a browser may drop the tag. Open svg and math
 * elements and their integration points are followed, closing no sooner than a browser would;
 * where the answer still depends on the tree, the markup is refused.
 */
function scanMarkup(html, found) {
  const unreadable = (what) => found.push(`${what}, which the check cannot read as a browser does`);
  const open = []; // open foreign elements and integration points: { name, ns, integration }
  const closeForeign = () => {
    while (open.length && !open.at(-1).integration) open.pop();
  };
  let selects = 0;
  let i = 0;
  while ((i = html.indexOf('<', i)) >= 0) {
    const top = open.at(-1);
    const foreign = Boolean(top && !top.integration);
    const next = html[i + 1] || '';
    if (html.startsWith('<!--', i)) {
      const comment = /<!--(?:>|->|[\s\S]*?(?:--!?>|$))/y;
      comment.lastIndex = i;
      comment.exec(html);
      i = comment.lastIndex;
      continue;
    }
    if (next === '/' && html[i + 2] === '>') {
      i += 3;
      continue;
    }
    if (next === '!' || next === '?' || (next === '/' && !/[a-z]/i.test(html[i + 2] || ''))) {
      if (foreign && html.startsWith('<![CDATA[', i)) unreadable(`a CDATA section in <${top.ns}>`);
      const close = html.indexOf('>', i + 2);
      i = close < 0 ? html.length : close + 1;
      continue;
    }
    if (!/[a-z]/i.test(next === '/' ? html[i + 2] : next)) {
      i += 1;
      continue;
    }
    const tag = readTag(html, i);
    if (!tag) break;
    i = tag.end;
    const { name } = tag;
    if (next === '/') {
      if (name === 'select' && selects) selects -= 1;
      if (foreign && (name === 'br' || name === 'p')) closeForeign();
      else if (foreign) {
        const at = open.findLastIndex((entry) => entry.name === name);
        if (at > open.findLastIndex((entry) => entry.integration)) open.length = at;
      } else if (top && top.name === name) open.pop();
      continue;
    }
    const first = Object.fromEntries([...tag.attributes].reverse());
    for (const [key, value] of tag.attributes) scanAttribute(name, key, value, found);
    if (name === 'base') found.push('a base address <base>');
    if (name === 'meta' && /^\s*(?:refresh|link)\s*$/i.test(first['http-equiv'] || ''))
      found.push(`a ${first['http-equiv'].trim().toLowerCase()} <meta http-equiv>`);
    const opens = (entry) => tag.selfClosing || open.push(entry);
    if (foreign) {
      const html5 = /^(?:text\/html|application\/xhtml\+xml)$/i.test(first.encoding || '');
      if (
        BREAKOUT.has(name) ||
        (name === 'font' && ['color', 'face', 'size'].some((a) => a in first))
      )
        closeForeign();
      else if (
        INTEGRATION[top.ns].has(name) ||
        (top.ns === 'math' && name === 'annotation-xml' && html5)
      )
        opens({ name, ns: top.ns, integration: true });
      else if (SWITCHING.has(name)) unreadable(`a <${name}> inside <${top.ns}>`);
      else if (name === 'svg' || name === 'math') opens({ name, ns: top.ns });
      continue;
    }
    if (top?.ns === 'math' && (name === 'mglyph' || name === 'malignmark'))
      opens({ name, ns: 'math' });
    else if (name === 'svg' || name === 'math') opens({ name, ns: name });
    else if (name === 'frameset') unreadable('a <frameset>');
    else if (name === 'select') selects += 1;
    if (!SWITCHING.has(name)) continue;
    if (selects) {
      unreadable(`a <${name}> inside <select>`);
      continue;
    }
    if (name === 'plaintext') break;
    const end = name === 'script' ? scriptEnd(html, i) : rawTextEnd(html, i, name);
    if (name === 'script') scanScript('<script>', html.slice(i, end), found);
    if (name === 'style') scanCss('<style>', html.slice(i, end), found);
    i = end;
  }
  return found;
}

/** Each address `html` would reach on another origin, named where it sits; empty when none. */
function foreignAddresses(html) {
  return [...new Set(scanMarkup(html, []))];
}

module.exports = { foreignAddresses, leavesOrigin };
