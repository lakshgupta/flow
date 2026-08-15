---
id: development/20260627-004-FIX-home-transition-perf/commit-notes
type: note
graph: development/20260627-004-FIX-home-transition-perf
title: Commit mapping for home transition optimization
tags:
    - commit
    - performance
links:
    - node: development/20260627-004-FIX-home-transition-perf/optimize-home-transition
      context: Notes on home transition optimization
      relationships:
        - maps-to
---

## Commit Scope

This commit covers the home page transition performance optimization work.

## Changes Included

- `frontend/src/App.tsx`: Non-blocking navigation in `handleSelectHome` and `handleSelectGraph`
- `frontend/src/components/MiddleContent.tsx`: Persistent HomeSurface mounting
- `frontend/src/App.test.tsx`: Test assertion update

## Validation Status

- ✅ `npm run build` passes
- ✅ `npm test` passes (114/114)

## Flow Task Mapping

- `20260627-004-FIX-home-transition-perf/optimize-home-transition.md` → Done
