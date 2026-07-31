---
id: development/20260730-002-FIX-graph-canvas-coordinates/root-cause
type: note
graph: development/20260730-002-FIX-graph-canvas-coordinates
title: Root cause — canvas position caches shared across graphs
description: Frontend position maps are keyed by document id only and leak positions between graph scopes
links:
    - node: development/20260730-002-FIX-graph-canvas-coordinates/fix-graph-canvas-coordinates
      context: Root cause analysis drives the fix
      relationships:
        - relates-to
---

Each graph canvas must keep its own node coordinates: dragging a node in a subgraph must not move the same node in the parent graph, and vice versa.

The backend already scopes correctly. GraphLayoutPosition is keyed by (graph_path, document_id); handleGraphCanvas reads and handleGraphLayout writes positions under the selected graph path only.

The leak is in the frontend. App.tsx keeps three position caches keyed by document id only and shared across all graphs: graphCanvasPositions, graphCanvasUserPositions, graphCanvasHorizontalPositions.

On every graph canvas load, syncGraphCanvasLayout (App.tsx) restores the cached positions of the PREVIOUS graph onto the new graph: preserveKnownPositions keeps any cached entry whose document id is visible in the current scope, and a parent graph scope includes descendant (subgraph) nodes. So a node dragged in a subgraph overrides the parent graph's own persisted position for the same node.

Worse, persistGraphCanvasPosition / persistGraphCanvasPositions serialize the ENTIRE cache into the PUT /api/graph-layout payload scoped to the current graph, so foreign positions get written into the current graph's persisted rows.

Fix: clear the three position caches when selectedGraphPath changes so each graph canvas re-initializes from its own server-persisted positions (the server already persists per graph path, so nothing is lost). This restores the per-graph independence documented for graph canvas behavior.