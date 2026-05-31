---
id: development/20260509-001-FEAT-home-backlog/ignore-generated-frontend-test-artifacts
type: task
graph: development/20260509-001-FEAT-home-backlog
title: Ignore generated frontend test artifacts
description: Add ignore rules for generated Playwright report and test-result directories, and remove the tracked artifacts from the repository
tags:
    - maintenance
    - frontend
status: Success
---

- Added `frontend/playwright-report/` and `frontend/test-results/` to `.gitignore`.
- Removed the tracked generated files under those directories from git.

Validation

- git check-ignore -v frontend/playwright-report/index.html frontend/test-results/.last-run.json
