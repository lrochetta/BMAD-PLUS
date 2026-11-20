/**
 * Record real BMAD+ command output for the screencasts.
 *
 * Runs INSIDE a throwaway container (see run-capture.sh), never on the laptop. For each scenario
 * it builds a fresh project in /home/dev/app, installs the packed tarball of this checkout one
 * level up (so `npx bmad-plus` resolves to it), runs the listed commands through bash and stores
 * command, merged stdout+stderr, exit code and duration in transcripts/<scenario>.json.
 * Interactive commands run in a real pseudo-terminal with scripted key presses; their raw output
 * chunks and arrival times are stored (lib/vt.js replays them into screens at render time).
 * Nothing is typed by hand: the renderer only ever replays what is stored here.
 *
 * Output cleanup (the only edits, plain commands only): ANSI escape sequences and carriage
 * returns are removed, trailing spaces are trimmed, "npm notice run" lines are dropped. No path,
 * user name or number is rewritten; the container paths (/home/dev/...) are already neutral.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { runInPty } = require('./pty-session');

const OUT = process.env.CAPTURE_OUT || '/out/transcripts';
const FIXTURES = path.join(__dirname, 'fixtures');
const TARBALL = process.env.CAPTURE_TARBALL || '/out/bmad-plus.tgz';
const HOME = process.env.HOME || '/home/dev';
const TOOLS = HOME; // the tarball is installed here, one level above the project
const APP = path.join(HOME, 'app');
const ONLY = process.env.CAPTURE_ONLY ? process.env.CAPTURE_ONLY.split(',') : null;

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;

function clean(text) {
  return text
    .replace(/\r/g, '')
    .replace(ANSI, '')
    .split('\n')
    .filter((line) => !/^npm notice run /.test(line))
    .map((line) => line.trimEnd())
    .join('\n')
    .replace(/\n+$/, '');
}

const ENV = {
  ...process.env,
  HOME,
  PATH: `${path.join(TOOLS, 'node_modules', '.bin')}:${process.env.PATH}`,
  NO_COLOR: '1',
};

function sh(command, cwd = APP) {
  return spawnSync('bash', ['-c', `${command} 2>&1`], {
    cwd,
    encoding: 'utf8',
    env: ENV,
    maxBuffer: 16 * 1024 * 1024,
  });
}

function must(command, cwd) {
  const result = sh(command, cwd);
  if (result.status !== 0) throw new Error(`setup failed: ${command}\n${result.stdout}`);
  return result.stdout;
}

function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
}

function freshProject() {
  fs.rmSync(APP, { recursive: true, force: true });
  fs.rmSync(path.join(TOOLS, 'node_modules'), { recursive: true, force: true });
  fs.rmSync(path.join(HOME, '.bmad-plus'), { recursive: true, force: true });
  fs.writeFileSync(
    path.join(TOOLS, 'package.json'),
    JSON.stringify({ name: 'bmad-tools', version: '1.0.0', private: true }, null, 2) + '\n'
  );
  must(`npm install --ignore-scripts --no-audit --no-fund ${TARBALL}`, TOOLS);
  fs.mkdirSync(APP, { recursive: true });
  must('git init -q', APP);
}

const installSilent = (packs) =>
  `npx bmad-plus install --yes --lang en --packs ${packs} --tools claude-code`;

/** Swarm definition, profile, pitch, brief template and the demo replies, inside the project. */
function swarmFixtures() {
  const dest = path.join(APP, 'swarm');
  for (const name of ['buyer-panel.json', 'profile.json', 'pitch.md']) {
    copy(path.join(FIXTURES, name), path.join(dest, name));
  }
  copy(path.join(FIXTURES, 'briefs', 'buyer.md'), path.join(dest, 'briefs', 'buyer.md'));
  const replies = JSON.parse(fs.readFileSync(path.join(FIXTURES, 'replies.json'), 'utf8'));
  const inbox = path.join(dest, 'inbox');
  fs.mkdirSync(inbox, { recursive: true });
  for (const [id, reply] of Object.entries(replies.valid)) {
    fs.writeFileSync(
      path.join(inbox, `${id}.txt`),
      `As ${id}, here is my answer:\n${JSON.stringify(reply)}\n`
    );
  }
  fs.writeFileSync(path.join(inbox, 'B009.json'), JSON.stringify(replies.refused.B009) + '\n');
}

/** The fan-out files of the case study (the same ones the swarm page of the docs prints). */
function caseStudyFanout() {
  const from = path.join(FIXTURES, 'case-study', 'swarm');
  const dest = path.join(APP, 'swarm');
  for (const name of ['page-fanout.json', 'units.json', 'briefs/page.md']) {
    copy(path.join(from, name), path.join(dest, name));
  }
}

