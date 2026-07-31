---
id: development/20260730-004-FIX-mermaid-paste-title/commit-notes
type: note
graph: development/20260730-004-FIX-mermaid-paste-title
title: Commit mapping for mermaid paste title fix
description: Commit scope and validation for the title-extraction fix
tags:
    - commit
links:
    - node: development/20260730-004-FIX-mermaid-paste-title/fix-mermaid-paste-title
      context: Commit notes for the fix task
      relationships:
        - maps-to
---

## Commit Scope

This commit covers the fix for mermaid diagram sources whose first line is consumed as the section title, breaking rendering.

## Changes Included

- frontend/src/components/editor/ui/diagram-section/diagram-section.tsx: on mount, a first line that starts a mermaid diagram directive (mirroring mermaid's detectType detectors) is no longer treated as a title; explicit non-syntax titles still work.
- frontend/src/components/editor/ui/diagram-section/diagram-section.test.tsx: new tests mocking MermaidDiagram to assert the rendered source prop (full source for syntax first lines, title-stripped source for explicit titles, full pasted source).

## Validation Status

- npx tsc --noEmit passes
- vitest diagram-section suite passes 5/5 consecutive runs
- Revert check: without the fix, the syntax-first-line test fails
- Full npm test: 123/123 pass

## Flow Task Mapping

- 20260730-004-FIX-mermaid-paste-title/fix-mermaid-paste-title.md -> Done