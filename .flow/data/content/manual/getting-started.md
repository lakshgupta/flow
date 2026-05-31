---
id: manual/getting-started
type: note
graph: manual
title: Getting Started
description: Install Flow, initialize a workspace, and learn the core ideas.
links:
    - node: manual/notes
    - node: manual/workspaces
    - node: manual/gui
---

# Getting Started

## Install Flow

Flow ships as a single binary for Linux, macOS (Intel and Apple Silicon), and Windows. Download the release archive for your platform and run the installer:

```bash
bash ./install.sh
```

You can also build from source if you have Go and Node.js installed.

## Initialize a workspace

A workspace is a directory named `.flow/` that lives either inside a project (local mode) or in your user config directory (global mode).

**Local workspace** (tied to a project):

```bash
cd /path/to/your-project
flow init
```

**Global workspace** (personal, always available):

```bash
flow -g configure --workspace ~/flow-workspace
flow -g init
```

## The `.flow/` directory

After initialization you will see:

```text
.flow/
  config/
    flow.yaml         — settings like GUI port and panel widths
    flow.index        — derived search and graph index (rebuildable)
    gui-server.json   — runtime server metadata
  data/
    home.md           — your workspace landing page
    content/          — all notes, tasks, and commands live here
```

Everything under `data/content/` is canonical Markdown. The files in `config/` are derived and can be regenerated.

## Core concepts

- **Graph** — A folder path under `.flow/data/content/`. Example: `manual/getting-started`.
    
- **Node** — A single Markdown document inside a graph. It can be a note, a task, or a command.
    
- **ID** — The unique address of a node, shaped like `<graph>/<file>` without the `.md` extension.
    
- **Edge** — A directed link from one node to another. You create edges to trace relationships between notes, tasks, and commands.
    

## Quick first steps

1. Open the GUI:
    
    ```bash
    flow service
    ```
    
    This starts a local web server and opens your browser.
    
2. Or open the desktop app:
    
    ```bash
    flow desktop
    ```
    
3. Create your first note:
    
    ```bash
    flow create note --graph getting-started --file welcome --title "Welcome to Flow"
    ```
    
4. Browse the graph tree in the left sidebar, click a node to open it in the editor, and start writing.
