/* global window */
/**
 * Render one scene to PNG frames on stdout (for ffmpeg) with Playwright, stepping time
 * explicitly: frame i shows the page at t = i / fps. No wall clock is involved.
 *
 *   node render.js --scene scenes/<id>.json --out - [--fps 30] [--only-frame N] [--png FILE]
 *   node render.js --scene scenes/<id>.json --info      # prints { duration, frames } only
 *
 * Runs on the VPS inside the Playwright image (see render.sh), never on the laptop.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const next = process.argv[index + 1];
  return next === undefined || next.startsWith('--') ? true : next;
}

function loadScene(file) {
  const scene = JSON.parse(fs.readFileSync(file, 'utf8'));
  const transcripts = {};
  if (scene.transcript) {
    const source = path.join(__dirname, 'transcripts', `${scene.transcript}.json`);
    transcripts[scene.transcript] = JSON.parse(fs.readFileSync(source, 'utf8'));
  }
  return { scene, transcripts };
}

async function main() {
  const sceneFile = arg('scene');
  if (!sceneFile || sceneFile === true) throw new Error('--scene FILE is required');
  const fps = Number(arg('fps', 30));
  const { chromium } = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');
  const browser = await chromium.launch({
    args: [
      '--no-sandbox',
      '--force-device-scale-factor=1',
      '--font-render-hinting=none',
      '--disable-lcd-text',
      '--disable-gpu',
    ],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
    });
    page.on('pageerror', (error) => {
      throw error;
    });
    await page.goto('file://' + path.join(__dirname, 'page', 'index.html'));
    const payload = loadScene(sceneFile);
    const { duration } = await page.evaluate((p) => window.Stage.load(p), payload);
    const frames = Math.ceil(duration * fps - 1e-9);
    if (arg('info')) {
      console.log(
        JSON.stringify({ id: payload.scene.id, duration, frames, fps, seconds: frames / fps })
      );
      return;
    }
    const only = arg('only-frame');
    const out = arg('out', '-');
    const from = only === undefined ? 0 : Number(only);
    const to = only === undefined ? frames : Number(only) + 1;
    for (let i = from; i < to; i += 1) {
      await page.evaluate((t) => window.Stage.render(t), i / fps);
      const png = await page.screenshot({ type: 'png', animations: 'disabled', caret: 'initial' });
      if (arg('png') && arg('png') !== true) {
        fs.writeFileSync(String(arg('png')).replace('%d', String(i)), png);
      }
      if (out === '-') {
        if (!process.stdout.write(png))
          await new Promise((resolve) => process.stdout.once('drain', resolve));
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
