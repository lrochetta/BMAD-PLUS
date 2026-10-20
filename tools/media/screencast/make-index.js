/**
 * Build website/media/screencasts/scenes.json from the scene files, the transcripts they replay
 * and the ffprobe record of each rendered clip. Run from the repo root (render.sh does it).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const HERE = __dirname;
const OUT = path.join(ROOT, 'website', 'media', 'screencasts');

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

function collapsed(scene) {
  const list = [];
  (scene.steps || []).forEach((step, index) => {
    for (const cut of step.collapse || []) {
      list.push({ step: index, fromLine: cut.from, toLine: cut.to, lines: cut.to - cut.from + 1 });
    }
  });
  return list;
}

function main() {
  const order = read(path.join(HERE, 'scenes', 'scenes.json'));
  const clips = [];
  for (const entry of order.scenes) {
    const probeFile = path.join(HERE, '.probe', `${entry.id}.json`);
    if (!fs.existsSync(probeFile)) continue;
    const scene = read(path.join(HERE, 'scenes', `${entry.id}.json`));
    const probe = read(probeFile);
    const stream = probe.streams[0];
    const transcript = scene.transcript
      ? read(path.join(HERE, 'transcripts', `${scene.transcript}.json`))
      : null;
    const [num, den] = stream.r_frame_rate.split('/').map(Number);
    clips.push({
      id: scene.id,
      video: scene.video,
      scene: scene.scene,
      file: `media/screencasts/${scene.id}.mp4`,
      durationSeconds: Number(Number(probe.format.duration).toFixed(3)),
      minSeconds: scene.minDuration || null,
      frames: Number(stream.nb_frames),
      fps: num / den,
      width: stream.width,
      height: stream.height,
      codec: stream.codec_name,
      bytes: Number(probe.format.size),
      audio: false,
      description: scene.description || null,
      source: transcript
        ? {
            transcript: `tools/media/screencast/transcripts/${scene.transcript}.json`,
            commands: transcript.steps.map((step) => step.cmd),
            capturedAt: transcript.capturedAt,
            repoCommit: transcript.environment.repoCommit,
            environment: `${transcript.environment.os}, Node ${transcript.environment.node}, bmad-plus ${transcript.environment.bmadPlus}`,
            hiddenSteps: transcript.hiddenSteps,
            redactions: transcript.redactions,
          }
        : null,
      collapsed: collapsed(scene),
      notes: scene.notes || [],
    });
  }
  const index = {
    schema: 'bmad-plus/screencasts/1',
    generator: 'tools/media/screencast (render.sh, make-index.js)',
    note: 'Terminal text is the recorded output of real commands; see source.transcript. Clips are silent.',
    clips,
  };
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'scenes.json'), JSON.stringify(index, null, 2) + '\n');
  console.log(`scenes.json: ${clips.length} clips`);
}

main();
