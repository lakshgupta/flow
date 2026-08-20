---
id: development/20260820-001-FIX-edge-violations-pane-close/fix-notes
type: note
graph: development/20260820-001-FIX-edge-violations-pane-close
title: Root cause and validation for edge violations pane close button
tags:
    - bugfix
    - frontend
    - ui
links:
    - node: development/20260820-001-FIX-edge-violations-pane-close/fix-edge-violations-pane-close
      context: Fix task
      relationships:
        - maps-to
---

## Root Cause

The Edge violations panel (the right-rail pane listing edge-type violations for
the selected graph) had no close affordance of its own. Once opened from the
graph-tree violation badge, the header shield button, or the header validation
indicator, the only ways to dismiss it were indirect: click the shield toggle
again or switch to another right-rail tab. Every other right-rail surface
(search, calendar) or document pane offers a direct dismiss action, so the
violations pane felt stuck open.

## Fix

Added an onClose prop to RightRailViolationsPanel that renders a ghost X
button in the panel header (right-aligned, matching the document pane's close
button pattern). RightSidebarPanel threads the handler through, and App.tsx
wires it to collapseRightRail so closing the pane collapses the right rail.

## Validation

- New unit test in RightRailViolationsPanel.test.tsx: clicking 'Close edge
  violations' calls onClose.
- Full frontend suite: 231/231 pass. tsc --noEmit clean.