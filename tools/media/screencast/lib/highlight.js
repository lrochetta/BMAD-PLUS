/**
 * Keyword highlighting for replayed text. It only adds style tokens to runs; the characters are
 * never changed. Command lines: program, subcommand, flags, quoted values. Output lines: status
 * words, ids, box-drawing, list markers.
 */
'use strict';

(function (root) {
  const SUBCOMMANDS = new Set([
    'install',
    'uninstall',
    'update',
    'update-check',
    'update-policy',
    'doctor',
    'intake',
    'swarm',
    'nexus',
    'uat',
    'studio',
    'review',
    'assurance',
    'check',
    'plan',
    'record',
    'render',
    'init',
    'briefs',
    'save',
    'tally',
    'create',
    'launch',
    'collect',
    'verify',
    'accept',
    'inspect',
  ]);
  const PROGRAMS = new Set([
    'bmad-plus',
    'npx',
    'sed',
    'ls',
    'cat',
    'tail',
    'echo',
    'mkdir',
    'cp',
    'for',
    'grep',
    'awk',
  ]);

  /** Split a command line into styled runs. */
  function highlightCommand(cmd) {
    const runs = [];
    const push = (t, c) => {
      if (t) runs.push({ t, c });
    };
    const re = /("[^"]*"|'[^']*')|(\s+)|(\$\??\w*|;|\||>>?)|([^\s;|>"']+)/g;
    let match;
    let seenProgram = false;
    let seenSub = false;
    let previous = '';
    while ((match = re.exec(cmd))) {
      const [token, quoted, space, shell, word] = match;
      if (quoted) push(token, 's-str');
      else if (space) push(token, '');
      else if (shell) {
        push(token, token[0] === '$' ? 's-flag' : 's-dim');
        if (token === ';' || token === '|') {
          seenProgram = false;
          seenSub = false;
        }
      } else if (word) {
        if (word.startsWith('--') || /^-[a-z]$/i.test(word)) push(word, 's-flag');
        else if (!seenProgram && PROGRAMS.has(word)) {
          push(word, 's-prog');
          seenProgram = word !== 'npx';
          if (word === 'npx') seenProgram = false;
        } else if (previous === 'npx' && word === 'bmad-plus') {
          push(word, 's-prog');
          seenProgram = true;
        } else if (seenProgram && !seenSub && SUBCOMMANDS.has(word)) {
          push(word, 's-sub');
          if (word !== 'intake' && word !== 'swarm' && word !== 'nexus') seenSub = true;
        } else if (
          seenProgram &&
          SUBCOMMANDS.has(word) &&
          /^(plan|record|render|check|init|briefs|save|tally|create|launch|collect|verify|accept|inspect)$/.test(
            word
          )
        ) {
          push(word, 's-sub');
          seenSub = true;
        } else push(word, '');
        previous = word;
      }
    }
    return runs;
  }

  const GOOD =
    /(\d+\/\d+ checks passed|\bpassed\b|\bready\b|\bvalid answers?\b|\bfiled\b|\baccepted\b|\bcompleted\b|Nothing to update|preserved|\bremoved\b|\bRecorded\b|Brief written|Installation complete|is ready|exit code: 0|\bupdated\b|applied|\bcounted\b)/g;
  const BAD =
    /(needs approval|not ready|\bmissing\b|\binvalid\b|refused|\bfailed\b|\bpending\b|exit code: [1-9]\d*|conflicts?|partially)/g;
  const IDS = /(\bB\d{3}\b|buyer-panel-\d{8}-\w{4}|\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f-]{23,}\b)/g;
  const MARKS =
    /(\[(?:choice|text|number)\]|\(must-have[^)]*\)|\bMust-haves still open:|\bDisclosure:|\bUnknown:)/g;

  function paint(runs, pattern, cls) {
    const out = [];
    for (const run of runs) {
      if (run.c) {
        out.push(run);
        continue;
      }
      let last = 0;
      pattern.lastIndex = 0;
      let m;
      while ((m = pattern.exec(run.t))) {
        if (m.index > last) out.push({ t: run.t.slice(last, m.index), c: '' });
        out.push({ t: m[0], c: cls });
        last = m.index + m[0].length;
        if (m[0].length === 0) pattern.lastIndex += 1;
      }
      if (last < run.t.length) out.push({ t: run.t.slice(last), c: '' });
    }
    return out;
  }

  /** Style one line of command output. */
  function highlightOutput(line) {
    let runs = [{ t: line, c: '' }];
    if (/^[\s]*[┌└├│╮╯╭╰─]/.test(line) || /^[\s]*[|+]/.test(line)) {
      const m = /^([\s]*[┌└├│╮╯╭╰─|+]+)(.*)$/.exec(line);
      runs = [
        { t: m[1], c: 's-dim' },
        { t: m[2], c: '' },
      ];
      // The side bars at the end of a boxed line are dim too.
      const tail = /^(.*?)([\s]*[│|]\s*|[\s─]*[╮╯])$/.exec(m[2]);
      if (tail && tail[2].trim())
        runs = [runs[0], { t: tail[1], c: '' }, { t: tail[2], c: 's-dim' }];
    }
    runs = paint(runs, /([◇✅])/g, 's-ok');
    runs = paint(runs, /(▲)/g, 's-warn');
    runs = paint(runs, /(■)/g, 's-bad');
    runs = paint(runs, /(●)/g, 's-info');
    runs = paint(runs, /(◆)/g, 's-acc');
    runs = paint(runs, GOOD, 's-ok');
    runs = paint(runs, BAD, 's-warn');
    runs = paint(runs, MARKS, 's-acc');
    runs = paint(runs, IDS, 's-id');
    return runs;
  }

  const api = { highlightCommand, highlightOutput };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.SC = root.SC || {}).highlight = api;
})(globalThis);
