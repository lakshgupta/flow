---
id: development/20260505-003-REFACTOR-frontend-open-flows/extract-sidebar-surface
type: task
graph: development/20260505-003-REFACTOR-frontend-open-flows
title: Extract sidebar surface
description: Move the sidebar workspace selector and graph-tree wrapper wiring out of App.tsx behind memoized sidebar panels and a stable action hook
tags:
    - performance
    - frontend
links:
    - node: development/20260505-003-REFACTOR-frontend-open-flows/extract-right-rail-controls
      context: Continue extracting the remaining shell-owned control surfaces after the sidebar surface
      relationships:
        - depends-on

---
- Added `frontend/src/hooks/useSidebarNavigationActions.ts` to own the stable workspace-selection and graph-tree action adapters that previously lived inline in `frontend/src/App.tsx`.
- Added `frontend/src/components/WorkspaceSidebarPanels.tsx` to own the sidebar workspace selector and `GraphTree` wrapper surface so `App.tsx` no longer recreates that JSX and its wrapper callbacks inline.
- Added a focused App regression covering the sidebar workspace selector so the extracted sidebar surface is validated for both graph-tree interactions and workspace switching behavior.

Validation

- cd frontend && npm test -- src/App.test.tsx -t "opens a sidebar file in the center pane on single click and keeps it open when calendar is toggled|switches workspaces from the sidebar selector and refreshes the graph tree|lets a graph with direct files collapse and expand its file list|renames a graph from the content tree|renames a node from the content tree"
- editor diagnostics: frontend/src/App.tsx, frontend/src/hooks/useSidebarNavigationActions.ts, frontend/src/components/WorkspaceSidebarPanels.tsx, frontend/src/App.test.tsx