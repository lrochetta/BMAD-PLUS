/** Human acceptance recipes: real specs, real runs, and a gate that refuses to guess. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const uat = require('../../tools/cli/lib/uat');

const tempParent = fs.realpathSync.native(os.tmpdir());
let workspace;

beforeEach(() => {
  workspace = fs.mkdtempSync(path.join(tempParent, 'uat-'));
});

afterEach(() => {
  fs.rmSync(workspace, { recursive: true, force: true });
});

const spec = () => ({
  schema: uat.SPEC_SCHEMA,
  id: 'demo-1.0.0',
  product: 'Demo',
  versions: ['1.0.0'],
  language: 'en',
  title: 'The duration is proposed, never invented',
  environment: { name: 'DEMO', url: 'https://demo.example' },
  estimate: '5 min',
  steps: [
    {
      id: '0-setup',
      title: 'Setup',
      where: ['Open <span class="ecran">Folders</span>.'],
      do: ['Sign in.'],
      expect: [{ id: 'a', text: 'I am signed in.' }],
    },
    {
      id: '1-confirm',
      title: 'Confirm the funder',
      writes: true,
      verify: { kind: 'sql', text: 'select updated_at from company where ref = 42' },
      where: ['Company <span class="ecran">KREISKER</span>.'],
      do: ['Click <span class="ecran">Confirm</span>.'],
      expect: [{ id: 'a', text: 'The line reads <span class="ecran">OPCO confirmed</span>.' }],
    },
  ],
});

const run = (over = {}) => ({
  schema: uat.RESULTS_SCHEMA,
  specId: 'demo-1.0.0',
  specSha256: uat.specHash(spec()),
  runId: '20260916-sarah-aaaa',
  tester: 'Sarah',
  startedAt: '2026-09-16T08:00:00.000Z',
  updatedAt: '2026-09-16T08:20:00.000Z',
  finishedAt: '2026-09-16T08:20:00.000Z',
  overallNote: '',
  steps: {
    '0-setup': {
      title: 'Setup',
      note: '',
      expect: { a: { text: 'I am signed in.', state: 'passed' } },
    },
    '1-confirm': {
      title: 'Confirm the funder',
      note: '',
      expect: { a: { text: 'OPCO confirmed', state: 'passed' } },
    },
  },
  summary: { passed: 2, failed: 0, blocked: 0, skipped: 0, unanswered: 0 },
  ...over,
});

const triage = (
  failures = [],
  writeChecks = [{ step: '1-confirm', verified: true, evidence: 'updated_at = 2026-09-16T08:19Z' }]
) => ({
  schema: uat.TRIAGE_SCHEMA,
  specId: 'demo-1.0.0',
  runs: [{ runId: '20260916-sarah-aaaa', failures, writeChecks }],
});

function writeRun(document, name = `${document.runId}.json`) {
  const dir = path.join(workspace, 'results', 'demo-1.0.0');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), JSON.stringify(document));
  return dir;
}

describe('spec validation', () => {
  it('accepts a complete spec and refuses what would be ignored in silence', () => {
    expect(uat.validateSpec(spec()).errors).toEqual([]);

    const typo = spec();
    typo.stpes = [];
    expect(uat.validateSpec(typo).errors.join(' ')).toContain('unknown key at spec level: "stpes"');
  });

  it('refuses a writing step without its read-only confirmation', () => {
    const withoutProof = spec();
    delete withoutProof.steps[1].verify;
    expect(uat.validateSpec(withoutProof).errors.join(' ')).toContain(
      'writes: true requires verify'
    );
  });

  it('refuses markup a tester page must never carry', () => {
    const injected = spec();
    injected.steps[0].expect[0].text = 'Look <script>fetch("//evil")</script>';
    expect(uat.validateSpec(injected).errors.join(' ')).toContain('<script> is not allowed');

    const insecure = spec();
    insecure.steps[0].where[0] = '<a href="http://demo.example">open</a>';
    expect(uat.validateSpec(insecure).errors.join(' ')).toContain('must be https');

    const styled = spec();
    styled.steps[0].where[0] = '<span class="danger">x</span>';
    expect(uat.validateSpec(styled).errors.join(' ')).toContain('only class="ecran" is allowed');
  });

  it('warns when a page is too long to be played in one sitting', () => {
    const long = spec();
    long.estimate = '55 min';
    expect(uat.validateSpec(long).warnings.join(' ')).toContain('over the 30-minute budget');
  });

  it('refuses a witness that names an unknown step', () => {
    const witness = spec();
    witness.witnesses = [{ id: 'KREISKER', proof: 'select ...', writes: ['9-nowhere'] }];
    expect(uat.validateSpec(witness).errors.join(' ')).toContain('unknown step "9-nowhere"');
  });
});

describe('lint against the source tree', () => {
  it('reports every quoted label that exists in no source file', () => {
    fs.writeFileSync(
      path.join(workspace, 'Component.tsx'),
      'export const label = "OPCO confirmed";\nconst menu = "Folders";\nconst button = "Confirm";\n'
    );
    const report = uat.lintSpec(spec(), { sources: [workspace] });
    expect(report.missing.map((entry) => entry.label)).toEqual(['KREISKER']);
    expect(report.errors.join(' ')).toContain('the label "KREISKER" is in no source file');
    expect(report.scannedFiles).toBe(1);
  });

  it('says nothing about labels when no source folder is given', () => {
    expect(uat.lintSpec(spec()).errors).toEqual([]);
  });
});

describe('page build', () => {
  it('survives a spec that quotes a regular expression', () => {
    const tricky = spec();
    tricky.intro = ["Regex: <code>^[0-9]+$'</code> and $& and $`"];
    const page = uat.buildPage(tricky);
    const embedded = /<script id="uat-spec" type="application\/json">([\s\S]*?)<\/script>/.exec(
      page.html
    );
    expect(JSON.parse(embedded[1]).intro[0]).toContain("$'");
    expect(page.html).not.toContain('__SPEC_JSON__');
    expect(page.html).not.toContain('__SPEC_SHA__');
    expect(page.html.match(/<script id="uat-spec"/g)).toHaveLength(1);
  });

  it('binds the page to the exact revision it was built from', () => {
    const first = uat.buildPage(spec());
    const amended = spec();
    amended.steps[0].expect[0].text = 'I am signed in as an administrator.';
    const second = uat.buildPage(amended);
    expect(first.sha256).not.toBe(second.sha256);
    expect(first.html).toContain(first.sha256);
  });

  it('never asks the browser for an element the page does not carry', () => {
    // No browser runs here, so a typo in an id would only show up in front of a
    // tester. Every literal lookup is matched against the ids the page declares.
    const { html } = uat.buildPage(spec());
    const declared = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map(([, id]) => id));
    const looked = [...html.matchAll(/\$\("([^"+]+)"\)/g)].map(([, id]) => id);
    expect(looked.length).toBeGreaterThan(20);
    expect(looked.filter((id) => !declared.has(id))).toEqual([]);
  });
});

describe('what the first human run taught the page', () => {
  // 2026-09-16: a tester filled every step of a page that had never started a run.
  // Nothing was recorded, and "Save the JSON" exported null.json.
  const { html } = uat.buildPage(spec());

  it('hides the steps until a run exists, whatever a class says about display', () => {
    expect(html).toContain('[hidden] { display: none !important; }');
    expect(html).toMatch(/<main class="steps" id="steps" hidden>/);
  });

  it('cannot export or finish a run that does not exist', () => {
    expect(html).toMatch(/id="btn-save" type="button" disabled/);
    expect(html).toMatch(/id="btn-copy" type="button" disabled/);
    expect(html).toMatch(/id="btn-finish" type="button" disabled/);
    expect(html).toMatch(/id="btn-another" type="button" disabled/);
    expect(html.split('if (!requireRun()) return;')).toHaveLength(5);
  });

  it('shows every step as a segment of the progress bar, and the share answered as a progressbar', () => {
    expect(html).toContain('<nav class="strip" id="strip"></nav>');
    expect(html).toContain('.strip a[data-state="failed"]');
    expect(html).toContain('.strip a[data-state="blocked"]');
    expect(html).toMatch(/id="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100"/);
  });

  // 2026-09-25: on FormaPro's own kit, the steps showed before any run existed, ticks were
  // dropped in silence, and "saved" was printed without a verified write. The page carries a
  // named list of what it guarantees against that, and the build refuses a template without it.
  it('names every guarantee it carries, in the build report too', () => {
    const page = uat.buildPage(spec());
    expect(page.guarantees).toEqual(uat.PAGE_GUARANTEES.map((entry) => entry.id));
    expect(page.guarantees).toEqual(
      expect.arrayContaining([
        'hidden-before-start',
        'verified-local-write',
        'honest-save-status',
        'save-on-every-change',
        'restore-before-capabilities',
        'revision-guard',
        'other-tab-notice',
        'unreadable-draft-kept',
        'progress-accessible',
        'storage-explained',
        'finished-is-not-accepted',
        'utf8-and-escaped-diacritics',
      ])
    );
  });

  it('lets a command be copied without the sentence around it', () => {
    expect(html).toContain('code.cmd');
    const punctuated = spec();
    punctuated.steps[0].do = ['Run <code>npx bmad-plus doctor</code>.'];
    expect(uat.validateSpec(punctuated).warnings.join(' ')).toContain(
      'punctuation right after a command'
    );
    punctuated.steps[0].do = ['Run <code>npx bmad-plus doctor</code>'];
    expect(uat.validateSpec(punctuated).warnings.join(' ')).not.toContain('punctuation');
  });
});

describe('the page speaks the tester language', () => {
  const { LANGUAGES } = require('../../tools/cli/i18n');

  it('offers exactly the languages the framework installs, with no missing string', () => {
    expect(Object.keys(uat.STRINGS)).toEqual(Object.keys(LANGUAGES));
    for (const [code, strings] of Object.entries(uat.STRINGS)) {
      expect(strings.name).toBe(LANGUAGES[code].name);
      expect(Object.keys(strings).sort()).toEqual(Object.keys(uat.STRINGS.en).sort());
      for (const [key, value] of Object.entries(strings)) {
        expect(typeof value === 'string' && value.trim()).toBeTruthy();
        // `name` and `dir` are legitimately shared; a copied sentence means a missing translation.
        if (!['name', 'dir'].includes(key) && code !== 'en') {
          expect(value).not.toBe(uat.STRINGS.en[key]);
        }
      }
    }
  });

  it('reads a code, a framework language name or a locale tag', () => {
    expect(uat.languageCode('fr')).toBe('fr');
    expect(uat.languageCode('Français')).toBe('fr');
    expect(uat.languageCode('pt-BR')).toBe('pt-br');
    expect(uat.languageCode('fr-CA')).toBe('fr');
    expect(uat.languageCode('klingon')).toBeNull();
    expect(uat.languageCode('')).toBeNull();
  });

  it('opens in the recipe language, else the project one, else English', () => {
    expect(uat.buildPage({ ...spec(), language: 'de' }).language).toBe('de');
    expect(
      uat.buildPage({ ...spec(), language: undefined }, { language: 'Español' }).language
    ).toBe('es');
    expect(uat.buildPage({ ...spec(), language: 'fr' }, { language: 'Español' }).language).toBe(
      'fr'
    );
    expect(uat.buildPage({ ...spec(), language: 'klingon' }).language).toBe('en');
  });

  it('ships every language in the page and lets the tester switch', () => {
    const { html } = uat.buildPage({ ...spec(), language: 'fr' });
    const embedded = /<script id="uat-strings" type="application\/json">([\s\S]*?)<\/script>/.exec(
      html
    );
    expect(Object.keys(JSON.parse(embedded[1]))).toEqual(Object.keys(LANGUAGES));
    expect(html).toContain('id="lang"');
    expect(html).toContain('Pas vu');
  });

  it('turns the page around for a right-to-left language', () => {
    const hebrew = uat.buildPage({ ...spec(), language: 'he' });
    expect(hebrew.html).toContain('<html lang="he" dir="rtl">');
    expect(uat.buildPage({ ...spec(), language: 'ja' }).html).toContain(
      '<html lang="ja" dir="ltr">'
    );
  });
});

describe('legacy FormaPro files stay readable', () => {
  const legacySpec = {
    schema: 'recette-interactive/1',
    id: 'formapro-1.202.1',
    produit: 'FormaPro',
    versions: ['1.202.1'],
    titre: 'La durée se propose',
    environnement: { nom: 'DEMO', url: 'https://demo.formapro.cloud' },
    etapes: [
      {
        id: '0-preparation',
        titre: 'Préparation',
        ou: ['Ouvre DEMO.'],
        faire: ['Connecte-toi.'],
        attendus: [{ id: 'a', texte: 'Je suis connecté(e).' }],
      },
    ],
  };

  it('maps the keys without inventing anything', () => {
    const mapped = uat.fromLegacySpec(legacySpec);
    expect(mapped.schema).toBe(uat.SPEC_SCHEMA);
    expect(mapped.product).toBe('FormaPro');
    expect(mapped.language).toBe('fr');
    expect(mapped.environment).toEqual({ name: 'DEMO', url: 'https://demo.formapro.cloud' });
    expect(mapped.steps[0]).toMatchObject({
      id: '0-preparation',
      title: 'Préparation',
      where: ['Ouvre DEMO.'],
    });
    expect(mapped.steps[0].expect).toEqual([{ id: 'a', text: 'Je suis connecté(e).' }]);
    expect(uat.validateSpec(mapped).errors).toEqual([]);
  });

  it('reads a legacy run and keeps its states apart', () => {
    const mapped = uat.fromLegacySpec(legacySpec);
    const normalized = uat.normalizeRun(
      {
        schema: 'recette-interactive/resultats/1',
        specId: 'formapro-1.202.1',
        runId: '20260915-laurent-f89a',
        testeur: 'laurent',
        demarreLe: '2026-09-15T19:37:28.238Z',
        termineLe: '2026-09-15T20:02:55.981Z',
        etapes: {
          '0-preparation': {
            titre: 'Préparation',
            attendus: { a: false },
            verdict: 'KO',
            note: 'page blanche',
          },
        },
        resume: { vus: 0, pasVus: 1, aFaire: 0 },
      },
      mapped
    );
    expect(normalized.tester).toBe('laurent');
    expect(normalized.steps['0-preparation'].expect.a.state).toBe('failed');
    expect(normalized.summary).toEqual({
      passed: 0,
      failed: 1,
      blocked: 0,
      skipped: 0,
      unanswered: 0,
    });
    expect(uat.failures(normalized, mapped)[0]).toMatchObject({
      step: '0-preparation',
      expect: 'a',
      note: 'page blanche',
    });
  });
});

describe('reading runs', () => {
  it('counts a run exported twice only once', () => {
    writeRun(run());
    const copy = path.join(workspace, 'results', 'demo-1.0.0', 'artifact');
    fs.mkdirSync(copy, { recursive: true });
    fs.writeFileSync(path.join(copy, '20260916-sarah-aaaa.json'), JSON.stringify(run()));
    expect(uat.readRuns(path.join(workspace, 'results', 'demo-1.0.0'), spec())).toHaveLength(1);
  });

  it('marks a run that answered another revision', () => {
    writeRun(run({ specSha256: '0'.repeat(64) }));
    const [only] = uat.readRuns(path.join(workspace, 'results', 'demo-1.0.0'), spec());
    expect(only.stale).toBe(true);
  });
});

describe('the gate', () => {
  const evaluate = (over, triageDocument) =>
    uat.gate({
      spec: spec(),
      runs: uat.readRuns(writeRun(run(over)), spec()),
      triage: triageDocument === undefined ? triage() : triageDocument,
    });

  it('waits instead of passing when nothing was played', () => {
    expect(uat.gate({ spec: spec(), runs: [], triage: null }).status).toBe('awaiting');
  });

  it('waits while a run is still open', () => {
    expect(evaluate({ finishedAt: null }).status).toBe('awaiting');
  });

  it('refuses a run that answered an amended spec', () => {
    expect(evaluate({ specSha256: '0'.repeat(64) }).status).toBe('stale');
  });

  it('refuses an untriaged failure, and an undecided one', () => {
    const failing = {
      steps: {
        ...run().steps,
        '0-setup': {
          title: 'Setup',
          note: '',
          expect: { a: { text: 'I am signed in.', state: 'failed', note: 'error 500' } },
        },
      },
    };
    expect(evaluate(failing, triage()).reasons.join(' ')).toContain(
      '0-setup/a is failed and not triaged'
    );

    const undecided = triage([
      { step: '0-setup', expect: 'a', class: 'undecided', decision: 'ask-tester' },
    ]);
    expect(evaluate(failing, undecided).reasons.join(' ')).toContain('never guess');

    const decided = triage([
      { step: '0-setup', expect: 'a', class: 'product', decision: 'fix', fixRef: 'story-3' },
    ]);
    expect(evaluate(failing, decided).status).toBe('passed');
  });

  it('never lets a blocked expectation pass on a classification alone', () => {
    // Nothing was observed: explaining why does not establish the product works.
    const blocked = {
      steps: {
        ...run().steps,
        '0-setup': {
          title: 'Setup',
          note: 'the archive was not in the folder',
          expect: { a: { text: 'I am signed in.', state: 'blocked' } },
        },
      },
    };
    const explained = triage([
      { step: '0-setup', expect: 'a', class: 'recipe', decision: 'amend-spec' },
    ]);
    expect(evaluate(blocked, explained).status).toBe('failed');
    expect(evaluate(blocked, explained).reasons.join(' ')).toContain('nothing was observed');

    const accepted = triage([
      {
        step: '0-setup',
        expect: 'a',
        class: 'recipe',
        decision: 'accept-risk',
        decidedBy: 'laurent',
      },
    ]);
    expect(evaluate(blocked, accepted).status).toBe('passed');
  });

  it('refuses a tick on a writing step that was never confirmed', () => {
    expect(evaluate({}, triage([], [])).reasons.join(' ')).toContain(
      'the write was never confirmed read-only'
    );
    expect(
      evaluate({}, triage([], [{ step: '1-confirm', verified: false, evidence: 'row unchanged' }]))
        .status
    ).toBe('failed');
  });

  it('refuses an unanswered expectation', () => {
    const partial = {
      steps: {
        ...run().steps,
        '0-setup': {
          title: 'Setup',
          note: '',
          expect: { a: { text: 'I am signed in.', state: null } },
        },
      },
    };
    expect(evaluate(partial).reasons.join(' ')).toContain('never answered');
  });

  it('passes a complete, current and triaged run', () => {
    const verdict = evaluate({});
    expect(verdict.status).toBe('passed');
    expect(verdict.run.tester).toBe('Sarah');
  });
});

describe('the emitted Nexus verifier', () => {
  const emit = () => {
    const file = path.join(workspace, 'gate.cjs');
    fs.writeFileSync(
      file,
      uat.emitCheck({
        specId: 'demo-1.0.0',
        specSha256: uat.specHash(spec()),
        dir: '.',
        writeSteps: ['1-confirm'],
      })
    );
    return file;
  };
  const execute = (file) =>
    spawnSync(process.execPath, [file], {
      cwd: workspace,
      encoding: 'utf8',
      timeout: 15000,
      windowsHide: true,
    });

  it('fails while no run is finished, passes once the run is triaged', () => {
    const file = emit();
    expect(execute(file).status).toBe(1);

    writeRun(run());
    fs.mkdirSync(path.join(workspace, 'triage'), { recursive: true });
    fs.writeFileSync(path.join(workspace, 'triage', 'demo-1.0.0.json'), JSON.stringify(triage()));
    const passing = execute(file);
    expect(passing.status).toBe(0);
    expect(passing.stdout).toContain('human-observed');
  });

  it('fails on a failure nobody classified', () => {
    writeRun(
      run({
        steps: {
          '0-setup': { title: 'Setup', note: '', expect: { a: { text: 'x', state: 'failed' } } },
        },
      })
    );
    expect(execute(emit()).status).toBe(1);
  });
});

describe('play order', () => {
  it('puts the reader of a witness before its writer, and reports cycles', () => {
    const writer = {
      ...spec(),
      id: 'demo-1.1.0',
      witnesses: [{ id: 'KREISKER', proof: 'select ...', writes: ['1-confirm'] }],
    };
    const reader = {
      ...spec(),
      id: 'demo-1.0.0',
      witnesses: [{ id: 'KREISKER', proof: 'select ...', reads: ['0-setup'] }],
    };
    const { order, collisions } = uat.playOrder([writer, reader]);
    expect(collisions).toEqual([
      { witness: 'KREISKER', writtenBy: 'demo-1.1.0', readBy: 'demo-1.0.0' },
    ]);
    expect(order.indexOf('demo-1.0.0')).toBeLessThan(order.indexOf('demo-1.1.0'));

    const a = { ...spec(), id: 'a-1.0.0', after: ['b-1.0.0'] };
    const b = { ...spec(), id: 'b-1.0.0', after: ['a-1.0.0'] };
    expect(uat.playOrder([a, b]).cycles.length).toBeGreaterThan(0);
  });
});
