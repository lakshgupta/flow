---
id: development/20260815-002-FIX-table-handle-color-contrast/fix-notes
type: note
graph: development/20260815-002-FIX-table-handle-color-contrast
title: Root cause and validation for table handle color contrast fix
status: Success
tags:
  - bugfix
  - frontend
  - ui
links:
  - node: development/20260815-002-FIX-table-handle-color-contrast/fix-table-handle-color-contrast
    context: Fix task
    relationships:
      - maps-to
---

## Root Cause

The table handle row/column options popover rendered white text on a white
background (or dark text on a dark background), making the menu items
invisible. The app theme is class-based: `ThemeProvider` toggles `.dark` on
`<html>` and switches CSS variables in the `.dark {}` block. But every
`dark:` utility in the app compiled to Tailwind's default
`@media (prefers-color-scheme: dark)` variant — there was no
`@custom-variant dark` in `styles.css`.

So whenever the app theme disagreed with the OS preference:

- App dark + OS light → popover kept `bg-white` (media variant off) while text
  inherited the light `--foreground` → white on white.
- App light + OS dark → popover got `bg-gray-950` (media variant on) while text
  stayed dark `--foreground` → dark on dark.

Verified in a headless browser against the built app in both mismatch cases.

## Fix

`frontend/src/styles.css`: added

```css
@custom-variant dark (&:where(.dark, .dark *));
```

so `dark:` utilities follow the `.dark` class like the rest of the theme
system. This fixes the table handle popover and every other editor menu that
uses `dark:` grays (inline menu, tag menu, user menu, block handle, etc.) —
they all pair `dark:` utilities with class-based CSS variables.

## Validation

- Rebuilt frontend + binary; confirmed compiled CSS now emits
  `.dark\:bg-gray-950:where(.dark,.dark *)` (no `prefers-color-scheme`).
- Headless browser, app dark + OS light: popover `bg-gray-950`, text white.
- Headless browser, app light + OS dark: popover white, text black.
- `npm test`: 217/217 pass. `tsc --noEmit` clean.
