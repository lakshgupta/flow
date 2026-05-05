#!/usr/bin/env bash

set -euo pipefail

REPO_SLUG="${FLOW_RELEASE_REPO:-lex/flow}"
INSTALL_DIR="${FLOW_INSTALL_DIR:-$HOME/.local/bin}"
VERSION_ARG="${1:-}"
TMP_DIR=""
RELEASE_BASE_URL="${FLOW_RELEASE_BASE_URL:-https://github.com/${REPO_SLUG}/releases/download}"

usage() {
	cat <<'EOF'
Usage: install.sh [version]

Installs the latest Flow release for the current OS and architecture.
Pass an explicit version such as 0.1.0 or v0.1.0 to install an older release.

Environment overrides:
  FLOW_INSTALL_DIR   Destination directory for the flow binary
  FLOW_RELEASE_REPO  GitHub repository in owner/name format
	FLOW_RELEASE_BASE_URL Base URL for release downloads (advanced)
	FLOW_TARGET_OS     Override detected OS (linux or darwin)
	FLOW_TARGET_ARCH   Override detected architecture (amd64 or arm64)
	FLOW_INSTALL_DRY_RUN Set to 1 to print selected asset names and exit
EOF
}

cleanup() {
	if [[ -n "$TMP_DIR" && -d "$TMP_DIR" ]]; then
		rm -rf "$TMP_DIR"
	fi
}

trap cleanup EXIT

download() {
	local url="$1"
	local destination="$2"

	if command -v curl >/dev/null 2>&1; then
		curl -fsSL "$url" -o "$destination"
		return 0
	fi

	if command -v wget >/dev/null 2>&1; then
		wget -qO "$destination" "$url"
		return 0
	fi

	echo "curl or wget is required to download Flow releases." >&2
	return 1
}

download_text() {
	local url="$1"

	if command -v curl >/dev/null 2>&1; then
		curl -fsSL "$url"
		return 0
	fi

	if command -v wget >/dev/null 2>&1; then
		wget -qO- "$url"
		return 0
	fi

	echo "curl or wget is required to download Flow releases." >&2
	return 1
}

sha256_tool_available() {
	command -v sha256sum >/dev/null 2>&1 || command -v shasum >/dev/null 2>&1
}

sha256_digest() {
	local path="$1"

	if command -v sha256sum >/dev/null 2>&1; then
		sha256sum "$path" | awk '{print $1}'
		return 0
	fi

	if command -v shasum >/dev/null 2>&1; then
		shasum -a 256 "$path" | awk '{print $1}'
		return 0
	fi

	return 1
}

verify_sha256_file() {
	local archive_path="$1"
	local checksum_path="$2"
	local expected_digest
	local actual_digest

	expected_digest="$(awk 'NF { print $1; exit }' "$checksum_path")"
	if [[ -z "$expected_digest" ]]; then
		echo "Checksum file is empty or invalid: $checksum_path" >&2
		return 1
	fi

	actual_digest="$(sha256_digest "$archive_path")" || return 1
	if [[ "$expected_digest" != "$actual_digest" ]]; then
		echo "SHA-256 checksum mismatch for $archive_path" >&2
		return 1
	fi

	return 0
}

normalize_os() {
	local raw_os
	raw_os="${FLOW_TARGET_OS:-$(uname -s)}"

	case "$raw_os" in
		linux|Linux)
			printf 'linux\n'
			;;
		darwin|Darwin|macos|macOS|MacOS)
			printf 'darwin\n'
			;;
		*)
			echo "Unsupported OS: $raw_os" >&2
			return 1
			;;
	esac
}

normalize_arch() {
	local raw_arch
	raw_arch="${FLOW_TARGET_ARCH:-$(uname -m)}"

	case "$raw_arch" in
		x86_64|amd64)
			printf 'amd64\n'
			;;
		aarch64|arm64|arm64e)
			printf 'arm64\n'
			;;
		*)
			echo "Unsupported architecture: $raw_arch" >&2
			return 1
			;;
	esac
}

release_target_supported() {
	local os_name="$1"
	local arch_name="$2"

	case "${os_name}/${arch_name}" in
		linux/amd64|darwin/amd64|darwin/arm64)
			return 0
			;;
		*)
			return 1
			;;
	esac
}

