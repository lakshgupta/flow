---
id: development/20260505-003-REFACTOR-frontend-open-flows/refactor-notes
type: note
graph: development/20260505-003-REFACTOR-frontend-open-flows
title: Frontend refactor notes
description: Preserved behavior, structural changes, and validation for App.tsx/frontend test cleanup
tags:
    - refactor
    - frontend
---

Preserved behavior

- Document open, thread activation, and asset-thread navigation behavior in frontend/src/App.tsx remains unchanged; the refactor only centralizes repeated state transitions and source-thread resolution.
- Sidebar navigation behavior in frontend/src/App.test.tsx is unchanged; repeated button lookup boilerplate now goes through shared helpers.

Structural changes

- Added shared App.tsx helpers for graph-surface activation, collapsing the document right rail, syncing center-thread selection, and resolving thread base state from a source document.
- Updated the duplicated thread/document open paths to reuse those helpers instead of re-implementing the same branches.
- Added reusable App.test.tsx helpers for sidebar graph/file button lookup and replaced the repeated inline lookup blocks in the navigation-heavy tests.
- Extracted the right-rail search and calendar branches from `frontend/src/App.tsx` into memoized components in `frontend/src/components/RightRailPanels.tsx`.
- Added stable right-rail callback bridges in `frontend/src/App.tsx` so the extracted panels are not invalidated by new inline handler identities on unrelated renders.
- Extracted the thread panel stack from `frontend/src/App.tsx` into `frontend/src/components/ThreadPanels.tsx` and moved repeated readonly/asset rendering into local helper components.
- Added stable thread-panel callback bridges in `frontend/src/App.tsx` so thread activation, navigation, editor updates, TOC/properties controls, and panel resize handlers do not force the extracted stack to remount on unrelated shell renders.
- Filled `frontend/src/components/DocumentEditorPane.tsx` with the right-rail document editor/TOC subtree and switched `frontend/src/App.tsx` to render that memoized component instead of the inline panel branch.
- Added stable right-rail document callback bridges in `frontend/src/App.tsx` so maximize, close, delete, editor updates, inline references, asset threading, file drops, link inspection, and TOC interactions do not depend on fresh inline handlers.
- Added `frontend/src/components/GraphCanvasSurface.tsx` for the loaded graph-canvas toolbar, ReactFlow host, and overlay tree, and switched `frontend/src/App.tsx` to render that memoized surface instead of the inline canvas branch.
- Stabilized the graph-canvas action and overlay-controller boundary in `frontend/src/App.tsx`, including ref-backed viewport persistence, so the loaded canvas host is less sensitive to unrelated shell rerenders.
- Added `frontend/src/components/HomeSurface.tsx` for the Home editor/TOC branch and switched `frontend/src/App.tsx` to render that memoized surface instead of the inline Home branch.
- Added stable Home surface callback bridges in `frontend/src/App.tsx` so TOC toggling, editor updates, inline references, asset threading, TOC resizing, and TOC navigation do not depend on fresh inline handlers.
- Added `frontend/src/components/GraphEmptyState.tsx` for the empty-graph create and drag-drop branch and switched `frontend/src/App.tsx` to render that memoized surface instead of the inline empty-graph branch.
- Reused the stabilized graph-canvas action bridges for the empty-graph surface so create and drag-drop interactions are no longer owned by fresh inline handlers in `frontend/src/App.tsx`.
- Added `frontend/src/components/SettingsDialog.tsx` for the settings modal and switched `frontend/src/App.tsx` to render that memoized dialog instead of the inline settings branch.
- Added stable settings dialog callback bridges in `frontend/src/App.tsx` for modal open state, tab selection, appearance changes, local workspace deregistration, index rebuild, and GUI stop actions.
- Added `frontend/src/components/WorkflowDialogs.tsx` for the create-node, delete-document, and rename modal workflows and switched `frontend/src/App.tsx` to render those memoized dialogs instead of the inline branches.
- Added stable workflow-dialog callback bridges in `frontend/src/App.tsx` for open-state changes, input updates, cancel actions, and create/delete/rename confirms so the remaining modal workflows do not depend on fresh inline handlers.
- Added `frontend/src/hooks/useThreadPanelActions.ts` and moved the `ThreadPanels` action bridge setup out of `frontend/src/App.tsx`, keeping the thread action contract stable while shrinking the shell-owned adapter block.
- Added `frontend/src/hooks/useGraphCanvasSurfaceActions.ts` and moved the graph-canvas overlay/surface action bridge setup out of `frontend/src/App.tsx`, then rewired the empty-graph surface to reuse the extracted canvas actions.
- Added `frontend/src/hooks/useRightRailDocumentActions.ts` and moved the `DocumentEditorPane` action bridge setup out of `frontend/src/App.tsx`, keeping the right-rail document action contract stable while shrinking another shell-owned adapter block.
- Added `frontend/src/hooks/useHomeSurfaceActions.ts` and moved the `HomeSurface` action bridge setup out of `frontend/src/App.tsx`, keeping the Home action contract stable while reducing shell-owned surface wiring.
- Added `frontend/src/hooks/useSidebarNavigationActions.ts` and moved the sidebar workspace-selection and graph-tree wrapper callbacks out of `frontend/src/App.tsx`, keeping the sidebar action contract stable while shrinking another shell-owned adapter block.
- Added `frontend/src/components/WorkspaceSidebarPanels.tsx` and moved the sidebar workspace selector and `GraphTree` wrapper surface out of `frontend/src/App.tsx`, then added direct App coverage for workspace switching from the sidebar selector.
- Added `frontend/src/hooks/useRightRailControlsActions.ts` and moved the settings/search/calendar/document control actions out of `frontend/src/App.tsx`, keeping the right-rail control contract stable while shrinking another shell-owned adapter block.
- Added `frontend/src/components/RightRailControls.tsx` and moved the right-rail icon strip and settings-dialog mount out of `frontend/src/App.tsx`, reusing the existing `SettingsDialog` contract behind a memoized settings prop bundle.

