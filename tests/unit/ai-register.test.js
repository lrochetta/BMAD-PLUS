/** The AI processing register and its soft gate against the integrations found in a project. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const yaml = require('js-yaml');

const register = require('../../tools/cli/lib/ai-register');

const cli = path.resolve(__dirname, '../../tools/cli/bmad-plus-cli.js');
const template = path.resolve(
  __dirname,
  '../../src/bmad-plus/packs/pack-shield/shared/ai-processing-register-template.yaml'
);
let project;

const write = (file, text) => {
  fs.mkdirSync(path.dirname(path.join(project, file)), { recursive: true });
  fs.writeFileSync(path.join(project, file), text);
};
const entry = (overrides = {}) => ({
  id: 'assistant',
  name: 'Assistant',
  provider: 'Provider',
  integrations: ['claude-code'],
  purpose: 'Code assistance.',
  data: ['Source code'],
  personalData: false,
  retention: '30 days',
  transfers: [],
  ...overrides,
});
const doc = (tools) => ({
  schema: 'bmad-plus/ai-processing-register/1',
  controller: 'Example Ltd',
  reviewed: '2026-09-01',
  tools,
});
const saveRegister = (tools) => write(register.REGISTER_FILE, yaml.dump(doc(tools)));

beforeEach(() => {
  project = fs.mkdtempSync(path.join(fs.realpathSync.native(os.tmpdir()), 'ai-register-'));
});
afterEach(() => fs.rmSync(project, { recursive: true, force: true }));

describe('the register', () => {
  it('accepts the Shield template', () => {
    const parsed = register.parseRegister(yaml.load(fs.readFileSync(template, 'utf8')));
    expect(parsed.tools.map((t) => t.integrations).flat()).toEqual(['claude-code', 'mcp:github']);
  });

  it('refuses entries that leave the legal questions open or invent values', () => {
    const refuse = (tools, reason) =>
      expect(() => register.parseRegister(doc(tools))).toThrow(reason);
    refuse([entry({ personalData: true })], /legalBasis must be one of consent/);
    refuse([entry({ legalBasis: 'consent' })], /applies only when the tool sees personal data/);
    refuse([entry({ personalData: 'maybe' })], /personalData must say true or false/);
    refuse([entry({ transfers: undefined })], /transfers must list/);
    refuse(
      [entry({ transfers: [{ to: 'United States', mechanism: 'trust-us' }] })],
      /mechanism must be one of adequacy-decision/
    );
    refuse([entry({ data: [] })], /data category: must be a non-empty list/);
    refuse([entry({ integrations: ['Claude Code'] })], /is not an integration id/);
    refuse([entry(), entry({ id: 'other' })], /claude-code is already covered by assistant/);
    refuse([entry({ owner: 'me' })], /unknown key/);
    expect(() => register.parseRegister({ ...doc([entry()]), reviewed: '2026-02-30' })).toThrow(
      /YYYY-MM-DD/
    );
  });
});

describe('detecting AI integrations', () => {
  it('finds adapter files, tool folders and declared MCP servers', () => {
    write('CLAUDE.md', '# adapter\n');
    write('GEMINI.md', '# adapter\n');
    write('.cursor/rules/bmad-plus.mdc', 'rules\n');
    write('.mcp.json', JSON.stringify({ mcpServers: { github: {}, 'db-prod': {} } }));
    write('.vscode/mcp.json', '{ not json');
    const { integrations, warnings } = register.detectIntegrations(project);
    expect(integrations).toEqual([
      { ids: ['claude-code'], sources: ['CLAUDE.md'] },
      { ids: ['gemini-cli', 'antigravity'], sources: ['GEMINI.md'] },
      { ids: ['cursor'], sources: ['.cursor/rules/bmad-plus.mdc', '.cursor'] },
      { ids: ['mcp:github'], sources: ['.mcp.json'] },
      { ids: ['mcp:db-prod'], sources: ['.mcp.json'] },
    ]);
    expect(warnings).toEqual([
      expect.stringMatching(/^\.vscode\/mcp\.json cannot be read .*MCP servers are not checked$/),
    ]);
  });

  it('reads commented MCP settings and registers a server under any printable name', () => {
    write(
      '.vscode/mcp.json',
      [
        '{',
        '  // company tools',
        '  "servers": {',
        '    "crm": { "url": "https://crm.example/mcp", /* a trailing comma */ },',
        '    "My Server: prod": { "command": "run" },',
        '  },',
        '}',
      ].join('\n')
    );
    write('.gemini/settings.json', '{ "mcpServers": { "bad\\u001b[31m": {} } }');
    const { integrations, warnings } = register.detectIntegrations(project);
    expect(integrations.map((i) => i.ids[0])).toEqual([
      'gemini-cli',
      'mcp:crm',
      'mcp:My Server: prod',
    ]);
    expect(warnings).toEqual([
      '.gemini/settings.json declares the MCP server "bad\\u001b[31m", whose name cannot be registered; it is not checked',
    ]);
    fs.rmSync(path.join(project, '.gemini/settings.json'));
    saveRegister([entry({ integrations: ['gemini-cli', 'mcp:crm', 'mcp:My Server: prod'] })]);
    expect(register.checkRegister(project)).toMatchObject({ status: 'ok', warnings: [] });
    write('.vscode/mcp.json', '{ "servers": {} /* not closed');
    expect(register.detectIntegrations(project).warnings[0]).toMatch(
      /^\.vscode\/mcp\.json cannot be read \(a block comment is not closed\)/
    );
  });

  it('ignores a marker reached through a symbolic link', () => {
    const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-register-link-'));
    try {
      fs.symlinkSync(elsewhere, path.join(project, '.claude'), 'dir');
    } catch {
      fs.rmSync(elsewhere, { recursive: true, force: true });
      return; // the platform does not let this user create links
    }
    expect(register.detectIntegrations(project).integrations).toEqual([]);
    fs.rmSync(elsewhere, { recursive: true, force: true });
  });
});

