---
id: development/20260612-001-FIX-desktop-excalidraw-load/cleanup-remove-diagrams
type: task
graph: development/20260612-001-FIX-desktop-excalidraw-load
title: Remove Mermaid/Excalidraw rendering code
description: Drop the Mermaid/Excalidraw diagram support from the editor and renderer
tags:
    - refactor
    - cleanup
status: Done
---

After multiple failed attempts to make the `/` slash-menu trigger reliably
insert Mermaid/Excalidraw code blocks (and a separate Wails desktop load
crash documented in `root-cause.md`), the team decided to remove the
diagram support entirely. The code blocks remain in the markdown schema
(plain fenced blocks) but no longer render as interactive diagrams.

This commit also bundles the surrounding editor improvements that were
sitting in the working tree: `crypto.subtle` polyfill, the `view`
existence guard in the code-block exit keymap, `defineDiagLogPlugin`
wiring, the `0.5.0-dev → 0.6.0-dev` version bump, the obsidian-style
editor/thread loading work, and related test/script cleanups. The user
explicitly requested a single "commit all the changes" run, so unrelated
edits are included on purpose.
