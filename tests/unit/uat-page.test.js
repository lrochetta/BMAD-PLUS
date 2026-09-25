/**
 * The acceptance page in a DOM, played the way a tester plays it — reload included.
 *
 * Every scenario here comes from the FormaPro incident of 2026-09-25: answers typed
 * before any run existed were shown but never kept, a reload lost them, and the page
 * said "saved" on nobody's word. Persistence lives in the template and nowhere else,
 * so this suite is where those behaviours are proven; `uat.PAGE_GUARANTEES` then
 * refuses to build a template that lost one. A DOM is not a browser: the CSS part of
 * the original defect (a class beating the hidden attribute) is asserted on computed
 * style here and replayed in a real browser by tools/qa/uat-page-browser-check.js.
 */
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const uat = require('../../tools/cli/lib/uat');

const ID = 'demo-2.0.0';
const T = uat.STRINGS.fr;

const spec = () => ({
  schema: uat.SPEC_SCHEMA,
  id: ID,
  product: 'Demo',
  versions: ['2.0.0'],
  language: 'fr',
  title: 'La durée se propose, jamais inventée',
  environment: { name: 'DEMO <staging>', url: 'https://demo.example' },
  estimate: '5 min',
  steps: [
    {
      id: '0-setup',
      title: 'Préparation',
      where: ['Ouvre <span class="ecran">Dossiers</span>.'],
      do: ['Connecte-toi.'],
      expect: [
        { id: 'a', text: 'Je suis connecté(e).' },
        { id: 'b', text: 'Le menu <span class="ecran">Dossiers</span> est ouvert.' },
      ],
    },
    {
      id: '1-confirm',
      title: 'Confirmer le financeur',
      writes: true,
      verify: { kind: 'sql', text: 'select updated_at from company where ref = 42' },
      where: ['Société <span class="ecran">KREISKER</span>.'],
      do: ['Clique <span class="ecran">Confirmer</span>.'],
      expect: [{ id: 'a', text: 'La ligne affiche <span class="ecran">OPCO confirmé</span>.' }],
    },
  ],
});

const built = uat.buildPage(spec());
const settle = (ms = 10) => new Promise((resolve) => setTimeout(resolve, ms));
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const key = (runId) => `uat-${ID}-${runId}`;

/**
 * One tab. `storage` seeds localStorage before the page runs — that is what a reload
 * is; `blocked` makes writes fail the way a full, refused or silently dropping storage does.
 */
function openPage({ html = built.html, storage = {}, blocked = false, claude, fetch } = {}) {
  const errors = [];
  const captured = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on('jsdomError', (error) => {
    // jsdom announces what it does not implement (scrolling, navigation) on this channel.
    if (!/not implemented/i.test(String(error && error.message))) errors.push(error);
  });
  const dom = new JSDOM(html, {
    url: 'https://tests.example/recette/',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      window.scrollTo = () => {};
      const NativeBlob = window.Blob;
      window.Blob = class extends NativeBlob {
        constructor(parts, options) {
          super(parts, options);
          this.__text = parts.join('');
        }
      };
      window.URL.createObjectURL = (blob) => {
        captured.push(blob);
        return `blob:tests/${captured.length}`;
      };
      window.URL.revokeObjectURL = () => {};
      window.HTMLAnchorElement.prototype.click = function click() {
        captured.push({ href: this.href, download: this.download });
      };
      for (const [name, value] of Object.entries(storage)) window.localStorage.setItem(name, value);
      if (blocked === true) {
        window.Storage.prototype.setItem = () => {
          throw new Error('QuotaExceededError');
        };
      } else if (blocked === 'silent') {
        window.Storage.prototype.setItem = () => {};
      } else if (blocked === 'index') {
        const native = window.Storage.prototype.setItem;
        window.Storage.prototype.setItem = function setItem(name, value) {
          if (name.endsWith('-last')) throw new Error('QuotaExceededError');
          return native.call(this, name, value);
        };
      }
      if (claude) window.claude = claude;
      if (fetch) window.fetch = fetch;
    },
  });
  const { window } = dom;
  const { document } = window;
  const $ = (id) => document.getElementById(id);
  const display = (id) => window.getComputedStyle($(id)).display;
  const storageDump = () =>
    Object.fromEntries(
      Array.from({ length: window.localStorage.length }, (_, index) => {
        const name = window.localStorage.key(index);
        return [name, window.localStorage.getItem(name)];
      })
    );
  const stored = () => {
    const last = window.localStorage.getItem(`uat-${ID}-last`);
    return last ? JSON.parse(window.localStorage.getItem(key(last))) : null;
  };
  const start = (name) => {
    $('tester').value = name;
    $('btn-start').click();
  };
  const tick = (step, letter, state) => $(`e-${step}-${letter}-${state}`).click();
  const type = (id, text) => {
    const field = $(id);
    field.value = text;
    field.dispatchEvent(new window.Event('input', { bubbles: true }));
  };
  const exported = () => captured.filter((entry) => entry.__text !== undefined).pop();
  const downloaded = () => captured.filter((entry) => entry.download !== undefined).pop();
  const resumeButtons = () => [...$('resume-list').querySelectorAll('button')];
  return {
    window,
    document,
    $,
    display,
    storageDump,
    stored,
    start,
    tick,
    type,
    captured,
    exported,
    downloaded,
    resumeButtons,
    errors,
  };
}

const freeze = (value) => {
  if (value && typeof value === 'object') {
    for (const inner of Object.values(value)) freeze(inner);
    Object.freeze(value);
  }
  return value;
};

