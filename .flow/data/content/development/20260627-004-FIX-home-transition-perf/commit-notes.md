---
title: Commit mapping for home transition optimization
type: note
status: Success
tags:
  - commit
  - performance
links:
  - "20260627-004-FIX-home-transition-perf"
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
