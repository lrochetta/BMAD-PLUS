/** Pure logic of the screencast renderer: timing, cells, terminal replay, highlight, scenes. */
'use strict';

const path = require('node:path');

const lib = (name) => require(path.resolve(__dirname, '../../tools/media/screencast/lib', name));
const timing = lib('timing');
const cells = lib('cells');
const vt = lib('vt');
const highlight = lib('highlight');
const markdown = lib('markdown');
const scene = lib('scene');

describe('timing', () => {
  test('the seeded generator and the typing cadence are deterministic', () => {
    const a = timing.typingTimes('bmad-plus doctor --directory demo', timing.mulberry32(7));
    const b = timing.typingTimes('bmad-plus doctor --directory demo', timing.mulberry32(7));
    const c = timing.typingTimes('bmad-plus doctor --directory demo', timing.mulberry32(8));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(timing.hashSeed('scene:1')).toBe(timing.hashSeed('scene:1'));
    expect(timing.hashSeed('scene:1')).not.toBe(timing.hashSeed('scene:2'));
  });

  test('typing is strictly increasing, variable, and capped by maxSeconds', () => {
    const times = timing.typingTimes('x'.repeat(200), timing.mulberry32(1), { maxSeconds: 2 });
    expect(times).toHaveLength(200);
    for (let i = 1; i < times.length; i += 1) expect(times[i]).toBeGreaterThan(times[i - 1]);
    expect(times[times.length - 1]).toBeLessThanOrEqual(2 + 1e-9);
    const gaps = new Set(times.slice(1).map((t, i) => (t - times[i]).toFixed(4)));
    expect(gaps.size).toBeGreaterThan(20);
  });

  test('followScroll reaches its target and is exact between events', () => {
    const events = [{ t: 1, target: 10 }];
    expect(timing.followScroll(events, 0.5)).toBe(0);
    const mid = timing.followScroll(events, 1.22, 0.22);
    expect(mid).toBeCloseTo(10 * (1 - Math.exp(-1)), 6);
    expect(timing.followScroll(events, 30)).toBeCloseTo(10, 6);
    // Same value no matter how often it is asked.
    expect(timing.followScroll(events, 1.22, 0.22)).toBe(mid);
  });

  test('windowWeight ramps up, holds and ramps down', () => {
    expect(timing.windowWeight(0, 1, 0.5, 1, 0.5)).toBe(0);
    expect(timing.windowWeight(1.25, 1, 0.5, 1, 0.5)).toBeGreaterThan(0);
    expect(timing.windowWeight(1.25, 1, 0.5, 1, 0.5)).toBeLessThan(1);
    expect(timing.windowWeight(2, 1, 0.5, 1, 0.5)).toBe(1);
    expect(timing.windowWeight(3.2, 1, 0.5, 1, 0.5)).toBe(0);
  });
});

describe('cells', () => {
  test('widths: ascii 1, emoji 2, flags are one two-cell cluster, marks 0', () => {
    expect(cells.textWidth('abc')).toBe(3);
    expect(cells.textWidth('✅')).toBe(2);
    expect(cells.textWidth('🛡️')).toBe(2);
    expect(cells.clusters('🇬🇧 English')[0]).toBe('🇬🇧');
    expect(cells.textWidth('🇬🇧')).toBe(2);
    expect(cells.textWidth('│')).toBe(1);
    expect(cells.clusterWidth('́')).toBe(0);
  });

  test('wrapRuns breaks at spaces, keeps styles and hangs list items', () => {
    const runs = [
      { t: '  - name ', c: 's-dim' },
      { t: 'word '.repeat(12).trim(), c: '' },
    ];
    const rows = cells.wrapRuns(runs, 30);
    expect(rows.length).toBeGreaterThan(1);
    for (const row of rows) expect(cells.textWidth(cells.runsText(row))).toBeLessThanOrEqual(30);
    expect(cells.runsText(rows[1]).startsWith('    ')).toBe(true);
    expect(rows[0][0].c).toBe('s-dim');
  });

  test('box-drawing lines are cut hard and a short line is untouched', () => {
    const box = '│' + 'a'.repeat(50);
    const rows = cells.wrapRuns([{ t: box, c: '' }], 20);
    expect(cells.runsText(rows[0])).toHaveLength(20);
    expect(cells.wrapRuns([{ t: 'short', c: '' }], 20)).toHaveLength(1);
  });

  test('sliceRuns keeps the first clusters only', () => {
    const sliced = cells.sliceRuns(
      [
        { t: 'ab', c: 'x' },
        { t: 'cd', c: 'y' },
      ],
      3
    );
    expect(cells.runsText(sliced)).toBe('abc');
  });
});

