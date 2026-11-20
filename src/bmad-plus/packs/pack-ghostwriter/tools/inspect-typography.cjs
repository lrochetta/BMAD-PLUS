'use strict';

const fs = require('node:fs');
const { Buffer } = require('node:buffer');
const { TextDecoder } = require('node:util');
const process = require('node:process');

const MAX_BYTES = 1024 * 1024;
const MAX_POSITIONS = 250;
const BREAK = /^[\r\n\u0085\u2028\u2029]$/u;
const EXTEND = /^(?:\p{M}|\p{Emoji_Modifier})$/u;
const PICTOGRAPH = /^\p{Extended_Pictographic}$/u;
const ALPHABET = /^\p{L}$/u;
const JOINING_SCRIPT =
  /^(?:\p{Script=Arabic}|\p{Script=Syriac}|\p{Script=Devanagari}|\p{Script=Bengali}|\p{Script=Malayalam})$/u;

const marks = new Map([
  [
    0x00a0,
    [
      'NO-BREAK SPACE',
      'preserve',
      'Keep nonbreaking spacing between a value and its unit or around punctuation.',
    ],
  ],
  [
    0x202f,
    [
      'NARROW NO-BREAK SPACE',
      'preserve',
      'Keep narrow nonbreaking spacing used in French typography and grouped numbers.',
    ],
  ],
  [
    0x00ad,
    [
      'SOFT HYPHEN',
      'review',
      'Check optional line breaking. Remove only if the word must never have this discretionary break.',
    ],
  ],
  [
    0x200b,
    [
      'ZERO WIDTH SPACE',
      'review',
      'Check the word or line-break boundary. If accidental, propose removing only this character.',
    ],
  ],
  [
    0x2060,
    [
      'WORD JOINER',
      'review',
      'Check whether the author intended to prevent a line break at this position.',
    ],
  ],
  [
    0xfffd,
    [
      'REPLACEMENT CHARACTER',
      'review',
      'Consult the original text to recover the intended character.',
    ],
  ],
  [
    0xfe0e,
    [
      'VARIATION SELECTOR-15',
      'preserve',
      'Keep the text-presentation selector with its base character.',
    ],
  ],
  [
    0xfe0f,
    [
      'VARIATION SELECTOR-16',
      'preserve',
      'Keep the emoji-presentation selector with its base character.',
    ],
  ],
]);
const directional = new Map([
  [0x061c, 'ARABIC LETTER MARK'],
  [0x200e, 'LEFT-TO-RIGHT MARK'],
  [0x200f, 'RIGHT-TO-LEFT MARK'],
  [0x202a, 'LEFT-TO-RIGHT EMBEDDING'],
  [0x202b, 'RIGHT-TO-LEFT EMBEDDING'],
  [0x202c, 'POP DIRECTIONAL FORMATTING'],
  [0x202d, 'LEFT-TO-RIGHT OVERRIDE'],
  [0x202e, 'RIGHT-TO-LEFT OVERRIDE'],
  [0x2066, 'LEFT-TO-RIGHT ISOLATE'],
  [0x2067, 'RIGHT-TO-LEFT ISOLATE'],
  [0x2068, 'FIRST STRONG ISOLATE'],
  [0x2069, 'POP DIRECTIONAL ISOLATE'],
]);
const controls = [
  'NULL',
  'START OF HEADING',
  'START OF TEXT',
  'END OF TEXT',
  'END OF TRANSMISSION',
  'ENQUIRY',
  'ACKNOWLEDGE',
  'BELL',
  'BACKSPACE',
  null,
  null,
  'LINE TABULATION',
  'FORM FEED',
  null,
  'SHIFT OUT',
  'SHIFT IN',
  'DATA LINK ESCAPE',
  'DEVICE CONTROL ONE',
  'DEVICE CONTROL TWO',
  'DEVICE CONTROL THREE',
  'DEVICE CONTROL FOUR',
  'NEGATIVE ACKNOWLEDGE',
  'SYNCHRONOUS IDLE',
  'END OF TRANSMISSION BLOCK',
  'CANCEL',
  'END OF MEDIUM',
  'SUBSTITUTE',
  'ESCAPE',
  'INFORMATION SEPARATOR FOUR',
  'INFORMATION SEPARATOR THREE',
  'INFORMATION SEPARATOR TWO',
  'INFORMATION SEPARATOR ONE',
];

