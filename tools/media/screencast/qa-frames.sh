#!/bin/bash
# Extract review frames from the rendered clips (run on the VPS).
#   REPO=~/bmad-plus-ci/repo-screencast ./qa-frames.sh [scene-id ...]
# Writes $REPO/.qa/<id>-{1,2,3}.png (full size, at 20 %, 50 % and 88 % of the clip) and a 2x2
# contact sheet $REPO/.qa/<id>-sheet.png. Uses the same ffmpeg image as render.sh.
set -euo pipefail
REPO="${REPO:?set REPO}"
MEDIA_IMAGE="${MEDIA_IMAGE:-bmad-media:ffmpeg}"
OUT="$REPO/.qa"
mkdir -p "$OUT"
chmod a+rwx "$OUT"
SC="$REPO/tools/media/screencast"

if [ "$#" -gt 0 ]; then IDS=("$@"); else mapfile -t IDS < <(grep -o '"id": *"[^"]*"' "$SC/scenes/scenes.json" | sed 's/.*: *"\(.*\)"/\1/'); fi

cat > "$OUT/frames.sh" <<'EOS'
#!/bin/bash
id="$1"
f="/clips/$id.mp4"
d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$f")
i=1
for p in 0.20 0.50 0.88; do
  t=$(awk -v d="$d" -v p="$p" 'BEGIN{printf "%.3f", d*p}')
  ffmpeg -hide_banner -loglevel error -y -ss "$t" -i "$f" -frames:v 1 "/qa/$id-$i.png"
  i=$((i+1))
done
ffmpeg -hide_banner -loglevel error -y -i "/qa/$id-1.png" -i "/qa/$id-2.png" -i "/qa/$id-3.png" \
  -filter_complex "[0]scale=640:360[a];[1]scale=640:360[b];[2]scale=640:360[c];color=c=black:s=640x360[d];[a][b]hstack[t];[c][d]hstack[u];[t][u]vstack" \
  -frames:v 1 "/qa/$id-sheet.png"
EOS
chmod +x "$OUT/frames.sh"
for id in "${IDS[@]}"; do
  docker run --rm -u "$(id -u):$(id -g)" -v "$REPO/website/media/screencasts:/clips:ro" -v "$OUT:/qa" "$MEDIA_IMAGE" bash /qa/frames.sh "$id"
done
echo "frames in $OUT"