describe('the soft gate', () => {
  beforeEach(() => {
    write('CLAUDE.md', '# adapter\n');
    write('GEMINI.md', '# adapter\n');
    write('.mcp.json', JSON.stringify({ mcpServers: { github: {} } }));
  });
  const now = new Date('2026-09-29T00:00:00Z');

  it('warns when there is no register', () => {
    const result = register.checkRegister(project, { now });
    expect(result.status).toBe('warning');
    expect(result.warnings[0]).toBe(`no AI processing register at ${register.REGISTER_FILE}`);
    expect(result.warnings).toHaveLength(4);
  });

  it('warns about each integration the register does not cover, and nothing else', () => {
    saveRegister([
      entry(),
      entry({ id: 'gemini', integrations: ['antigravity'] }),
      entry({ id: 'sheets', integrations: ['mcp:google-sheets'] }),
    ]);
    const result = register.checkRegister(project, { now });
    expect(result.status).toBe('warning');
    expect(result.integrations.map((i) => i.coveredBy)).toEqual(['assistant', 'gemini', null]);
    expect(result.warnings).toEqual([
      'mcp:github is set up (.mcp.json) but not in the AI processing register',
    ]);
    expect(result.unmatched).toEqual(['sheets']);
  });

  it('is clean when everything is registered, and warns once the review is a year old', () => {
    saveRegister([entry({ integrations: ['claude-code', 'gemini-cli', 'mcp:github'] })]);
    expect(register.checkRegister(project, { now })).toMatchObject({ status: 'ok', warnings: [] });
    const later = new Date('2027-10-01T00:00:00Z');
    expect(register.checkRegister(project, { now: later }).warnings).toEqual([
      'the register was last reviewed on 2026-09-01, 395 days ago',
    ]);
  });

  it('reports an unreadable register as an error, not a warning', () => {
    saveRegister([entry({ personalData: true })]);
    const result = register.checkRegister(project, { now });
    expect(result.status).toBe('error');
    expect(result.errors[0]).toMatch(/legalBasis must be one of/);
  });

  it('starts from the Shield template, once', () => {
    expect(register.initRegister(project)).toBe(register.REGISTER_FILE);
    expect(register.checkRegister(project, { now }).register).toEqual({
      controller: 'Example Ltd, 1 Example Street, Example City',
      reviewed: '2026-09-29',
    });
    expect(() => register.initRegister(project)).toThrow(/already exists/);
  });

  it('exits 0 on warnings, 1 on an invalid register, 3 on an unknown action', () => {
    const run = (...args) =>
      spawnSync(process.execPath, [cli, 'ai-register', ...args, '--directory', project], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 20000,
      });
    const warned = run('check', '--json');
    expect(warned.status).toBe(0);
    expect(JSON.parse(warned.stdout)).toMatchObject({
      schema: 'bmad-plus/ai-register-check/1',
      status: 'warning',
    });
    expect(run('check').stdout).toContain('warning   claude-code is set up (CLAUDE.md)');
    saveRegister([entry({ personalData: true })]);
    expect(run('check').status).toBe(1);
    expect(run('init').status).toBe(3);
    expect(run('list').status).toBe(3);
  });
});
