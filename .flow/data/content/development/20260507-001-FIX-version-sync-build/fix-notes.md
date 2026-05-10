---
id: development/20260507-001-FIX-version-sync-build/fix-notes
type: note
graph: development/20260507-001-FIX-version-sync-build
title: Version sync fix notes
description: Root cause, fix, and validation for frontend/internal version drift
---

Root cause

- internal/buildinfo/VERSION was already the canonical version source for the CLI and release archive names, but frontend/package.json and frontend/package-lock.json could drift independently.

Fix

- Added scripts/sync-frontend-version.sh to copy the canonical version into frontend/package.json and frontend/package-lock.json.
- Updated scripts/build-release.sh to call the sync helper before npm ci so release builds always align frontend metadata with the Go build version.
- Added frontend package.json prebuild hook so direct npm run build also syncs from internal/buildinfo/VERSION.
- Updated docs/reference.md, docs/release.md, and README.md to document the canonical version source and the sync behavior.

Validation

- bash -n scripts/sync-frontend-version.sh scripts/build-release.sh
- bash ./scripts/build-release.sh linux amd64
- cd frontend && npm run build
- editor diagnostics: README.md