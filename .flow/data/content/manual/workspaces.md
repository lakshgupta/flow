---
id: manual/workspaces
type: note
graph: manual
title: Workspaces
description: Choose between local project workspaces and a global personal workspace.
links:
    - node: manual/gui
---

# Workspaces

Flow supports two workspace modes: **global** and **local**.

## Global workspace

A single personal workspace that lives in your user config directory, independent of any project.

- Use it as a personal knowledge base and task tracker that is always available.
    
- Run global commands from any directory by prefixing with `-g`.
    

Set it up once:

```bash
flow -g configure --workspace ~/flow-workspace
flow -g init
```

Then open it:

```bash
flow -g service
```

## Local workspace

Tied to a specific project directory. The `.flow/` folder sits inside your repository, so workspace content travels with your code.

```bash
cd /path/to/your-repo
flow init
```

When you initialize a local workspace, it is automatically registered with the global workspace. This means it appears in the **global GUI's workspace switcher** without extra steps.

## Switching workspaces in the GUI

When running the global web service (`flow -g service`), the sidebar shows a workspace selector listing:

- The global workspace
    
- Every registered local workspace
    

Click any entry to switch context, browse its graphs, and edit its documents — all in the same browser tab.

When you switch, Flow rebuilds the selected workspace's index before loading data, so external changes on disk are always reflected.

## Managing registered workspaces

List registered local workspaces:

```bash
flow -g workspace list
```

Remove a stale entry from the global GUI using the settings dialog's **Workspaces** section, or by using the sidebar remove button.

## What to commit

When using Flow in a Git project, commit these:

- `.flow/data/content/**`
    
- `.flow/data/home.md`
    
- `.flow/.gitignore`
    

Do **not** commit generated files:

- `.flow/config/flow.index`
    
- `.flow/config/flow.index.tmp`
    
- `.flow/config/gui-server.json`
    
- `.flow/logs/`
