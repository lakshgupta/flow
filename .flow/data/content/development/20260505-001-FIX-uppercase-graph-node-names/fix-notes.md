---
id: development/20260505-001-FIX-uppercase-graph-node-names/fix-notes
type: note
graph: development/20260505-001-FIX-uppercase-graph-node-names
title: Uppercase graph/node fix notes
description: Root cause, fix decision, and validation for mixed-case graph and node names
---

Root cause

- frontend/src/App.tsx enforced lowercase-only file-name validation while backend graph and document path handling already preserved case.
    

Fix

- Relaxed the React validator and updated the dialog/error copy to allow mixed-case names.
    
- Added focused frontend tests for mixed-case graph rename, node rename, and node creation.
    

Validation

- cd frontend && npm test -- src/App.test.tsx -t "renames a graph from the content tree|renames a node from the content tree|shows empty-graph create actions and creates a note into the selected graph"
