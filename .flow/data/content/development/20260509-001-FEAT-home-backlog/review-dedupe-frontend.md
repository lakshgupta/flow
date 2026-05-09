---
id: development/20260509-001-FEAT-home-backlog/review-dedupe-frontend
type: task
graph: development/20260509-001-FEAT-home-backlog
title: Review and dedupe frontend
description: 'Perform a bounded frontend review for duplicate logic and concrete rerender or performance issues (commit: d79fe12)'
tags:
    - review
    - refactor
    - frontend
status: Success
---

Replaced the repeated latest-action ref boilerplate across the frontend action hooks with a shared `useLatestRef` helper, then switched the thread, graph canvas, home, sidebar, and right-rail hooks to reuse that helper while preserving their stable callback contracts.

Validation

- cd frontend && npm run build
- Attempted: cd frontend && npm test -- src/App.test.tsx -t "opens graph documents as thread roots in the center view and persists the full drag-end arrangement|shows a document icon after node selection and opens a thread root from it|shows a document table of contents on the Home surface and persists resize|opens a sidebar file in the center pane on single click and keeps it open when calendar is toggled|switches workspaces from the sidebar selector and refreshes the graph tree" (blocked before test collection by an existing JSON import-attribute error for open-color/open-color.json)