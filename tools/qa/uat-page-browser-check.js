#!/usr/bin/env node
/**
 * The essential tester pass on the acceptance page, in a real browser.
 *
 * A DOM library proves the script; only a browser proves the stylesheet, and the
 * original defect was a stylesheet one: a class that set `display` beat the `hidden`
 * attribute, the steps showed before any run existed, and every tick was dropped.
 * This check builds the shipped example recipe in French, serves it on the loopback
 * interface WITHOUT a charset header (so the page's own `<meta charset>` is what
 * decodes the bytes), and walks the pass of the incident report of 2026-09-25 in Chromium:
 *
 *   open → no answer field → start → tick Seen → tick Not seen → type a note without
 *   leaving the field → type an overall remark → reload at once → everything is back →
 *   the progress says two lines of three are answered → storage refused → the page says
 *   so, never says "saved", and still exports the run.
 *
 * Usage (no application dependency is added; pass an installed playwright-core):
 *   node tools/qa/uat-page-browser-check.js --playwright /path/to/playwright-core [--channel msedge] [--out report.json]
 *
 * Exit 0 when every assertion holds; 1 otherwise, with the failing assertion named.
 * This is evidence about the page, never about a product: a green run here says the
 * page keeps answers, not that a tester looked at the right place.
 */
'use strict';
/* global document, getComputedStyle, localStorage, Storage */ // inside page.evaluate callbacks

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');

const uat = require('../cli/lib/uat');

const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};

