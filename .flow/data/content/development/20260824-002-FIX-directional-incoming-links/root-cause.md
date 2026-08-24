---
id: development/20260824-002-FIX-directional-incoming-links/root-cause
type: note
graph: development/20260824-002-FIX-directional-incoming-links
title: Directional incoming links fix
description: 'Fix run — status: Resolved; validated by go test, vitest, tsc'
tags:
    - fix
    - links
---

Issue: opening a node lists its children in both the outgoing and incoming link sections, even though links are one-way declarations.

Root cause: BuildNoteGraphView (internal/graph/layers.go) computes a symmetric note graph and appends both directions into NoteNode.RelatedNoteIDs. The frontend selectedDocumentLinks memo feeds relatedNoteIds straight into the incoming list, so every outgoing target reappears as incoming. The canvas-edge part of that computation is directional and correct.

Fix decision: compute directional backlinks where all documents are available - buildDocumentResponse scans every workspace document's declared links for targets matching the opened document ID and returns them as incomingLinks on DocumentResponse. The frontend drops the relatedNoteIds shortcut and renders incoming exclusively from incomingLinks. RelatedNoteIDs stays in the API for other consumers.