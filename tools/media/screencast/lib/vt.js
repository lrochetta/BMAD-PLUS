/**
 * A small terminal screen emulator, just enough for what the BMAD+ installer prints through a
 * pseudo-terminal (@clack/prompts): text, colours, cursor moves, line and screen erase.
 * Feed it the recorded output chunks; it returns the screen as styled rows after every chunk.
 * Anything it does not understand is ignored, never invented.
 */
'use strict';

(function (root) {
  const cellsApi = typeof require === 'function' ? require('./cells') : root.SC.cells;
  const { clusters, clusterWidth, fromCells } = cellsApi;

  const FG = (n) => `f${n}`;
  const BG = (n) => `g${n}`;

  class Screen {
    constructor(cols) {
      this.cols = cols;
      this.rows = [[]];
      this.row = 0;
      this.col = 0;
      this.style = new Set();
    }

    ensureRow(index) {
      while (this.rows.length <= index) this.rows.push([]);
    }

    put(cluster) {
      const width = clusterWidth(cluster);
      if (width === 0 && this.col > 0) return;
      if (this.col + width > this.cols) {
        this.row += 1;
        this.col = 0;
      }
      this.ensureRow(this.row);
      const line = this.rows[this.row];
      while (line.length < this.col) line.push({ ch: ' ', w: 1, c: '' });
      const cell = { ch: cluster, w: width || 1, c: [...this.style].join(' ') };
      // A wide cell covers two columns: keep a hidden filler so array index equals column.
      const fresh = width === 2 ? [cell, { ch: '', w: 0, c: cell.c, filler: true }] : [cell];
      line.splice(this.col, fresh.length, ...fresh);
      this.col += width || 1;
    }

    sgr(params) {
      const list = params.length ? params : [0];
      for (let i = 0; i < list.length; i += 1) {
        const n = list[i];
        if (n === 0) this.style.clear();
        else if (n === 1) this.style.add('b');
        else if (n === 2) this.style.add('d');
        else if (n === 22) {
          this.style.delete('b');
          this.style.delete('d');
        } else if (n === 7) this.style.add('inv');
        else if (n === 27) this.style.delete('inv');
        else if ((n >= 30 && n <= 37) || (n >= 90 && n <= 97)) {
          for (const s of [...this.style]) if (s[0] === 'f') this.style.delete(s);
          this.style.add(FG(n));
        } else if (n === 39) {
          for (const s of [...this.style]) if (s[0] === 'f') this.style.delete(s);
        } else if ((n >= 40 && n <= 47) || (n >= 100 && n <= 107)) {
          for (const s of [...this.style]) if (s[0] === 'g') this.style.delete(s);
          this.style.add(BG(n));
        } else if (n === 49) {
          for (const s of [...this.style]) if (s[0] === 'g') this.style.delete(s);
        } else if (n === 38 || n === 48) {
          // Extended colours are not produced by the installer; skip their arguments.
          i += list[i + 1] === 5 ? 2 : 4;
        }
      }
    }

    csi(params, final, priv) {
      const n = params[0] || 0;
      switch (final) {
        case 'm':
          this.sgr(params);
          break;
        case 'A':
          this.row = Math.max(0, this.row - (n || 1));
          break;
        case 'B':
          this.row += n || 1;
          this.ensureRow(this.row);
          break;
        case 'C':
          this.col += n || 1;
          break;
        case 'D':
          this.col = Math.max(0, this.col - (n || 1));
          break;
        case 'G':
          this.col = Math.max(0, (n || 1) - 1);
          break;
        case 'K': {
          const line = this.rows[this.row] || [];
          if (n === 2) this.rows[this.row] = [];
          else if (n === 1) {
            for (let i = 0; i < this.col && i < line.length; i += 1)
              line[i] = { ch: ' ', w: 1, c: '' };
          } else line.length = Math.min(line.length, this.col);
          break;
        }
        case 'J': {
          if (n === 2 || n === 3) {
            this.rows = [[]];
            this.row = 0;
            this.col = 0;
          } else {
            const line = this.rows[this.row] || [];
            line.length = Math.min(line.length, this.col);
            this.rows.length = this.row + 1;
          }
          break;
        }
        case 'H': {
          this.row = Math.max(0, (params[0] || 1) - 1);
          this.col = Math.max(0, (params[1] || 1) - 1);
          this.ensureRow(this.row);
          break;
        }
        default:
          break; // cursor visibility (?25l/h), scroll regions, modes: no visible effect here
      }
      return priv;
    }

    write(data) {
      const text = data.replace(/\r\n/g, '\n');
      let i = 0;
      while (i < text.length) {
        const ch = text[i];
        if (ch === '\u001b') {
          if (text[i + 1] === '[') {
            // eslint-disable-next-line no-control-regex
            const match = /^\u001b\[([?>=]?)([0-9;]*)([ -/]*)([@-~])/.exec(text.slice(i, i + 64));
            if (match) {
              const params = match[2] === '' ? [] : match[2].split(';').map((x) => Number(x) || 0);
              this.csi(params, match[4], match[1]);
              i += match[0].length;
              continue;
            }
          } else if (text[i + 1] === ']') {
            // eslint-disable-next-line no-control-regex
            const end = text.slice(i).search(/\u0007|\u001b\\/);
            i += end === -1 ? text.length : end + 1;
            continue;
          }
          i += 2;
          continue;
        }
        if (ch === '\n') {
          this.row += 1;
          this.col = 0;
          this.ensureRow(this.row);
          i += 1;
          continue;
        }
        if (ch === '\r') {
          this.col = 0;
          i += 1;
          continue;
        }
        if (ch === '\b' || ch === '\u0007') {
          i += 1;
          continue;
        }
        // Take one cluster at a time (surrogates, variation selectors, joiners stay together).
        // cluster length drives the advance
        const cps = clusters(text.slice(i, i + 16));
        const end = i + cps[0].length;
        this.put(cps[0]);
        i = end;
      }
    }

    /** The screen as rows of runs, trailing blank rows and trailing spaces removed. */
    snapshot() {
      const rows = this.rows.map((line) => {
        const cells = line.filter((cell) => !cell.filler);
        while (
          cells.length &&
          cells[cells.length - 1].ch === ' ' &&
          !/inv|g4/.test(cells[cells.length - 1].c)
        )
          cells.pop();
        return fromCells(cells);
      });
      while (rows.length && rows[rows.length - 1].length === 0) rows.pop();
      return rows;
    }
  }

  /**
   * @param {Array<{t:number,data:string}>} chunks recorded pty output
   * @param {number} cols terminal width used while recording
   * @returns {Array<{t:number,rows:Array}>} the screen after each chunk that changed it
   */
  function replay(chunks, cols = 80) {
    const screen = new Screen(cols);
    const frames = [];
    let previous = '[]';
    for (const chunk of chunks) {
      screen.write(chunk.data);
      const rows = screen.snapshot();
      const key = JSON.stringify(rows);
      if (key !== previous) {
        frames.push({ t: chunk.t, rows });
        previous = key;
      }
    }
    return frames;
  }

  const api = { Screen, replay };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.SC = root.SC || {}).vt = api;
})(globalThis);
