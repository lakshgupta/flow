---
id: development/20260506-001-FEAT-mermaid-diagrams/extend-readonly-mermaid
type: task
graph: development/20260506-001-FEAT-mermaid-diagrams
title: Extend readonly Mermaid previews
description: Reuse the shared Mermaid renderer in remaining readonly markdown surfaces such as Home calendar excerpts
tags:
    - implementation
    - frontend
status: Success
links:
    - node: development/20260506-001-FEAT-mermaid-diagrams/regression-mermaid-authoring
      context: Readonly preview changes should be covered by the authoring regression or nearby focused tests
      relationships:
        - depends-on
---

- Reused frontend/src/components/RenderedMarkdown.tsx in frontend/src/components/HomeCalendarPanel.tsx so Home calendar date-entry excerpts also hydrate Mermaid fenced blocks.
- Extended frontend/src/styles.css so rendered Mermaid source blocks are hidden in rich-editor-preview surfaces after preview hydration.