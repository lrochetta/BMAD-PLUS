#!/bin/bash
# Render screencast scenes to silent H.264 clips. Run on the VPS only (Docker required).
#
#   REPO=~/bmad-plus-ci/repo-screencast PW=~/bmad-plus-ci/pw ./render.sh [scene-id ...]
#
# Pipeline: Playwright (image mcr.microsoft.com/playwright:v1.55.0-noble, playwright-core 1.55.0
# mounted from $PW) paints PNG frames at t = i/30 s and streams them to ffmpeg running in a second
# container (image bmad-media:ffmpeg: Debian 12, ffmpeg 5.1.9 with libx264, Node 24). Outputs
# $REPO/website/media/screencasts/<scene-id>.mp4 and a per-clip ffprobe record; make-index.js then
# writes scenes.json with the exact durations.
set -euo pipefail
REPO="${REPO:?set REPO}"
PW="${PW:-$HOME/bmad-plus-ci/pw}"
FPS="${FPS:-30}"
CRF="${CRF:-28}"
OUT="$REPO/website/media/screencasts"
SC="$REPO/tools/media/screencast"
PW_IMAGE="mcr.microsoft.com/playwright:v1.55.0-noble"
MEDIA_IMAGE="${MEDIA_IMAGE:-bmad-media:ffmpeg}"
mkdir -p "$OUT" "$SC/.probe"
chmod a+rwx "$OUT" "$SC/.probe"

if [ "$#" -gt 0 ]; then IDS=("$@"); else mapfile -t IDS < <(grep -o '"id": *"[^"]*"' "$SC/scenes/scenes.json" | sed 's/.*: *"\(.*\)"/\1/'); fi

for id in "${IDS[@]}"; do
  echo "== $id"
  # A scene file may set its own "crf" (heavy camera motion needs a little more compression).
  CLIP_CRF="$(grep -o "\"crf\": *[0-9]*" "$SC/scenes/$id.json" | grep -o "[0-9]*$" || true)"
  CLIP_CRF="${CLIP_CRF:-$CRF}"
  docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp -e PLAYWRIGHT_CORE=/pw/node_modules/playwright-core \
    -v "$REPO:/work" -v "$PW:/pw:ro" -w /work/tools/media/screencast "$PW_IMAGE" \
    node render.js --scene "scenes/$id.json" --fps "$FPS" --out - \
  | docker run --rm -i -u "$(id -u):$(id -g)" -v "$OUT:/out" "$MEDIA_IMAGE" \
    ffmpeg -hide_banner -loglevel error -y -f image2pipe -framerate "$FPS" -c:v png -i - \
      -c:v libx264 -preset slow -tune animation -crf "$CLIP_CRF" -pix_fmt yuv420p -g 90 -an \
      -movflags +faststart "/out/$id.mp4"
  docker run --rm -u "$(id -u):$(id -g)" -v "$OUT:/out:ro" "$MEDIA_IMAGE" \
    ffprobe -v error -show_entries format=duration,size:stream=width,height,r_frame_rate,nb_frames,codec_name \
      -of json "/out/$id.mp4" > "$SC/.probe/$id.json"
done

docker run --rm -u "$(id -u):$(id -g)" -v "$REPO:/work" -w /work "$MEDIA_IMAGE" \
  node tools/media/screencast/make-index.js
