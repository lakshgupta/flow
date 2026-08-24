---
id: development/20260824-002-FIX-directional-incoming-links/fix-directional-links
type: task
graph: development/20260824-002-FIX-directional-incoming-links
title: Make incoming link list directional
description: 'Backend directional backlinks field; frontend renders incoming from it only (commit: 61409db)'
tags:
    - implementation
    - links
status: Done
links:
    - node: development/20260824-002-FIX-directional-incoming-links/root-cause
      context: Fix implements the root cause analysis recorded in the note
      relationships:
        - relates-to
---

Acceptance Criteria:
- DocumentResponse gains an incomingLinks field listing nodes whose declared links target the opened document
- Frontend incoming section derives solely from incomingLinks; children linked only outbound no longer appear as incoming
- App test updated so a symmetric relatedNoteIds payload no longer produces phantom incoming entries

Evidence:
- go build ./... clean; go test ./internal/httpapi ./internal/graph pass
- npx tsc --noEmit clean
- npm test --run src/App.test.tsx: 57/57 pass, including the updated link-stats scenario asserting note-2 (outbound child) is absent from Incoming while genuine backlink note-3 is listed

Evidence Strategy: go test ./internal/httpapi ./internal/graph and targeted frontend vitest run for App.test.tsx link stats scenario plus tsc clean.