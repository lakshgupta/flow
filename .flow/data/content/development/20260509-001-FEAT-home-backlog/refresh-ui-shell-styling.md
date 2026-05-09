---
id: development/20260509-001-FEAT-home-backlog/refresh-ui-shell-styling
type: task
graph: development/20260509-001-FEAT-home-backlog
title: Refresh UI shell styling
description: 'Review the live app UI and modernize the shell colors, hierarchy, and navigation chrome (commit: fb3a8a9)'
tags:
    - design
    - frontend
status: Success
---

Reviewed the live GUI while explicitly ignoring DESIGN.md, then refreshed the global color tokens and main shell chrome so the workspace header, content frame, graph navigation, and right rail read as a more modern layered interface instead of flat white panels.

Validation

- cd frontend && npm run build
- Live review at http://127.0.0.1:4317/ after running cd /home/lex/Documents/github/flow && go run ./cmd/flow gui