---
id: development/20260821-004-FIX-mutation-feedback-timeout/fix-notes
type: note
graph: development/20260821-004-FIX-mutation-feedback-timeout
title: Auto-dismiss mutation success feedback
description: Root cause, fix, and validation for persistent success notifications
tags:
    - fix
    - feedback
links:
    - node: development/20260821-004-FIX-mutation-feedback-timeout/auto-dismiss-mutation-feedback
      context: Root-cause note defines the centralized success-feedback timeout
      relationships:
        - relates-to
---

## Reported Issue

Success feedback such as "Index refreshed." remains visible indefinitely instead of disappearing like the brief "Saved" confirmation.

## Root Cause

The shared `mutationSuccess` state is rendered by the workspace header and document panels, but mutation handlers only replace or clear it; no timer resets it after a successful mutation.

## Fix

Added `MUTATION_FEEDBACK_TIMEOUT_MS` and a centralized `useEffect` in `App.tsx` that clears non-empty `mutationSuccess` after 2 seconds. Each new message gets a fresh timer, and effect cleanup clears the previous timer. Added regression coverage that confirms index-refresh feedback appears and then disappears.

## Validation

- `npm test -- --run src/App.test.tsx -t "rebuilds the index and refreshes the Home body"` — passed (1 passed, 57 skipped).
- `npx tsc --noEmit` — passed.