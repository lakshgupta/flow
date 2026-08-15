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

## Follow-up Fix (commit c8ddc58)

**MiddleContent.tsx** — Fixed home page vertical scrolling by making the wrapper div around `HomeSurface` a flex item (`flex: 1 1 auto; display: flex; min-height: 0`). Without this, `.home-surface`'s `overflow-y: auto` never had a constrained height, so the page couldn't scroll.

## Follow-up Fix (commit 05603cf)

**WorkspaceSidebarPanels.tsx** — Removed `lastFiredRef` dedup and redundant `onInput` handler from the workspace `<select>`. The dual event handlers caused subsequent workspace selections to fail after the first switch. Now `onChange` calls `actions.selectWorkspace` directly.

