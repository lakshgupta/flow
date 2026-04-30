#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/checksums.sh"
source "$ROOT_DIR/scripts/lib/version.sh"

FRONTEND_DIR="$ROOT_DIR/frontend"
STATIC_DIR="$ROOT_DIR/internal/httpapi/static"
DIST_DIR="$ROOT_DIR/dist"
STAGING_DIR="$DIST_DIR/linux-amd64"
VERSION="$(release_version)"
ARCHIVE_NAME="$(linux_amd64_archive_name "$VERSION")"
CHECKSUM_NAME="$(linux_amd64_checksum_name "$VERSION")"
INSTALLER_NAME="install.sh"

rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"

pushd "$FRONTEND_DIR" >/dev/null
npm ci
# Remove prior emitted frontend bundles so the next binary embeds only fresh assets.
rm -rf "$STATIC_DIR/assets"
rm -f "$STATIC_DIR/index.html"
npm run build
popd >/dev/null

pushd "$ROOT_DIR" >/dev/null
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build \
	-trimpath \
	-ldflags "-s -w -X main.version=${VERSION}" \
	-o "$STAGING_DIR/flow" \
	./cmd/flow
popd >/dev/null

cp "$ROOT_DIR/LICENSE" "$STAGING_DIR/LICENSE"
install -m 0755 "$ROOT_DIR/scripts/install.sh" "$DIST_DIR/$INSTALLER_NAME"

tar -C "$STAGING_DIR" -czf "$DIST_DIR/$ARCHIVE_NAME" flow LICENSE

if ! sha256_tool_available; then
	echo "No SHA-256 utility found; cannot create checksum file." >&2
	exit 1
fi

write_sha256_file "$DIST_DIR/$ARCHIVE_NAME" "$DIST_DIR/$CHECKSUM_NAME"

echo "Staged release artifacts:"
echo "- $DIST_DIR/$ARCHIVE_NAME"
echo "- $DIST_DIR/$CHECKSUM_NAME"
echo "- $DIST_DIR/$INSTALLER_NAME"