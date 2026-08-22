---
id: design/20260821-001-FEAT-sidebar-contextual-toc/design
type: note
graph: design/20260821-001-FEAT-sidebar-contextual-toc
title: Contextual sidebar table of contents design
description: 'Approved design — clarified: sidebar navigation is bidirectional; Back to content tree is paired with Show table of contents and the active Home/document row shortcut.'
tags:
    - design
    - navigation
    - toc
links:
    - node: design/20260821-001-FEAT-sidebar-contextual-toc/plan-sidebar-contextual-toc
      context: Approved design defines the implementation plan scope for the sidebar TOC migration
      relationships:
        - relates-to
---

### Feature: Contextual Sidebar Table of Contents

#### Status

Approved.

#### Summary

Move document table-of-contents navigation from editor panes into the left sidebar. The sidebar switches between the existing Content tree and a contextual TOC, with a back button returning to the tree.

#### Problem

The current TOC occupies editor space and is duplicated across Home, center-thread, and right-rail document surfaces. It also requires per-pane toggles instead of using the existing navigation sidebar.

#### Goals

- Show headings for the active Home, document, or selected thread in the left sidebar.
- Preserve heading-to-editor scrolling.
- Remove TOC panels and resize handles from all editor panes.
- Keep graph expansion as tree navigation only.

#### Non-Goals

- Change markdown heading parsing or slug generation.
- Add a persisted sidebar-mode preference.
- Change graph canvas or document/thread layout behavior.

#### User Experience

The Content tree is the default sidebar view. Opening a document from the tree or selecting a thread switches the sidebar to that document’s TOC. Home uses the same contextual view. A Back to content tree control restores the tree without closing the active editor or thread. Expanding a graph or folder only reveals its children and does not switch views. Documents without headings show No headings yet.

#### Architecture

The application shell owns a content-or-toc sidebar view state and passes the active TOC context and items into the sidebar navigation component. The sidebar renders the existing GraphTree or the reusable TableOfContents component. Existing editor scroll-target state and handleTOCNavigate behavior are reused. Center and right-rail editor TOC markup, toggles, and TOC resize plumbing are removed; document properties remain available in the center side panel.

#### Data And Interfaces

Sidebar navigation receives view mode, active TOC title/context, TOC items, a back callback, and existing graph/document actions. The documentTOCRatio workspace setting and TOC-specific resize handlers are removed because the sidebar uses the existing sidebar width.

#### Control Flow

File selection opens the document as today and switches the sidebar to TOC. Thread activation switches the TOC context to the selected thread document. Home selection shows Home headings. Selecting a graph or returning with the back button switches to Content. Clicking a heading invokes the existing editor scroll-target mechanism.

#### Edge Cases And Failure Modes

Loading documents must not display stale headings. Closing the active thread or losing the selected document returns the sidebar to Content. No-heading documents show an empty state. TOC items update with active editor body changes. The collapsed sidebar continues to use its existing responsive behavior.

#### Testing Strategy

Add component and application tests for document selection, thread activation, Home, back navigation, heading scrolling, graph expansion, empty headings, and absence of editor TOCs. Run frontend unit tests, typecheck, and visual regression checks.

#### Risks And Tradeoffs

A graph-wide aggregate TOC is intentionally avoided because graph expansion does not identify one document and would require loading and labeling many documents. Centralizing all TOCs creates a single navigation model but removes the right-rail convenience view.

#### Open Questions

None. Graph expansion keeps the Content tree visible, and all editor TOCs are removed.

## Approval

Approved by the user on 2026-08-21.

## Record Sync

`docs/architecture.md` was updated with the indexed Contextual Sidebar Table of Contents architecture specification. The existing `.flow/data/home.md` improvement entry already captures this requested capability, so no separate Home edit was needed.