release_tag_candidates() {
	local version_arg="$1"

	if [[ "$version_arg" == v* ]]; then
		printf '%s\n' "$version_arg"
		printf '%s\n' "${version_arg#v}"
		return 0
	fi

	printf '%s\n' "$version_arg"
	printf 'v%s\n' "$version_arg"
}

latest_release_tag() {
	local repo_slug="$1"
	local metadata
	local tag

	metadata="$(download_text "https://api.github.com/repos/${repo_slug}/releases/latest")" || return 1
	tag="$(printf '%s' "$metadata" | tr -d '\n' | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
	if [[ -z "$tag" ]]; then
		echo "Could not determine the latest release tag for ${repo_slug}." >&2
		return 1
	fi

	printf '%s\n' "$tag"
}

download_release_assets() {
	local repo_slug="$1"
	local version_arg="$2"
	local os_name="$3"
	local arch_name="$4"
	local archive_path="$5"
	local checksum_path="$6"
	local base_release_url="$7"
	local normalized_version
	local archive_name
	local checksum_name
	local tag
	local base_url
	local requested_version

	requested_version="$version_arg"
	if [[ -z "$requested_version" ]]; then
		requested_version="$(latest_release_tag "$repo_slug")" || return 1
	fi

	normalized_version="${requested_version#v}"
	archive_name="flow-${normalized_version}-${os_name}-${arch_name}.tar.gz"
	checksum_name="flow-${normalized_version}-${os_name}-${arch_name}.sha256"

	if [[ "${FLOW_INSTALL_DRY_RUN:-0}" == "1" ]]; then
		echo "Dry run: would install ${archive_name} from tag ${requested_version}."
		echo "Dry run: base release URL is ${base_release_url}."
		return 0
	fi

	while IFS= read -r tag; do
		base_url="${base_release_url}/${tag}"

		if download "$base_url/$archive_name" "$archive_path" && download "$base_url/$checksum_name" "$checksum_path"; then
			return 0
		fi
	done < <(release_tag_candidates "$requested_version")

	if [[ -z "$version_arg" ]]; then
		echo "Could not download the latest release assets for ${os_name}/${arch_name} from ${repo_slug}." >&2
	else
		echo "Could not download Flow ${version_arg} for ${os_name}/${arch_name} from ${repo_slug}." >&2
	fi

	return 1
}

if [[ "$VERSION_ARG" == "-h" || "$VERSION_ARG" == "--help" ]]; then
	usage
	exit 0
fi

OS_NAME="$(normalize_os)"
ARCH_NAME="$(normalize_arch)"

if ! release_target_supported "$OS_NAME" "$ARCH_NAME"; then
	echo "No Flow release artifact is published for ${OS_NAME}/${ARCH_NAME}. Supported release targets are linux/amd64, darwin/amd64, and darwin/arm64." >&2
	exit 1
fi

TMP_DIR="$(mktemp -d 2>/dev/null || mktemp -d -t flow-install)"
ARCHIVE_PATH="$TMP_DIR/flow.tar.gz"
CHECKSUM_PATH="$TMP_DIR/flow.sha256"

download_release_assets "$REPO_SLUG" "$VERSION_ARG" "$OS_NAME" "$ARCH_NAME" "$ARCHIVE_PATH" "$CHECKSUM_PATH" "$RELEASE_BASE_URL"

if [[ "${FLOW_INSTALL_DRY_RUN:-0}" == "1" ]]; then
	exit 0
fi

if sha256_tool_available; then
	verify_sha256_file "$ARCHIVE_PATH" "$CHECKSUM_PATH"
else
	echo "Warning: no SHA-256 utility found; skipping checksum verification." >&2
fi

tar -C "$TMP_DIR" -xzf "$ARCHIVE_PATH"

if [[ ! -f "$TMP_DIR/flow" ]]; then
	echo "Archive does not contain a flow binary." >&2
	exit 1
fi

mkdir -p "$INSTALL_DIR"
if command -v install >/dev/null 2>&1; then
	install -m 0755 "$TMP_DIR/flow" "$INSTALL_DIR/flow"
else
	cp "$TMP_DIR/flow" "$INSTALL_DIR/flow"
	chmod 0755 "$INSTALL_DIR/flow"
fi

echo "Installed flow to $INSTALL_DIR/flow"
echo "Ensure $INSTALL_DIR is on your PATH before running flow."