---
id: development/20260821-006-FIX-sidebar-toc-return-navigation/decision
type: note
graph: development/20260821-006-FIX-sidebar-toc-return-navigation
title: Clarify bidirectional sidebar TOC navigation
description: Follow-up decision for contextual sidebar TOC return navigation; implemented and validated
tags:
    - decision
    - toc
links:
    - node: design/20260821-001-FEAT-sidebar-contextual-toc/design
      context: Clarifies the approved Back control as a bidirectional sidebar navigation flow
      relationships:
        - evolves-from
---

## Decision

The Content/TOC sidebar switch is bidirectional. When the user returns to the Content tree, a visible Show table of contents control restores the current Home/document/thread TOC without closing the active editor. Clicking the currently active document row (or Home row) provides the same shortcut.

## Rationale

The existing Back to content tree control otherwise leaves users without an obvious way to return to the active document's headings. Both controls preserve the current editor and thread state.
