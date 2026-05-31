---
id: design/20260506-001-FEAT-mermaid-diagrams/mermaid-design
type: note
graph: design/20260506-001-FEAT-mermaid-diagrams
title: Mermaid diagrams design
description: Use fenced mermaid code blocks as the canonical authoring format with slash-menu insertion as a shortcut and render previews across readonly and editor views without starter content
tags:
    - design
    - frontend
---

- Canonical authoring format remains a fenced code block with language mermaid.
    
- The slash-menu action should insert a mermaid code block without starter diagram content.
    
- Mermaid previews should render anywhere user-facing readonly markdown presents document excerpts, including thread panels and Home calendar mention previews.
    
- Diagram containers should avoid clipping right-edge label text when Mermaid SVG bounds are tight.