/** The artifact database as the page sees it: frozen documents by path, every write recorded, live snapshots on demand. */
function fakeDb(docs = {}, { rejectSet = false } = {}) {
  const writes = [];
  const listeners = {};
  return {
    docs,
    writes,
    emit(docPath, data, { hasPendingWrites = false, exists = true } = {}) {
      for (const listener of listeners[docPath] || []) {
        listener({
          exists,
          data: () => freeze(JSON.parse(JSON.stringify(data))),
          metadata: { hasPendingWrites },
        });
      }
    },
    doc(docPath) {
      return {
        get: async () => ({
          exists: Boolean(docs[docPath]),
          data: () =>
            docs[docPath] ? freeze(JSON.parse(JSON.stringify(docs[docPath]))) : undefined,
        }),
        set: async (value) => {
          if (rejectSet) throw new Error('permission-denied');
          writes.push({ path: docPath, value });
          docs[docPath] = value;
        },
        onSnapshot: (listener) => {
          (listeners[docPath] = listeners[docPath] || []).push(listener);
          return () => {
            listeners[docPath] = listeners[docPath].filter((entry) => entry !== listener);
          };
        },
      };
    },
    collection() {
      const query = {
        where: () => query,
        limit: () => query,
        get: async () => ({
          docs: Object.entries(docs).map(([docPath, value]) => ({
            id: docPath.split('/')[1],
            data: () => freeze(JSON.parse(JSON.stringify(value))),
          })),
        }),
      };
      return query;
    },
  };
}
const claudeWith = (db) => ({ use: (name) => Promise.resolve(name === 'db' ? db : null) });

/** A run as the page stores it, ready to be answered. */
async function answeredRun() {
  const page = openPage();
  await settle();
  page.start('Test QA');
  page.tick('0-setup', 'a', 'passed');
  return { page, run: page.stored() };
}

describe('before a run exists', () => {
  it('shows no answer field, and refuses a tick while saying why', async () => {
    const page = openPage();
    await settle();
    // The FormaPro defect: `.etapes { display: grid }` beat the hidden attribute.
    expect(page.$('steps').hasAttribute('hidden')).toBe(true);
    expect(page.display('steps')).toBe('none');
    expect(page.display('bar')).toBe('none');
    expect(page.display('end')).toBe('none');
    expect(page.display('startbox')).not.toBe('none');
    const radio = page.$('e-0-setup-a-passed');
    radio.click();
    expect(radio.checked).toBe(false);
    expect(page.$('start-state').textContent).toBe(T.startFirst);
    expect(page.window.localStorage.getItem(`uat-${ID}-last`)).toBeNull();
    expect(page.$('storage-note').textContent).toBe(T.localMode);
    expect(page.errors).toEqual([]);
  });

  it('refuses a note, a skip and an export before the run exists, and exports nothing', async () => {
    const page = openPage();
    await settle();
    page.type('overall', 'trop tôt');
    expect(page.$('start-state').textContent).toBe(T.startFirst);
    page.type('note-0-setup', 'trop tôt');
    expect(page.window.localStorage.getItem(`uat-${ID}-last`)).toBeNull();
    // The export buttons are disabled; a regression that enabled them must still export nothing.
    for (const id of ['btn-save', 'btn-copy', 'btn-finish', 'btn-another']) {
      expect(page.$(id).disabled).toBe(true);
      page.$(id).disabled = false;
      page.$(id).click();
    }
    expect(page.downloaded()).toBeUndefined();
    expect(page.exported()).toBeUndefined();
    expect(page.$('start-state').textContent).toBe(T.startFirst);
    expect(page.errors).toEqual([]);
  });

  it('never renders the environment name as markup', async () => {
    const page = openPage();
    await settle();
    const warning = page.$('step-1-confirm').querySelector('.warn-box');
    expect(warning.textContent).toContain('DEMO <staging>');
    expect(warning.querySelector('staging')).toBeNull();
  });
});

