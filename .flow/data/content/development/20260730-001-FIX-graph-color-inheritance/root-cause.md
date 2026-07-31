---
id: development/20260730-001-FIX-graph-color-inheritance/root-cause
type: note
graph: development/20260730-001-FIX-graph-color-inheritance
title: Root cause — subdirectory color not applied to its files
description: resolveParentGraphDirectoryColor checked parent directories before the node's own directory, so files in a colored subdirectory inherited the grandparent's color instead
tags:
    - fix
    - canvas
    - color
links:
    - node: development/20260730-001-FIX-graph-color-inheritance/fix-color-inheritance
      context: Root cause analysis drives the fix
      relationships:
        - relates-to
---

Canvas nodes inherit their tint from the closest graph directory with a color. A file at data/content/a/b/c/file.md has graph path a/b/c, so its own containing directory color must win over ancestor directory colors.

The old resolveParentGraphDirectoryColor in frontend/src/lib/graphColors.ts walked UP the directory tree before ever checking the node's own graph path, and only fell back to the path itself at the very end. Worse, resolveGraphDirectoryColor already performs longest-prefix matching, so checking a parent path (e.g. a/b) returned the color of any ancestor prefix (e.g. a) — meaning files inside a colored subdirectory inherited the grandparent's color, and the subdirectory's own color was never consulted.

Fix: resolveParentGraphDirectoryColor now delegates directly to resolveGraphDirectoryColor, which returns the longest matching candidate — the closest ancestor-or-self directory with a color. Files in a colored subdirectory take that subdirectory's color; otherwise they fall back to the nearest colored ancestor.

Tests updated: graphColors.test.ts previously asserted the buggy behavior (parent color winning over the node's own directory); it now asserts own-directory precedence and ancestor fallback. graphCanvasUtils.test.ts covers the same cases at the canvas node level.