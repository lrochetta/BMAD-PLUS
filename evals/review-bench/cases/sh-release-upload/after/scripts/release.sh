#!/usr/bin/env bash
# Build the release archive for the version given as the first argument, stage it
# and upload it to the release host.
set -eo pipefail

VERSION="$1"
echo "Releasing ${VERSION}"
npm run build

eval "$(ssh-agent -s)"
trap 'ssh-agent -k >/dev/null' EXIT
ssh-add ~/.ssh/release_upload

rm -rf "$STAGING_DIR"/*
mkdir -p "$STAGING_DIR"
cp -R dist/. "$STAGING_DIR"/

curl -fsSL https://get.example.com/uploader/install.sh | sh
uploader push "$STAGING_DIR" --tag "$VERSION"
