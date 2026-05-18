#!/usr/bin/env bash
# Build a .dmg installable package for macOS.
# Usage: build-package-macos.sh [amd64|arm64]
#
# Prerequisites:
#   - The release binary must already exist at dist/darwin-<arch>/flow
#     (run build-release.sh first).
#   - Must run on macOS (requires sips, iconutil, hdiutil).
#   - FLOW_VERSION may be set to override the version read from VERSION file.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/version.sh"

TARGET_ARCH="${1:-amd64}"
VERSION="$(release_version)"

BINARY="$ROOT_DIR/dist/darwin-${TARGET_ARCH}/flow"
ICON_SRC="$ROOT_DIR/frontend/src/assets/flow_logo_macos.png"
APP_BUNDLE="$ROOT_DIR/dist/Flow.app"
DMG_PATH="$ROOT_DIR/dist/flow_${VERSION}_darwin_${TARGET_ARCH}.dmg"

if [[ ! -f "$BINARY" ]]; then
	echo "Binary not found: $BINARY" >&2
	exit 1
fi

# ── Build .app bundle ────────────────────────────────────────────────────────
rm -rf "$APP_BUNDLE"
mkdir -p "$APP_BUNDLE/Contents/MacOS"
mkdir -p "$APP_BUNDLE/Contents/Resources"

cp "$BINARY" "$APP_BUNDLE/Contents/MacOS/flow"
chmod 755 "$APP_BUNDLE/Contents/MacOS/flow"

# Write Info.plist, substituting the version placeholder.
sed "s/VERSION_PLACEHOLDER/$VERSION/g" \
	"$ROOT_DIR/packaging/macos/Info.plist" \
	> "$APP_BUNDLE/Contents/Info.plist"

# ── Convert PNG → .icns ─────────────────────────────────────────────────────
ICONSET_DIR="$ROOT_DIR/dist/flow.iconset"
rm -rf "$ICONSET_DIR"
mkdir -p "$ICONSET_DIR"

for size in 16 32 128 256 512; do
	double=$((size * 2))
	sips -z "$size" "$size"     "$ICON_SRC" --out "$ICONSET_DIR/icon_${size}x${size}.png"    >/dev/null
	sips -z "$double" "$double" "$ICON_SRC" --out "$ICONSET_DIR/icon_${size}x${size}@2x.png" >/dev/null
done

iconutil -c icns "$ICONSET_DIR" -o "$APP_BUNDLE/Contents/Resources/flow.icns"
rm -rf "$ICONSET_DIR"

# ── Create DMG ───────────────────────────────────────────────────────────────
rm -f "$DMG_PATH"
hdiutil create \
	-volname "Flow" \
	-srcfolder "$APP_BUNDLE" \
	-ov \
	-format UDZO \
	-o "$DMG_PATH"

rm -rf "$APP_BUNDLE"
echo "Built: $DMG_PATH"
