#!/usr/bin/env bash

sha256_tool_available() {
	command -v sha256sum >/dev/null 2>&1 || command -v shasum >/dev/null 2>&1
}

sha256_digest() {
	local path="$1"

	if command -v sha256sum >/dev/null 2>&1; then
		sha256sum "$path" | awk '{print $1}'
		return
	fi

	if command -v shasum >/dev/null 2>&1; then
		shasum -a 256 "$path" | awk '{print $1}'
		return
	fi

	return 1
}

write_sha256_file() {
	local archive_path="$1"
	local checksum_path="$2"
	local digest

	digest="$(sha256_digest "$archive_path")" || return 1
	printf '%s  %s\n' "$digest" "$(basename "$archive_path")" > "$checksum_path"
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