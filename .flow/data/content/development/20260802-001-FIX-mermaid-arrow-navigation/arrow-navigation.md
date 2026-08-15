---
id: development/20260802-001-FIX-mermaid-arrow-navigation/arrow-navigation
type: task
graph: development/20260802-001-FIX-mermaid-arrow-navigation
title: Arrow-key navigation around collapsed mermaid diagram sections
description: 'Arrow keys and Backspace navigate over collapsed/open mermaid diagram edges (Down/Right/Enter to write after, Up/Left/Backspace to move the section up) (commit: 85971ff)'
tags:
    - bugfix
    - editor
    - mermaid
    - navigation
status: Done
---

When a mermaid diagram is the last block on the page the caret could not reach the right side of the collapsed section to press Enter and write after it; when it is the first block the caret could not reach the left side to press Backspace and move the whole section up.

Implement full arrow-key navigation over mermaid diagram edges in `code-block-exit-keymap.ts`:

- **ArrowDown** in the paragraph above a diagram lands the caret on the source's left edge; when already on the left edge of a collapsed diagram it jumps to the right edge; when on the right edge it moves out to the block after the diagram.
- **ArrowUp** in the paragraph below lands on the source's right edge; when already on the right edge of a collapsed diagram it jumps to the left edge; when on the left edge it moves out to the block before it.
- **Enter** at a collapsed diagram edge creates a paragraph before (moves section down) or after (fresh line below) the section — never inside the hidden source.
- **Backspace** at the left edge of the diagram deletes the block above, moving the whole section up one line.

The same navigation works when the mermaid source editor is **open**: Down/Up from adjacent paragraphs and Backspace behave the same, while the edge-crossing jumps (ArrowRight at source start / ArrowLeft at source end) only apply when the source is collapsed so arrow keys keep editing the visible source text normally.

Also fixes a latent crash: ArrowDown in the last paragraph of a document threw `RangeError: Index N out of range` because `nextDiagramNode` called `grandParent.child(index)` without a bounds check (`Fragment.child` throws instead of returning undefined, so the existing `next === undefined` guard was dead code).

Validation: full frontend suite passes (138/138), `npx tsc --noEmit` clean. Deterministic unit tests in `code-block-exit-keymap.test.ts` (hand-built schema mirroring prosekit's codeBlock textblock, positions computed from node boundaries) plus two integration tests in `RichTextEditor.shortcuts.test.tsx` (collapsed-state Down/Right/Enter and Up/Left/Backspace flows, asserted via `ref.getMarkdown()`).
