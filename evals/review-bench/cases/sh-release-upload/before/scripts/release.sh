#!/usr/bin/env bash
# Build the release archive for the version given as the first argument.
set -eo pipefail

VERSION="$1"
echo "Releasing ${VERSION}"
npm run build
