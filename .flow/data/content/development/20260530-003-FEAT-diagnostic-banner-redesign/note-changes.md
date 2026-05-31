---
id: development/20260530-003-FEAT-diagnostic-banner-redesign/note-changes
type: note
graph: development/20260530-003-FEAT-diagnostic-banner-redesign
title: Changes — banner redesign and code cleanup
description: New DropDiagBanner component, extracted base64 utility, extracted extractPathsFromHTML to module scope
tags:
    - summary
---

## Changes

1. **New component: `frontend/src/components/editor/ui/drop-diag-banner.tsx`**
   - `DropDiagBanner` renders a stack of diagnostic entries
   - Each entry shows `[HH:MM:SS] <message>` with a close button
   - Close button opens a Radix dropdown: "Close" and "Close All (N)"
   - Count badge appears on hover when multiple banners are stacked
   - Banners persist until manually closed (no auto-fade)

2. **State change in `RichTextEditor.tsx`**
   - `dropDiag: string | null` → `dropDiags: DropDiagEntry[]`
   - `showDiag` appends new entries instead of replacing
   - Close handlers: `handleCloseDiag(id)` and `handleCloseAllDiags()`
   - Removed `dropDiagTimeoutRef` and timeout cleanup

3. **Extracted `arrayBufferToBase64` in `imageUploader.ts`**
   - Shared utility replaces 3 inline copies of the chunked base64 encoding
   - Used by `uploadViaWailsBinding` and both file upload paths in `RichTextEditor.tsx`

4. **Extracted `extractPathsFromHTML` to module scope in `RichTextEditor.tsx`**
   - Moved from inside useEffect closure to top-level function
   - No closure dependencies — pure function

5. **Computed `isWails` once at top of useEffect**
   - `getWailsUploadFromPath()` and `getWailsUpload()` called once at setup
   - Closed over by all three capture handlers