/** Three small pages and one baseline commit, then one line added to a page: something to review. */
function caseStudySite() {
  const pages = {
    'site/about/index.md': '# About us\n\nWe roast coffee and we keep our promises.\n',
    'site/pricing/index.md': '# Pricing\n\nA filter coffee costs 3 euros.\n',
    'site/contact/index.md': '# Contact\n\nWrite to hello@example.com.\n',
  };
  for (const [file, text] of Object.entries(pages)) {
    fs.mkdirSync(path.dirname(path.join(APP, file)), { recursive: true });
    fs.writeFileSync(path.join(APP, file), text);
  }
  must(
    'git add -A && git -c user.name=demo -c user.email=demo@example.com commit -q -m baseline',
    APP
  );
  fs.appendFileSync(path.join(APP, 'site/contact/index.md'), 'Open every weekday.\n');
}

function nexusFixtures(names) {
  for (const name of names) {
    copy(path.join(FIXTURES, 'nexus', name), path.join(APP, name));
  }
  fs.mkdirSync(path.join(APP, 'src'), { recursive: true });
  fs.writeFileSync(path.join(APP, 'src', 'value.json'), '{ "value": 0 }\n');
  fs.mkdirSync(path.join(APP, 'docs'), { recursive: true });
}

/** Key steps for the interactive installer. Each waits for its prompt, then pauses like a person. */
const answerQuestions = (pause) => [
  { until: 'Your first name', delay: pause, key: 'enter' },
  { until: 'Communication language', delay: pause, key: 'enter' },
  { until: 'Test environment', delay: pause, key: 'enter' },
  { until: 'Execution mode', delay: pause, key: 'enter' },
];

