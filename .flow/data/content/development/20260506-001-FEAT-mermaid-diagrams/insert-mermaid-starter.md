---
id: development/20260506-001-FEAT-mermaid-diagrams/insert-mermaid-starter
type: task
graph: development/20260506-001-FEAT-mermaid-diagrams
title: Insert Mermaid starter diagram
description: Insert empty Mermaid code block
tags:
    - implementation
    - frontend
status: Success
links:
    - node: development/20260506-001-FEAT-mermaid-diagrams/regression-mermaid-authoring
      context: Starter insertion should be validated by the Mermaid authoring regression
      relationships:
        - depends-on
---

- Updated frontend/src/components/editor/ui/slash-menu/slash-menu.tsx so the Mermaid Diagram slash action inserts an empty mermaid code block without starter content.
- Added focused coverage in frontend/src/components/editor/ui/slash-menu/slash-menu.test.tsx to assert no extra text is inserted.