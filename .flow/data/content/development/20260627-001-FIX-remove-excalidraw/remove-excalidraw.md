---
id: development/20260627-001-FIX-remove-excalidraw/remove-excalidraw
type: task
graph: development/20260627-001-FIX-remove-excalidraw
title: Remove Excalidraw section and slash trigger
description: Remove Excalidraw diagram section and /excalidraw slash-menu item
tags:
    - cleanup
    - excalidraw
status: Done
---

Remove Excalidraw support from the editor. The feature was not working
reliably and will be re-added later. Changes:

- Deleted `LazyExcalidraw.tsx` component and `lib/excalidraw.ts` helper library
- Removed `/excalidraw` item from the slash menu
- Removed `excalidraw` from `DIAGRAM_LANGUAGES` in code-block-view
- Stripped all excalidraw references from diagram-section (type, labels, source-change handler)
- Removed `@excalidraw/excalidraw` dependency from package.json
- Removed ~230 lines of excalidraw CSS from styles.css
- Updated docs/architecture.md references
