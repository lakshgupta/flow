---
id: manual/commands
type: note
graph: manual
title: Working with Commands
description: Define shell commands in Flow and run them from the CLI or GUI.
links:
    - node: manual/cli-reference
---

# Working with Commands

Commands are executable nodes. They let you store repeatable shell operations inside your workspace, right next to the notes and tasks that describe why they exist.

## Creating a command

From the CLI:

```bash
flow create command \
  --graph manual \
  --file example-command \
  --title "Example Command" \
  --name example \
  --run "echo 'Hello from Flow'"
```

A command node requires:

- `--name` — a short unique name used to run the command later.
    
- `--run` — the shell command string to execute.
    

## Command frontmatter

```yaml
---
id: manual/example-command
type: command
graph: manual
title: Example Command
description: A sample command demonstrating the command node type
name: example
links:
  - manual/tasks
env:
  GREETING: Hello
run: echo "$GREETING from Flow"
---
```

The `env` map is optional. When the command runs, those environment variables are merged on top of the current process environment.

## Running a command

By short name:

```bash
flow run example
```

By full node ID:

```bash
flow run manual/example-command
```

Flow executes the command from the workspace root, so relative paths in `run` resolve against your project directory.

## Linking commands to tasks

Connect a command to the task that depends on it:

```bash
flow node connect \
  --from manual/tasks \
  --to manual/commands \
  --graph manual \
  --relationship related
```

This makes the command visible on the task's graph canvas and in its neighbor list.
