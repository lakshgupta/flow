---
id: 20260627-007-FIX-heading-dropdown-dark-mode/task
title: Fix heading dropdown invisible in dark mode
type: task
status: Done
tags:
  - fix
  - ui
  - dark-mode
---

# Fix heading dropdown invisible in dark mode

## Description

The heading dropdown in the ProseKit inline menu used a native `<select>` element. In WebKitGTK, native `<select>` elements ignore CSS background/color styling and use OS-level rendering, making the text invisible when the background matched the editor.

## Fix

Replaced the native `<select>` with a custom dropdown using `Button` + `InlinePopover` — the same pattern used for text color and background color menus. The heading options are now fully styled with Tailwind classes and work correctly in both light and dark mode.

## Files

- `frontend/src/components/editor/ui/inline-menu/inline-menu.tsx`: Replaced `<select>` with Button + InlinePopover dropdown
- `frontend/src/components/editor/ui/inline-menu/inline-menu.test.tsx`: Updated test for new button-based UI
- `frontend/src/styles.css`: Removed unused `.heading-select` CSS rules

## Status

Done
