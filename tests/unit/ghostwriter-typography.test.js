const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const tool = path.resolve(
  __dirname,
  '../../src/bmad-plus/packs/pack-ghostwriter/tools/inspect-typography.cjs'
);
const { inspect } = require(tool);
const scan = (input) => inspect(Buffer.from(input));
const position = ({ codePoint, line, column, classification }) => [
  codePoint,
  line,
  column,
  classification,
];

test('counts supplementary and combining code points individually, and CRLF as one line break', () => {
  const input = '🙂e\u0301\u200b9\u202f€\r\n👩🏽\u200d💻\rA\u00a0B\nC\u00adD';
  const original = Buffer.from(input);
  const copy = Buffer.from(original);
  const report = inspect(original);
  expect(original.equals(copy)).toBe(true);
  expect(report.entries.map(position)).toEqual([
    ['U+200B', 1, 4, 'review'],
    ['U+202F', 1, 6, 'preserve'],
    ['U+200D', 2, 3, 'preserve'],
    ['U+00A0', 3, 2, 'preserve'],
    ['U+00AD', 4, 2, 'review'],
  ]);
  expect(scan('Café 🎉 e\u0301.')).toMatchObject({ total: 0, entries: [] });
});

test('distinguishes format-specific controls without exposing any part of the original text', () => {
  const report = scan('\ufeffprivate email@example.com ت\u200cر x\u200dy \ufeff \u202e \ufffd');
  expect(report.entries.map((e) => [e.name, e.classification])).toEqual([
    ['ZERO WIDTH NO-BREAK SPACE', 'preserve'],
    ['ZERO WIDTH NON-JOINER', 'preserve'],
    ['ZERO WIDTH JOINER', 'review'],
    ['ZERO WIDTH NO-BREAK SPACE', 'review'],
    ['RIGHT-TO-LEFT OVERRIDE', 'review'],
    ['REPLACEMENT CHARACTER', 'review'],
  ]);
  expect(JSON.stringify(report)).not.toContain('email@example');
});

test('reports bounded positions, total occurrence count, and strictly rejects invalid input', () => {
  const report = scan('\u200b'.repeat(251));
  expect(report.total).toBe(251);
  expect(report.entries).toHaveLength(250);
  expect(report.truncated).toBe(true);
  expect(() => inspect(Buffer.from([0xed, 0xa0, 0x80]))).toThrow('valid UTF-8');
  expect(() => inspect(Buffer.alloc(1024 * 1024 + 1))).toThrow('1 MiB');
});

test('the CLI only reads the selected file, distinguishes usage errors and rejects a directory', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-ghostwriter-type-'));
  const file = path.join(dir, 'draft.txt');
  const run = (args) =>
    spawnSync(process.execPath, [tool, ...args], { encoding: 'utf8', timeout: 10000 });
  try {
    const bytes = Buffer.from('Masqué\u200b ici.');
    fs.writeFileSync(file, bytes);
    const result = run([file]);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).entries[0]).toMatchObject({
      codePoint: 'U+200B',
      name: 'ZERO WIDTH SPACE',
      line: 1,
      column: 7,
      classification: 'review',
    });
    expect(fs.readFileSync(file)).toEqual(bytes);
    expect(run([]).status).toBe(2);
    expect(run([dir]).status).toBe(1);
    fs.writeFileSync(file, Buffer.from([0xff]));
    expect(run([file])).toMatchObject({ status: 1, stdout: '' });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
