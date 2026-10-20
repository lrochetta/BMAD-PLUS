/**
 * Scene compiler. Turns a scene description plus a recorded transcript into a pure function of
 * time: at(t) returns everything that is on screen at second t (rows, scroll, caret, camera,
 * callout ring, caption). Nothing reads a clock; the same input gives the same frames.
 */
'use strict';

(function (root) {
  const need = (name) => (typeof require === 'function' ? require('./' + name) : root.SC[name]);
  const timing = need('timing');
  const cells = need('cells');
  const vt = need('vt');
  const highlight = need('highlight');
  const markdown = need('markdown');
  const { clamp, lerp } = timing;

  const STAGE = { w: 1280, h: 720 };
  const CHAR_ASPECT = 0.6; // JetBrains Mono advance width / font size
  const WIN_PAD = 20;
  const TITLEBAR = 44;

  /** Pixel geometry for the terminal and, in split scenes, the preview panel. */
  function geometry(scene) {
    const split = scene.type === 'split';
    const term = split ? { x: 24, y: 22, w: 560, h: 676 } : { x: 24, y: 22, w: 1232, h: 676 };
    const innerW = term.w - 2 * WIN_PAD;
    const cols = scene.cols || (split ? 42 : 78);
    const font = Math.min(scene.font || 30, Math.floor(innerW / (CHAR_ASPECT * cols)));
    const rowH = Math.round(font * 1.32); // equals JetBrains Mono's em box, so box lines join
    const innerH = term.h - TITLEBAR - 2 * WIN_PAD;
    const geom = {
      cols,
      font,
      charW: font * CHAR_ASPECT,
      rowH,
      viewRows: Math.floor(innerH / rowH),
      term: {
        ...term,
        cx: term.x + WIN_PAD,
        cy: term.y + TITLEBAR + WIN_PAD,
        cw: innerW,
        ch: innerH,
      },
    };
    if (split) {
      const win = { x: 600, y: 22, w: 656, h: 676 };
      geom.preview = {
        ...win,
        cx: win.x + 30,
        cy: win.y + TITLEBAR + 26,
        cw: win.w - 60,
        ch: win.h - TITLEBAR - 52,
      };
    }
    return geom;
  }

  const prompt = () => [{ t: '$ ', c: 's-prompt' }];

  /** Rows (runs) of a typed command prefix, wrapped to the terminal width. */
  function commandRows(prefix, cols) {
    const runs = prompt().concat(highlight.highlightCommand(prefix));
    return cells.wrapRuns(runs, cols, { hang: 2 });
  }

  function textOf(row) {
    return cells.runsText(row.runs);
  }

  function compileTerminal(scene, transcript, geom) {
    const cols = geom.cols;
    const blocks = [];
    const windows = [];
    let cursor = scene.lead === undefined ? 0.4 : scene.lead;
    const stepsSpec = scene.steps || transcript.steps.map((_, ref) => ({ ref }));

    stepsSpec.forEach((spec, index) => {
      const step = transcript.steps[spec.ref];
      if (!step) throw new Error(`scene ${scene.id}: transcript has no step ${spec.ref}`);
      const rng = timing.mulberry32(timing.hashSeed(`${scene.id}:${index}:${scene.seed || 0}`));
      const typeStart = cursor + (spec.preType === undefined ? 0.25 : spec.preType);
      const times = timing.typingTimes(step.cmd, rng, {
        maxSeconds: (spec.type && spec.type.max) || 2.6,
      });
      const typed = step.cmd.length ? Array.from(step.cmd).length : 0;
      const charTimes = times.slice(0, typed).map((x) => typeStart + x);
      const typeEnd = charTimes.length ? charTimes[charTimes.length - 1] + 0.05 : typeStart;
      const enter = typeEnd + (spec.enterPause === undefined ? 0.25 : spec.enterPause);
      const cmdChars = Array.from(step.cmd);
      blocks.push({
        kind: 'cmd',
        step: index,
        start: cursor,
        charTimes,
        chars: cmdChars,
        typeEnd,
        enter,
      });

      let end;
      if (step.chunks) {
        const frames = vt.replay(step.chunks, (step.tty && step.tty.cols) || 80);
        const firstContent = frames.find((f) => f.rows.some((r) => r.length));
        const origin = firstContent ? firstContent.t : 0;
        const shift = enter + 0.25 - (spec.leadCut === false ? 0 : origin);
        const placed = frames.map((f) => ({
          t: f.t + shift,
          rows: f.rows.map((runs) => ({ runs, step: index, kind: 'screen' })),
        }));
        const first = placed.findIndex((f) => f.rows.some((r) => r.runs.length));
        let trimmed = first > 0 ? placed.slice(first) : placed;
        if (spec.cutAfter) {
          // Stop the replay at the first screen that shows this text (the clip ends there).
          const stop = trimmed.findIndex((f) =>
            f.rows.some((r) => textOf(r).includes(spec.cutAfter))
          );
          if (stop < 0)
            throw new Error(`scene ${scene.id}: cutAfter text not found: ${spec.cutAfter}`);
          trimmed = trimmed.slice(0, stop + 1);
        }
        const trailing = spec.hold === undefined ? 0.6 : spec.hold;
        blocks.push({ kind: 'screen', step: index, frames: trimmed });
        end = trimmed.length ? trimmed[trimmed.length - 1].t + trailing : enter;
        if (spec.endAt !== undefined) end = enter + spec.endAt;
      } else {
        const latency =
          spec.latency === undefined
            ? clamp(((step.ms || 300) / 1000) * 0.45, 0.2, 0.9)
            : spec.latency;
        const interval = spec.lineInterval === undefined ? 0.06 : spec.lineInterval;
        const lines = step.output === '' ? [] : step.output.split('\n');
        const rows = [];
        let t = enter + latency;
        let i = 0;
        const collapse = spec.collapse || [];
        while (i < lines.length) {
          const cut = collapse.find((c) => i >= c.from && i <= c.to);
          if (cut) {
            const count = cut.to - cut.from + 1;
            const label = (cut.label || '… {n} more lines (collapsed in this clip)').replace(
              '{n}',
              String(count)
            );
            rows.push({ runs: [{ t: label, c: 's-collapse' }], t, step: index, kind: 'collapse' });
            i = cut.to + 1;
            t += interval * 2;
            continue;
          }
          const wrapped = cells.wrapRuns(highlight.highlightOutput(lines[i]), cols);
          for (const runs of wrapped) {
            rows.push({ runs, t, step: index, kind: 'out' });
            t += interval * (0.75 + 0.5 * rng());
          }
          i += 1;
        }
        blocks.push({ kind: 'out', step: index, rows });
        end = rows.length ? rows[rows.length - 1].t : enter + latency;
      }

      // Focus windows attach to rows of this step, found by text.
      for (const focus of spec.focus || []) {
        windows.push({ ...focus, target: 'term', step: index, stepEnd: end });
      }
      cursor = end + (spec.pause === undefined ? 0.35 : spec.pause);
    });

    const idleAt = cursor;
    if (scene.endPrompt !== false) blocks.push({ kind: 'idle', start: idleAt });

    return { blocks, windows, cursor, idleAt };
  }

  /** Rows of the terminal at time t. */
  function terminalRows(compiled, geom, t) {
    const rows = [];
    let caret = null;
    for (const block of compiled.blocks) {
      if (block.kind === 'cmd') {
        if (t < block.start + 0.0001) continue;
        let n = 0;
        while (n < block.charTimes.length && block.charTimes[n] <= t) n += 1;
        const prefix = block.chars.slice(0, n).join('');
        const wrapped = commandRows(prefix, geom.cols);
        wrapped.forEach((runs) => rows.push({ runs, step: block.step, kind: 'cmd' }));
        const typing = t < block.enter;
        if (typing) {
          const last = wrapped[wrapped.length - 1];
          caret = {
            row: rows.length - 1,
            col: cells.textWidth(cells.runsText(last)),
            mode: n < block.chars.length ? 'solid' : 'idle',
          };
        }
      } else if (block.kind === 'out') {
        for (const row of block.rows) if (row.t <= t) rows.push(row);
      } else if (block.kind === 'screen') {
        let frame = null;
        for (const f of block.frames) if (f.t <= t) frame = f;
        if (frame) for (const row of frame.rows) rows.push(row);
      } else if (block.kind === 'idle') {
        if (t >= block.start) {
          rows.push({ runs: prompt(), step: -1, kind: 'cmd' });
          caret = { row: rows.length - 1, col: 2, mode: 'idle' };
        }
      }
    }
    return { rows, caret };
  }

  function changeTimes(compiled) {
    const times = new Set([0]);
    for (const block of compiled.blocks) {
      if (block.kind === 'cmd') {
        times.add(block.start);
        block.charTimes.forEach((x) => times.add(x));
      } else if (block.kind === 'out') block.rows.forEach((r) => times.add(r.t));
      else if (block.kind === 'screen') block.frames.forEach((f) => times.add(f.t));
      else if (block.kind === 'idle') times.add(block.start);
    }
    return [...times].sort((a, b) => a - b);
  }

  /** First time a row of `step` contains `match`, or null. */
  function appearTime(compiled, geom, step, match) {
    for (const time of changeTimes(compiled)) {
      const { rows } = terminalRows(compiled, geom, time + 1e-6);
      if (
        rows.some((row) => row.step === step && row.kind !== 'cmd' && textOf(row).includes(match))
      ) {
        return time;
      }
    }
    return null;
  }

  function compileScene(scene, transcripts) {
    const type = scene.type || 'terminal';
    if (type === 'title') return compileTitle(scene);
    const transcript = transcripts[scene.transcript];
    if (!transcript)
      throw new Error(`scene ${scene.id}: transcript ${scene.transcript} not loaded`);
    const geom = geometry(scene);
    const compiled = compileTerminal(scene, transcript, geom);

    // Scroll targets follow the number of rows on screen.
    const scrollEvents = [];
    let lastTarget = 0;
    const times = changeTimes(compiled);
    for (const time of times) {
      const { rows } = terminalRows(compiled, geom, time + 1e-6);
      const target = Math.max(0, rows.length - (geom.viewRows - 0.2));
      if (Math.abs(target - lastTarget) > 1e-9) {
        scrollEvents.push({ t: time, target });
        lastTarget = target;
      }
    }

    // Preview panel (split scenes): blocks reveal one after another after a given step.
    let preview = null;
    if (type === 'split') {
      const spec = scene.preview;
      const stepSpec = scene.steps[spec.step];
      const file = transcript.steps[stepSpec.ref].files[spec.file || 0];
      let blocks =
        spec.kind === 'json'
          ? markdown.parseJsonLines(file.content)
          : markdown.parseMarkdown(file.content);
      for (const rule of spec.shorten || []) {
        blocks = blocks.map((block) => {
          if (!block.text.startsWith(rule.startsWith)) return block;
          const text = block.text.slice(0, rule.keep).replace(/\s+\S*$/, '') + ' ' + rule.label;
          return {
            type: block.type,
            html: `<p>${markdown.escapeHtml(text)}</p>`,
            text,
            shortened: true,
          };
        });
      }
      preview = { spec, blocks, name: spec.name || file.path.split('/').pop() };
    }

    return { scene, geom, compiled, scrollEvents, preview, transcript, type };
  }

  const defaultMetrics = (blocks) => {
    const out = [];
    let y = 0;
    for (const block of blocks) {
      const h = block.type === 'table' ? 220 : block.type === 'hr' ? 24 : 64;
      out.push({ top: y, height: h });
      y += h + 12;
    }
    return { blocks: out, total: y };
  };

  /** Reveal times of the preview blocks, resolved against the terminal timeline. */
  function previewTimes(c) {
    const spec = c.scene.preview;
    const stepIndex = spec.step;
    const afterStep = c.compiled.blocks.filter((b) => b.step === stepIndex && b.kind !== 'cmd');
    let base = 0;
    for (const b of afterStep) {
      if (b.kind === 'out' && b.rows.length) base = Math.max(base, b.rows[b.rows.length - 1].t);
      if (b.kind === 'screen' && b.frames.length)
        base = Math.max(base, b.frames[b.frames.length - 1].t);
    }
    if (!afterStep.length) {
      const cmd = c.compiled.blocks.find((b) => b.kind === 'cmd' && b.step === stepIndex);
      base = cmd.enter;
    }
    const start = base + (spec.start === undefined ? 0.45 : spec.start);
    const interval = spec.interval === undefined ? 0.28 : spec.interval;
    return c.preview.blocks.map((_, i) => start + i * interval);
  }

  /** Focus windows resolved to absolute times and sorted, never overlapping. */
  function resolveWindows(c) {
    if (c.resolved) return c.resolved;
    const out = [];
    const list = [];
    for (const w of c.compiled.windows) {
      const appear = appearTime(c.compiled, c.geom, w.step, w.match);
      if (appear === null) throw new Error(`scene ${c.scene.id}: focus text not found: ${w.match}`);
      list.push({ ...w, appear });
    }
    if (c.preview) {
      const reveal = previewTimes(c);
      for (const w of c.scene.preview.focus || []) {
        const index = c.preview.blocks.findIndex((b) => b.text.includes(w.match));
        if (index < 0) throw new Error(`scene ${c.scene.id}: preview text not found: ${w.match}`);
        list.push({ ...w, target: 'preview', blockIndex: index, appear: reveal[index] });
      }
    }
    list.sort((a, b) => a.appear - b.appear);
    let free = 0;
    for (const w of list) {
      const start = Math.max(w.appear + (w.delay === undefined ? 0.2 : w.delay), free);
      const rampIn = w.rampIn || 0.6;
      const rampOut = w.rampOut || 0.5;
      const hold = w.hold === undefined ? 1.6 : w.hold;
      out.push({ ...w, start, rampIn, rampOut, hold, end: start + rampIn + hold + rampOut });
      free = start + rampIn + hold + rampOut * (w.release === false ? 0 : 0.5);
    }
    c.resolved = out;
    return out;
  }

  function duration(c) {
    if (c.type === 'title') return c.duration;
    if (c.length !== undefined) return c.length;
    const windows = resolveWindows(c);
    let end = c.compiled.idleAt;
    // The clip may end while the camera is still on the last focus: only a short settle is kept.
    for (const w of windows) end = Math.max(end, w.start + w.rampIn + w.hold + 0.35);
    if (c.preview) {
      const reveal = previewTimes(c);
      end = Math.max(end, reveal[reveal.length - 1] + 1.2);
    }
    end += c.scene.tail === undefined ? 0.7 : c.scene.tail;
    c.length = Math.max(end, c.scene.minDuration || 0);
    return c.length;
  }

  const pulse = (t) => 0.62 + 0.38 * Math.sin(t * 2.6);

  function at(c, t, metrics) {
    if (c.type === 'title') return atTitle(c, t);
    const { geom } = c;
    const total = duration(c);
    const { rows, caret } = terminalRows(c.compiled, geom, t);
    const scrollRows = timing.followScroll(c.scrollEvents, t, c.scene.scrollTau || 0.24);
    const scrollPx = scrollRows * geom.rowH;
    const first = Math.max(0, Math.floor(scrollRows) - 1);
    const last = Math.min(rows.length, Math.ceil(scrollRows + geom.viewRows) + 1);
    const state = {
      t,
      duration: total,
      geom,
      term: {
        title: c.scene.title || '~/app',
        rows: rows.slice(first, last),
        first,
        scrollPx,
        caret: caret
          ? {
              x: geom.term.cx + caret.col * geom.charW,
              y: geom.term.cy + caret.row * geom.rowH - scrollPx,
              opacity: caret.mode === 'solid' ? 1 : pulse(t),
              visible: caret.row >= first && caret.row <= last,
            }
          : null,
      },
      preview: null,
      camera: { z: 1, cx: STAGE.w / 2, cy: STAGE.h / 2 },
      ring: null,
      caption: null,
    };

    let m = null;
    let previewLayout = null;
    if (c.preview) {
      const pg = geom.preview;
      m = metrics || defaultMetrics(c.preview.blocks);
      const reveal = previewTimes(c);
      const events = [];
      reveal.forEach((time, i) => {
        const bottom = m.blocks[i].top + m.blocks[i].height;
        events.push({ t: time, target: Math.max(0, bottom - pg.ch + 8) });
      });
      const scroll = timing.followScroll(events, t, 0.35);
      previewLayout = { scroll, reveal };
      state.preview = {
        name: c.preview.name,
        scroll,
        alpha: reveal.map((time) => clamp((t - time) / 0.35, 0, 1)),
        rise: reveal.map((time) => (1 - timing.easeOutCubic((t - time) / 0.35)) * 14),
      };
    }

    // Camera: a gentle push over the whole scene, plus one focus window at a time.
    const drift = c.scene.drift === undefined ? 0.025 : c.scene.drift;
    const base = 1 + drift * timing.easeInOutCubic(t / total);
    let z = base;
    let cx = STAGE.w / 2;
    let cy = STAGE.h / 2;
    for (const w of resolveWindows(c)) {
      const weight = timing.windowWeight(t, w.start, w.rampIn, w.hold, w.rampOut);
      if (weight <= 0) continue;
      let rect = null;
      if (w.target === 'term') {
        const idx = rows.findIndex(
          (row) => row.step === w.step && row.kind !== 'cmd' && textOf(row).includes(w.match)
        );
        if (idx >= 0) {
          const text = textOf(rows[idx]);
          const col = cells.textWidth(text.slice(0, text.indexOf(w.match)));
          const width = cells.textWidth(w.match);
          rect = {
            x: geom.term.cx + col * geom.charW - 8,
            y: geom.term.cy + idx * geom.rowH - scrollPx - 3,
            w: width * geom.charW + 16,
            h: geom.rowH + 6,
          };
        }
      } else if (previewLayout) {
        const pg = geom.preview;
        const b = m.blocks[w.blockIndex];
        rect = {
          x: pg.cx - 12,
          y: pg.cy + b.top - previewLayout.scroll - 8,
          w: pg.cw + 24,
          h: b.height + 16,
        };
      }
      if (!rect) continue;
      const zoom = w.zoom || 1.45;
      const px = rect.x + rect.w / 2;
      const py = rect.y + rect.h / 2;
      const targetZ = zoom;
      const zz = lerp(base, targetZ, weight);
      const fx = lerp(STAGE.w / 2, px, weight);
      const fy = lerp(STAGE.h / 2, py + 60 / targetZ, weight);
      z = zz;
      cx = fx;
      cy = fy;
      if (w.ring !== false)
        state.ring = {
          rect,
          opacity: clamp(weight * 1.4, 0, 1),
          pulse: 0.5 + 0.5 * Math.sin(t * 3),
        };
      if (w.caption) state.caption = { text: w.caption, opacity: clamp(weight * 1.6 - 0.2, 0, 1) };
      break;
    }
    cx = clamp(cx, STAGE.w / 2 / z, STAGE.w - STAGE.w / 2 / z);
    cy = clamp(cy, STAGE.h / 2 / z, STAGE.h - STAGE.h / 2 / z);
    state.camera = { z, cx, cy };
    return state;
  }

  // ---- title card -------------------------------------------------------------------------

  function compileTitle(scene) {
    return {
      scene,
      type: 'title',
      duration: Math.max(scene.minDuration || 0, 3),
      geom: geometry({ type: 'terminal' }),
    };
  }

  function atTitle(c, t) {
    const lines = c.scene.lines || [];
    return {
      t,
      duration: c.duration,
      title: lines.map((line, i) => {
        const k = timing.easeOutCubic((t - 0.25 - i * 0.28) / 0.7);
        return {
          text: line.text,
          size: line.size || 56,
          accent: !!line.accent,
          opacity: k,
          rise: (1 - k) * 22,
        };
      }),
      camera: { z: 1 + 0.03 * (t / c.duration), cx: STAGE.w / 2, cy: STAGE.h / 2 },
    };
  }

  const api = {
    STAGE,
    geometry,
    compileScene,
    at,
    duration,
    resolveWindows,
    previewTimes,
    commandRows,
    defaultMetrics,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else (root.SC = root.SC || {}).scene = api;
})(globalThis);
