#!/bin/bash
# Record the real transcripts. Run on the VPS (never on the laptop):
#   REPO=~/bmad-plus-ci/repo-screencast ./run-capture.sh [scenario,scenario]
# Needs Docker. Packs the checkout into a tarball, runs capture.js in node:20-bookworm with a
# throwaway home, and copies transcripts/*.json next to this script's parent.
set -euo pipefail
REPO="${REPO:?set REPO to the checkout on the VPS}"
WORK="${WORK:-$HOME/bmad-plus-ci/screencast-work}"
IMAGE="${IMAGE:-node:20-bookworm}"
mkdir -p "$WORK/out" "$WORK/home"
chmod a+rwx "$WORK/out" "$WORK/home"

# CAPTURE_PACKAGE=bmad-plus@0.23.0 records from a published package instead of this checkout.
PACKAGE_ENV=()
if [ -n "${CAPTURE_PACKAGE:-}" ]; then
  PACKAGE_ENV=(-e "CAPTURE_TARBALL=$CAPTURE_PACKAGE")
else
  docker run --rm -u "$(id -u):$(id -g)" -e HOME=/tmp/h -v "$REPO:/repo:ro" -v "$WORK/out:/out" -w /tmp \
    "$IMAGE" bash -c 'mkdir -p /tmp/h && npm pack /repo --ignore-scripts --pack-destination /tmp >/dev/null 2>&1 && cp /tmp/bmad-plus-*.tgz /out/bmad-plus.tgz'
fi

docker run --rm -u "$(id -u):$(id -g)" -e HOME=/home/dev "${PACKAGE_ENV[@]}" \
  -e CAPTURE_COMMIT="${CAPTURE_COMMIT:-unknown}" -e CAPTURE_ONLY="${1:-}" -e CAPTURE_IMAGE="$IMAGE" \
  -v "$WORK/home:/home/dev" -v "$WORK/out:/out" -v "$REPO:/repo:ro" -w /home/dev \
  "$IMAGE" node /repo/tools/media/screencast/capture/capture.js

cp "$WORK"/out/transcripts/*.json "$REPO/tools/media/screencast/transcripts/"
echo "transcripts copied to $REPO/tools/media/screencast/transcripts/"
