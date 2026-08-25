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
  windows amd64
  windows arm64
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
ROOT_INSTALLER_NAME="flow-install.sh"

rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"
mkdir -p "$DIST_DIR"

if [[ "${FLOW_SKIP_FRONTEND_BUILD:-0}" != "1" ]]; then
	bash "$ROOT_DIR/scripts/sync-frontend-version.sh" "$VERSION"
	pushd "$FRONTEND_DIR" >/dev/null
	npm ci
	# Remove prior emitted frontend bundles so the next binary embeds only fresh assets.
	rm -rf "$STATIC_DIR/assets"
	rm -f "$STATIC_DIR/index.html"
	npm run build
	popd >/dev/null
fi

pushd "$ROOT_DIR" >/dev/null
	# Binary naming: Windows uses flow.exe.
	if [[ "$TARGET_OS" == "windows" ]]; then
		BINARY_NAME="flow.exe"
	else
		BINARY_NAME="flow"
	fi

	# Desktop mode (Wails) requires CGO and platform-specific WebView libraries.
	# - Linux: webkit2gtk-4.1 (install libwebkit2gtk-4.1-dev before building)
	# - macOS: WebKit.framework is always available; no extra install needed
	# - Windows: WebView2 + mingw required for Wails; CLI-only build ships without Wails on Windows to avoid CGO toolchain
	# The webkit2_41 tag switches Wails from webkit2gtk-4.0 to webkit2gtk-4.1,
	# required on Ubuntu 24.04+ and other modern distros.
	if [[ "$TARGET_OS" == "linux" ]]; then
		WAILS_TAGS="wails,production,webkit2_41"
	elif [[ "$TARGET_OS" == "windows" ]]; then
		WAILS_TAGS="production"
	else
		WAILS_TAGS="wails,production"
	fi

	# UniformTypeIdentifiers (UTType) requires macOS 11+.
	# (a) MACOSX_DEPLOYMENT_TARGET tells the linker the minimum supported OS so
	#     that symbols introduced in macOS 11+ are considered valid for the target.
	#     Set it to the actual installed SDK version to avoid a mismatch warning
	#     between Go objects (compiled for host macOS) and the CGO link target.
	# (b) Wails' WailsContext.m references UTType but its #cgo LDFLAGS do not
	#     include -framework UniformTypeIdentifiers, so the linker cannot find
	#     _OBJC_CLASS_$_UTType without an explicit flag here.
	if [[ "$TARGET_OS" == "darwin" ]]; then
		_sdk_ver=$(xcrun --sdk macosx --show-sdk-version 2>/dev/null || true)
		export MACOSX_DEPLOYMENT_TARGET="${_sdk_ver:-11.0}"
		export CGO_LDFLAGS="-framework UniformTypeIdentifiers"
	fi

	if [[ "$TARGET_OS" == "windows" ]]; then
		# Windows: CLI-only, no CGO/Wails to allow cross-compile from Linux without mingw.
		CGO_ENABLED=0 GOOS="$TARGET_OS" GOARCH="$TARGET_ARCH" go build \
			-tags="$WAILS_TAGS" \
			-trimpath \
			-ldflags "-s -w -X main.version=${VERSION}" \
			-o "$STAGING_DIR/$BINARY_NAME" \
			./cmd/flow
	else
		CGO_ENABLED=1 GOOS="$TARGET_OS" GOARCH="$TARGET_ARCH" go build \
			-tags="$WAILS_TAGS" \
			-trimpath \
			-ldflags "-s -w -X main.version=${VERSION}" \
			-o "$STAGING_DIR/$BINARY_NAME" \
			./cmd/flow
	fi
popd >/dev/null

cp "$ROOT_DIR/LICENSE" "$STAGING_DIR/LICENSE"
install -m 0755 "$ROOT_DIR/scripts/install.sh" "$DIST_DIR/$INSTALLER_NAME"
install -m 0755 "$ROOT_DIR/flow-install.sh" "$DIST_DIR/$ROOT_INSTALLER_NAME"

if [[ "$TARGET_OS" == "windows" ]]; then
	# Windows releases ship as zip (flow.exe + LICENSE).
	if command -v zip >/dev/null 2>&1; then
		( cd "$STAGING_DIR" && zip -q "$DIST_DIR/$ARCHIVE_NAME" "$BINARY_NAME" LICENSE )
	else
		# Fallback to tar.gz if zip is unavailable (still extractable on Windows 10+)
		tar -C "$STAGING_DIR" -czf "$DIST_DIR/$ARCHIVE_NAME" "$BINARY_NAME" LICENSE
	fi
else
	tar -C "$STAGING_DIR" -czf "$DIST_DIR/$ARCHIVE_NAME" "$BINARY_NAME" LICENSE
fi

if ! sha256_tool_available; then
	echo "No SHA-256 utility found; cannot create checksum file." >&2
	exit 1
fi

write_sha256_file "$DIST_DIR/$ARCHIVE_NAME" "$DIST_DIR/$CHECKSUM_NAME"

echo "Staged release artifacts for ${TARGET_OS}/${TARGET_ARCH}:"
echo "- $DIST_DIR/$ARCHIVE_NAME"
echo "- $DIST_DIR/$CHECKSUM_NAME"
echo "- $DIST_DIR/$INSTALLER_NAME"
echo "- $DIST_DIR/$ROOT_INSTALLER_NAME"