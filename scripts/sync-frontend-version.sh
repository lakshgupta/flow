#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/version.sh"

TARGET_VERSION="${1:-$(release_version)}"
PACKAGE_JSON_PATH="$ROOT_DIR/frontend/package.json"
PACKAGE_LOCK_PATH="$ROOT_DIR/frontend/package-lock.json"

VERSION="$TARGET_VERSION" PACKAGE_JSON_PATH="$PACKAGE_JSON_PATH" PACKAGE_LOCK_PATH="$PACKAGE_LOCK_PATH" node <<'EOF'
const fs = require('node:fs');

const version = process.env.VERSION;
const packageJsonPath = process.env.PACKAGE_JSON_PATH;
const packageLockPath = process.env.PACKAGE_LOCK_PATH;

if (!version) {
  throw new Error('VERSION is required');
}

const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
if (packageJson.version !== version) {
  packageJson.version = version;
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

let packageLock = fs.readFileSync(packageLockPath, 'utf8');
const replacements = [
  {
    pattern: /^(\{\s*"name":\s*"flow-frontend",\s*"version":\s*)"[^"]+"/,
    description: 'package-lock root version',
  },
  {
    pattern: /("packages":\s*\{\s*"":\s*\{\s*"name":\s*"flow-frontend",\s*"version":\s*)"[^"]+"/,
    description: 'package-lock root package version',
  },
];

for (const replacement of replacements) {
  if (!replacement.pattern.test(packageLock)) {
    throw new Error(`Could not find ${replacement.description} in ${packageLockPath}`);
  }
  packageLock = packageLock.replace(replacement.pattern, `$1"${version}"`);
}

fs.writeFileSync(packageLockPath, packageLock);
EOF

echo "Synced frontend version to ${TARGET_VERSION}."