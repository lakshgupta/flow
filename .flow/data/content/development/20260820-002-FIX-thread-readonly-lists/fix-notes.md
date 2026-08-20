---
id: development/20260820-002-FIX-thread-readonly-lists/fix-notes
type: note
graph: development/20260820-002-FIX-thread-readonly-lists
title: Root cause and validation for thread readonly list rendering
tags:
    - bugfix
    - frontend
    - ui
links:
    - node: development/20260820-002-FIX-thread-readonly-lists/fix-thread-readonly-lists
      context: Fix task
      relationships:
        - maps-to
---

## Root Cause

Unselected thread panels render the document body through RenderedMarkdown,
which converts markdown to native `<ul>`/`<ol>` elements. Tailwind's preflight
reset strips list styling from every ul/ol (`list-style: none; margin: 0;
padding: 0`), and the editor's own list markers (prosekit's
.prosemirror-flat-list custom markers) are not present in the readonly HTML.
The result: list items render as plain sentences with no bullets and no
indent. The prosekit .ProseMirror p typography (margin/padding on `li > p`)
then makes each item read like a separate paragraph with extra spacing
between lines.

Verified headless in Chromium against the built app: readonly panel `ul`
computed `list-style-type: none`, `padding: 0`, and `li p` carried
margin/padding — exactly matching the reported symptom.

## Fix

frontend/src/styles.css — added rules scoped to .thread-panel-rendered-markdown
(the readonly thread panel body):

- :is(ul, ol): restore margin and 1.5rem left padding.
- ul -> list-style-type: disc; ol -> list-style-type: decimal.
- li: zero margin.
- li > p: zero margin/padding so items sit tightly under their marker.
- Nested :is(ul, ol): keep a small top margin, no bottom margin.

## Validation

- Rebuilt frontend + binary; headless Chromium against the running app:
  readonly panel ul now computes list-style-type disc with 24px padding-left,
  li p margin/padding 0, first item indented 24px under the bullet.
- Full frontend suite: 231/231 pass. tsc --noEmit clean.