Validation

- cd frontend && npm test -- src/App.test.tsx -t "opens graph documents as thread roots in the center view and persists the full drag-end arrangement|follows inline references by appending and replacing thread panels|lets an earlier thread panel become the active editor and save its edits|preserves multiple blank lines after switching nodes and back"
- cd frontend && npm test -- src/App.test.tsx -t "opens graph documents as thread roots in the center view and persists the full drag-end arrangement|follows inline references by appending and replacing thread panels|lets an earlier thread panel become the active editor and save its edits|preserves multiple blank lines after switching nodes and back|rebuilds the index from settings and refreshes the open document"
- cd frontend && npm test -- src/App.test.tsx -t "searches graph canvas nodes by title|opens a sidebar file in the center pane on single click and keeps it open when calendar is toggled|switches to the Home workspace from a Graph and renders the HomeRichTextEditor properly"
- cd frontend && npm test -- src/App.test.tsx -t "follows inline references by appending and replacing thread panels|shows a loading tail instead of stale content while following a delayed thread reference|lets an earlier thread panel become the active editor and save its edits|preserves multiple blank lines after switching nodes and back"
- editor diagnostics: frontend/src/App.tsx, frontend/src/components/ThreadPanels.tsx
- cd frontend && npm test -- src/App.test.tsx -t "shows a document icon after node selection and opens a thread root from it|opens a sidebar file in the center pane on single click and keeps it open when calendar is toggled"
- editor diagnostics: frontend/src/App.tsx, frontend/src/components/DocumentEditorPane.tsx
- cd frontend && npm test -- src/App.test.tsx -t "toggles between horizontal and user-adjusted canvas layouts|searches graph canvas nodes by title"
- editor diagnostics: frontend/src/App.tsx, frontend/src/components/GraphCanvasSurface.tsx
- cd frontend && npm test -- src/App.test.tsx -t "shows a document table of contents on the Home surface and persists resize|switches to the Home workspace from a Graph and renders the HomeRichTextEditor properly"
- editor diagnostics: frontend/src/App.tsx, frontend/src/components/HomeSurface.tsx
- cd frontend && npm test -- src/App.test.tsx -t "shows empty-graph create actions and creates a note into the selected graph|refreshes the empty canvas after creating a note from the graph tree menu"
- editor diagnostics: frontend/src/App.tsx, frontend/src/components/GraphEmptyState.tsx
- cd frontend && npm test -- src/App.test.tsx -t "persists appearance changes from the settings dialog|de-registers a local workspace from settings|rebuilds the index from settings and refreshes the open document"
- editor diagnostics: frontend/src/App.tsx, frontend/src/components/GraphEmptyState.tsx, frontend/src/components/SettingsDialog.tsx
- cd frontend && npm test -- src/App.test.tsx -t "deletes a node from the content tree|shows empty-graph create actions and creates a note into the selected graph|refreshes the empty canvas after creating a note from the graph tree menu"
- cd frontend && npm test -- src/App.test.tsx -t "renames a graph from the content tree|renames a node from the content tree"
- editor diagnostics: frontend/src/App.tsx, frontend/src/components/WorkflowDialogs.tsx
- cd frontend && npm test -- src/App.test.tsx -t "opens graph documents as thread roots in the center view and persists the full drag-end arrangement|follows inline references by appending and replacing thread panels|lets an earlier thread panel become the active editor and save its edits|preserves multiple blank lines after switching nodes and back"
- cd frontend && npm test -- src/App.test.tsx -t "opens graph documents as thread roots in the center view and persists the full drag-end arrangement|toggles between horizontal and user-adjusted canvas layouts|searches graph canvas nodes by title"
- editor diagnostics: frontend/src/App.tsx, frontend/src/hooks/useThreadPanelActions.ts, frontend/src/hooks/useGraphCanvasSurfaceActions.ts
- cd frontend && npm test -- src/App.test.tsx -t "shows a document icon after node selection and opens a thread root from it|opens a sidebar file in the center pane on single click and keeps it open when calendar is toggled"
- cd frontend && npm test -- src/App.test.tsx -t "shows a document table of contents on the Home surface and persists resize|switches to the Home workspace from a Graph and renders the HomeRichTextEditor properly"
- editor diagnostics: frontend/src/App.tsx, frontend/src/hooks/useRightRailDocumentActions.ts, frontend/src/hooks/useHomeSurfaceActions.ts
- cd frontend && npm test -- src/App.test.tsx -t "opens a sidebar file in the center pane on single click and keeps it open when calendar is toggled|switches workspaces from the sidebar selector and refreshes the graph tree|lets a graph with direct files collapse and expand its file list|renames a graph from the content tree|renames a node from the content tree"
- editor diagnostics: frontend/src/App.tsx, frontend/src/hooks/useSidebarNavigationActions.ts, frontend/src/components/WorkspaceSidebarPanels.tsx, frontend/src/App.test.tsx
- cd frontend && npm test -- src/App.test.tsx -t "shows a document icon after node selection and opens a thread root from it|opens a sidebar file in the center pane on single click and keeps it open when calendar is toggled|persists appearance changes from the settings dialog|de-registers a local workspace from settings|rebuilds the index from settings and refreshes the open document"
- editor diagnostics: frontend/src/App.tsx, frontend/src/components/RightRailControls.tsx, frontend/src/hooks/useRightRailControlsActions.ts

Follow-up

- frontend/src/App.tsx is still a large orchestration component even after the right-rail controls extraction; the next useful refactor is consolidating the repeated ref-backed action-hook pattern behind a shared helper or a smaller set of orchestration hooks so the shell stops owning so much adapter setup.
- After the right-rail controls extraction, the next useful UI-side slice is the remaining shell orchestration around the header and shared state transitions rather than more sidebar or control-strip cleanup.