---
id: home
type: home
title: Home
---

## Backlog

- Improvements
    - export a note as pdf.
    - canvas where all the nodes graph is displayed should have a toggle mode to have a grid as days for column and rows as the hourly section divided in 15 mins sub sections. the nodes in the canvas could be free flowing but in case there is a start date and a due date for task then arrange them as per the grid.
- Fix
    - empty list items no longer write literal `<p><br></p>` into markdown; list items serialize without stray indented blank lines — done (20260821-001-FIX-empty-list-item-serialization)
    - switching the workspace in-place (global → local, or deregistering a local workspace) now redirects all desktop saves to the newly selected workspace instead of the launch-time one — done (20260821-002-FIX-desktop-workspace-switch-writes)
- Tagging
    - ability to add a tag using `#` trigger. typing `#` and typing without any space should show user options to select an already used tags or type in a new one fully. the tag could be added anywhere in the page.
    - deleting a tag should delete it from the memory of the app in case it was the last of it's kind. for example, if there is no longer a tag name 'test' in any of the page then the `#` trigger should not show `test` as an option to select.
- Search
    - simplify the global search option. I would still like to be able to search with either or and condition with the title, tags, description or content. Is there a way to use a single search bar instead of multiple as used currently?//
    - Is there a way to combine the graph local title search with the global search? currently there are 2 search bars visible when graph view is open which seems unintuitive.
- Skills
    - along with the research used in creating the current skills in packaging/skills and docs/skills.md, we should explore how Flow app can be used to plan things beforehand and record in flow and then start the developement of all the planned features together. All the research should blend in together to create something which is useful for the user and also make sense for the flow app.

## Thinking

- Command node
    - finish implementing command type of nodes
- Draw on the canvas directly
