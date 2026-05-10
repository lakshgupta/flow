---
id: development/20260505-001-FIX-uppercase-graph-node-names/allow-mixed-case-graph-node-names
type: task
graph: development/20260505-001-FIX-uppercase-graph-node-names
title: Allow mixed-case graph and node names
description: Relax frontend lowercase-only validation for graph and node names
status: Success
links:
    - node: development/20260505-001-FIX-uppercase-graph-node-names/fix-notes
      context: Captures root cause, fix decision, and validation for mixed-case graph and node name handling.
      relationships:
        - documents
---

Implemented the React-side validator change in frontend/src/App.tsx and added focused regression coverage in frontend/src/App.test.tsx.

Validation

- cd frontend && npm test -- src/App.test.tsx -t "renames a graph from the content tree|renames a node from the content tree|shows empty-graph create actions and creates a note into the selected graph"
