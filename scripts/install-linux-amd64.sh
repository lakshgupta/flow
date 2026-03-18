#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/checksums.sh"
source "$ROOT_DIR/scripts/lib/version.sh"

PROJECT_VERSION="$(project_version "$(project_version_file)")"
DEFAULT_ARCHIVE_PATH="$ROOT_DIR/dist/$(linux_amd64_archive_name "$PROJECT_VERSION")"
DEFAULT_CHECKSUM_PATH="$ROOT_DIR/dist/$(linux_amd64_checksum_name "$PROJECT_VERSION")"
LEGACY_ARCHIVE_PATH="$ROOT_DIR/dist/flow-linux-amd64.tar.gz"
LEGACY_CHECKSUM_PATH="$ROOT_DIR/dist/flow-linux-amd64.sha256"
ARCHIVE_PATH="${FLOW_ARCHIVE_PATH:-}"
CHECKSUM_PATH="${FLOW_CHECKSUM_PATH:-}"
INSTALL_DIR="${FLOW_INSTALL_DIR:-$HOME/.local/bin}"
TMP_DIR=""

if [[ -z "$ARCHIVE_PATH" ]]; then
	if [[ -f "$DEFAULT_ARCHIVE_PATH" ]]; then
		ARCHIVE_PATH="$DEFAULT_ARCHIVE_PATH"
	elif [[ -f "$LEGACY_ARCHIVE_PATH" ]]; then
		ARCHIVE_PATH="$LEGACY_ARCHIVE_PATH"
	else
		ARCHIVE_PATH="$DEFAULT_ARCHIVE_PATH"
	fi
fi

if [[ -z "$CHECKSUM_PATH" ]]; then
	if [[ "$ARCHIVE_PATH" == "$LEGACY_ARCHIVE_PATH" ]]; then
		CHECKSUM_PATH="$LEGACY_CHECKSUM_PATH"
	else
		CHECKSUM_PATH="$DEFAULT_CHECKSUM_PATH"
	fi
fi

cleanup() {
	if [[ -n "$TMP_DIR" && -d "$TMP_DIR" ]]; then
		rm -rf "$TMP_DIR"
	fi
}

trap cleanup EXIT

if [[ ! -f "$ARCHIVE_PATH" ]]; then
	echo "Release archive not found: $ARCHIVE_PATH" >&2
	echo "Build it first with: bash ./scripts/build-release-linux-amd64.sh" >&2
	exit 1
fi

if [[ -f "$CHECKSUM_PATH" ]]; then
	if sha256_tool_available; then
		verify_sha256_file "$ARCHIVE_PATH" "$CHECKSUM_PATH"
	else
		echo "Warning: no SHA-256 utility found; skipping checksum verification." >&2
	fi
else
	echo "Warning: checksum file not found; skipping verification: $CHECKSUM_PATH" >&2
fi

TMP_DIR="$(mktemp -d)"
tar -C "$TMP_DIR" -xzf "$ARCHIVE_PATH"

if [[ ! -f "$TMP_DIR/flow" ]]; then
	echo "Archive does not contain a flow binary: $ARCHIVE_PATH" >&2
	exit 1
fi

if [[ ! -f "$TMP_DIR/LICENSE" ]]; then
	echo "Warning: archive does not contain a LICENSE file: $ARCHIVE_PATH" >&2
fi

mkdir -p "$INSTALL_DIR"
install -m 0755 "$TMP_DIR/flow" "$INSTALL_DIR/flow"

echo "Installed flow to $INSTALL_DIR/flow"
echo "Ensure $INSTALL_DIR is on your PATH before running flow."