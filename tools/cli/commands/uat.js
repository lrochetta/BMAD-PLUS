/** Build, serve and read human acceptance recipes (recette); the gate stays evidence-bound. */
'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { URL } = require('node:url');
const yaml = require('js-yaml');
const uat = require('../lib/uat');

const MAX_BODY = 4 * 1024 * 1024;
const RUN_ID = /^[0-9a-z][0-9a-z-]{0,63}$/;

function fail(message) {
  throw new Error(message);
}

function resolveSpec(target, paths) {
  if (!target) fail('an id or a spec file is required');
  if (target.endsWith('.json')) {
    const file = path.resolve(target);
    if (!fs.existsSync(file)) fail(`no spec at ${file}`);
    return uat.loadSpec(file);
  }
  const direct = path.join(paths.specs, `${target}.json`);
  if (fs.existsSync(direct)) return uat.loadSpec(direct);
  // A recipe is named by its id, not by its file: a copied template keeps its own name
  // (the shipped example-uat-spec.json holds the id example-1.0.0).
  if (fs.existsSync(paths.specs)) {
    for (const name of fs.readdirSync(paths.specs).filter((entry) => entry.endsWith('.json'))) {
      try {
        const loaded = uat.loadSpec(path.join(paths.specs, name));
        if (loaded.spec.id === target) return loaded;
      } catch {
        // an unreadable file cannot be the recipe asked for
      }
    }
  }
  fail(`no spec with the id "${target}" in ${paths.specs}`);
  return null;
}

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    fail('nothing on standard input');
    return '';
  }
}

function print(json, payload, lines) {
  if (json) console.log(JSON.stringify({ schemaVersion: 1, ...payload }, null, 2));
  else for (const line of lines) console.log(line);
}

function runsFor(spec, paths) {
  const dir = path.join(paths.results, spec.id);
  return uat.readRuns(fs.existsSync(dir) ? dir : paths.results, spec);
}

function triageFile(spec, paths) {
  return path.join(paths.triage, `${spec.id}.json`);
}

/** The project's communication language, so a tester reads the page in their own. */
function projectLanguage(projectDir) {
  try {
    const config = yaml.load(
      fs.readFileSync(path.join(projectDir, '_bmad', 'config.yaml'), 'utf8')
    );
    return (config && config.communication_language) || null;
  } catch {
    return null;
  }
}

function serve(spec, paths, options) {
  const page = path.join(paths.pages, `uat-${spec.id}.html`);
  if (!fs.existsSync(page)) fail(`no page at ${page} — run "bmad-plus uat build ${spec.id}" first`);
  const html = fs.readFileSync(page);
  const resultsDir = path.join(paths.results, spec.id);
  fs.mkdirSync(resultsDir, { recursive: true });
  const port = Number.parseInt(options.port || '4173', 10);

  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    const send = (code, body, type = 'application/json') => {
      response.writeHead(code, { 'content-type': type, 'cache-control': 'no-store' });
      response.end(body);
    };
    // Loopback is not enough against the tester's own browser: a name rebound to 127.0.0.1
    // is same-origin for it. Only the two names this server answers to are served.
    const host = String(request.headers.host || '').toLowerCase();
    const bound = server.address() ? server.address().port : port;
    if (host !== `127.0.0.1:${bound}` && host !== `localhost:${bound}`) {
      return send(403, JSON.stringify({ error: 'unexpected host' }));
    }
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      return send(200, html, 'text/html; charset=utf-8');
    }
    if (request.method === 'GET' && url.pathname === '/__uat/ping') {
      return send(
        200,
        JSON.stringify({ uat: true, specId: spec.id, specSha256: uat.specHash(spec) })
      );
    }
    if (request.method === 'PUT' && url.pathname.startsWith('/__uat/results/')) {
      const runId = url.pathname.slice('/__uat/results/'.length);
      if (!RUN_ID.test(runId)) return send(400, JSON.stringify({ error: 'invalid runId' }));
      let size = 0;
      const chunks = [];
      request.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_BODY) {
          request.destroy();
          return;
        }
        chunks.push(chunk);
      });
      request.on('end', () => {
        try {
          const run = uat.normalizeRun(JSON.parse(Buffer.concat(chunks).toString('utf8')), spec);
          if (run.runId !== runId || run.specId !== spec.id)
            fail('run identity does not match the request');
          // The page's rule holds on disk too: a copy older than the file never replaces it.
          const file = path.join(resultsDir, `${runId}.json`);
          if (fs.existsSync(file)) {
            let existing = null;
            try {
              existing = JSON.parse(fs.readFileSync(file, 'utf8'));
            } catch {
              existing = null;
            }
            const was = Date.parse(existing && existing.updatedAt);
            const now = Date.parse(run.updatedAt);
            if (!Number.isNaN(was) && (Number.isNaN(now) || was > now)) {
              send(
                409,
                JSON.stringify({
                  error: 'a newer copy of this run is already stored',
                  updatedAt: existing.updatedAt,
                })
              );
              return;
            }
          }
          fs.writeFileSync(file, JSON.stringify(run, null, 2));
          const s = run.summary;
          console.log(
            `${new Date().toISOString().slice(11, 19)}  ${runId} — ${s.passed} passed, ${s.failed} failed, ${s.blocked} blocked, ${s.unanswered} to do${run.finishedAt ? ' — finished' : ''}`
          );
          send(200, JSON.stringify({ stored: runId }));
        } catch (error) {
          send(400, JSON.stringify({ error: error.message }));
        }
      });
      return undefined;
    }
    return send(404, JSON.stringify({ error: 'not found' }));
  });

  // Loopback only: a tester on another machine uses the artifact or the file (decision D5).
  server.listen(port, '127.0.0.1', () => {
    console.log(
      `uat serve: http://127.0.0.1:${server.address().port}  (${spec.id}, ${spec.steps.length} steps)`
    );
    console.log(`results → ${resultsDir}`);
    console.log('Ctrl+C to stop.');
  });
  return server;
}

