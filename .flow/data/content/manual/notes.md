---
id: manual/notes
type: note
graph: manual
title: Working with Notes
description: Create, edit, and link notes to build context and knowledge.
links:
    - node: manual/tasks
    - node: manual/graphs
---

# Working with Notes

Notes are the simplest node type in Flow. Use them to capture ideas, decisions, research, meeting minutes, or any free-form context you want to keep traceable.

## Creating a note

From the CLI:

```bash
flow create note --graph manual --file example-note --title "Example Note"
```

This creates `.flow/data/content/manual/example-note.md` with a YAML frontmatter header:

```yaml
---
id: manual/example-note
type: note
graph: manual
title: Example Note
---
```

You can also create notes from the GUI by using the graph tree menu or the slash-command menu in the editor.

## Editing a note

Open any note in the right-side editor panel. The editor is WYSIWYG:

- Type `/` to open the **slash-command menu** for block actions.
    
- Select text to reveal a floating toolbar for **bold, italic, links, and highlight**.
    
- Highlighted text is saved as inline `<mark>` HTML inside the Markdown body.
    
- Drag images into the editor to upload and embed them.
    
- Fold and unfold nested list branches when reading rendered Markdown.
    

## Linking notes together

Connect related notes so you can navigate between them in the graph canvas and the editor.

From the CLI:

```bash
flow node connect \
  --from manual/notes \
  --to manual/tasks \
  --graph manual \
  --relationship related
```

In the GUI, open a note and use the **Links** section in the right-side properties panel to add or remove connections.

Links are stored in the note's frontmatter:

```yaml
---
links:
  - manual/tasks
---
```

You can also write inline references in the body using double brackets. These soft references are resolved by the index and shown in the GUI.

## Tags and description

Add tags for classification:

```yaml
---
tags:
  - design
  - backend
---
```

Add a `description` for a short summary that appears in search results and graph cards.
