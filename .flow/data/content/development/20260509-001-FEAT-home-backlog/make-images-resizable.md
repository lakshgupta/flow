---
id: development/20260509-001-FEAT-home-backlog/make-images-resizable
type: task
graph: development/20260509-001-FEAT-home-backlog
title: Make images resizable
description: 'Register the production editor image node view so inserted images expose the resize handle (commit: 3048044)'
tags:
    - fix
    - frontend
status: Success
---

Registered the custom image node view in the production editor extension so the existing resizable image component is actually mounted for inserted images instead of staying example-only code.

Validation

- cd frontend && npm test -- src/components/editor/define-editor-extension.test.ts
- cd frontend && npm run build
*** Add File: /home/lex/Documents/github/flow/.flow/data/content/development/20260509-001-FEAT-home-backlog/refresh-ui-shell-styling.md
---
id: development/20260509-001-FEAT-home-backlog/refresh-ui-shell-styling
type: task
graph: development/20260509-001-FEAT-home-backlog
title: Refresh UI shell styling
description: Review the live app UI and modernize the shell colors, hierarchy, and navigation chrome
tags:
    - design
    - frontend
status: Success
---

Reviewed the live GUI while explicitly ignoring DESIGN.md, then refreshed the global color tokens and main shell chrome so the workspace header, content frame, graph navigation, and right rail read as a more modern layered interface instead of flat white panels.

Validation

- cd frontend && npm run build
- Live review at http://127.0.0.1:4317/ after running cd /home/lex/Documents/github/flow && go run ./cmd/flow gui