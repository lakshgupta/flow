#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/checksums.sh"
source "$ROOT_DIR/scripts/lib/version.sh"

TARGET_OS="$(normalize_release_os_name "${1:-}" || true)"
TARGET_ARCH="$(normalize_release_arch_name "${2:-}" || true)"

if [[ -z "$TARGET_OS" || -z "$TARGET_ARCH" ]]; then
	cat <<'EOF' >&2
Usage: build-release.sh <os> <arch>

Supported targets:
  linux amd64
  darwin amd64
  darwin arm64
EOF
	exit 1
fi

if ! release_target_supported "$TARGET_OS" "$TARGET_ARCH"; then
	echo "Unsupported release target: ${TARGET_OS}/${TARGET_ARCH}" >&2
	exit 1
fi

FRONTEND_DIR="$ROOT_DIR/frontend"
STATIC_DIR="$ROOT_DIR/internal/httpapi/static"
DIST_DIR="$ROOT_DIR/dist"
STAGING_DIR="$DIST_DIR/${TARGET_OS}-${TARGET_ARCH}"
VERSION="$(release_version)"
ARCHIVE_NAME="$(release_archive_name "$VERSION" "$TARGET_OS" "$TARGET_ARCH")"
CHECKSUM_NAME="$(release_checksum_name "$VERSION" "$TARGET_OS" "$TARGET_ARCH")"
INSTALLER_NAME="install.sh"

rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"
mkdir -p "$DIST_DIR"

if [[ "${FLOW_SKIP_FRONTEND_BUILD:-0}" != "1" ]]; then
	pushd "$FRONTEND_DIR" >/dev/null
	npm ci
	# Remove prior emitted frontend bundles so the next binary embeds only fresh assets.
	rm -rf "$STATIC_DIR/assets"
	rm -f "$STATIC_DIR/index.html"
	npm run build
	popd >/dev/null
fi

pushd "$ROOT_DIR" >/dev/null
	CGO_ENABLED=0 GOOS="$TARGET_OS" GOARCH="$TARGET_ARCH" go build \
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

echo "Staged release artifacts for ${TARGET_OS}/${TARGET_ARCH}:"
echo "- $DIST_DIR/$ARCHIVE_NAME"
echo "- $DIST_DIR/$CHECKSUM_NAME"
echo "- $DIST_DIR/$INSTALLER_NAME"