---
id: development/20260530-002-REVIEW-desktop-backend-upload/note-findings
type: note
graph: development/20260530-002-REVIEW-desktop-backend-upload
title: Review findings — upload utility duplication
description: sanitizeAssetFileName, makeUniqueUploadFileName, and documentPath validation were duplicated across desktop/backend.go and httpapi/server.go
tags:
    - findings
    - duplication
---

## Findings

**High — Duplication: `sanitizeAssetFileName`, `makeUniqueUploadFileName`, and documentPath validation logic** were identical between `internal/desktop/backend.go` and `internal/httpapi/server.go`. These are now consolidated into `internal/workspace/upload.go` as exported functions (`SanitizeAssetFileName`, `MakeUniqueFileName`, `ResolveAssetDir`, `BuildAssetURL`, `ValidateFileName`).

**Low — Test duplication: `TestMakeUniqueUploadFileName` in `backend_test.go` had duplicate code** within the same function body. Removed the duplicate block during refactoring.

No security, correctness, or architectural issues found. The `writeUploadedFile` function now cleanly delegates path resolution to `workspace.ResolveAssetDir` and file naming to `workspace.MakeUniqueFileName`, improving modularity.
