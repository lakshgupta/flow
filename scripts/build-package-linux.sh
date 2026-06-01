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

echo "Ensuring latest nfpm..." >&2
go install github.com/goreleaser/nfpm/v2/cmd/nfpm@latest
NFPM="$(go env GOPATH)/bin/nfpm"

mkdir -p "$ROOT_DIR/dist"

# Expand $GOARCH and $VERSION in the nfpm config before passing it in, because
# older nfpm releases do not interpolate environment variables in content src paths.
NFPM_CONF="$(mktemp /tmp/nfpm-XXXXXX.yaml)"
trap 'rm -f "$NFPM_CONF"' EXIT
envsubst < "$ROOT_DIR/packaging/linux/nfpm.yaml" > "$NFPM_CONF"

# --output flag requires nfpm >= 2.41; use --target (directory + auto-name)
# for broader version compatibility.
"$NFPM" package \
        --config "$NFPM_CONF" \
        --packager deb \
        --target "$ROOT_DIR/dist/"
