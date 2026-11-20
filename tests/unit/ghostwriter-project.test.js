const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const editorial = require('../../tools/cli/lib/ghostwriter');
const { hash, voice, loadConfig } = require('../../tools/cli/lib/ghostwriter-project');

let project;
const state = '.bmad-plus/ghostwriter';
const pack = '.agents/skills/pack-ghostwriter';
const profile = {
  schema_version: 1,
  id: 'test-author',
  version: 1,
  status: 'draft',
  kind: 'author',
  locale: 'fr-FR',
};

function put(file, value) {
  const target = path.join(project, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, typeof value === 'string' ? value : JSON.stringify(value));
}

beforeEach(() => {
  project = fs.mkdtempSync(path.join(os.tmpdir(), 'ghostwriter-profile-'));
});
afterEach(() => {
  fs.rmSync(project, { recursive: true, force: true });
});

test('a sample referenced by a voice cannot read a control or credentials file', () => {
  put('credentials/model.txt', 'never include this');
  put(state + '/profiles/test-author.yaml', {
    ...profile,
    approved_samples: [
      { id: 'sample', path: 'credentials/model.txt', sha256: hash('never include this') },
    ],
  });
  expect(() => voice(project, 'test-author')).toThrow('outside private and control directories');
});

test.each([
  ['channels', 'email'],
  ['unresolved_questions', [42]],
  ['explicit_preferences', []],
  ['glossary', 'word'],
  ['exceptions', {}],
  ['observations', [{ sample_id: 's', passage: 'text', observation: 'formal', confidence: [] }]],
])('a malformed optional profile field is rejected before use: %s', (field, value) => {
  put(state + '/profiles/test-author.yaml', { ...profile, [field]: value });
  expect(() => voice(project, 'test-author')).toThrow();
});

test('config accepts a profiles/<id>.yaml reference and rejects a nonstring selector', () => {
  put(state + '/config.yaml', { schema_version: 1, voice_profile: 'profiles/test-author.yaml' });
  expect(loadConfig(project).voice_profile).toBe('test-author');
  for (const invalid of [false, 0, '../outside.yaml', '']) {
    put(state + '/config.yaml', { schema_version: 1, voice_profile: invalid });
    expect(() => loadConfig(project)).toThrow();
  }
});

test('an oversized Codex packet cannot consume a revision attempt', async () => {
  fs.mkdirSync(path.join(project, '.agents/skills'), { recursive: true });
  const source = path.resolve(__dirname, '../../src/bmad-plus');
  fs.cpSync(path.join(source, 'packs/pack-ghostwriter'), path.join(project, pack), {
    recursive: true,
  });
  for (const skill of ['ghostwriter-edit', 'ghostwriter-verify']) {
    fs.cpSync(path.join(source, 'skills', skill), path.join(project, '.agents/skills', skill), {
      recursive: true,
    });
  }
  put('draft.txt', 'x'.repeat(280 * 1024));
  const prepared = editorial.prepare(project, {
    workflow: 'agent-output-review',
    input: 'draft.txt',
    mode: 'orchestrated',
  });
  await expect(
    editorial.run(project, prepared.run_id, { codex: process.execPath })
  ).rejects.toThrow(/256|packet|split/i);
  expect(fs.readdirSync(path.dirname(path.join(project, prepared.manifest_path)))).toEqual([
    'manifest.json',
  ]);
});
