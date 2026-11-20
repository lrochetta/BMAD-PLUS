# Screencast renderer

Turns **real BMAD+ command output** into silent 1280x720, 30 fps H.264 clips for the website
videos. Nothing on screen is typed by hand: every terminal line is recorded from a real run, and
the renderer only replays it (typing cadence, streaming, scrolling and camera moves are added on
top). Everything runs on the VPS in Docker, never on the laptop.

```
capture/            records transcripts (real runs, in a throwaway container)
transcripts/        what was recorded: command, output, exit code, timing, attached files
scenes/             one JSON per clip + scenes.json (the render order)
lib/                pure logic (timing, cells, terminal replay, highlight, markdown, scene compiler)
page/               the terminal window, split panel and callouts (plain HTML/CSS/JS, no CDN)
fonts/              JetBrains Mono and Inter, both SIL OFL 1.1 (licences next to the files)
render.js           Playwright: paints PNG frames at t = i/30, no wall clock
render.sh           Playwright container piped into an ffmpeg container, then make-index.js
make-index.js       writes website/media/screencasts/scenes.json (exact durations)
```

Output: `website/media/screencasts/<video>-<scene>.mp4` and
`website/media/screencasts/scenes.json` (duration, frames, size, source transcript and commands,
capture commit, collapsed ranges, notes, per clip).

## Truth rules

- Terminal text is the recorded output of the real CLI (`transcripts/*.json`). Plain commands are
  stored as text (ANSI escapes, carriage returns and trailing spaces removed, `npm notice run`
  lines dropped). Interactive commands (the installer prompts) run in a real pseudo-terminal with
  scripted key presses; the raw output chunks are stored untouched and replayed through
  `lib/vt.js`, a small screen emulator.
- Nothing is rewritten. The container paths (`/home/dev/app`) and the unnamed user are already
  neutral, so no redaction is needed; every transcript says so (`redactions: []`).
- A long output is only ever shortened by an explicit marker line (`collapse` in the scene, shown
  as dim italic `…  B003 … B010`). A replay that stops early (`cutAfter`) says so in the scene
  notes and in `scenes.json`.
- The swarm demo replies (`capture/fixtures/replies.json`) are eight hand-written answers that
  stand in for sub-agent output. The swarm commands that read them are real; the numbers in the
  tally are demo data, not research.
- Two small setup steps are not typed on screen and are listed in each transcript (`setup`,
  `hiddenSteps`): installing the packed tarball, `git init`, and for `nexus-run` writing
  `attempt.json` from `nexus inspect --json` (the id and backend that `launch` recorded).
- The prompt `$ ` and the window chrome are drawn decoration.

## Re-render

On the VPS (`support-dev`), with the repo copy at `$REPO` and `playwright-core@1.55.0` in `$PW`:

```sh
# 1. record the real output (about 6 minutes, needs network for npm)
REPO=$HOME/bmad-plus-ci/repo-screencast CAPTURE_COMMIT=$(git rev-parse --short HEAD) \
  $REPO/tools/media/screencast/capture/run-capture.sh            # or a comma list of scenario ids

# 2. render every clip (or pass scene ids)
REPO=$HOME/bmad-plus-ci/repo-screencast PW=$HOME/bmad-plus-ci/pw \
  $REPO/tools/media/screencast/render.sh [scene-id ...]
```

Images: `node:20-bookworm` (capture), `mcr.microsoft.com/playwright:v1.55.0-noble` (frames) and
`bmad-media:ffmpeg` (Debian 12, ffmpeg 5.1.9 with libx264, Node 24; encoding, ffprobe and
`make-index.js`). Encoding: `libx264 -preset slow -tune animation -crf 28 -pix_fmt yuv420p
-movflags +faststart`, no audio. A scene may set its own `"crf"` (the design-read clip uses 30
because its camera and scroll motion cost more bits).

`qa-frames.sh` extracts three review frames per clip (20 %, 50 %, 88 %) plus a contact sheet into
`$REPO/.qa/`; `scenes.json` is rebuilt by every `render.sh` run.

Debug helpers: `node render.js --scene scenes/<id>.json --info` prints the exact duration and frame
count without rendering; `--only-frame N --png FILE` writes one frame.

## Scene file

```jsonc
{
  "id": "install-and-keep-memory-doctor",  // file name, also the mp4 name
  "video": "install-and-keep-memory", "scene": "doctor",
  "type": "terminal",                      // "terminal" | "split" (terminal + file preview) | "title"
  "transcript": "doctor-design",           // transcripts/<name>.json
  "cols": 78,                              // terminal columns: sets the font size (width / 0.6 / cols)
  "seed": 3,                               // typing cadence is seeded: same seed, same frames
  "minDuration": 6,                        // the clip is held on its last frame up to this length
  "endPrompt": false,                      // omit the idle prompt after the last step
  "steps": [{
    "ref": 0,                              // index into transcript.steps
    "type": { "max": 2.2 },                // a long command is typed faster, never cut
    "lineInterval": 0.085,                 // seconds between output lines
    "collapse": [{ "from": 4, "to": 11, "label": "…  B003 … B010" }],
    "cutAfter": "IDE(s) configured",       // pty steps: stop the replay at this screen
    "focus": [{ "match": "87/87 checks passed", "zoom": 1.55, "hold": 1.5, "caption": "optional" }]
  }],
  "preview": {                             // split scenes: the file attached to a step
    "step": 0, "file": 0, "kind": "markdown" /* or "json" */, "name": "tally.md",
    "interval": 0.1, "focus": [{ "match": "50.0%", "zoom": 1.3 }],
    "shorten": [{ "startsWith": "8 of 40", "keep": 110, "label": "…" }]
  }
}
```

A `focus` finds its line by text (the run fails loudly if the text is not in the output), pushes the
camera in, draws a callout ring around the text and, if given, a caption. Time is a pure function:
`scene.at(compiled, t)` returns rows, scroll, caret, camera, ring and caption for second `t`, so a
frame never depends on when it is rendered.

## Look

Deep indigo and near-black, one warm accent (amber), semantic colours only for status. Text colours
are checked against the window background for WCAG AA (body 15:1, dim 8:1). The terminal font is
sized to the column count of the scene: 24 to 25 px at 78 to 80 columns (a real 80-column
installer box fits); the camera push-in on the focus line takes the text to 33 px and more.
Split scenes keep the terminal at 20 px and put the file preview at 22 px, zoomed on focus.

## Tests

`tests/unit/screencast.test.js` covers the pure modules (seeded timing, cell widths and wrapping,
the terminal replay, highlight, Markdown, scene compilation and determinism). Run it with the rest
of the suite on the VPS (`npx jest tests/unit/screencast.test.js`).
