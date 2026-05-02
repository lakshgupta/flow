#!/usr/bin/env bash

project_version_file() {
	printf '%s\n' "$ROOT_DIR/internal/buildinfo/VERSION"
}

project_version() {
	local version_path="$1"
	local version

	if [[ ! -f "$version_path" ]]; then
		echo "Project version file not found: $version_path" >&2
		return 1
	fi

	version="$(awk 'NF { print; exit }' "$version_path")"
	if [[ -z "$version" ]]; then
		echo "Project version file is empty: $version_path" >&2
		return 1
	fi

	printf '%s\n' "$version"
}

release_version() {
	if [[ -n "${FLOW_VERSION:-}" ]]; then
		printf '%s\n' "$FLOW_VERSION"
		return 0
	fi

	project_version "$(project_version_file)"
}

normalize_release_os_name() {
	case "$1" in
		linux|Linux)
			printf 'linux\n'
			;;
		darwin|Darwin|macos|macOS|MacOS)
			printf 'darwin\n'
			;;
		*)
			printf '\n'
			return 1
			;;
	esac
}

normalize_release_arch_name() {
	case "$1" in
		x86_64|amd64)
			printf 'amd64\n'
			;;
		aarch64|arm64)
			printf 'arm64\n'
			;;
		*)
			printf '\n'
			return 1
			;;
	esac
}

release_target_supported() {
	case "$1/$2" in
		linux/amd64|darwin/amd64|darwin/arm64)
			return 0
			;;
		*)
			return 1
			;;
	esac
}

release_artifact_basename() {
	local version="$1"
	local os_name="$2"
	local arch_name="$3"
	printf 'flow-%s-%s-%s\n' "$version" "$os_name" "$arch_name"
}

release_archive_name() {
	local version="$1"
	local os_name="$2"
	local arch_name="$3"
	printf '%s.tar.gz\n' "$(release_artifact_basename "$version" "$os_name" "$arch_name")"
}

release_checksum_name() {
	local version="$1"
	local os_name="$2"
	local arch_name="$3"
	printf '%s.sha256\n' "$(release_artifact_basename "$version" "$os_name" "$arch_name")"
}

linux_amd64_artifact_basename() {
	local version="$1"
	release_artifact_basename "$version" linux amd64
}

linux_amd64_archive_name() {
	local version="$1"
	release_archive_name "$version" linux amd64
}

linux_amd64_checksum_name() {
	local version="$1"
	release_checksum_name "$version" linux amd64
}