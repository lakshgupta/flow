---
id: development/20260505-003-REFACTOR-frontend-open-flows/extract-right-rail-controls
type: task
graph: development/20260505-003-REFACTOR-frontend-open-flows
title: Extract right rail controls
description: Move the right-rail icon strip and settings-dialog mount out of App.tsx behind a memoized component with stable control actions
tags:
    - performance
    - frontend
status: Success
---

- Added `frontend/src/hooks/useRightRailControlsActions.ts` to own the stable settings/search/calendar/document control actions that previously lived inline in `frontend/src/App.tsx`.
- Added `frontend/src/components/RightRailControls.tsx` to own the right-rail icon strip and settings-dialog mount so `App.tsx` no longer recreates that control surface inline.
- Reused the existing `SettingsDialog` contract and added a memoized settings-dialog prop bundle in `frontend/src/App.tsx` so the extracted right-rail controls preserve settings behavior while narrowing the shell render surface.

Validation

- cd frontend && npm test -- src/App.test.tsx -t "shows a document icon after node selection and opens a thread root from it|opens a sidebar file in the center pane on single click and keeps it open when calendar is toggled|persists appearance changes from the settings dialog|de-registers a local workspace from settings|rebuilds the index from settings and refreshes the open document"
- editor diagnostics: frontend/src/App.tsx, frontend/src/components/RightRailControls.tsx, frontend/src/hooks/useRightRailControlsActions.ts