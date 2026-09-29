/** Third-party actions are pinned by commit, with their version beside the pin. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { checkWorkflow, verifyDirectory } = require('../../tools/build/verify-action-pins');

const SHA = '9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0';

describe('action pins', () => {
  it('accepts a commit pin with its version, local workflows and digest-pinned images', () => {
    const text = [
      'steps:',
      `  - uses: actions/checkout@${SHA} # v7.0.0`,
      `    uses: github/codeql-action/init@${SHA} # v3.28.1`,
      '    uses: ./.github/workflows/ci.yml',
      `  - uses: docker://alpine@sha256:${'a'.repeat(64)}`,
    ].join('\n');
    expect(checkWorkflow(text, 'wf.yml')).toEqual([]);
  });

  it('refuses a moving tag, a short SHA, a missing version and an unpinned image', () => {
    const text = [
      '  - uses: actions/checkout@v4',
      '  - uses: actions/setup-node@48b55a0 # v6',
      `  - uses: actions/cache@${SHA}`,
      '  - uses: docker://alpine:3.20',
    ].join('\n');
    const problems = checkWorkflow(text, 'wf.yml');
    expect(problems).toHaveLength(4);
    expect(problems[0]).toMatch(/wf\.yml:1: actions\/checkout@v4 — pin to a full 40-character/);
    expect(problems[2]).toMatch(/add the released version as a comment/);
    expect(problems[3]).toMatch(/sha256 digest/);
  });

  it('fails closed on an empty workflow folder, and passes on this repository', () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'pins-'));
    expect(() => verifyDirectory(empty)).toThrow(/no workflow file/);
    fs.rmSync(empty, { recursive: true, force: true });
    const own = verifyDirectory(path.resolve(__dirname, '../../.github/workflows'));
    expect(own.problems).toEqual([]);
    expect(own.references).toBeGreaterThan(5);
  });
});
