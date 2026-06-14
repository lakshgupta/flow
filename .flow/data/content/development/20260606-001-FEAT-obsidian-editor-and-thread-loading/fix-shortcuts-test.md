---
id: development/20260606-001-FEAT-obsidian-editor-and-thread-loading/fix-shortcuts-test
type: task
graph: development/20260606-001-FEAT-obsidian-editor-and-thread-loading
title: Fix pre-existing shortcuts test failure
description: Fix RichTextEditor.shortcuts.test.tsx to query code[data-node-view-content] instead of pre for code block content
tags:
    - fix
status: Done
---

### Root Cause

The test `moves the caret out of a trailing code block with ArrowDown` used `editor.querySelector('pre')` to check code block content. ProseKit's ReactNodeView with `contentAs: 'code'` renders the code block's text content inside a `<code data-node-view-content>` element nested within `<pre>`. The `pre.textContent` was empty because ProseKit's content container (`<code>`) holds the text, not the `<pre>` wrapper directly in the test DOM query.

### Fix

Changed the assertion from `editor.querySelector('pre')` to `editor.querySelector('code[data-node-view-content]')` to match the actual ProseKit DOM structure.

### Validation

- `npm test` — 133/133 tests pass (0 failures)
