---
id: development/20260806-001-FEAT-ui-pastel-notion-lookfe/tests-visual
type: task
graph: development/20260806-001-FEAT-ui-pastel-notion-lookfe
title: Test and regenerate visual regression baselines
description: Run cd frontend && npm test (vitest); regenerate visual regression snapshots with npm run test:visual and confirm diffs are the intended pastel restyle; run go build/test as needed
status: Done
commit: 5b55233
---

Done — 20260806. Validated the full pastel restyle:

- `cd frontend && npm test`: 26/26 files, 183/183 tests pass.
- `npm run test:visual` (Playwright, chromium + firefox): all 12 visual baselines regenerated (6 screenshots × 2 browsers) and passing against the new app render.
- Diffs confirmed intentional: light-theme means shifted warm off-white (#F9F6F0 -> #F9F7F6 family, matching the `#faf9f7` token); file sizes dropped sharply (e.g. light tablet chromium 212KB -> 61KB) consistent with flat hairline surfaces replacing gradients; dark-theme snapshots now genuinely dark (#161619-#1F1F22, matching `#0b0b0e`).
- `go build ./...` OK; `go test ./internal/...` all packages pass.

Spec fixes required to regenerate (pre-existing test bugs, not restyle defects):

- The ready-marker `text=Navigation` no longer exists in the sidebar (sections are now Home / Favorites / Content); replaced with `text=FRESH WORKSPACE` (home surface, visible at every viewport under the spec mocks).
- The theme toggle wrote `localStorage.flow-theme` and reloaded, but ThemeProvider (`frontend/src/lib/theme.tsx`) never reads localStorage — both "dark" screenshots were actually light-themed. Replaced with direct `documentElement` class/dataset toggling matching `applyTheme()` (classList.add/remove('dark'), data-theme, color-scheme). Dark baselines now exercise real dark-mode rendering.
