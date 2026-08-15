---
id: development/20260627-002-FIX-open-external-links/open-link-cmd-click
type: task
graph: development/20260627-002-FIX-open-external-links
title: Cmd/Ctrl+Click opens external URLs in system browser
description: Add Cmd/Ctrl+Click handler to open external links in the default browser
tags:
    - fix
    - editor
    - links
status: Done
---

Cmd/Ctrl+Click on external URLs in the editor and rendered markdown views
now opens them in the system default browser.

In the ProseKit editor, ProseMirror intercepts click events on links for
cursor positioning, so regular clicks don't navigate. Cmd/Ctrl+Click is
the standard modifier to override this and open links.

Implementation:
- Added `openExternalLink()` helper that checks for `window.runtime.BrowserOpenURL`
  (Wails desktop API) and falls back to a temporary `<a>` element click (web mode)
- Added Cmd/Ctrl+Click check in `handleEditorClickCapture` for the ProseKit editor
- Added Cmd/Ctrl+Click check in `handleReadonlyPanelClick` for rendered markdown
- Flow-specific links (date, reference, asset) are excluded and keep existing behavior
