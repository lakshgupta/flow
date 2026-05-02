#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

FLOW_TARGET_OS=linux FLOW_TARGET_ARCH=amd64 exec "$ROOT_DIR/scripts/install-local-release.sh"