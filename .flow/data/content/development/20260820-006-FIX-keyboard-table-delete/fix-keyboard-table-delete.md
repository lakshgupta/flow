---
id: development/20260820-006-FIX-keyboard-table-delete/fix-keyboard-table-delete
type: task
graph: development/20260820-006-FIX-keyboard-table-delete
title: Let keyboard Delete/Backspace remove a whole table
description: 'Backspace/Delete inside a table only clears cell content (deleteCellSelection); add a keymap so Backspace at the start of the first cell, Delete at the end of the last cell, or Backspace/Delete with the whole table selected deletes the table (commit: 1e526db)'
tags:
    - bugfix
    - frontend
    - editor
status: Done
---