const scenarios = [
  {
    id: 'install-quick',
    steps: () => [
      {
        cmd: 'npx bmad-plus install --lang en --packs core,design --tools claude-code',
        pty: { keys: answerQuestions(0.35) },
      },
    ],
  },
  {
    id: 'install-choices',
    steps: () => [
      {
        cmd: 'npx bmad-plus install --lang en',
        pty: {
          keys: [
            { until: 'Which packs', delay: 0.5, key: 'down' },
            { delay: 0.4, key: 'down' },
            { delay: 0.4, key: 'space' },
            { delay: 0.5, key: 'enter' },
            { until: 'Which IDE', delay: 0.5, key: 'space' },
            { delay: 0.45, key: 'enter' },
            ...answerQuestions(0.35),
          ],
        },
      },
    ],
  },
  {
    id: 'packs-select',
    steps: () => [
      {
        cmd: 'npx bmad-plus install --lang en',
        pty: {
          keys: [
            { until: 'Which packs', delay: 1.0, key: 'down' },
            ...Array.from({ length: 8 }, () => ({ delay: 1.35, key: 'down' })),
            { delay: 1.4, key: 'ctrlc' },
          ],
        },
      },
    ],
  },
  {
    id: 'doctor-design',
    setup: [installSilent('core,design')],
    steps: () => [{ cmd: 'bmad-plus doctor' }],
  },
  {
    id: 'intake',
    setup: [installSilent('core,design')],
    steps: () => {
      const intake = '--intake .agents/skills/pack-design/intake.yaml';
      const answers = '--answers _bmad-output/design/intake.json';
      return [
        { cmd: `bmad-plus intake plan ${intake} ${answers}` },
        {
          cmd:
            `bmad-plus intake record ${intake} ${answers} --set surface_kind=dashboard ` +
            `--set "audience=Accountants in a practice, on a desktop, at month end" ` +
            `--set job=UNKNOWN --default design_system`,
        },
        {
          cmd: `bmad-plus intake render ${intake} ${answers} --out _bmad-output/design/brief.md`,
          attach: ['_bmad-output/design/brief.md'],
        },
      ];
    },
  },
  {
    id: 'swarm',
    setup: [installSilent('core')],
    prepare: swarmFixtures,
    steps: () => {
      const init =
        'bmad-plus swarm init --definition swarm/buyer-panel.json --profile swarm/profile.json ' +
        '--context pitch=swarm/pitch.md --n 40';
      return [
        { cmd: `${init} --seed 7; echo "exit code: $?"` },
        {
          cmd: `${init} --seed 7 --approved`,
          capture: { RUN: /^(\S+): panel of/m },
        },
        {
          cmd: 'bmad-plus swarm briefs {{RUN}}',
          attach: ['.bmad-plus/swarm/runs/{{RUN}}/briefs/B001.md'],
        },
        { cmd: 'bmad-plus swarm save {{RUN}} B001 --input swarm/inbox/B001.txt' },
        {
          cmd: 'for n in 2 3 4 5 6 7 8; do bmad-plus swarm save {{RUN}} B00$n --input swarm/inbox/B00$n.txt; done',
        },
        { cmd: 'cp swarm/inbox/B009.json .bmad-plus/swarm/runs/{{RUN}}/answers/B009.json' },
        { cmd: 'bmad-plus swarm check {{RUN}}' },
        {
          cmd: 'bmad-plus swarm tally {{RUN}}',
          attach: ['.bmad-plus/swarm/runs/{{RUN}}/tally.md'],
        },
      ];
    },
  },
  // The case-study video: the five commands of the case-study page, recorded from the PUBLISHED
  // package (CAPTURE_TARBALL=bmad-plus@0.23.0), not from this checkout.
  {
    id: 'cs-install',
    steps: () => [
      {
        cmd: 'npx bmad-plus install --yes --lang en --packs core,design,memory --tools claude-code',
      },
    ],
  },
  {
    id: 'cs-intake',
    setup: [installSilent('core,design,memory')],
    steps: () => {
      const intake = '--intake .agents/skills/pack-design/intake.yaml';
      const answers = '--answers _bmad-output/design/intake.json';
      return [
        {
          cmd:
            `npx bmad-plus intake record ${intake} ${answers} --set surface_kind=landing ` +
            '--set "audience=Urban professionals who buy coffee most days" ' +
            '--set "job=Get a first-time visitor to open a loyalty card"',
        },
      ];
    },
  },
  {
    id: 'cs-swarm',
    setup: [installSilent('core,design,memory')],
    prepare: caseStudyFanout,
    prepared: [
      'swarm/page-fanout.json, swarm/units.json and swarm/briefs/page.md copied into the project (the files printed on the swarm page of the docs)',
    ],
    steps: () => [
      {
        cmd: 'npx bmad-plus swarm init --definition swarm/page-fanout.json --units swarm/units.json',
        capture: { RUN: /^(\S+): fanout of/m },
      },
      { cmd: 'npx bmad-plus swarm briefs {{RUN}}' },
    ],
  },
  {
    id: 'cs-review',
    setup: [installSilent('core,design,memory')],
    prepare: caseStudySite,
    prepared: [
      'three pages written under site/ (about, pricing, contact), one commit named baseline, then one line appended to site/contact/index.md',
    ],
    steps: () => [
      { cmd: 'npx bmad-plus review scope site --workspace --base HEAD' },
      { cmd: 'npx bmad-plus review gate site; echo "exit code: $?"' },
    ],
  },
  {
    id: 'roster',
    setup: [installSilent('all')],
    steps: () => [{ cmd: "sed -n '/^## Agents/,/^## Skills/p' AGENTS.md" }],
  },
  {
    id: 'checklist',
    setup: [installSilent('core,design')],
    steps: () => [{ cmd: "sed -n '7,28p' .agents/skills/design/references/80-preflight.md" }],
  },
  {
    id: 'update',
    // The project starts from the previously published release, then this checkout updates it.
    setup: ['npx --yes bmad-plus@0.22.0 install --yes --lang en --packs core --tools claude-code'],
    steps: () => [
      { cmd: "echo '# my notes' >> .agents/skills/agent-strategist/SKILL.md" },
      { cmd: 'bmad-plus update-check' },
      { cmd: 'bmad-plus update --yes' },
      { cmd: 'tail -n 2 .agents/skills/agent-strategist/SKILL.md' },
    ],
  },
  {
    id: 'uninstall',
    setup: [installSilent('core,design')],
    steps: () => [
      { cmd: "echo '# my notes' >> AGENTS.md" },
      {
        cmd: "mkdir -p .agents/memory && echo 'decision: keep it simple' > .agents/memory/decisions.md",
      },
      { cmd: 'bmad-plus uninstall --yes' },
      { cmd: 'ls AGENTS.md .agents/memory _bmad' },
    ],
  },
  {
    id: 'nexus-plan',
    setup: [installSilent('core')],
    prepare: () => nexusFixtures(['nexus-plan.json', 'checks/value.cjs', 'checks/notes.cjs']),
    steps: () => [
      { cmd: 'bmad-plus nexus create --plan nexus-plan.json', attach: ['nexus-plan.json'] },
      { cmd: 'bmad-plus nexus inspect demo' },
    ],
  },
  {
    id: 'nexus-run',
    setup: [installSilent('core')],
    prepare: () => {
      nexusFixtures([
        'nexus-run.json',
        'checks/value.cjs',
        'workers/value.cjs',
        'inputs/task.json',
      ]);
    },
    steps: () => [
      { cmd: 'bmad-plus nexus create --plan nexus-run.json' },
      { cmd: 'bmad-plus nexus launch demo value' },
      {
        hidden: true,
        // collect needs the exact attempt id and the whole backend object (supervisor pid,
        // host) that launch recorded; read them back from the run's own JSON state.
        run: () => {
          const state = JSON.parse(sh('bmad-plus nexus inspect demo --json').stdout);
          const attempt = state.tasks[0].attempts.at(-1);
          fs.writeFileSync(
            path.join(APP, 'attempt.json'),
            JSON.stringify({ attemptId: attempt.id, backend: attempt.backend }) + '\n'
          );
        },
      },
      { cmd: 'bmad-plus nexus collect demo value --input attempt.json' },
      { cmd: 'bmad-plus nexus verify demo value; echo "exit code: $?"' },
      {
        cmd:
          'bmad-plus nexus inspect demo --json | grep -E \'"(policy|command|exitCode|stdout)": ["0-9]\' ' +
          "| sed 's/^ *//' | awk '!seen[$0]++'",
      },
      { cmd: 'bmad-plus nexus accept demo value' },
    ],
  },
];

