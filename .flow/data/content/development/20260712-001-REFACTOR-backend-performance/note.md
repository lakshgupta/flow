---
id: development/20260712-001-REFACTOR-backend-performance/note
type: note
graph: development/20260712-001-REFACTOR-backend-performance
title: Backend refactor notes
description: Scope, implementation decisions, and validation for backend code review changes
---

<p>Commit: 332374f</p>

## Scope

Comprehensive Go backend refactor addressing findings from a full code review of `internal/httpapi`, `internal/workspace`, `internal/markdown`, `internal/graph`, `internal/index`, and `internal/desktop`.

## Changes

1. **Document interface accessors** — Added `ID()`, `Graph()`, `Title()`, `Description()`, `Tags()`, `CreatedAt()`, `UpdatedAt()`, `Color()`, `Links()`, `BodyContent()`, `MetadataCommon()` to `markdown.Document`. Eliminated ~15 repeated type-switch statements across the codebase.

2. **Data race fix** — Changed `apiHandler.options.Root` from unprotected struct field to `atomic.Value` with a `resolvedRoot()` accessor. The root field was mutated on workspace switch while concurrent request handlers read it without synchronization.

3. **O(n²) elimination in single-document endpoints** — `handleDocument` and `loadDocumentResponse` were calling `buildDocumentResponse` (which resolves inline references in O(n)) for every document in a loop. Changed to find the matching document first via simple ID comparison, reducing to O(n).

4. **Load-all-documents optimization** — `Backend.GraphTree` loaded all workspace documents just to extract the home document. Changed to read `home.md` directly from `root.HomePath`, eliminating the full filesystem walk.

5. **Redundant scan elimination** — `loadHomeResponse` iterated all documents to find the home item by path; now constructs it directly from the already-parsed home response.

6. **Helper deduplication** — Moved `CloneStrings`, `CloneMap`, `LooksLikeFlowDocument`, `DeriveHomeTitle`, `NormalizeMarkdownText` to `internal/markdown`. Replaced 3 copies of `cloneStrings` with `slices.Clone`.

7. **Dead code removal** — Removed unused `workspaceConfigGraphColors` and `fileExists` functions.

8. **File descriptor leak fix** — Replaced `defer source.Close()` inside `filepath.WalkDir` callbacks in archive builders with explicit close.

9. **Unbounded loop guard** — Added 10,000 iteration safety limit to `uniqueAssetFileName`.

## Validation

- `go build ./...` — clean
- `go vet ./...` — clean
- `go test ./...` — all packages pass
- Changed files: 8 Go source files across 5 packages
