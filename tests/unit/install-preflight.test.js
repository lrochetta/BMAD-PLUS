/** An install that cannot enumerate every selected pack writes nothing at all. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const clack = require('@clack/prompts');
const { PACKS } = require('../../tools/cli/lib/packs');
const install = require('../../tools/cli/commands/install');

let tmp;
let exitCode0;

beforeEach(() => {
  clack.intro = jest.fn();
  clack.outro = jest.fn();
  clack.cancel = jest.fn();
  clack.note = jest.fn();
  clack.confirm = jest.fn().mockResolvedValue(true);
  clack.isCancel = jest.fn().mockReturnValue(false);
  clack.spinner = () => ({ start: jest.fn(), stop: jest.fn(), message: jest.fn() });
  clack.log = {
    info: jest.fn(),
    success: jest.fn(),
    warn: jest.fn(),
    warning: jest.fn(),
    error: jest.fn(),
    step: jest.fn(),
    message: jest.fn(),
  };
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bmad-preflight-'));
  exitCode0 = process.exitCode;
});

afterEach(() => {
  process.exitCode = exitCode0;
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('an external module that does not resolve stops the install before the first write', async () => {
  const original = PACKS.maker;
  PACKS.maker = {
    ...original,
    externalModule: { package: 'fake-skill-missing', version: '1.0.0', skills: ['x'] },
  };
  try {
    await expect(
      install.action({ directory: tmp, yes: true, packs: 'core,maker', tools: 'none', lang: 'en' })
    ).rejects.toThrow(/External module fake-skill-missing is not installed next to BMAD\+/);
  } finally {
    PACKS.maker = original;
  }
  expect(fs.existsSync(path.join(tmp, '.agents'))).toBe(false);
  expect(fs.existsSync(path.join(tmp, '_bmad'))).toBe(false);
  expect(fs.existsSync(path.join(tmp, 'AGENTS.md'))).toBe(false);
  expect(fs.existsSync(path.join(tmp, '.bmad', 'update.lock'))).toBe(false);
});

test('the same selection installs once the module is not required', async () => {
  await install.action({
    directory: tmp,
    yes: true,
    packs: 'core,maker',
    tools: 'none',
    lang: 'en',
  });
  expect(fs.existsSync(path.join(tmp, '_bmad', '.bmad-plus-install.json'))).toBe(true);
  expect(fs.existsSync(path.join(tmp, '.agents', 'skills', 'agent-maker', 'SKILL.md'))).toBe(true);
});
