---
id: development/20260511-001-FIX-home-backlog-followup/run-home-backlog-regression
type: task
graph: development/20260511-001-FIX-home-backlog-followup
title: Run home backlog regression
description: Run focused and broad regression coverage for the completed home backlog fixes
tags:
    - test
    - frontend
status: Success
---

- Updated stale inline-menu and calendar preview expectations to the current shared palette and rendered diagram prefix.
- Added test-only Excalidraw mocks in the app-level regression suites so Vitest does not load the `open-color.json` entrypoint through the bundled Excalidraw package.

Validation

- cd frontend && npm test -- --run src/App.test.tsx src/components/HomeCalendarPanel.test.tsx src/components/editor/ui/inline-menu/inline-menu.test.tsx
- cd frontend && npm test
- cd frontend && npm run build

