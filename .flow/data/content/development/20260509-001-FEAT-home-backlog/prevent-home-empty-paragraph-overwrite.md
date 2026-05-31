---
id: development/20260509-001-FEAT-home-backlog/prevent-home-empty-paragraph-overwrite
type: task
graph: development/20260509-001-FEAT-home-backlog
title: Prevent Home empty paragraph overwrite
description: Avoid persisting Home body as <p><br></p> when the editor only contains empty paragraphs
tags:
    - implementation
    - frontend
status: Success
---

- Added `normalizeHomeBodyForSave` in `frontend/src/lib/docUtils.ts` to collapse Home bodies that are empty or only `<p><br></p>` blocks to an empty string.
- Wired Home body normalization into `frontend/src/App.tsx` across editor sync, form field updates, and Home save payload construction.
- Added regression coverage in `frontend/src/lib/docUtils.test.ts` for single and repeated empty-paragraph inputs.

Validation

- cd frontend && npm run test -- src/lib/docUtils.test.ts
- cd frontend && npm run build
