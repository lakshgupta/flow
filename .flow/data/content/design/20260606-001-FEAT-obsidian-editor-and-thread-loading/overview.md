---
id: design/20260606-001-FEAT-obsidian-editor-and-thread-loading/overview
type: note
graph: design/20260606-001-FEAT-obsidian-editor-and-thread-loading
title: Obsidian editor and thread loading design
description: Design details for Obsidian-like editor behaviors and smooth thread panel loading
tags:
    - design
    - editor
links:
    - node: design/20260606-001-FEAT-obsidian-editor-and-thread-loading/design-task
      context: Tracks design state
      relationships:
        - evolves-from
---

### Feature: Obsidian-like Editor, Brand Logo Styling, & Smooth Thread Loading

#### Status

Proposed

#### Summary

This design proposal refines the rich text editor (powered by ProseKit/ProseMirror) to support Obsidian-style keyboard navigation and removes redundant action buttons from diagrams and code blocks. It also upgrades the brand logo styling on the left sidebar with a modern gradient and responsive collapsed state, and replaces the thread panel loading text spinner with a layout-preserving Skeleton Loader.

#### Problem

1. **Redundant Editor Actions**: The "Write above" and "Write below" buttons on code editors, Mermaid diagrams, and Excalidraw sections occupy visual space and create clutter.
    
2. **Cursor Stuck/Blocked**: Because Mermaid and Excalidraw blocks are rendered with `contentEditable={false}` containers and hide their inner editable `<pre>` elements, standard browser keyboard navigation gets stuck or jumps unpredictably around them.
    
3. **Logo Design Limitations**: The current sidebar brand logo has a static monochrome stroke look and completely vanishes when the sidebar is collapsed.
    
4. **Layout Shifting on Load**: When loading active thread panels, the entire UI is cleared and replaced by the simple text "Loading document content." This causes a jarring flash of blank space and layout shifts when switching between panels in the thread view.
    

#### Goals

- Remove "Write above" and "Write below" buttons from the UI of code editor, Mermaid, and Excalidraw blocks.
    
- Allow seamless cursor movement above and below these blocks via standard `ArrowUp` and `ArrowDown` keys.
    
- Visually highlight diagram/code blocks with a primary border when selected via the keyboard.
    
- Enhance the brand logo on the left sidebar with an eye-catching gradient, hover scale transition, and a centered glowing circular "F" brand mark when collapsed.
    
- Create a layout-preserving Skeleton Loader with pulsing lines for thread panels to eliminate layout shift and create a smooth feel.
    

#### Non-Goals

- Changing the underlying ProseMirror schema definitions or markdown serialization formats.
    
- Rewriting the code editor language selector or Shiki syntax highlighting.
    

#### User Experience

- **Editor UI**: The headers of diagram blocks will only contain a delete button. The code block inline controls will only display the language selector dropdown.
    
- **Keyboard Navigation**:
    
    - Pressing `ArrowDown` at the bottom of a paragraph above a diagram block selects the diagram block itself (marked by a subtle highlight). Pressing it again moves the cursor to the paragraph below (or creates a new paragraph if it is at the end of the document).
        
    - Pressing `ArrowUp` at the top of a paragraph below a diagram block selects the diagram block. Pressing it again moves the cursor to the paragraph above (or creates a new paragraph if it is at the start).
        
- **Brand Logo**:
    
    - Expanded: Shows "Flow" rendered with a beautiful gradient from `--primary` (indigo) to violet. Hovering scale-animates it slightly.
        
    - Collapsed: Shows a centered "F" monogram inside a glowing circular gradient background.
        
- **Loading State**: When a thread panel is loading, the title bar and document content are replaced by a pulsing skeleton composed of a title bar placeholder and a few line placeholder blocks, preventing content jumpiness.
    

#### Architecture

- **Editor Extension**: We will add a custom keymap extension to the ProseKit setup, mapping `ArrowUp` and `ArrowDown`.
    
- **Node Selection Styling**: Define rules for `.ProseMirror-selectednode` in `styles.css`.
    
- **Logo and Collapse Props**: Update `AppSidebar.tsx` to pass/handle collapsed state, and update `styles.css` with matching logo styles.
    
- **Skeleton Component**: Introduce a skeleton loader state in `ThreadPanels.tsx`.
    

#### Data And Interfaces

No API contracts or database schemas change.

#### Control Flow

1. **Key Down (ArrowDown / ArrowUp)**:
    
    - Check if selection is a `NodeSelection` on a diagram. If so, move the selection past it.
        
    - If in a text block, check if the selection is at the boundary (`view.endOfTextblock`). If the adjacent node is a diagram, convert the selection to a `NodeSelection` on that diagram.
        
2. **Selection Render**: The active selection of the node is highlighted with CSS.
    
3. **Document Load**:
    
    - `panelDocumentIsLoading` triggers rendering of the pulsing skeleton.
        
    - Once the API response returns, the skeleton is replaced by the actual document editor.
        

#### Edge Cases And Failure Modes

- **Boundary insertion**: If the diagram is the first or last element of the document, moving past it creates a paragraph.
    
- **Multiple diagrams in sequence**: The keyboard navigation correctly hops from one diagram node selection to the next.
    

#### Testing Strategy

- Update `code-block-view.test.tsx` to remove the obsolete button-click tests.
    
- Verify that standard editor actions (inserting blocks, key inputs) continue to work properly.
    

#### Risks And Tradeoffs

- Intercepting arrow keys in ProseMirror has minor cross-platform differences, but utilizing `view.endOfTextblock` is the robust standard approach.
    

#### Open Questions

- None at this time.