module.exports = {
  command: 'uat <action> [target]',
  aliases: ['recette'],
  description: 'Human acceptance recipes: lint, build, serve, import, read, gate, order',
  options: [
    ['-d, --directory <path>', 'Project directory'],
    ['--dir <path>', 'Recipe folder inside the project', uat.DEFAULT_DIR],
    [
      '--src <path>',
      'Source folder checked for on-screen labels (repeatable)',
      (value, all) => [...all, value],
      [],
    ],
    ['--language <code>', 'Page language (code or name); defaults to the project language'],
    ['--input <file>', 'Results file to import ("-" reads standard input)'],
    ['--port <number>', 'Port for serve (loopback only)'],
    ['--emit-check', 'Write the self-contained Nexus verifier next to the recipe'],
    ['--json', 'Machine-readable output'],
  ],
  action: (action, target, options = {}) => {
    const projectDir = path.resolve(options.directory || process.cwd());
    const paths = uat.layout(projectDir, options.dir || uat.DEFAULT_DIR);
    const json = Boolean(options.json);
    try {
      if (action === 'lint') {
        const { spec, legacy } = resolveSpec(target, paths);
        const report = uat.lintSpec(spec, { sources: options.src });
        print(json, { action, specId: spec.id, legacy, ...report }, [
          `${spec.id}: ${spec.steps.length} steps, ${spec.steps.reduce((n, s) => n + s.expect.length, 0)} expectations, ${report.labels} on-screen labels${report.scannedFiles ? ` checked against ${report.scannedFiles} source files` : ''}`,
          ...report.errors.map((line) => `  error   ${line}`),
          ...report.warnings.map((line) => `  warning ${line}`),
          report.errors.length ? '' : '  no error',
        ]);
        process.exitCode = report.errors.length ? 1 : 0;
        return;
      }

      if (action === 'build') {
        const { spec } = resolveSpec(target, paths);
        const report = uat.lintSpec(spec, { sources: options.src });
        if (report.errors.length) {
          print(json, { action, specId: spec.id, status: 'error', errors: report.errors }, [
            `${spec.id}: not built, ${report.errors.length} error(s)`,
            ...report.errors.map((line) => `  error   ${line}`),
          ]);
          process.exitCode = 1;
          return;
        }
        let page;
        try {
          page = uat.buildPage(spec, {
            language: options.language || projectLanguage(projectDir),
          });
        } catch (error) {
          // A refused page reads like a refused lint: same shape, so a machine reader sees a refusal, not a crash.
          print(
            json,
            { action, specId: spec.id, status: 'error', errors: [error.message], guarantees: [] },
            [`${spec.id}: not built`, `  error   ${error.message}`]
          );
          process.exitCode = 1;
          return;
        }
        fs.mkdirSync(paths.pages, { recursive: true });
        const file = path.join(paths.pages, `uat-${spec.id}.html`);
        fs.writeFileSync(file, page.html, 'utf8');
        print(
          json,
          {
            action,
            specId: spec.id,
            file,
            specSha256: page.sha256,
            language: page.language,
            languages: Object.keys(uat.STRINGS),
            guarantees: page.guarantees,
            warnings: report.warnings,
          },
          [
            `${file} — ${spec.steps.length} steps, ${(page.html.length / 1024).toFixed(0)} KiB, spec ${page.sha256.slice(0, 12)}`,
            `opens in ${uat.STRINGS[page.language].name}; the tester can switch to any of the ${Object.keys(uat.STRINGS).length} languages on the page`,
            `carries the ${page.guarantees.length} page guarantees: ${page.guarantees.join(', ')}`,
            ...report.warnings.map((line) => `  warning ${line}`),
          ]
        );
        return;
      }

      if (action === 'serve') {
        const { spec } = resolveSpec(target, paths);
        serve(spec, paths, options);
        return;
      }

      if (action === 'import') {
        const { spec } = resolveSpec(target, paths);
        if (!options.input) fail('--input <file> or --input - is required');
        const fromStdin = options.input === '-';
        const source = fromStdin
          ? readStdin()
          : fs.readFileSync(path.resolve(options.input), 'utf8');
        const document = JSON.parse(source);
        // The first artifact exports carried neither runId nor specId; the file name holds the run.
        if (!document.runId && !fromStdin) {
          const marked = /(\d{8}-[0-9a-z-]+)$/.exec(path.basename(options.input, '.json'));
          if (marked) document.runId = marked[1];
        }
        if (!document.specId) document.specId = spec.id;
        const run = uat.normalizeRun(document, spec);
        if (run.specId !== spec.id) fail(`these results answer ${run.specId}, not ${spec.id}`);
        const dir = path.join(paths.results, spec.id);
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, `${run.runId}.json`);
        fs.writeFileSync(file, JSON.stringify(run, null, 2));
        print(json, { action, specId: spec.id, runId: run.runId, file, summary: run.summary }, [
          `${file} — ${run.summary.passed} passed, ${run.summary.failed} failed, ${run.summary.blocked} blocked, ${run.summary.unanswered} to do`,
        ]);
        return;
      }

      if (action === 'read') {
        const { spec } = resolveSpec(target, paths);
        const runs = runsFor(spec, paths);
        if (!runs.length) {
          print(json, { action, specId: spec.id, status: 'awaiting', runs: [] }, [
            `${spec.id}: no run yet`,
          ]);
          process.exitCode = 2;
          return;
        }
        const payload = runs.map((run) => ({
          runId: run.runId,
          tester: run.tester,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
          stale: run.stale,
          unsigned: run.unsigned,
          summary: run.summary,
          failures: uat.failures(run, spec),
          unanswered: uat.unanswered(run, spec),
          overallNote: run.overallNote,
          file: run.file,
        }));
        const lines = [];
        for (const run of payload) {
          const s = run.summary;
          lines.push('');
          lines.push(
            `■ ${spec.product} ${spec.versions.join(' · ')} — ${run.tester} — ${String(run.startedAt).slice(0, 16).replace('T', ' ')}${run.finishedAt ? ', finished' : ', IN PROGRESS'}`
          );
          lines.push(
            `  ${s.passed} passed · ${s.failed} failed · ${s.blocked} blocked · ${s.skipped} skipped · ${s.unanswered} to do   (${run.file})`
          );
          if (run.stale)
            lines.push('  ⚠ answered another revision of the spec — replay the affected steps');
          else if (run.unsigned)
            lines.push('  ⚠ run without a spec fingerprint (page built before fingerprints)');
          if (run.overallNote) lines.push(`  overall: ${run.overallNote}`);
          for (const failure of run.failures) {
            lines.push(
              `  ✗ ${failure.step}/${failure.expect} (${failure.state}) — ${failure.title}`
            );
            if (failure.missingFromSpec)
              lines.push('      expectation: ABSENT from the current spec');
            else if (failure.text) lines.push(`      expectation: ${failure.text}`);
            lines.push(
              failure.note
                ? `      seen instead: ${failure.note.replace(/\s+/g, ' ').trim()}`
                : '      (no note — ask the tester what they saw)'
            );
          }
          if (!run.failures.length) lines.push('  ✓ nothing failed');
        }
        print(json, { action, specId: spec.id, runs: payload }, lines);
        process.exitCode = payload[0].stale
          ? 3
          : payload.some((run) => run.failures.length)
            ? 1
            : 0;
        return;
      }

      if (action === 'gate') {
        const { spec } = resolveSpec(target, paths);
        const runs = runsFor(spec, paths);
        const triage = uat.loadTriage(triageFile(spec, paths));
        const verdict = uat.gate({ spec, runs, triage });
        let check = null;
        if (options.emitCheck) {
          fs.mkdirSync(paths.checks, { recursive: true });
          check = path.join(paths.checks, `gate-${spec.id}.cjs`);
          fs.writeFileSync(
            check,
            uat.emitCheck({
              specId: spec.id,
              specSha256: uat.specHash(spec),
              dir: options.dir || uat.DEFAULT_DIR,
              writeSteps: spec.steps.filter((step) => step.writes).map((step) => step.id),
            }),
            'utf8'
          );
        }
        print(
          json,
          {
            action,
            specId: spec.id,
            status: verdict.status,
            reasons: verdict.reasons,
            runId: verdict.run?.runId || null,
            check,
          },
          [
            `${spec.id}: ${verdict.status}${verdict.run ? ` (run ${verdict.run.runId} by ${verdict.run.tester})` : ''}`,
            ...verdict.reasons.map((reason) => `  - ${reason}`),
            check ? `  verifier: ${check}` : '',
            verdict.status === 'passed'
              ? '  human-observed: complete, current and triaged. It does not establish that the tester looked at the right place.'
              : '',
          ].filter(Boolean)
        );
        process.exitCode = { passed: 0, failed: 1, awaiting: 2, stale: 3 }[verdict.status];
        return;
      }

      if (action === 'order') {
        const specs = (fs.existsSync(paths.specs) ? fs.readdirSync(paths.specs) : [])
          .filter((name) => name.endsWith('.json'))
          .map((name) => uat.loadSpec(path.join(paths.specs, name)).spec);
        if (!specs.length) fail(`no spec in ${paths.specs}`);
        const { order, collisions, cycles } = uat.playOrder(specs);
        const body = [
          '# Play order',
          '',
          'Generated by `bmad-plus uat order`. A witness written by one recipe and read by another',
          'decides the order; a step meant "for later" belongs to its own page.',
          '',
          ...order.map((id, index) => `${index + 1}. \`${id}\``),
          '',
          ...(collisions.length
            ? [
                '## Shared witnesses',
                '',
                ...collisions.map(
                  (c) =>
                    `- \`${c.witness}\`: written by \`${c.writtenBy}\`, read by \`${c.readBy}\``
                ),
                '',
              ]
            : []),
          ...(cycles.length
            ? ['## Cycles — decide by hand', '', ...cycles.map((c) => `- ${c}`), '']
            : []),
        ].join('\n');
        fs.mkdirSync(paths.root, { recursive: true });
        const file = path.join(paths.root, 'ORDER.md');
        fs.writeFileSync(file, body, 'utf8');
        print(json, { action, order, collisions, cycles, file }, [
          file,
          ...order.map((id, index) => `${index + 1}. ${id}`),
          ...cycles.map((c) => `cycle: ${c}`),
        ]);
        process.exitCode = cycles.length ? 1 : 0;
        return;
      }

      fail(`unknown action "${action}" (lint, build, serve, import, read, gate, order)`);
    } catch (error) {
      if (json)
        console.log(
          JSON.stringify({ schemaVersion: 1, status: 'error', message: error.message }, null, 2)
        );
      else console.error(`uat: ${error.message}`);
      process.exitCode = 1;
    }
  },
};
