---
id: development/20260730-003-FIX-mermaid-diagram-caret/root-cause
type: note
graph: development/20260730-003-FIX-mermaid-diagram-caret
title: Root cause — Enter inside hidden mermaid source edits source invisibly
description: Clicking next to a mermaid diagram places the caret inside its code block text, whose source editor is collapsed, so Enter inserts a newline into the hidden source
links:
    - node: development/20260730-003-FIX-mermaid-diagram-caret/fix-mermaid-diagram-caret
      context: Root cause analysis drives the fix
      relationships:
        - relates-to
---

A mermaid diagram is a codeBlock node (language "mermaid") rendered by the DiagramSection node view. Its source editor <pre> is display:none when the diagram is collapsed, so text positions inside the code block have no visible caret.

Reported behavior:
1. Diagram as the last line: clicking to the right/below the section places the caret at the end of the code block text (invisible). Pressing Enter hits the base keymap's newlineInCode and appends a newline to the hidden source — nothing visible happens. Expected: a new paragraph after the diagram with the caret on the next line.
2. Diagram as the first line: clicking above/left places the caret at the start of the code block text (invisible). Pressing Enter inserts a newline at the top of the hidden source. Expected: a new paragraph before the diagram, pushing the whole section to the next line.

The base keymap (defineBaseKeymap, priority low=1) binds Enter to chainCommands(newlineInCode, createParagraphNear, liftEmptyBlock, splitBlock). Custom defineKeymap extensions run before it (default priority 2), so we can intercept Enter for mermaid code blocks whose source editor is collapsed: at parentOffset 0 insert a paragraph before the block; at parentOffset == content.size insert a paragraph after the block, then place the caret in the new paragraph (mirroring the existing code-block-exit-keymap ArrowUp/ArrowDown handlers).

Key design constraint: when the source editor is VISIBLE (open), Enter must keep inserting newlines into the source, so the new handling only applies when the caret's DOM position is inside a hidden .flow-diagram-block-source wrapper (checked via view.domAtPos + classList 'hidden').

Validation: two new RichTextEditor shortcut tests (diagram at end -> paragraph after; diagram at start -> paragraph before). Verified the end-of-doc test fails without the fix.