function joinControl(chars, index, cp) {
  // Look through marks on each side without including the neighbouring text in the report.
  let left = index - 1;
  let right = index + 1;
  while (left >= 0 && EXTEND.test(chars[left])) left--;
  while (right < chars.length && EXTEND.test(chars[right])) right++;
  const a = chars[left] || '';
  const b = chars[right] || '';
  const name = cp === 0x200d ? 'ZERO WIDTH JOINER' : 'ZERO WIDTH NON-JOINER';
  if (cp === 0x200d && PICTOGRAPH.test(a) && PICTOGRAPH.test(b)) {
    return [name, 'preserve', 'Keep the joiner inside this pictographic sequence.'];
  }
  if (JOINING_SCRIPT.test(a) && JOINING_SCRIPT.test(b) && ALPHABET.test(a) && ALPHABET.test(b)) {
    return [
      name,
      'preserve',
      'Keep the joining control in this script unless a language editor confirms a correction.',
    ];
  }
  return [
    name,
    'review',
    'Check the neighbouring script or glyphs. Propose removal only after confirming the joining control is accidental.',
  ];
}

function guidance(chars, i) {
  const cp = chars[i].codePointAt(0);
  if (cp === 0xfeff) {
    return i === 0
      ? [
          'ZERO WIDTH NO-BREAK SPACE',
          'preserve',
          'This initial character is the UTF-8 byte order mark. Keep it unless the destination requires BOM-free input.',
        ]
      : [
          'ZERO WIDTH NO-BREAK SPACE',
          'review',
          'Check for a byte order mark introduced at a pasted boundary. Propose removing only this occurrence if confirmed.',
        ];
  }
  if (cp === 0x200c || cp === 0x200d) return joinControl(chars, i, cp);
  if ((cp === 0xfe0e || cp === 0xfe0f) && (!i || /[\s\p{C}\p{M}]/u.test(chars[i - 1]))) {
    return [
      marks.get(cp)[0],
      'review',
      'No visible base immediately precedes this selector. Check the intended glyph before changing it.',
    ];
  }
  if (directional.has(cp))
    return [
      directional.get(cp),
      'review',
      'Check directionality in the rendered text before changing this mark or its paired controls.',
    ];
  const name = cp === 0x7f ? 'DELETE' : controls[cp];
  if (name)
    return [
      name,
      'review',
      'Check whether the destination expects this control. Propose removing only this occurrence if it was pasted accidentally.',
    ];
  return marks.get(cp);
}

function inspect(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length > MAX_BYTES)
    throw new Error('Expected at most 1 MiB.');
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new Error('Input is not valid UTF-8.');
  }
  const chars = Array.from(text);
  const entries = [];
  let total = 0;
  let line = 1;
  let column = 1;
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const advice = guidance(chars, i);
    if (advice) {
      total++;
      if (entries.length < MAX_POSITIONS) {
        const [name, classification, suggestion] = advice;
        const hex = char.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
        entries.push({ codePoint: 'U+' + hex, name, line, column, classification, suggestion });
      }
    }
    if (BREAK.test(char)) {
      if (char === '\r' && chars[i + 1] === '\n') i++;
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return {
    schemaVersion: 1,
    coordinates: '1-based Unicode scalar positions; CRLF, CR, LF, NEL, LS and PS are line breaks',
    total,
    truncated: total > entries.length,
    entries,
  };
}

function read(file) {
  const descriptor = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK);
  try {
    const stat = fs.fstatSync(descriptor);
    if (!stat.isFile()) throw new Error('Expected a regular file.');
    if (stat.size > MAX_BYTES) throw new Error('Expected at most 1 MiB.');
    const buffer = Buffer.allocUnsafe(MAX_BYTES + 1);
    let length = 0;
    while (length < buffer.length) {
      const n = fs.readSync(descriptor, buffer, length, buffer.length - length, null);
      if (!n) break;
      length += n;
    }
    return inspect(buffer.subarray(0, length));
  } finally {
    fs.closeSync(descriptor);
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length !== 1) {
    process.stderr.write('Usage: node inspect-typography.cjs <UTF-8-file>\n');
    process.exitCode = 2;
  } else {
    try {
      process.stdout.write(JSON.stringify(read(args[0]), null, 2) + '\n');
    } catch (error) {
      process.stderr.write((error.code ? 'Cannot read the supplied file.' : error.message) + '\n');
      process.exitCode = 1;
    }
  }
}

module.exports = { inspect };
