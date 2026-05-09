---
id: development/20260509-001-FEAT-home-backlog/make-excalidraw-resizable
type: task
graph: development/20260509-001-FEAT-home-backlog
title: Make Excalidraw resizable
description: Allow the embedded Excalidraw surface to be resized without breaking editor layout
tags:
    - implementation
    - frontend
status: Ready
links:
    - node: development/20260509-001-FEAT-home-backlog/fix-editor-toolbar-focus
      context: Proceed to the next backlog item after Excalidraw feature work is complete.
      relationships:
        - depends-on
---

Add a bounded resize affordance for the Excalidraw surface and validate the interaction in focused tests.