async function main() {
  const playwrightPath = option('--playwright');
  if (!playwrightPath) throw new Error('Pass --playwright <path to an installed playwright-core>.');
  const { chromium } = require(path.resolve(playwrightPath));
  const channel = option('--channel');
  const out = option('--out');

  const specFile = path.resolve(
    __dirname,
    '../../src/bmad-plus/skills/bmad-plus-uat/templates/example-uat-spec.json'
  );
  const { spec: shipped } = uat.loadSpec(specFile);
  // French, with an accented title of its own: the bytes must survive the wire without a charset header.
  const spec = { ...shipped, language: 'fr', title: 'La durée se propose, jamais inventée' };
  const page = uat.buildPage(spec);
  const T = uat.STRINGS[page.language];
  const step = spec.steps[0];
  const [first, second] =
    step.expect.length > 1 ? step.expect : [step.expect[0], spec.steps[1].expect[0]];
  const secondStep = step.expect.length > 1 ? step : spec.steps[1];
  const total = spec.steps.reduce((n, s) => n + s.expect.length, 0);

  const server = http.createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html', 'cache-control': 'no-store' });
    response.end(page.html);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}/`;

  const report = { spec: spec.id, specSha256: page.sha256, language: page.language, checks: [] };
  const check = (name, ok, detail) => {
    report.checks.push({ name, ok: Boolean(ok), ...(detail === undefined ? {} : { detail }) });
    assert(ok, `${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`);
  };
  const pill = (stepId, letter, state) =>
    `label.pill.${state}:has(#e-${stepId}-${letter}-${state})`;

  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
    const context = await browser.newContext({ locale: 'fr-FR' });
    const tab = await context.newPage();
    const errors = [];
    tab.on('pageerror', (error) => errors.push(error.message));
    const display = (id) =>
      tab.evaluate((el) => getComputedStyle(document.getElementById(el)).display, id);
    const text = (id) => tab.locator(`#${id}`).textContent();
    const stored = () =>
      tab.evaluate((specId) => {
        const last = localStorage.getItem(`uat-${specId}-last`);
        return last ? JSON.parse(localStorage.getItem(`uat-${specId}-${last}`)) : null;
      }, spec.id);

    await tab.goto(origin, { waitUntil: 'load' });
    check(
      'the page decoded its own bytes: accented title intact',
      (await tab.locator('h1').textContent()) === spec.title
    );
    check('steps hidden before any run, by computed style', (await display('steps')) === 'none');
    check('bar hidden before any run', (await display('bar')) === 'none');
    check('end hidden before any run', (await display('end')) === 'none');
    // Force a tick on the hidden radio: the page must refuse it and say so.
    await tab.evaluate(
      (id) => document.getElementById(id).click(),
      `e-${step.id}-${first.id}-passed`
    );
    check(
      'a tick before the run is refused',
      !(await tab.locator(`#e-${step.id}-${first.id}-passed`).isChecked())
    );
    check('and explained', (await text('start-state')) === T.startFirst);
    check('nothing stored before the run', (await stored()) === null);
    check('the page says where answers live', (await text('storage-note')) === T.localMode);

    await tab.fill('#tester', 'Test QA');
    await tab.click('#btn-start');
    const started = await stored();
    check(
      'a run is stored at once',
      started && started.tester === 'Test QA' && started.specSha256 === page.sha256,
      started && started.runId
    );
    check('steps visible once the run exists', (await display('steps')) !== 'none');
    check('progress at 0 %', (await tab.getAttribute('#meter', 'aria-valuenow')) === '0');
    check('status reads saved in this browser', (await text('save-state')) === T.savedLocal);

    // The visible controls, as a person clicks them — never a forced click on the hidden input.
    await tab.locator(pill(step.id, first.id, 'passed')).click();
    check(
      'Seen is stored immediately',
      (await stored()).steps[step.id].expect[first.id].state === 'passed'
    );
    await tab.locator(pill(secondStep.id, second.id, 'failed')).click();
    check(
      'Not seen is stored immediately',
      (await stored()).steps[secondStep.id].expect[second.id].state === 'failed'
    );
    const expected = String(Math.round((2 / total) * 100));
    check(
      'progress counts answered lines, not passed ones',
      (await tab.getAttribute('#meter', 'aria-valuenow')) === expected,
      { expected }
    );

    const note = 'Déjà vérifié : résultat différent de l’attendu';
    await tab.locator(`#n-${secondStep.id}-${second.id}`).pressSequentially(note);
    check(
      'a note is stored while being typed, before any blur',
      (await stored()).steps[secondStep.id].expect[second.id].note === note
    );
    // Typing in the middle of the note: the caret must stay where the tester put it.
    await tab.locator(`#n-${secondStep.id}-${second.id}`).press('Home');
    await tab.locator(`#n-${secondStep.id}-${second.id}`).pressSequentially('X ');
    check(
      'the cursor never moved while saving',
      (await tab.inputValue(`#n-${secondStep.id}-${second.id}`)) === `X ${note}`
    );
    await tab.locator('#overall').pressSequentially('Remarque générale');
    check(
      'the overall remark is stored while being typed',
      (await stored()).overallNote === 'Remarque générale'
    );
    const before = await stored();

    await tab.reload({ waitUntil: 'load' });
    const after = await stored();
    check('the same run is back after an immediate reload', after && after.runId === before.runId);
    check('steps visible after the reload', (await display('steps')) !== 'none');
    check('Seen restored', await tab.locator(`#e-${step.id}-${first.id}-passed`).isChecked());
    check(
      'Not seen restored',
      await tab.locator(`#e-${secondStep.id}-${second.id}-failed`).isChecked()
    );
    check(
      'note restored',
      (await tab.inputValue(`#n-${secondStep.id}-${second.id}`)) === `X ${note}`
    );
    check('overall remark restored', (await tab.inputValue('#overall')) === 'Remarque générale');
    check(
      'tester restored in the bar',
      (await text('bar-tester')) === T.runBy.replace('{tester}', 'Test QA')
    );
    check(
      'progress recomputed from the restored answers',
      (await tab.getAttribute('#meter', 'aria-valuenow')) === expected
    );

    // Finishing with a line unanswered is questioned on the page, not in a dialog a host may swallow.
    await tab.click('#btn-finish');
    check(
      'unanswered lines are said on the page before finishing',
      (await text('end-state')) === T.confirmUnanswered.replace('{n}', String(total - 2))
    );
    check('and the run is not finished yet', (await stored()).finishedAt === null);
    await tab.click('#btn-finish');
    check('the second click finishes', typeof (await stored()).finishedAt === 'string');
    check('finished is not accepted', (await text('end-state')) === T.finishedNote);
    check('no page error', errors.length === 0, errors);

    // Storage refused: the page must say so, must never print "saved", and must still let the run out.
    const blocked = await browser.newContext({ locale: 'fr-FR' });
    await blocked.addInitScript(() => {
      Storage.prototype.setItem = () => {
        throw new Error('QuotaExceededError');
      };
    });
    const refused = await blocked.newPage();
    const refusedErrors = [];
    refused.on('pageerror', (error) => refusedErrors.push(error.message));
    await refused.goto(origin, { waitUntil: 'load' });
    await refused.fill('#tester', 'Test QA');
    await refused.click('#btn-start');
    const status = await refused.locator('#save-state').textContent();
    check('a refused write is reported', status === T.saveFailed, status);
    check('and never presented as saved', !status.includes(T.savedLocal));
    await refused.locator(pill(step.id, first.id, 'passed')).click();
    check(
      'a tick after the refusal is still reported as unsaved',
      (await refused.locator('#save-state').textContent()) === T.saveFailed
    );
    const download = refused.waitForEvent('download', { timeout: 10000 });
    await refused.click('#btn-save');
    const file = await download;
    const exportedRun = JSON.parse(fs.readFileSync(await file.path(), 'utf8'));
    check(
      'the run still exports from a browser that keeps nothing',
      exportedRun.tester === 'Test QA' &&
        exportedRun.steps[step.id].expect[first.id].state === 'passed',
      file.suggestedFilename()
    );
    check('no page error with storage refused', refusedErrors.length === 0, refusedErrors);
    await blocked.close();
    await context.close();
  } finally {
    if (browser) await browser.close();
    server.close();
  }

  if (out) fs.writeFileSync(path.resolve(out), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(
    `uat page: ${report.checks.length} checks held in a real browser (${spec.id}, ${page.sha256.slice(0, 12)})`
  );
  return report;
}

main().catch((error) => {
  console.error(`uat page browser check: ${error.message}`);
  process.exit(1);
});
