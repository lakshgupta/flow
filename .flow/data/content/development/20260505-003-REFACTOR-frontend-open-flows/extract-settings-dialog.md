---
id: development/20260505-003-REFACTOR-frontend-open-flows/extract-settings-dialog
type: task
graph: development/20260505-003-REFACTOR-frontend-open-flows
title: Extract settings dialog
description: Move the settings modal branch out of App.tsx behind a memoized component with stable action bridges
tags:
    - performance
    - frontend
links:
    - node: development/20260505-003-REFACTOR-frontend-open-flows/extract-workflow-dialogs
      context: Continue extracting the remaining inline App.tsx modal workflows after the settings dialog
      relationships:
        - depends-on

---
- Added `frontend/src/components/SettingsDialog.tsx` to own the settings navigation, general tab, appearance controls, and danger-zone content.
- Replaced the inline settings modal in `frontend/src/App.tsx` with the memoized settings dialog component.
- Added stable settings action bridges in `frontend/src/App.tsx` for open state, tab selection, index rebuild, local workspace deregistration, appearance changes, and stopping the GUI.

Validation

- cd frontend && npm test -- src/App.test.tsx -t "persists appearance changes from the settings dialog|de-registers a local workspace from settings|rebuilds the index from settings and refreshes the open document"
- editor diagnostics: frontend/src/App.tsx, frontend/src/components/GraphEmptyState.tsx, frontend/src/components/SettingsDialog.tsx