describe('vt replay', () => {
  const ESC = '\u001b';

  test('plain text, colours and line feeds', () => {
    const frames = vt.replay([{ t: 0.1, data: `${ESC}[32mok${ESC}[39m done\r\nnext\r\n` }], 40);
    expect(frames).toHaveLength(1);
    const rows = frames[0].rows;
    expect(cells.runsText(rows[0])).toBe('ok done');
    expect(rows[0][0].c).toBe('f32');
    expect(cells.runsText(rows[1])).toBe('next');
  });

  test('cursor up and erase down redraw a prompt in place (the clack pattern)', () => {
    const first = `one\r\ntwo\r\nthree\r\n`;
    const redraw = `${ESC}[999D${ESC}[3A${ESC}[J` + `one\r\nTWO\r\nthree\r\n`;
    const frames = vt.replay(
      [
        { t: 0.1, data: first },
        { t: 0.2, data: redraw },
      ],
      40
    );
    expect(frames).toHaveLength(2);
    expect(frames[1].rows.map((r) => cells.runsText(r))).toEqual(['one', 'TWO', 'three']);
  });

  test('wide cells keep columns aligned and unknown sequences are ignored', () => {
    const frames = vt.replay(
      [{ t: 0, data: `${ESC}[?25l✅ a${ESC}[2K${ESC}[Gx\r\n${ESC}[?25h` }],
      20
    );
    expect(frames[0].rows.map((r) => cells.runsText(r))).toEqual(['x']);
    const wide = vt.replay([{ t: 0, data: '✅ ab' }], 20);
    expect(wide[0].rows[0][0].t).toContain('✅');
  });

  test('an unchanged screen produces no new frame', () => {
    const frames = vt.replay(
      [
        { t: 0.1, data: 'a' },
        { t: 0.2, data: `${ESC}[?25h` },
      ],
      10
    );
    expect(frames).toHaveLength(1);
  });
});

describe('highlight', () => {
  test('commands: program, subcommand, flags and quoted values keep their text', () => {
    const cmd = 'npx bmad-plus intake record --set "job=Spot late invoices" --default x';
    const runs = highlight.highlightCommand(cmd);
    expect(cells.runsText(runs)).toBe(cmd);
    const byText = Object.fromEntries(runs.map((r) => [r.t, r.c]));
    expect(byText['bmad-plus']).toBe('s-prog');
    expect(byText.intake).toBe('s-sub');
    expect(byText['--set']).toBe('s-flag');
    expect(byText['"job=Spot late invoices"']).toBe('s-str');
  });

  test('output: status words are marked and the line is unchanged', () => {
    const line = '│  87/87 checks passed   │';
    const runs = highlight.highlightOutput(line);
    expect(cells.runsText(runs)).toBe(line);
    expect(runs.some((r) => r.c === 's-ok' && r.t.includes('87/87 checks passed'))).toBe(true);
    const warn = highlight.highlightOutput('B010  missing: no answer file');
    expect(warn.some((r) => r.c === 's-warn' && r.t === 'missing')).toBe(true);
    expect(warn.some((r) => r.c === 's-id' && r.t === 'B010')).toBe(true);
  });
});

describe('markdown', () => {
  const source = [
    '> Simulated units are not people.',
    '',
    '# Title (run x)',
    '<!-- hidden -->',
    '',
    '| group | yes |',
    '|---|---|',
    '| all | 4 |',
    '',
    '- B001: "it is <b>fine</b>"',
    '',
    'Answer:',
    '    dashboard',
  ].join('\n');

  test('blocks, comments dropped and every character escaped', () => {
    const blocks = markdown.parseMarkdown(source);
    expect(blocks.map((b) => b.type)).toEqual(['quote', 'h1', 'table', 'li', 'p']);
    expect(blocks.some((b) => b.html.includes('hidden'))).toBe(false);
    const item = blocks.find((b) => b.type === 'li');
    expect(item.html).toContain('&lt;b&gt;fine&lt;/b&gt;');
    expect(item.text).toContain('B001');
    expect(blocks.find((b) => b.type === 'table').text).toContain('all 4');
  });

  test('JSON lines keep one block per line', () => {
    const blocks = markdown.parseJsonLines('{\n  "scope": ["a"],\n  "n": 2\n}\n');
    expect(blocks).toHaveLength(4);
    expect(blocks[1].text).toBe('  "scope": ["a"],');
    expect(blocks[1].html).toContain('class="jk"');
  });
});

