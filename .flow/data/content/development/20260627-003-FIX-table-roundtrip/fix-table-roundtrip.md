---
id: development/20260627-003-FIX-table-roundtrip/fix-table-roundtrip
type: task
graph: development/20260627-003-FIX-table-roundtrip
title: Fix table corruption on markdown round-trip
description: Add turndown rule to strip paragraph wrappers inside table cells
tags:
    - fix
    - editor
    - table
    - markdown
status: Done
---

Tables with header cells (`<th>`) were corrupted when the editor saved to
markdown and reloaded. The root cause: ProseKit wraps cell content in `<p>`
tags, and turndown's default paragraph rule appends `\n\n` after each
paragraph. This produced multi-line cell content in GFM table syntax,
which markdown-it could not re-parse as a table.

Fix: add a turndown rule `tableCellParagraph` that strips `<p>` wrappers
inside `<td>` and `<th>` elements, outputting the trimmed inline content
instead. This keeps each table row on a single line so the GFM table
syntax stays valid across round-trips.

Added test cases for both header and non-header table round-trips.