function substitute(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (!(key in vars)) throw new Error(`unknown variable ${key}`);
    return vars[key];
  });
}

function environment() {
  const osRelease = fs.existsSync('/etc/os-release')
    ? fs.readFileSync('/etc/os-release', 'utf8')
    : '';
  return {
    container: process.env.CAPTURE_IMAGE || 'node:20-bookworm',
    os: (osRelease.match(/PRETTY_NAME="([^"]+)"/) || [])[1] || process.platform,
    node: process.version,
    bmadPlus: must('npx bmad-plus --version').trim(),
    repoCommit: process.env.CAPTURE_COMMIT || 'unknown',
    project: APP,
    note: /^bmad-plus@/.test(TARBALL)
      ? `The CLI ran from the published package ${TARBALL} (npm registry), installed one level above the throwaway project.`
      : 'The CLI ran from the tarball made by `npm pack` on this checkout, installed one level above the throwaway project.',
  };
}

async function record(scenario) {
  freshProject();
  for (const command of scenario.setup || []) must(command);
  if (scenario.prepare) scenario.prepare();
  const vars = {};
  const steps = [];
  const hiddenSteps = [];
  for (const step of scenario.steps()) {
    if (step.hidden) {
      step.run(vars);
      hiddenSteps.push(String(step.run));
      continue;
    }
    const cmd = substitute(step.cmd, vars);
    const started = Date.now();
    if (step.pty) {
      const keys = step.pty.keys;
      const ptyEnv = { ...ENV };
      delete ptyEnv.NO_COLOR; // a real terminal has colours: some libraries only check that the key exists
      const result = await runInPty(cmd, keys, { cwd: APP, env: ptyEnv });
      steps.push({
        cmd,
        tty: { cols: result.cols, rows: result.rows },
        chunks: result.chunks,
        exitCode: result.exitCode,
        ms: Date.now() - started,
      });
      continue;
    }
    const result = sh(cmd);
    const ms = Date.now() - started;
    const output = clean(result.stdout || '');
    for (const [name, pattern] of Object.entries(step.capture || {})) {
      const found = output.match(pattern);
      if (!found) throw new Error(`could not capture ${name} from: ${output}`);
      vars[name] = found[1];
    }
    const files = (step.attach || []).map((file) => {
      const relative = substitute(file, vars);
      return {
        path: relative,
        content: fs.readFileSync(path.join(APP, relative), 'utf8').replace(/\r/g, ''),
      };
    });
    steps.push({ cmd, output, exitCode: result.status, ms, ...(files.length ? { files } : {}) });
  }
  return {
    schema: 'bmad-plus/screencast-transcript/2',
    id: scenario.id,
    capturedAt: new Date().toISOString(),
    environment: environment(),
    setup: [
      'npm install --ignore-scripts <bmad-plus tarball> (one level above the project)',
      'git init -q',
      ...(scenario.setup || []),
    ],
    ...(scenario.prepared ? { prepared: scenario.prepared } : {}),
    hiddenSteps: hiddenSteps.length
      ? ['attempt.json written from `nexus inspect demo --json` (attempt id and backend identity)']
      : [],
    redactions: [],
    cleanup: [
      'plain commands: ANSI escape sequences and carriage returns removed, trailing spaces trimmed, "npm notice run" lines dropped',
      'interactive commands: raw pty output stored untouched',
    ],
    steps,
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  for (const scenario of scenarios) {
    if (ONLY && !ONLY.includes(scenario.id)) continue;
    const transcript = await record(scenario);
    fs.writeFileSync(
      path.join(OUT, `${scenario.id}.json`),
      JSON.stringify(transcript, null, 2) + '\n'
    );
    console.log(`${scenario.id}: ${transcript.steps.length} steps`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
