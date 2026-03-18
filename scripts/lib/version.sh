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

linux_amd64_artifact_basename() {
	local version="$1"
	printf 'flow-%s-linux-amd64\n' "$version"
}

linux_amd64_archive_name() {
	local version="$1"
	printf '%s.tar.gz\n' "$(linux_amd64_artifact_basename "$version")"
}

linux_amd64_checksum_name() {
	local version="$1"
	printf '%s.sha256\n' "$(linux_amd64_artifact_basename "$version")"
}