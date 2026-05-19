#!/usr/bin/env bash
# Build a .deb installable package for Linux using nfpm.
# Usage: build-package-linux.sh [amd64|arm64]
#
# Prerequisites:
#   - The release binary must already exist at dist/linux-<arch>/flow
#     (run build-release.sh first).
#   - nfpm must be on PATH, or Go must be available to install it.
#   - FLOW_VERSION may be set to override the version read from VERSION file.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/version.sh"

GOARCH="${1:-amd64}"
export VERSION GOARCH
VERSION="$(release_version)"

if ! command -v nfpm >/dev/null 2>&1; then
	echo "nfpm not found; installing via go install..." >&2
	go install github.com/goreleaser/nfpm/v2/cmd/nfpm@latest
fi

mkdir -p "$ROOT_DIR/dist"

DEB_PATH="$ROOT_DIR/dist/flow_${VERSION}_${GOARCH}.deb"

# Expand $GOARCH and $VERSION in the nfpm config before passing it in, because
# older nfpm releases do not interpolate environment variables in content src paths.
NFPM_CONF="$(mktemp /tmp/nfpm-XXXXXX.yaml)"
trap 'rm -f "$NFPM_CONF"' EXIT
envsubst < "$ROOT_DIR/packaging/linux/nfpm.yaml" > "$NFPM_CONF"

nfpm package \
        --config "$NFPM_CONF" \
