---
id: manual/graphs
type: note
graph: manual
title: Graphs & Canvas
description: Browse the graph tree and arrange nodes on an infinite canvas.
links:
    - node: manual/search
---

# Graphs & Canvas

In Flow, a **graph** is a folder path under `.flow/data/content/`. Every document inside that folder belongs to the graph automatically. There is no separate registry — the filesystem is the source of truth.

## The graph tree

The left sidebar shows the full tree of graphs and their documents:

- Parent folders remain visible as long as any descendant contains a Markdown file.
    
- Empty graphs are hidden from the tree.
    
- Each graph row shows a count like `3 direct / 11 total`, telling you how many documents live directly inside versus in the full subtree.
    
- You can download an entire graph as a zip archive from the row menu.
    

## The graph canvas

When you select a graph in the sidebar, the middle panel switches to an **infinite canvas** for that graph scope.

### Nodes on the canvas

Notes, tasks, and commands all appear as cards. They are differentiated by:

- **Type color and label** — each type has its own color.
    
- **Status badge** — tasks show their current status.
    

### Interacting with the canvas

- **Single click** a node to select it and highlight its directly connected edges.
    
- **Double click** a node to open it in the right-side editor without changing the canvas view.
    
- **Drag** a node to move it freely. Its position is saved automatically on drag end.
    
- **Pan and zoom** the canvas to explore large graphs.
    

### Layout

If a node has never been moved, Flow seeds its position from graph relationships using layered columns derived from incoming and downstream links. Even cycles get a stable fallback based on creation time, so the initial layout is predictable.

Positions are stored as derived GUI state in the SQLite index, not in the Markdown files themselves.

### Home is not a graph

The Home document is a special top-level surface. It is never rendered as a graph canvas. Selecting Home shows the workspace landing page in the middle panel instead.
