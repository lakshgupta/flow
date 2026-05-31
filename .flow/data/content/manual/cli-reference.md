---
id: manual/cli-reference
type: note
graph: manual
title: CLI Reference
description: Common commands for everyday use.
---

# CLI Reference

Flow's CLI works without starting any server. Every command supports `--help` for detailed usage.

## Workspace commands

```bash
flow init                          # Initialize a local workspace
flow configure --gui-port 4318     # Change the local GUI port
flow -g configure --workspace ~/flow-workspace  # Set global workspace path
flow -g init                       # Initialize the global workspace
```

## Service and desktop

```bash
flow service                       # Start the web service and open the browser
flow service stop                  # Stop the web service
flow desktop                       # Open the desktop app
flow desktop stop                  # Close the desktop app
```

## Creating documents

```bash
flow create note --graph <graph> --file <file> --title <title>
flow create task --graph <graph> --file <file> --title <title> --status <status>
flow create command --graph <graph> --file <file> --title <title> --name <name> --run <command>
```

## Reading documents

```bash
flow node read --id <node-id>
flow node content --id <node-id>
flow node content --id <node-id> --line-start 10 --line-end 30
```

## Updating documents

```bash
flow node update --id <node-id> --title "New title"
flow node update --id <node-id> --status Done
flow node update --id <node-id> --body "Updated content"
flow update --path <relative-path> --title "New title"
```

## Deleting documents

```bash
flow delete --path <relative-path>
```

## Connecting and disconnecting

```bash
flow node connect --from <id> --to <id> --graph <graph> --relationship related
flow node disconnect --from <id> --to <id> --graph <graph>
```

## Listing and searching

```bash
flow node list --graph <graph> --type note --compact
flow node list --status Ready --compact
flow search "query"
flow search --type task --status Running --compact
flow search --tag design --limit 10
```

## Running commands

```bash
flow run <command-name>
flow run <graph>/<command-file>
```

## Global mode

Prefix any command with `-g` to target the global workspace:

```bash
flow -g service
flow -g search "personal notes"
flow -g node list --type task --status Ready
```

## Help

```bash
flow --help
flow <command> --help
flow node read --help
```
