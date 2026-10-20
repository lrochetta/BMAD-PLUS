/* global document, window */
/**
 * Paints one frame. All content decisions come from SC.scene.at(); this file only turns that
 * state into DOM. No timers, no animation: render(t) is the only thing that changes the page.
 */
'use strict';

(function () {
  const { cells, scene: sceneApi } = window.SC;
  const $ = (id) => document.getElementById(id);

  const els = {
    camera: $('camera'),
    term: $('term'),
    termTitle: $('term-title'),
    termViewport: $('term-viewport'),
    termContent: $('term-content'),
    caret: $('caret'),
    preview: $('preview'),
    previewTitle: $('preview-title'),
    previewViewport: $('preview-viewport'),
    previewContent: $('preview-content'),
    ring: $('ring'),
    caption: $('caption'),
    titlecard: $('titlecard'),
  };

  let compiled = null;
  let metrics = null;
  let lastRows = '';
  let blockEls = [];

  const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function classOf(tokens) {
    if (!tokens) return '';
    return tokens
      .split(' ')
      .filter(Boolean)
      .map((token) => (token.startsWith('s-') ? token : `t-${token}`))
      .join(' ');
  }

  /** Runs to HTML. Non-ASCII glyphs get fixed-width cells so box drawing and emoji line up. */
  function runsHtml(runs) {
    let html = '';
    for (const run of runs) {
      let body = '';
      let plain = '';
      for (const cluster of cells.clusters(run.t)) {
        if (cluster.length === 1 && cluster >= ' ' && cluster <= '~') plain += cluster;
        else {
          if (plain) body += escape(plain);
          plain = '';
          const w = cells.clusterWidth(cluster);
          body += `<span class="c${w === 2 ? 2 : 1}">${escape(cluster)}</span>`;
        }
      }
      if (plain) body += escape(plain);
      const cls = classOf(run.c);
      html += cls ? `<span class="${cls}">${body}</span>` : body;
    }
    return html;
  }

  function place(el, rect) {
    el.style.left = `${rect.x}px`;
    el.style.top = `${rect.y}px`;
    el.style.width = `${rect.w}px`;
    el.style.height = `${rect.h}px`;
  }

  function inset(viewport, win, rect) {
    viewport.style.left = `${rect.cx - win.x}px`;
    viewport.style.top = `${rect.cy - win.y}px`;
    viewport.style.width = `${rect.cw}px`;
    viewport.style.height = `${rect.ch}px`;
  }

  function measurePreview() {
    const parent = els.previewContent.getBoundingClientRect();
    const list = blockEls.map((el) => {
      const r = el.getBoundingClientRect();
      return { top: r.top - parent.top, height: r.height };
    });
    return {
      blocks: list,
      total: list.length ? list[list.length - 1].top + list[list.length - 1].height : 0,
    };
  }

  async function load(payload) {
    compiled = sceneApi.compileScene(payload.scene, payload.transcripts);
    metrics = null;
    lastRows = '';
    await document.fonts.load('400 24px "JB Mono"');
    await document.fonts.load('700 24px "JB Mono"');
    await document.fonts.load('400 24px "Inter UI"');
    await document.fonts.load('700 24px "Inter UI"');
    await document.fonts.ready;
    els.titlecard.style.display = compiled.type === 'title' ? 'flex' : 'none';
    const isTitle = compiled.type === 'title';
    els.term.style.display = isTitle ? 'none' : 'block';
    if (!isTitle) {
      const { geom } = compiled;
      place(els.term, geom.term);
      inset(els.termViewport, geom.term, geom.term);
      els.termContent.style.fontSize = `${geom.font}px`;
      els.termContent.style.lineHeight = `${geom.rowH}px`;
      els.termContent.style.setProperty('--rowh', `${geom.rowH}px`);
      els.caret.style.width = `${Math.round(geom.charW)}px`;
      els.caret.style.height = `${geom.rowH - 10}px`;
      els.preview.hidden = !compiled.preview;
      if (compiled.preview) {
        place(els.preview, geom.preview);
        inset(els.previewViewport, geom.preview, geom.preview);
        els.previewTitle.textContent = compiled.preview.name;
        els.previewContent.innerHTML = compiled.preview.blocks
          .map((b) => `<div class="blk">${b.html}</div>`)
          .join('');
        blockEls = Array.from(els.previewContent.children);
        metrics = measurePreview();
      }
    }
    return { duration: sceneApi.duration(compiled) };
  }

  function render(t) {
    const state = sceneApi.at(compiled, t, metrics);
    const cam = state.camera;
    els.camera.style.transform = `translate(640px,360px) scale(${cam.z}) translate(${-cam.cx}px,${-cam.cy}px)`;

    if (compiled.type === 'title') {
      els.titlecard.innerHTML = state.title
        .map(
          (line) =>
            `<div class="${line.accent ? 'accent' : ''}" style="font-size:${line.size}px;opacity:${line.opacity};transform:translateY(${line.rise}px)">${escape(line.text)}</div>`
        )
        .join('');
      els.ring.style.opacity = 0;
      els.caption.style.opacity = 0;
      return;
    }

    els.termTitle.textContent = state.term.title;
    const rowsHtml = state.term.rows
      .map((row) => `<div class="row">${runsHtml(row.runs)}</div>`)
      .join('');
    if (rowsHtml !== lastRows) {
      els.termContent.innerHTML = rowsHtml;
      lastRows = rowsHtml;
    }
    els.termContent.style.transform = `translateY(${state.term.first * state.geom.rowH - state.term.scrollPx}px)`;

    const caret = state.term.caret;
    if (caret && caret.visible) {
      els.caret.style.display = 'block';
      els.caret.style.opacity = caret.opacity;
      els.caret.style.left = `${caret.x - state.geom.term.cx}px`;
      els.caret.style.top = `${caret.y - state.geom.term.cy + 5}px`;
    } else els.caret.style.display = 'none';

    if (state.preview) {
      blockEls.forEach((el, i) => {
        el.style.opacity = state.preview.alpha[i];
        el.style.transform = `translateY(${state.preview.rise[i]}px)`;
      });
      els.previewContent.style.transform = `translateY(${-state.preview.scroll}px)`;
    }

    if (state.ring) {
      const r = state.ring.rect;
      const grow = (1 - state.ring.opacity) * 10;
      els.ring.style.left = `${r.x - grow}px`;
      els.ring.style.top = `${r.y - grow}px`;
      els.ring.style.width = `${r.w + 2 * grow}px`;
      els.ring.style.height = `${r.h + 2 * grow}px`;
      els.ring.style.opacity = state.ring.opacity;
    } else els.ring.style.opacity = 0;

    if (state.caption) {
      els.caption.textContent = state.caption.text;
      els.caption.style.opacity = state.caption.opacity;
    } else els.caption.style.opacity = 0;
  }

  window.Stage = { load, render };
})();
