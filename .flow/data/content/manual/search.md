---
id: manual/search
type: note
graph: manual
title: Search
description: Find anything in your workspace with full-text and field filters.
links:
    - node: manual/cli-reference
---

# Search

Flow indexes every document so you can search across titles, descriptions, tags, and content instantly.

## Quick search

The search box at the top of the left sidebar returns a mixed list of matching nodes. Each result shows its type — Home, Note, Task, or Command — so you know what you are looking at before you open it.

## CLI search

```bash
# Free-text search
flow search "retry budget"

# Filter by type
flow search --type task "manual"

# Filter by graph
flow search --graph manual

# Filter by tag
flow search --tag design

# Filter by title or description
flow search --title "Notes" --description "search"

# Search inside document content
flow search --content "error handling"

# Limit results
flow search --limit 10 "manual"

# Compact output (IDs only)
flow search --compact --type task --status Ready
```

You can combine filters. For example, find all Ready tasks in the manual graph:

```bash
flow search --graph manual --type task --status Ready
```

## Node listing

`flow node list` is a specialized search for nodes. It requires at least one filter:

```bash
# List all tasks in a graph
flow node list --graph manual --type task

# List tasks by status
flow node list --status Running --compact

# List nodes with a specific tag
flow node list --tag planning --type note
```

## Reading node content

Once you find a node, read it directly:

```bash
# Full node view
flow node read --id manual/tasks

# Just the body
flow node content --id manual/tasks

# A specific line range
flow node content --id manual/tasks --line-start 10 --line-end 30
```