describe('scene compiler', () => {
  const transcript = {
    steps: [
      {
        cmd: 'bmad-plus doctor',
        ms: 300,
        exitCode: 0,
        output: 'one\ntwo\n87/87 checks passed\nfour',
      },
      { cmd: 'echo hi', ms: 20, exitCode: 0, output: '' },
    ],
  };
  const spec = {
    id: 'unit',
    type: 'terminal',
    transcript: 't',
    seed: 4,
    steps: [
      { ref: 0, focus: [{ match: '87/87 checks passed', zoom: 1.5 }] },
      { ref: 1, type: { max: 0.5 } },
    ],
  };

  test('same input, same timeline and same frames', () => {
    const a = scene.compileScene(spec, { t: transcript });
    const b = scene.compileScene(JSON.parse(JSON.stringify(spec)), { t: transcript });
    const duration = scene.duration(a);
    expect(duration).toBe(scene.duration(b));
    for (const t of [0, 0.5, 1.7, duration / 2, duration - 0.1]) {
      expect(JSON.stringify(scene.at(a, t))).toBe(JSON.stringify(scene.at(b, t)));
    }
  });

  test('the command is typed first, then the output streams line by line', () => {
    const c = scene.compileScene(spec, { t: transcript });
    const early = scene.at(c, 0.5);
    expect(early.term.rows[0].runs.map((r) => r.t).join('')).toMatch(/^\$ /);
    const late = scene.at(c, scene.duration(c) - 0.01);
    const text = late.term.rows.map((row) => row.runs.map((r) => r.t).join(''));
    expect(text.join('\n')).toContain('87/87 checks passed');
    expect(text.join('\n')).toContain('$ echo hi');
  });

  test('the camera zooms on the focus line with a ring, and returns to rest', () => {
    const c = scene.compileScene(spec, { t: transcript });
    const [window] = scene.resolveWindows(c);
    const inside = scene.at(c, window.start + window.rampIn + 0.1);
    expect(inside.camera.z).toBeCloseTo(1.5, 1);
    expect(inside.ring.opacity).toBeGreaterThan(0.9);
    expect(scene.at(c, 0.05).ring).toBeNull();
    expect(scene.at(c, 0.05).camera.z).toBeLessThan(1.03);
  });

  test('a focus text that is not in the output fails loudly', () => {
    const bad = { ...spec, steps: [{ ref: 0, focus: [{ match: 'not there' }] }] };
    const c = scene.compileScene(bad, { t: transcript });
    expect(() => scene.duration(c)).toThrow('focus text not found');
  });

  test('collapse replaces only the named lines and says so', () => {
    const collapsed = {
      ...spec,
      steps: [{ ref: 0, collapse: [{ from: 0, to: 1, label: '… {n} lines' }] }],
    };
    const c = scene.compileScene(collapsed, { t: transcript });
    const state = scene.at(c, scene.duration(c) - 0.01);
    const text = state.term.rows.map((row) => row.runs.map((r) => r.t).join('')).join('\n');
    expect(text).toContain('… 2 lines');
    expect(text).not.toContain('one');
    expect(text).toContain('four');
  });

  test('minDuration stretches a short scene and the geometry fits the columns', () => {
    const short = { ...spec, minDuration: 30, steps: [{ ref: 1 }] };
    const c = scene.compileScene(short, { t: transcript });
    expect(scene.duration(c)).toBe(30);
    const geom = scene.geometry({ type: 'terminal', cols: 78 });
    expect(geom.charW * 78).toBeLessThanOrEqual(geom.term.cw);
    expect(scene.geometry({ type: 'split' }).preview).toBeDefined();
  });

  test('a replayed pty step cuts at the requested text', () => {
    const ESC = '\u001b';
    const pty = {
      steps: [
        {
          cmd: 'install',
          ms: 100,
          tty: { cols: 80, rows: 30 },
          chunks: [
            { t: 0.5, data: 'first\r\n' },
            { t: 0.9, data: `${ESC}[999D${ESC}[2Asecond\r\n` },
            { t: 1.4, data: 'third\r\n' },
          ],
        },
      ],
    };
    const c = scene.compileScene(
      { id: 'pty', type: 'terminal', transcript: 'p', steps: [{ ref: 0, cutAfter: 'second' }] },
      { p: pty }
    );
    const state = scene.at(c, scene.duration(c) - 0.01);
    const text = state.term.rows.map((row) => row.runs.map((r) => r.t).join('')).join('\n');
    expect(text).toContain('second');
    expect(text).not.toContain('third');
  });
});
