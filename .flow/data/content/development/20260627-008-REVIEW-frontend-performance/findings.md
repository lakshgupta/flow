---
id: development/20260627-008-REVIEW-frontend-performance/findings
type: note
graph: development/20260627-008-REVIEW-frontend-performance
title: Frontend performance findings
description: Performance findings, severities, residual risks, and recommended actions
tags:
    - review
links:
    - node: development/20260627-008-REVIEW-frontend-performance/review-perf
      context: Linked to review task
      relationships:
        - maps-to
---

This note captures the key findings from the performance review of the frontend code. Detailed recommendations are available in `docs/optimization.md`.

## Findings

### Finding 1: Overlay Description Syncing in Drag Frames
- **Severity**: High
- **Area**: rendering, simplification
- **Explanation**: A `useEffect` in `GraphCanvasOverlayNodes.tsx` syncs draft descriptions on every change to `graphCanvasNodes`, which triggers inside pointermove drag frames continuously.
- **Recommended Action**: Eliminate the effect and fall back to `node.data.description` directly when not editing.

### Finding 2: Recursive Sidebar Tree Re-renders
- **Severity**: High
- **Area**: rendering, maintainability
- **Explanation**: `FileTreeRow` is recursive and not memoized; its parent passes the entire `collapsed` Set, causing the entire tree to re-evaluate on any toggle.
- **Recommended Action**: Wrap in `memo`, pass a boolean `isCollapsed` instead of the Set, and memoize tree build helpers.

### Finding 3: Root State Bloat in App.tsx
- **Severity**: Medium
- **Area**: architecture, simplification
- **Explanation**: `App.tsx` contains 80+ state hooks. Unrelated changes (e.g. dialog visibility) trigger workspace-wide render passes.
- **Recommended Action**: Extract dialog states and split contexts.

### Finding 4: Eager Loading of Heavy Bundles
- **Severity**: Medium
- **Area**: architecture
- **Explanation**: Shiki, Katex, Mermaid, and ElkJS are loaded eagerly.
- **Recommended Action**: Use Vite dynamic imports (`import()`) to lazy load these components.

## Residual Risks
- Dynamic imports for editor extensions (e.g., Shiki) might introduce minor visual flashes when code blocks first render.
- Refactoring the recursive tree layout could introduce minor sidebar layout glitches if CSS styling is dependent on hierarchy.


