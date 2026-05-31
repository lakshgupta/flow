---
id: development/20260530-001-FIX-desktop-drag-drop-image/note-root-cause
type: note
graph: development/20260530-001-FIX-desktop-drag-drop-image
title: Root cause - capture handler skipped file-based drops in Wails mode
description: When dataTransfer.files was populated without URIs, the handler returned early without preventDefault, letting ProseKit try unreadable WebKitGTK File objects
tags:
    - analysis
    - desktop
---

The capturing-phase drop handler in RichTextEditor.tsx only handled drops containing file:// URIs (Linux/WebKitGTK text/uri-list path). When dataTransfer.files was populated but no URIs were present (lines 413-418), the handler returned early without calling event.preventDefault(). This allowed ProseKit's defineImageUploadHandler to process the drop, but ProseKit tried to read the File objects which are empty/unreadable in the WebKitGTK webview. The upload failed silently and no image was inserted.

Fix: intercept all file drops in the capturing handler when in Wails mode (both URI-based and File-based), call stopPropagation to prevent ProseKit from seeing the event, and handle the upload via the Wails binding directly.
