---
id: development/20260820-008-FEAT-keyboard-shortcuts-settings/feature-notes
type: note
graph: development/20260820-008-FEAT-keyboard-shortcuts-settings
title: Implementation and validation for the settings Keyboard tab
description: 'New Keyboard tab in the settings dialog listing all app keyboard shortcuts in six groups (commit: 6c22e1c)'
tags:
    - feature
    - frontend
    - ui
links:
    - node: development/20260820-008-FEAT-keyboard-shortcuts-settings/add-keyboard-shortcuts-settings
      context: Feature task
      relationships:
        - maps-to
---

## Context

The app has many keyboard shortcuts (global, canvas, editor formatting,
markdown input, tables, images & diagrams) but none of them were documented
anywhere in the UI — the only hints were tooltips and the slash menu's `kbd`
labels. The user asked to list the current keyboard mappings in the settings
dialog box in a new "Keyboard" section.

## Change

- Added a `keyboard` tab to `SettingsDialog.tsx` (icon: `Keyboard` from
  lucide-react), placed between Appearance and Advanced in the settings
  sidebar, with matching breadcrumb label.
- Added a `KEYBOARD_SHORTCUTS` data structure: six groups — General, Canvas,
  Text formatting, Markdown shortcuts, Tables, Images & diagrams — totaling 50
  shortcut entries with the actual key bindings in use.
- Each group renders as a bordered list with the action label on the left and
  a `<kbd>` chip with the key(s) on the right.
- Extended the `SettingsTab` union in `App.tsx` (the `settingsTab` state and
  the `handleSettingsDialogTabChange` callback) to include `"keyboard"`.

Shortcut inventory was gathered from the actual code paths:

- **General:** `Ctrl/Cmd+B` sidebar toggle (`ui/sidebar.tsx`), `Alt+←/→`
  thread navigation and `Alt+Shift+F` fix-all-violations (`App.tsx`),
  `Ctrl/Cmd+click` additive node selection.
- **Canvas:** `Ctrl/Cmd+scroll` canvas-only zoom (`GraphCanvasSurface.tsx`
  wheel capture), node-search `↑/↓`/`Enter`/`Shift+Enter` navigation.
- **Text formatting:** prosekit basic keymaps (`Mod-b/i/u/S/E`, `Mod-B`
  blockquote, `Mod-Alt-1..6` headings, `Mod-Alt-0` paragraph, `Mod-[`/`]`
  list indent, `Mod-Enter` hard break, `Mod-z`/`Mod-Z`/`Mod-y` undo/redo)
  plus `Ctrl/Cmd+click` on links.
- **Markdown shortcuts:** `#`/`##`/`###`, `-`, `1.`, `[]`, `>>`, `>`, `---`,
  ```` ``` ````, and the `/code` and `/mermaid` slash-menu items.
- **Tables:** `Tab`/`Shift+Tab` cell movement, arrow-key cell navigation,
  `Mod-A` whole-table selection, boundary `Backspace`/`Delete` table deletion
  (from the table-delete keymap).
- **Images & diagrams:** `Tab`/`Shift+Tab` image indent/outdent, `Alt+↑/↓`
  diagram section reorder.

## Validation

- `tsc --noEmit` clean.
- Full vitest suite passes (273/273), including the existing settings-dialog
  tests (appearance, about, workspaces, index rebuild) — the new tab is purely
  additive.
- Headless Chromium end-to-end: opens Settings, clicks the Keyboard tab, and
  confirms all six groups render with 50 `<kbd>` chips and the dialog content
  scrolls; no console or page errors.

## Follow-up fix (clipped scroll area)

The user reported the Keyboard list was cut off: the scrollbar ended but the
last rows were unreachable. Root cause: `SidebarProvider`'s base class sets
`min-height: 100svh` (700px), which stretched the settings layout taller than
the dialog's `max-h-[85vh]` (595px). The grid row resolved to 700px, so the
scroll viewport's bottom ~105px sat below the dialog's clipped edge — content
below that was unreachable even at max scroll.

Fix in `SettingsDialog.tsx`:

- The dialog content now uses `grid-rows-[minmax(0,1fr)]` so the grid row
  can never exceed the dialog's height.
- The `SidebarProvider` gets an inline `height: 85vh` (matching the dialog's
  max height) with `minHeight: 500px` replacing the previous `h-full
  min-h-[500px]` classes. The inline style overrides the base `min-h-svh`;
  the wrapper, main, and scroll area now cascade to the dialog's real height
  (595px → 539px scroll area).

Verified in headless Chromium at 700px viewport: the Keyboard tab scrolls to
`scrollTop == maxScroll`, the last shortcut row is fully visible, and the
General/About/Advanced tabs render unchanged.

## Follow-up fix (conflicting key mappings)

The user reported that `Ctrl/Cmd+B` was bound to both Bold (editor, prosekit
`Mod-b`) and the sidebar toggle (`sidebar.tsx`), and asked for distinct,
generally-used editor bindings. Audit of every app-wide binding found exactly
one duplicate plus one mislabeled entry:

- **`Ctrl/Cmd+B` — Bold vs sidebar toggle.** The editor keeps the standard
  Bold binding. The sidebar toggle moved to `Ctrl/Cmd+\` (`SIDEBAR_KEYBOARD_SHORTCUT`
  in `ui/sidebar.tsx` changed from `"b"` to `"\\"`), the convention used by
  Notion, Slack, and Discord.
- **Mislabeled strikethrough.** The strike keymap binds `Mod-S` (i.e.
  `Ctrl/Cmd+Shift+S`), but the settings list said `Ctrl/Cmd+S`. Corrected to
  `Ctrl/Cmd + Shift + S`.

All other bindings were checked and are already distinct or context-specific
by design (e.g. `Ctrl/Cmd+A` selects all text, or the whole table when the
caret is inside one; `Tab` moves between table cells or indents a selected
image; canvas node deletion with `Backspace`/`Delete` only applies to selected
canvas nodes).

Verified in headless Chromium: `Ctrl+B` inside the editor bolds the selected
text and leaves the sidebar expanded; `Ctrl+B` outside the editor no longer
toggles the sidebar; `Ctrl+\` toggles the sidebar; the settings Keyboard tab
shows `Ctrl/Cmd + \` for the sidebar, `Ctrl/Cmd + B` for bold, and
`Ctrl/Cmd + Shift + S` for strikethrough.
