/** Compare structured documents without serializing their protected bytes through a parser. */
'use strict';

const yaml = require('js-yaml');

function childPointer(parent, key) {
  return parent + '/' + String(key).replace(/~/g, '~0').replace(/\//g, '~1');
}

function jsonStrings(text, editable, capture) {
  // Validate the grammar once. Keep token spans for exact comparison (including large integers,
  // whitespace and escape spelling) and detect duplicate keys that JSON.parse would overwrite.
  JSON.parse(text);
  const token = /[ \t\r\n]*("(?:[^"\\]|\\.)*"|[{}[\],:]|[-+.\deE]+|true|false|null)/y;
  function next() {
    const found = token.exec(text);
    if (!found) throw new Error('Invalid JSON token');
    return found[1];
  }
  function visit(path, value, depth) {
    if (depth > 128) throw new Error('JSON nesting exceeds the supported depth');
    if (value[0] === '"' && editable.has(path)) {
      capture(path, token.lastIndex - value.length + 1, token.lastIndex - 1, JSON.parse(value));
    }
    if (value === '{') {
      const keys = new Set();
      let keyToken = next();
      while (keyToken !== '}') {
        const key = JSON.parse(keyToken);
        if (keys.has(key)) throw new Error('Duplicate JSON key');
        keys.add(key);
        next(); // colon
        visit(childPointer(path, key), next(), depth + 1);
        if (next() === '}') break;
        keyToken = next();
      }
    } else if (value === '[') {
      let item = next();
      let index = 0;
      while (item !== ']') {
        visit(childPointer(path, index++), item, depth + 1);
        if (next() === ']') break;
        item = next();
      }
    }
  }
  visit('', next(), 0);
}

function yamlScalar(tail) {
  if (tail.startsWith('#') || !tail.trim()) return '';
  if (tail[0] === '"' || tail[0] === "'") {
    const quoted = /^(?:"(?:[^"\\]|\\.)*"|'(?:[^']|'')*')(?=$|[ \t])/.exec(tail);
    if (!quoted || !/^(?:[ \t]+(?:#.*)?|)$/.test(tail.slice(quoted[0].length))) {
      throw new Error('Unsupported YAML quoted scalar');
    }
    return quoted[0];
  }
  if (/^[|>&*!%{}[\],@]/.test(tail) || /^[-?:](?:[ \t]|$)/.test(tail)) {
    throw new Error('Only single-line YAML scalars in block mappings are supported');
  }
  const comment = tail.search(/(?<=[ \t])#/);
  return (comment < 0 ? tail : tail.slice(0, comment)).trimEnd();
}

function yamlStrings(text, editable, capture) {
  // Only block mappings, simple keys and single-line scalar values. Stop on aliases, complex
  // keys, flow collections, sequences, directives and multi-line scalars instead of guessing
  // editable spans. Keep comments, quoting, indentation, separators and line endings intact.
  const candidates = [];
  const ancestors = [];
  const seen = new Set();
  for (let start = 0; start < text.length;) {
    const newline = text.indexOf('\n', start);
    const end = newline === -1 ? text.length : newline;
    const line = text.slice(start, end).replace(/\r$/, '');
    const offset = start;
    start = end + 1;
    if (/^[ \t]*(?:#.*)?$/.test(line)) continue;
    const match = /^( *)([A-Za-z_][A-Za-z0-9_./~-]*):(?:([ \t]+)(.*)|$)$/.exec(line);
    if (!match) throw new Error('Unsupported YAML mapping or scalar syntax');
    const [, indent, key, separator = '', tail = ''] = match;
    while (ancestors.length && ancestors[ancestors.length - 1].indent >= indent.length) {
      ancestors.pop();
    }
    if (ancestors.length > 128) throw new Error('YAML nesting exceeds the supported depth');
    const path = childPointer(ancestors[ancestors.length - 1]?.path || '', key);
    if (seen.has(path)) throw new Error('Duplicate YAML key');
    seen.add(path);
    const scalar = yamlScalar(tail);
    if (scalar === '') {
      ancestors.push({ key, indent: indent.length, path });
    } else if (editable.has(path)) {
      const pos = offset + indent.length + key.length + 1 + separator.length;
      const quoted = scalar[0] === "'" || scalar[0] === '"' ? 1 : 0;
      candidates.push({
        path,
        keys: [...ancestors.map((node) => node.key), key],
        start: pos + quoted,
        end: pos + scalar.length - quoted,
      });
    }
  }
  const document = yaml.load(text, { schema: yaml.JSON_SCHEMA });
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    throw new Error('Expected a YAML block mapping');
  }
  for (const candidate of candidates) {
    let value = document;
    for (const key of candidate.keys) {
      if (!value || typeof value !== 'object' || !Object.hasOwn(value, key)) {
        throw new Error('YAML path does not resolve to the expected value');
      }
      value = value[key];
    }
    if (typeof value !== 'string') throw new Error('Editable YAML fields must contain strings');
    capture(candidate.path, candidate.start, candidate.end, value);
  }
}

/** Units use RFC 6901 pointers. Compare frames for equality before comparing decoded prose. */
function projectStructured(text, format, allowedFields) {
  if (typeof text !== 'string' || !Array.isArray(allowedFields)) {
    throw new Error('Expected document text and a list of editable field pointers');
  }
  const editable = new Set();
  for (const field of allowedFields) {
    if (
      typeof field !== 'string' ||
      (field !== '' && !field.startsWith('/')) ||
      /~(?:[^01]|$)/.test(field) ||
      editable.has(field)
    ) {
      throw new Error('Invalid or duplicate editable field pointer');
    }
    editable.add(field);
  }
  const units = new Map();
  const frame = [];
  let cursor = 0;
  function capture(path, start, end, value) {
    frame.push(text.slice(cursor, start), path);
    cursor = end;
    units.set(path, value);
  }
  if (format === 'json') jsonStrings(text, editable, capture);
  else if (format === 'yaml') yamlStrings(text, editable, capture);
  else throw new Error('Unsupported structured format');
  if (units.size !== editable.size) throw new Error('Missing or non-string editable field');
  frame.push(text.slice(cursor));
  return { frame: JSON.stringify(frame), units };
}

module.exports = { projectStructured };
