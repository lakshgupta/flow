---
id: manual/tasks
type: note
graph: manual
title: Working with Tasks
description: Create tasks, track status, and link them to notes and commands.
links:
    - node: manual/commands
    - node: manual/graphs
---

# Working with Tasks

Tasks are status-driven work nodes. They help you track what needs to happen, what is in progress, and what is finished.

## Creating a task

From the CLI:

```bash
flow create task \
  --graph manual \
  --file example-task \
  --title "Example Task" \
  --status Ready
```

Valid statuses:

|  
Status

|

Meaning

|  
| --- | --- |  
|

`Ready`

|

Planned but not started

|  
|

`Running`

|

Currently in progress

|  
|

`Done`

|

Completed successfully

|  
|

`Success`

|

Validated and passed

|  
|

`Failed`

|

Did not pass validation

|  
|

`Interrupted`

|

Stopped before completion

|

## Task frontmatter

A task looks like this:

```yaml
---
id: manual/example-task
type: task
graph: manual
title: Example Task
description: A sample task demonstrating status tracking
status: Ready
links:
  - manual/notes
---
```

## Linking tasks to context

Link tasks to the notes and commands that provide context or next steps:

```bash
flow node connect \
  --from manual/tasks \
  --to manual/notes \
  --graph manual \
  --relationship depends-on
```

In the GUI, the graph canvas shows task nodes with a color and label that reflect their current status.

## Updating status

From the CLI:

```bash
flow node update --id manual/example-task --status Running
```

In the GUI, open the task in the editor and change the status from the properties panel.

## Filtering tasks

List only the tasks you care about:

```bash
# All Ready tasks
flow node list --status Ready --compact

# Tasks in a specific graph
flow node list --graph manual --status Running
```
