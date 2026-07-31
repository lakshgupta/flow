---
id: development/20260730-004-FIX-mermaid-paste-title/root-cause
type: note
graph: development/20260730-004-FIX-mermaid-paste-title
title: Root cause — title extraction consumes first source line
description: First line of code block text is extracted as the title on mount, but every mermaid source starts with a syntax directive
tags:
    - root-cause
links:
    - node: development/20260730-004-FIX-mermaid-paste-title/fix-mermaid-paste-title
      context: Root cause analysis drives the fix
      relationships:
        - relates-to
---

A mermaid diagram section stores its title as the first line of the code block text. On mount, DiagramSection extracts the first line as the title and renders the diagram from the remaining lines. Every real mermaid source starts with a syntax directive (flowchart, graph, sequenceDiagram, ...), so pasted sources (or sources in documents opened from disk) had their first line consumed as a title and the diagram rendered only the remaining lines, failing with 'No diagram type detected'. Adding a leading newline worked around it by breaking the title-prefix match so the full text was rendered.

Typed diagrams appeared to work only because the section mounts empty (the title is captured once at mount), which made the bug appear paste/load-specific.

Fix: on mount, a first line that starts any mermaid diagram start directive (mirroring the detectors in mermaid's detectType) is never treated as a title. Explicit user titles (non-syntax first lines) still work and remain backward compatible.