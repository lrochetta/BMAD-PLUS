/**
 * Terminal cell arithmetic: grapheme clusters, display width (emoji and CJK take two cells),
 * and word-aware wrapping of styled runs. A run is { t: text, c: space-separated style tokens }.
 */
'use strict';

(function (root) {
  const EMOJI_PRESENTATION = /\p{Emoji_Presentation}/u;
  const isCombining = (cp) =>
    (cp >= 0x300 && cp <= 0x36f) ||
    (cp >= 0x591 && cp <= 0x5c7) ||
    (cp >= 0x200b && cp <= 0x200f) ||
    (cp >= 0xfe00 && cp <= 0xfe0f);
  const VS16 = String.fromCodePoint(0xfe0f);

  function isWideCodePoint(cp) {
    return (
      (cp >= 0x1100 && cp <= 0x115f) ||
      (cp >= 0x2e80 && cp <= 0xa4cf) ||
      (cp >= 0xac00 && cp <= 0xd7a3) ||
      (cp >= 0xf900 && cp <= 0xfaff) ||
      (cp >= 0xfe30 && cp <= 0xfe6f) ||
      (cp >= 0xff00 && cp <= 0xff60) ||
      (cp >= 0xffe0 && cp <= 0xffe6)
    );
  }

  /** Split into clusters: a base code point plus variation selectors, joiners and marks. */
  function clusters(text) {
    const out = [];
    let joinNext = false;
    for (const ch of text) {
      const cp = ch.codePointAt(0);
      const indicator = cp >= 0x1f1e6 && cp <= 0x1f1ff;
      if (indicator && out.length) {
        // Two regional indicators make one flag.
        const previous = Array.from(out[out.length - 1]);
        const pc = previous[0].codePointAt(0);
        if (previous.length === 1 && pc >= 0x1f1e6 && pc <= 0x1f1ff) {
          out[out.length - 1] += ch;
          joinNext = false;
          continue;
        }
      }
      const attaches =
        isCombining(cp) || (cp >= 0x1f3fb && cp <= 0x1f3ff) || cp === 0x200d || joinNext;
      if (attaches && out.length) {
        out[out.length - 1] += ch;
        joinNext = cp === 0x200d;
      } else {
        out.push(ch);
        joinNext = false;
      }
    }
    return out;
  }

  function clusterWidth(cluster) {
    const first = cluster.codePointAt(0);
    if (cluster.includes(VS16)) return 2;
    if (EMOJI_PRESENTATION.test(cluster[0] + (cluster[1] || '')) || first > 0x1f000) return 2;
    if (isWideCodePoint(first)) return 2;
    if (isCombining(first)) return 0;
    return 1;
  }

  function textWidth(text) {
    let width = 0;
    for (const cluster of clusters(text)) width += clusterWidth(cluster);
    return width;
  }

  function runsText(runs) {
    return runs.map((run) => run.t).join('');
  }

  function toCells(runs) {
    const cells = [];
    for (const run of runs) {
      for (const ch of clusters(run.t)) cells.push({ ch, w: clusterWidth(ch), c: run.c || '' });
    }
    return cells;
  }

  function fromCells(cells) {
    const runs = [];
    for (const cell of cells) {
      const last = runs[runs.length - 1];
      if (last && last.c === cell.c) last.t += cell.ch;
      else runs.push({ t: cell.ch, c: cell.c });
    }
    return runs;
  }

  /** First `count` clusters of the runs (used to show a command while it is being typed). */
  function sliceRuns(runs, count) {
    return fromCells(toCells(runs).slice(0, Math.max(0, count)));
  }

  /**
   * Wrap styled runs to `cols` cells. Breaks at the last space when there is one, otherwise
   * inside the word. Continuation rows keep the original indent plus `hang` cells.
   * Lines that start with a box-drawing character are cut hard, never at a space.
   */
  function wrapRuns(runs, cols, options = {}) {
    const cells = toCells(runs);
    const total = cells.reduce((sum, cell) => sum + cell.w, 0);
    if (total <= cols) return [fromCells(cells)];
    const text = cells.map((cell) => cell.ch).join('');
    const hard = /^[│┌└├╭╰─+|]/.test(text);
    let indent = 0;
    while (indent < cells.length && cells[indent].ch === ' ') indent += 1;
    let extra = 0;
    if (options.hang !== undefined) extra = options.hang;
    else if (/^\s*[-*]\s/.test(text)) extra = 2;
    else if (/^[●◆◇▲■└┌]\s\s/.test(text)) extra = 3;
    const hang = indent + extra;
    const rows = [];
    let row = [];
    let width = 0;
    let lastSpace = -1;
    const pad = () => Array.from({ length: hang }, () => ({ ch: ' ', w: 1, c: '' }));
    for (const cell of cells) {
      if (width + cell.w > cols) {
        let rest = [];
        if (!hard && lastSpace > hang && cell.ch !== ' ') {
          rest = row.slice(lastSpace + 1);
          row = row.slice(0, lastSpace);
        }
        rows.push(row);
        row = pad().concat(rest);
        width = row.reduce((sum, c) => sum + c.w, 0);
        lastSpace = row.map((c) => c.ch).lastIndexOf(' ');
        if (cell.ch === ' ' && width === hang) continue;
      }
      if (cell.ch === ' ') lastSpace = row.length;
      row.push(cell);
      width += cell.w;
    }
    if (row.length) rows.push(row);
    return rows.map(fromCells);
  }

  const api = {
    clusters,
    clusterWidth,
    textWidth,
    runsText,
    sliceRuns,
    wrapRuns,
    toCells,
    fromCells,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.SC = root.SC || {}).cells = api;
})(globalThis);
