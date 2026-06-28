---
id: development/20260627-009-REFACTOR-frontend-performance/changes
type: note
graph: development/20260627-009-REFACTOR-frontend-performance
title: Performance refactor details
description: Details of structural changes, behavior guarantees, and validation
tags:
    - refactor
---

## Changes Included

1. **GraphTree.tsx** — Wrap `FileTreeRow` with `memo` to prevent re-renders on parent state changes. Wrap `favoriteGraphs` and `fileTree` in `useMemo`. Pass `isCollapsed` boolean instead of the full `collapsed` Set, reducing prop comparison churn. Fixed bug where recursive children rendering referenced the renamed `collapsed` prop (caused runtime ReferenceError → black screen).

2. **GraphCanvasOverlayNodes.tsx** — Remove `useEffect` that synced draft descriptions from `graphCanvasNodes`, avoiding a render hook per node. Simplify `handleDescriptionCommit` to delete the draft entry after save instead of keeping stale state.

3. **useGraphCanvasSurfaceActions.ts** — Add `dragPositionRef` to skip intermediate React state updates during node drag; the final position is applied once on drag stop. Reduces re-renders per frame during canvas node drag.