describe('a run, tick by tick', () => {
  it('starts saved — both keys read back — fully initialised, with the bar visible and 0 % answered', async () => {
    const page = openPage();
    await settle();
    page.start('Test QA');
    const run = page.stored();
    expect(run).toMatchObject({
      schema: uat.RESULTS_SCHEMA,
      specId: ID,
      specSha256: built.sha256,
      tester: 'Test QA',
      finishedAt: null,
      overallNote: '',
    });
    expect(run.runId).toMatch(/^\d{8}-test-qa-[0-9a-z]{4}$/);
    expect(run.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(run.updatedAt >= run.startedAt).toBe(true);
    const initial = {};
    for (const step of spec().steps) {
      initial[step.id] = { title: step.title, state: null, note: '', expect: {} };
      for (const line of step.expect)
        initial[step.id].expect[line.id] = { text: line.text, state: null, note: '' };
    }
    expect(run.steps).toEqual(initial);
    expect(run.summary).toEqual({ passed: 0, failed: 0, blocked: 0, skipped: 0, unanswered: 3 });
    expect(page.window.localStorage.getItem(`uat-${ID}-last`)).toBe(run.runId);
    expect(page.display('steps')).not.toBe('none');
    expect(page.display('bar')).not.toBe('none');
    expect(page.display('startbox')).toBe('none');
    expect(page.$('meter').getAttribute('role')).toBe('progressbar');
    expect(page.$('meter').getAttribute('aria-valuenow')).toBe('0');
    expect(page.$('meter').getAttribute('aria-label')).toBe(T.progressLabel);
    expect(page.$('save-state').textContent).toBe(T.savedLocal);
    expect(page.$('save-state').className).toContain('saved');
    expect(page.$('mode-note').textContent).toBe(T.localMode);
    expect(page.document.activeElement).toBe(page.$('step-0-setup').querySelector('h2'));
    expect(page.errors).toEqual([]);
  });

  it('keeps every tick and every keystroke at once, and counts what is answered — not what passed', async () => {
    const page = openPage();
    await settle();
    page.start('Test QA');
    page.tick('0-setup', 'a', 'passed');
    expect(page.stored().steps['0-setup'].expect.a.state).toBe('passed');
    page.tick('1-confirm', 'a', 'failed');
    expect(page.stored().steps['1-confirm'].expect.a.state).toBe('failed');
    // Two of three lines answered; one of them is a "not seen" and advances the run just the same.
    expect(page.$('meter').getAttribute('aria-valuenow')).toBe('67');
    expect(page.$('meter').getAttribute('aria-valuetext')).toBe(
      `${T.percentAnswered.replace('{n}', '67')} · 1 ${T.seen} · 1 ${T.notSeen} · 0 ${T.blocked}`
    );
    expect(page.$('c-pct').textContent).toBe('67 %');
    expect(page.$('c-passed').textContent).toBe('1');
    expect(page.$('c-failed').textContent).toBe('1');
    expect(page.$('c-todo').textContent).toBe('1');
    // A note is kept while it is being typed: no blur, no click anywhere else.
    page.type('n-1-confirm-a', 'Déjà vérifié : résultat différent de l’attendu');
    expect(page.stored().steps['1-confirm'].expect.a.note).toBe(
      'Déjà vérifié : résultat différent de l’attendu'
    );
    expect(page.$('n-1-confirm-a').value).toBe('Déjà vérifié : résultat différent de l’attendu');
    page.type('note-0-setup', 'RAS');
    expect(page.stored().steps['0-setup'].note).toBe('RAS');
    page.type('overall', 'Remarque générale');
    expect(page.stored().overallNote).toBe('Remarque générale');
    expect(page.stored().summary).toEqual({
      passed: 1,
      failed: 1,
      blocked: 0,
      skipped: 0,
      unanswered: 1,
    });
    expect(page.errors).toEqual([]);
  });

  it('never moves the cursor of the field being typed in, whatever else is saved', async () => {
    const page = openPage();
    await settle();
    page.start('Test QA');
    page.tick('1-confirm', 'a', 'failed');
    const field = page.$('n-1-confirm-a');
    field.focus();
    field.value = 'abc';
    field.setSelectionRange(1, 1);
    field.dispatchEvent(new page.window.Event('input', { bubbles: true }));
    expect(page.stored().steps['1-confirm'].expect.a.note).toBe('abc');
    expect(page.document.activeElement).toBe(field);
    expect(field.selectionStart).toBe(1);
    // Another answer is saved while the note is still being typed: the caret stays where it was.
    page.tick('0-setup', 'a', 'passed');
    expect(page.document.activeElement).toBe(field);
    expect(field.selectionStart).toBe(1);
    expect(field.value).toBe('abc');
  });

  it('asks the right question under a blocked line, and keeps a written note in view whatever the answer became', async () => {
    const page = openPage();
    await settle();
    page.start('Test QA');
    page.tick('0-setup', 'b', 'blocked');
    expect(page.display('why-0-setup-b')).not.toBe('none');
    expect(page.$('w-0-setup-b').textContent).toBe(T.blockedWhy);
    page.tick('0-setup', 'b', 'failed');
    expect(page.$('w-0-setup-b').textContent).toBe(T.whyNot);
    page.type('n-0-setup-b', 'menu absent');
    page.tick('0-setup', 'b', 'passed');
    expect(page.display('why-0-setup-b')).not.toBe('none');
    expect(page.stored().steps['0-setup'].expect.b.note).toBe('menu absent');
    page.tick('0-setup', 'a', 'passed');
    expect(page.display('why-0-setup-a')).toBe('none');
  });

  it('comes back whole after an immediate reload, progress recomputed from the answers', async () => {
    const first = openPage();
    await settle();
    first.start('Test QA');
    first.tick('0-setup', 'a', 'passed');
    first.tick('1-confirm', 'a', 'failed');
    first.type('n-1-confirm-a', 'vu autre chose');
    first.type('note-0-setup', 'RAS');
    first.type('overall', 'global');
    const saved = first.stored();

    const second = openPage({ storage: first.storageDump() });
    await settle();
    expect(second.display('steps')).not.toBe('none');
    expect(second.display('startbox')).toBe('none');
    expect(second.stored()).toEqual(saved);
    expect(second.$('e-0-setup-a-passed').checked).toBe(true);
    expect(second.$('e-1-confirm-a-failed').checked).toBe(true);
    expect(second.$('n-1-confirm-a').value).toBe('vu autre chose');
    expect(second.$('note-0-setup').value).toBe('RAS');
    expect(second.$('overall').value).toBe('global');
    expect(second.$('bar-tester').textContent).toBe(T.runBy.replace('{tester}', 'Test QA'));
    expect(second.$('meter').getAttribute('aria-valuenow')).toBe(
      first.$('meter').getAttribute('aria-valuenow')
    );
    expect(second.$('save-state').textContent).toBe(T.savedLocal);
    expect(second.errors).toEqual([]);
  });

  it('restores the browser copy synchronously, before any capability answers — or hangs', () => {
    const seeded = openPage();
    seeded.start('Test QA');
    seeded.tick('0-setup', 'a', 'passed');
    const never = () => new Promise(() => {});
    const page = openPage({
      storage: seeded.storageDump(),
      fetch: never,
      claude: { use: never },
    });
    // No await: what follows must already be true when the script has run.
    expect(page.display('steps')).not.toBe('none');
    expect(page.display('startbox')).toBe('none');
    expect(page.stored().runId).toBe(seeded.stored().runId);
    expect(page.$('e-0-setup-a-passed').checked).toBe(true);
    expect(page.$('save-state').textContent).toBe(T.savedLocal);
  });

  it('finishing warns on unanswered lines on the page itself, keeps the date after a reload, and says it is not an acceptance', async () => {
    const first = openPage();
    await settle();
    first.start('Test QA');
    first.tick('0-setup', 'a', 'passed');
    // A dialog can be swallowed by a host; the warning is written on the page, and the second click finishes.
    first.$('btn-finish').click();
    expect(first.stored().finishedAt).toBeNull();
    expect(first.$('end-state').textContent).toBe(T.confirmUnanswered.replace('{n}', '2'));
    expect(first.$('btn-finish').textContent).toBe(T.finishAnyway);
    expect(first.$('btn-finish').disabled).toBe(false);
    // Answering one more line withdraws the question; the next click asks again with the new count.
    first.tick('0-setup', 'b', 'passed');
    expect(first.$('end-state').textContent).toBe('');
    expect(first.$('btn-finish').textContent).toBe(T.finishRun);
    first.$('btn-finish').click();
    expect(first.$('end-state').textContent).toBe(T.confirmUnanswered.replace('{n}', '1'));
    first.$('btn-finish').click();
    const finished = first.stored();
    expect(finished.finishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(first.$('end-state').textContent).toBe(T.finishedNote);
    expect(first.$('btn-finish').disabled).toBe(true);
    // A change after finishing is kept, dated after the finish, and said on screen.
    first.type('overall', 'ajouté après');
    expect(first.stored().finishedAt).toBe(finished.finishedAt);
    expect(first.stored().updatedAt > finished.finishedAt).toBe(true);
    expect(first.$('run-note').textContent).toBe(T.changedAfterFinish);

    const second = openPage({ storage: first.storageDump() });
    await settle();
    expect(second.stored().finishedAt).toBe(finished.finishedAt);
    expect(second.stored().steps['0-setup'].expect.a.state).toBe('passed');
    expect(second.$('btn-finish').disabled).toBe(true);
    expect(second.$('bar-tester').textContent).toContain(
      T.finishedOn.replace('{date}', finished.finishedAt.slice(0, 10))
    );
  });

  it('finishes at once when every line is answered', async () => {
    const page = openPage();
    await settle();
    page.start('Test QA');
    page.tick('0-setup', 'a', 'passed');
    page.tick('0-setup', 'b', 'passed');
    page.tick('1-confirm', 'a', 'blocked');
    page.$('btn-finish').click();
    expect(page.stored().finishedAt).toMatch(/^\d{4}/);
    expect(page.$('end-state').textContent).toBe(T.finishedNote);
  });

  it('exports the run exactly as answered, under its run id, and says so', async () => {
    const page = openPage();
    await settle();
    page.start('Test QA');
    page.tick('0-setup', 'b', 'blocked');
    page.type('n-0-setup-b', 'menu absent');
    page.$('btn-save').click();
    const run = page.stored();
    expect(page.exported().__text).toBe(JSON.stringify(run, null, 2));
    expect(page.downloaded().download).toBe(`${run.runId}.json`);
    expect(page.$('end-state').textContent).toBe(T.savedAs.replace('{file}', `${run.runId}.json`));
  });

  it('starts another run while the previous one stays saved and resumable, with nothing of it left on screen', async () => {
    const page = openPage();
    await settle();
    page.start('Alice');
    page.tick('0-setup', 'a', 'passed');
    page.$('btn-save').click();
    const firstId = page.stored().runId;
    expect(page.$('end-state').textContent).not.toBe('');
    page.$('btn-another').click();
    await settle();
    expect(page.display('startbox')).not.toBe('none');
    expect(page.display('steps')).toBe('none');
    expect(page.$('end-state').textContent).toBe('');
    expect(page.display('run-note')).toBe('none');
    expect(page.resumeButtons()).toHaveLength(1);
    expect(page.resumeButtons()[0].textContent).toContain(`1/3 ${T.countAnswered}`);
    page.start('Bob');
    const secondId = page.stored().runId;
    expect(secondId).not.toBe(firstId);
    expect(page.$('end-state').textContent).toBe('');
    const earlier = JSON.parse(page.window.localStorage.getItem(key(firstId)));
    expect(earlier.tester).toBe('Alice');
    expect(earlier.steps['0-setup'].expect.a.state).toBe('passed');
  });

  it('gives the same tester two different runs on the same day, both kept', async () => {
    const page = openPage();
    await settle();
    page.start('Alice');
    const firstId = page.stored().runId;
    page.$('btn-another').click();
    await settle();
    page.start('Alice');
    const secondId = page.stored().runId;
    expect(secondId).not.toBe(firstId);
    expect(secondId.slice(0, -4)).toBe(firstId.slice(0, -4));
    expect(page.window.localStorage.getItem(key(firstId))).not.toBeNull();
    expect(page.window.localStorage.getItem(key(secondId))).not.toBeNull();
  });

  it('declares UTF-8, escapes the diacritics range, slugs an accented name, and signs a non-Latin one', async () => {
    expect(built.html.slice(0, 1024)).toMatch(/<meta charset="utf-8">/i);
    expect(built.html).toContain('\\u0300-\\u036f');
    const page = openPage();
    await settle();
    page.start('Éléonore François');
    expect(page.stored().runId).toMatch(/^\d{8}-eleonore-francois-[0-9a-z]{4}$/);
    expect(page.$('json').value).toContain('Éléonore François');
    expect(page.$('bar-tester').textContent).toContain('Éléonore François');
    expect(page.$('step-0-setup').querySelector('h2').textContent).toBe('Préparation');
    page.$('btn-another').click();
    await settle();
    page.start('משה');
    expect(page.stored().runId).toMatch(/^\d{8}-t[0-9a-z]{1,7}-[0-9a-z]{4}$/);
    expect(page.stored().runId).not.toContain('anonymous');
    const hebrew = page.stored().runId;
    page.$('btn-another').click();
    await settle();
    page.start('משה');
    expect(page.stored().runId.slice(0, -5)).toBe(hebrew.slice(0, -5));
  });
});

describe('when this browser refuses to keep anything', () => {
  it.each([
    ['throws', true],
    ['drops the write in silence', 'silent'],
    ['keeps the run but not the pointer', 'index'],
  ])(
    'says so instead of claiming a save when storage %s, questions leaving, and still exports',
    async (_, blocked) => {
      const page = openPage({ blocked });
      await settle();
      page.start('Test QA');
      expect(page.$('save-state').textContent).toBe(T.saveFailed);
      expect(page.$('save-state').className).toContain('failed');
      expect(page.window.localStorage.getItem(`uat-${ID}-last`)).toBeNull();
      page.tick('0-setup', 'a', 'passed');
      expect(page.$('save-state').textContent).toBe(T.saveFailed);

      const leaving = new page.window.Event('beforeunload', { cancelable: true });
      page.window.dispatchEvent(leaving);
      expect(leaving.defaultPrevented).toBe(true);

      page.$('btn-save').click();
      const run = JSON.parse(page.exported().__text);
      expect(run.tester).toBe('Test QA');
      expect(run.steps['0-setup'].expect.a.state).toBe('passed');
      expect(page.errors).toEqual([]);
    }
  );

  it('never questions leaving when everything is saved', async () => {
    const page = openPage();
    await settle();
    page.start('Test QA');
    const leaving = new page.window.Event('beforeunload', { cancelable: true });
    page.window.dispatchEvent(leaving);
    expect(leaving.defaultPrevented).toBe(false);
  });
});

describe('what this browser already holds', () => {
  it('reports a saved run it cannot read, keeps it, lets the tester save it, and still lists it after another run', async () => {
    const raw = '{"schema": "bmad-plus/uat-results/2", "specId": "demo-2.0.0", "steps": ';
    const page = openPage({ storage: { [`uat-${ID}-last`]: 'x', [key('x')]: raw } });
    await settle();
    expect(page.display('draft-problem')).not.toBe('none');
    expect(page.$('t-draft-problem').textContent.trim()).toBe(T.draftUnreadable);
    expect(page.display('steps')).toBe('none');
    expect(page.window.localStorage.getItem(key('x'))).toBe(raw);
    page.$('btn-save-raw').click();
    expect(page.exported().__text).toBe(raw);
    expect(page.downloaded().download).toBe(`${key('x')}.txt`);
    // The page is not blocked: a new run starts, and the unreadable one is still offered afterwards.
    page.start('Test QA');
    expect(page.display('steps')).not.toBe('none');
    expect(page.window.localStorage.getItem(key('x'))).toBe(raw);
    const later = openPage({ storage: page.storageDump() });
    await settle();
    expect(later.display('steps')).not.toBe('none');
    later.$('btn-another').click();
    await settle();
    const rows = [...later.$('resume-list').querySelectorAll('.row')];
    const brokenRow = rows.find((row) => row.textContent.includes(T.draftUnreadable));
    expect(brokenRow).toBeDefined();
    brokenRow.querySelector('button').click();
    expect(later.exported().__text).toBe(raw);
    expect(later.errors).toEqual([]);
  });

  it('treats a parseable but half-shaped run as unreadable instead of opening it', async () => {
    const half = JSON.stringify({
      schema: uat.RESULTS_SCHEMA,
      specId: ID,
      specSha256: built.sha256,
      steps: { '0-setup': {} },
    });
    const page = openPage({ storage: { [`uat-${ID}-last`]: 'h', [key('h')]: half } });
    await settle();
    expect(page.display('steps')).toBe('none');
    expect(page.display('draft-problem')).not.toBe('none');
    expect(page.window.localStorage.getItem(key('h'))).toBe(half);
    page.start('Test QA');
    page.tick('0-setup', 'a', 'passed');
    expect(page.stored().steps['0-setup'].expect.a.state).toBe('passed');
    expect(page.errors).toEqual([]);
  });

  it('offers a run that answered another revision, and carries only identical lines', async () => {
    const first = openPage();
    await settle();
    first.start('Test QA');
    first.tick('0-setup', 'a', 'passed');
    first.tick('0-setup', 'b', 'blocked');
    first.tick('1-confirm', 'a', 'failed');
    first.type('n-1-confirm-a', 'ancienne remarque');
    first.type('note-0-setup', 'note étape');
    first.type('overall', 'global');
    const old = first.stored();
    const oldRaw = first.window.localStorage.getItem(key(old.runId));

    const amended = spec();
    amended.steps[1].expect[0].text =
      'La ligne affiche <span class="ecran">OPCO confirmé</span> en vert.';
    const rebuilt = uat.buildPage(amended);
    expect(rebuilt.sha256).not.toBe(built.sha256);

    const second = openPage({ html: rebuilt.html, storage: first.storageDump() });
    await settle();
    // Not reopened as if nothing had changed; offered, explained, exportable.
    expect(second.display('steps')).toBe('none');
    expect(second.display('resume')).not.toBe('none');
    const row = second.$('resume-list').querySelector('.row');
    expect(row.textContent).toContain(T.otherRevision);
    expect(row.textContent).toContain(`3/3 ${T.countAnswered}`);
    const [carryButton, saveButton] = row.querySelectorAll('button');
    expect(carryButton.textContent).toBe(T.continueHere);
    expect(saveButton.textContent).toBe(T.saveThatJson);

    saveButton.click();
    expect(second.exported().__text).toBe(JSON.stringify(old, null, 2));

    carryButton.click();
    const carried = second.stored();
    expect(carried.runId).not.toBe(old.runId);
    expect(carried.specSha256).toBe(rebuilt.sha256);
    expect(carried.tester).toBe('Test QA');
    expect(carried.carriedFrom).toEqual({
      runId: old.runId,
      specSha256: built.sha256,
      kept: 2,
      toAnswer: 1,
    });
    expect(carried.steps['0-setup'].expect.a.state).toBe('passed');
    expect(carried.steps['0-setup'].expect.b.state).toBe('blocked');
    expect(carried.steps['0-setup'].note).toBe('note étape');
    // The changed line is asked again, its old note included: it described another text.
    expect(carried.steps['1-confirm'].expect.a.state).toBeNull();
    expect(carried.steps['1-confirm'].expect.a.note).toBe('');
    expect(carried.overallNote).toBe('global');
    expect(second.$('meter').getAttribute('aria-valuenow')).toBe('67');
    expect(second.$('run-note').textContent).toBe(
      T.carried.replace('{kept}', '2').replace('{left}', '1')
    );
    // The earlier run is exactly where and what it was.
    expect(second.window.localStorage.getItem(key(old.runId))).toBe(oldRaw);
    // The notice belongs to this run only.
    second.$('btn-another').click();
    await settle();
    expect(second.display('run-note')).toBe('none');
    expect(second.errors).toEqual([]);
  });

  it('lists runs newest first, with their progress', async () => {
    const page = openPage();
    await settle();
    page.start('Alice');
    page.tick('0-setup', 'a', 'passed');
    page.$('btn-another').click();
    await settle(5);
    page.start('Bob');
    page.tick('0-setup', 'a', 'passed');
    page.tick('0-setup', 'b', 'passed');
    page.$('btn-another').click();
    await settle();
    const labels = page.resumeButtons().map((button) => button.textContent);
    expect(labels[0]).toContain('Bob');
    expect(labels[0]).toContain(`2/3 ${T.countAnswered}`);
    expect(labels[1]).toContain('Alice');
    expect(labels[1]).toContain(`1/3 ${T.countAnswered}`);
  });
});

describe('two tabs on the same run', () => {
  it('converge on the latest change and say so; an older copy changes nothing', async () => {
    const a = openPage();
    await settle();
    a.start('Test QA');
    a.tick('0-setup', 'a', 'passed');
    const name = key(a.stored().runId);
    const b = openPage({ storage: a.storageDump() });
    await settle();
    expect(b.stored().runId).toBe(a.stored().runId);
    await settle(5); // updatedAt has millisecond resolution and must move forward
    b.tick('1-confirm', 'a', 'failed');

    const fromB = b.window.localStorage.getItem(name);
    a.window.dispatchEvent(
      new a.window.StorageEvent('storage', {
        key: name,
        newValue: fromB,
        oldValue: a.window.localStorage.getItem(name),
      })
    );
    expect(a.$('e-1-confirm-a-failed').checked).toBe(true);
    expect(a.$('e-0-setup-a-passed').checked).toBe(true);
    expect(a.display('run-note')).not.toBe('none');
    expect(a.$('run-note').textContent).toBe(T.otherTab);
    expect(a.$('c-todo').textContent).toBe('1');

    const stale = JSON.parse(fromB);
    stale.updatedAt = '2000-01-01T00:00:00.000Z';
    stale.steps['0-setup'].expect.a.state = null;
    a.window.dispatchEvent(
      new a.window.StorageEvent('storage', {
        key: name,
        newValue: JSON.stringify(stale),
        oldValue: fromB,
      })
    );
    expect(a.$('e-0-setup-a-passed').checked).toBe(true);
    // A copy without a date is the oldest of all: it never wins.
    const undated = JSON.parse(fromB);
    delete undated.updatedAt;
    undated.steps['0-setup'].expect.a.state = null;
    a.window.dispatchEvent(
      new a.window.StorageEvent('storage', {
        key: name,
        newValue: JSON.stringify(undated),
        oldValue: fromB,
      })
    );
    expect(a.$('e-0-setup-a-passed').checked).toBe(true);
    expect(a.errors).toEqual([]);
  });
});

describe('with the artifact database', () => {
  it('pushes a newer local copy and never lets an older or undated remote one overwrite it', async () => {
    const { page: first, run: local } = await answeredRun();
    for (const variant of ['older', 'undated']) {
      const remote = JSON.parse(JSON.stringify(local));
      if (variant === 'older') remote.updatedAt = '2000-01-01T00:00:00.000Z';
      else delete remote.updatedAt;
      remote.steps['0-setup'].expect.a.state = null;
      const db = fakeDb({ [`recettes/${local.runId}`]: remote });

      const page = openPage({ storage: first.storageDump(), claude: claudeWith(db) });
      await settle();
      expect(page.$('e-0-setup-a-passed').checked).toBe(true);
      // The push is a save: it stamps updatedAt; everything answered stays exactly as it was.
      const { updatedAt: pushedAt, ...pushed } = page.stored();
      const { updatedAt: localAt, ...answered } = local;
      expect(pushed).toEqual(answered);
      expect(pushedAt >= localAt).toBe(true);
      expect(db.writes).toHaveLength(1);
      expect(db.writes[0].value.steps['0-setup'].expect.a.state).toBe('passed');
      expect(db.writes[0].value.updatedAt).toBe(pushedAt);
      expect(page.$('save-state').textContent).toMatch(new RegExp(`^${escape(T.savedRemote)}`));
      expect(page.$('storage-note').textContent).toBe(T.dbMode);
      expect(page.errors).toEqual([]);
    }
  });

  it('adopts a newer remote copy — a frozen one — keeps it in this browser, and reports it as the shared copy', async () => {
    const { page: first, run: local } = await answeredRun();
    await settle(5);
    const newer = JSON.parse(JSON.stringify(local));
    newer.updatedAt = new Date().toISOString();
    newer.steps['1-confirm'].expect.a.state = 'failed';
    newer.steps['1-confirm'].expect.a.note = 'depuis un autre appareil';
    const db = fakeDb({ [`recettes/${local.runId}`]: newer });

    const page = openPage({ storage: first.storageDump(), claude: claudeWith(db) });
    await settle();
    expect(page.$('e-1-confirm-a-failed').checked).toBe(true);
    expect(page.$('n-1-confirm-a').value).toBe('depuis un autre appareil');
    expect(page.stored().updatedAt).toBe(newer.updatedAt);
    expect(db.writes).toHaveLength(0);
    expect(page.$('save-state').textContent).toMatch(new RegExp(`^${escape(T.savedRemote)}`));
    expect(page.$('save-state').textContent).not.toBe(T.savedLocal);
    // The adopted copy is writable: the next tick is saved and pushed.
    page.tick('0-setup', 'b', 'blocked');
    await settle(700);
    expect(page.stored().steps['0-setup'].expect.b.state).toBe('blocked');
    expect(db.writes).toHaveLength(1);
    expect(page.errors).toEqual([]);
  });

  it('follows live snapshots: a newer one is adopted with a notice and cancels what this tab had not sent; older or pending ones change nothing', async () => {
    const { page: first, run: local } = await answeredRun();
    const db = fakeDb({ [`recettes/${local.runId}`]: local });
    const page = openPage({ storage: first.storageDump(), claude: claudeWith(db) });
    await settle();
    const docPath = `recettes/${local.runId}`;
    const writesBefore = db.writes.length;

    page.tick('0-setup', 'b', 'passed'); // pending, debounced
    await settle(5);
    const fromElsewhere = JSON.parse(JSON.stringify(page.stored()));
    fromElsewhere.updatedAt = new Date().toISOString();
    fromElsewhere.steps['0-setup'].expect.b.state = null;
    fromElsewhere.steps['1-confirm'].expect.a.state = 'blocked';
    db.emit(docPath, fromElsewhere);
    expect(page.$('e-1-confirm-a-blocked').checked).toBe(true);
    expect(page.$('e-0-setup-b-passed').checked).toBe(false);
    expect(page.$('run-note').textContent).toBe(T.otherTab);
    expect(page.stored().steps['1-confirm'].expect.a.state).toBe('blocked');
    await settle(700);
    // The pre-adoption body was never pushed over the newer copy.
    expect(db.writes).toHaveLength(writesBefore);

    const older = JSON.parse(JSON.stringify(fromElsewhere));
    older.updatedAt = '2000-01-01T00:00:00.000Z';
    older.steps['1-confirm'].expect.a.state = null;
    db.emit(docPath, older);
    expect(page.$('e-1-confirm-a-blocked').checked).toBe(true);

    const echo = JSON.parse(JSON.stringify(fromElsewhere));
    echo.updatedAt = new Date(Date.now() + 5000).toISOString();
    echo.steps['1-confirm'].expect.a.state = null;
    db.emit(docPath, echo, { hasPendingWrites: true });
    expect(page.$('e-1-confirm-a-blocked').checked).toBe(true);
    expect(page.errors).toEqual([]);
  });

  it('resumes the newest copy of a run from the list, wherever it lives', async () => {
    const { page: first, run: local } = await answeredRun();
    const remote = JSON.parse(JSON.stringify(local));
    remote.updatedAt = '2000-01-01T00:00:00.000Z';
    remote.steps['0-setup'].expect.a.state = null;
    const db = fakeDb({ [`recettes/${local.runId}`]: remote });
    const page = openPage({ storage: first.storageDump(), claude: claudeWith(db) });
    await settle();
    page.$('btn-another').click();
    await settle();
    expect(page.resumeButtons()).toHaveLength(1);
    expect(page.resumeButtons()[0].textContent).toContain(`1/3 ${T.countAnswered}`);
    page.resumeButtons()[0].click();
    expect(page.$('e-0-setup-a-passed').checked).toBe(true);
    expect(page.stored().steps['0-setup'].expect.a.state).toBe('passed');
  });

  it('reports a refused remote write without pretending, and keeps the local copy', async () => {
    const db = fakeDb({}, { rejectSet: true });
    const page = openPage({ claude: claudeWith(db) });
    await settle();
    page.start('Test QA');
    await settle();
    expect(page.$('save-state').textContent).toBe(T.remoteFailed);
    expect(page.$('save-state').className).not.toContain('saved');
    expect(page.stored().tester).toBe('Test QA');

    const blocked = openPage({
      claude: claudeWith(fakeDb({}, { rejectSet: true })),
      blocked: true,
    });
    await settle();
    blocked.start('Test QA');
    await settle();
    expect(blocked.$('save-state').textContent).toBe(T.saveFailed);
  });
});

describe('with the local server', () => {
  it('sends each save, flushes on pagehide with keepalive, and reports a refused one without pretending', async () => {
    const puts = [];
    let accept = true;
    const fetch = (url, init = {}) => {
      if (String(url).endsWith('__uat/ping')) {
        return Promise.resolve({ ok: true, json: async () => ({ uat: true, specId: ID }) });
      }
      puts.push({
        url: String(url),
        body: JSON.parse(init.body),
        keepalive: Boolean(init.keepalive),
      });
      return Promise.resolve({ ok: accept, status: accept ? 200 : 500 });
    };
    const page = openPage({ fetch });
    await settle();
    expect(page.$('storage-note').textContent).toBe(T.serveMode);
    page.start('Test QA');
    await settle();
    expect(puts).toHaveLength(1);
    expect(puts[0].url).toBe(`__uat/results/${page.stored().runId}`);
    expect(puts[0].body.tester).toBe('Test QA');
    expect(puts[0].keepalive).toBe(false);
    expect(page.$('save-state').textContent).toMatch(new RegExp(`^${escape(T.savedRemote)}`));
    expect(page.$('mode-note').textContent).toBe(T.serveMode);

    page.tick('0-setup', 'b', 'blocked');
    expect(page.$('save-state').textContent).toBe(T.saving);
    page.window.dispatchEvent(new page.window.Event('pagehide'));
    await settle();
    expect(puts).toHaveLength(2);
    expect(puts[1].keepalive).toBe(true);
    expect(puts[1].body.steps['0-setup'].expect.b.state).toBe('blocked');

    accept = false;
    page.tick('0-setup', 'a', 'passed');
    expect(page.$('save-state').textContent).toBe(T.saving);
    await settle(700); // the debounce
    expect(puts).toHaveLength(3);
    expect(page.$('save-state').textContent).toBe(T.remoteFailed);
    expect(page.stored().steps['0-setup'].expect.a.state).toBe('passed');
    expect(page.errors).toEqual([]);
  });
});

describe('the guarantees the build enforces', () => {
  const template = fs.readFileSync(
    path.resolve(__dirname, '../../src/bmad-plus/skills/bmad-plus-uat/template/page.html'),
    'utf8'
  );

  // Every guarantee names the test above that proves the behaviour, not just the marker.
  const EXERCISED = {
    'hidden-before-start': 'shows no answer field, and refuses a tick while saying why',
    'no-answer-before-run':
      'refuses a note, a skip and an export before the run exists, and exports nothing',
    'verified-local-write':
      'says so instead of claiming a save when storage %s, questions leaving, and still exports',
    'honest-save-status':
      'reports a refused remote write without pretending, and keeps the local copy',
    'save-on-every-change':
      'never moves the cursor of the field being typed in, whatever else is saved',
    'restore-before-capabilities':
      'restores the browser copy synchronously, before any capability answers — or hangs',
    'newer-copy-wins':
      'pushes a newer local copy and never lets an older or undated remote one overwrite it',
    'revision-guard':
      'offers a run that answered another revision, and carries only identical lines',
    'other-tab-notice': 'converge on the latest change and say so; an older copy changes nothing',
    'unreadable-draft-kept':
      'reports a saved run it cannot read, keeps it, lets the tester save it, and still lists it after another run',
    'progress-accessible':
      'keeps every tick and every keystroke at once, and counts what is answered — not what passed',
    'storage-explained':
      'starts saved — both keys read back — fully initialised, with the bar visible and 0 % answered',
    'finished-is-not-accepted':
      'finishing warns on unanswered lines on the page itself, keeps the date after a reload, and says it is not an acceptance',
    'unload-guard':
      'sends each save, flushes on pagehide with keepalive, and reports a refused one without pretending',
    'utf8-and-escaped-diacritics':
      'declares UTF-8, escapes the diacritics range, slugs an accented name, and signs a non-Latin one',
    'export-is-the-run': 'exports the run exactly as answered, under its run id, and says so',
  };

  it('are all carried by the shipped template, and each one names the test that proves it', () => {
    expect(built.guarantees).toEqual(uat.PAGE_GUARANTEES.map((entry) => entry.id));
    expect(uat.pageGuarantees(template)).toMatchObject({ ok: true, missing: [] });
    expect(Object.keys(EXERCISED).sort()).toEqual(
      uat.PAGE_GUARANTEES.map((entry) => entry.id).sort()
    );
    const suite = fs.readFileSync(__filename, 'utf8');
    for (const title of Object.values(EXERCISED)) expect(suite).toContain(title);
  });

  it('refuse to build a template that lost one, and say what was lost', () => {
    const noHidden = template.replace('[hidden] { display: none !important; }', '');
    expect(() => uat.buildPage(spec(), { template: noHidden })).toThrow(
      /lost a guarantee.*hidden-before-start: no answer field/
    );
    // A rule appended after it would beat it in a real browser: the rule must stay last.
    const notLast = template.replace(
      '[hidden] { display: none !important; }\n</style>',
      '[hidden] { display: none !important; }\n  .steps { display: grid !important; }\n</style>'
    );
    expect(() => uat.buildPage(spec(), { template: notLast })).toThrow(/hidden-before-start/);
    const silentWrite = template.replace('return localStorage.getItem(k) === v;', 'return true;');
    expect(() => uat.buildPage(spec(), { template: silentWrite })).toThrow(/verified-local-write/);
    const lateRestore = template.replace('  restoreLocal();\n', '');
    expect(() => uat.buildPage(spec(), { template: lateRestore })).toThrow(
      /restore-before-capabilities/
    );
    const lost = uat.pageGuarantees(lateRestore);
    expect(lost.carried).not.toContain('restore-before-capabilities');
    expect(lost.carried).toContain('hidden-before-start');
  });

  it('are checked on the template, so a recipe quoting a marker changes nothing', () => {
    const quoting = spec();
    quoting.steps[0].do = ['Run <code>probe()</code> then <code>restoreLocal();</code>'];
    expect(uat.buildPage(quoting).guarantees).toHaveLength(uat.PAGE_GUARANTEES.length);
  });
});
