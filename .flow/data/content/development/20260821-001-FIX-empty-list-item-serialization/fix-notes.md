---
id: development/20260821-001-FIX-empty-list-item-serialization/fix-notes
type: note
graph: development/20260821-001-FIX-empty-list-item-serialization
title: Fix empty list item serialization and desktop autosave test
description: Root cause of the reported issue and serialization fixes
tags:
    - fix
    - editor
    - desktop
---

## Root Cause Of Reported Issue

The user reported that content updates from the desktop app were not pushed to the markdown file. Investigation found the running desktop process is `flow -g desktop`, which resolves the GLOBAL workspace (`~/.config/flow/global-workspace.yaml` -> `~/Documents/notes/flow`) rather than the repo's local workspace. Edits made in the app are written to `~/Documents/notes/flow/.flow/data/...` (confirmed: that home.md was updated at 09:18 while the repo home.md was untouched). The repo markdown files only change when the app runs against the local workspace (launch `flow desktop` from the repo, or select the repo in the workspace dropdown).

## Second Bug Found: Literal HTML In Markdown

While investigating, the global home.md contained literal `<p><br></p>` items. `editorHTMLToMarkdown` serialized empty list items (`<li><p><br></p></li>`) as `- <p><br></p>` — raw HTML written into the markdown body. Also every list item produced a trailing indented blank line (`- one\n    \n- two`).

## Fixes

- `frontend/src/richText.ts`: empty paragraphs inside `<li>` now serialize to nothing (the item becomes empty instead of emitting literal markup), and paragraph wrappers inside list items are stripped so items no longer produce trailing indented blank lines.
- Regression tests added in `frontend/src/richText.test.ts`.
- `frontend/src/App.test.tsx`: the "autosaves the latest rich-text Home body through the Wails binding" test was failing because synthetic DOM mutations in jsdom are not detected by ProseMirror after the initial external value push (setContent). Rewrote it to use `user.type` (the technique proven to work in jsdom, matching the sibling test).

## Validation

- `cd frontend && npm test` — 293 passed (36 files).
- `go test ./...` — all packages pass.
- `npx tsc --noEmit` — clean.