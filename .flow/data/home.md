---
id: home
type: home
title: Home
---

## Backlog

- New features
    - Have an option to export a node as pdf. eventually exporting a graph should come out as a book in the form of pdf.
    - canvas where all the nodes graph is displayed should have a toggle mode to have a grid as days for column and rows as the hourly section divided in 15 mins sub sections. the nodes in the canvas could be free flowing but in case there is a start date and a due date for task then arrange them as per the grid.
    - check the arrangement of the text and the margin when text color or background color options are presented. the text like 'Clear background color' are going out of the button margin. — fixed 2026-08-22: Clear button now wraps and stays inside its border.

    - check the look of the presentation node. the content should be rendered properly. — polished 2026-08-22: flat pastel slide chrome with full markdown typography; see `development/20260822-005-FEAT-presentation-mode`.
    - the flow skill should tell the agent to use the discription in the frontmatter for a summary but the actual content should be outside of the front matter and should be the content of the node. — clarified 2026-08-22: skill now states description is the one-line summary, body is full detail, both searchable.
- Fix
- Tagging
    - ability to add a tag using `#` trigger. typing `#` and typing without any space should show user options to select an already used tags or type in a new one fully. the tag could be added anywhere in the page.
    - deleting a tag should delete it from the memory of the app in case it was the last of it's kind. for example, if there is no longer a tag name 'test' in any of the page then the `#` trigger should not show `test` as an option to select.
- Search
    - simplify the global search option. I would still like to be able to search with either or and condition with the title, tags, description or content. Is there a way to use a single search bar instead of multiple as used currently?//
    - Is there a way to combine the graph local title search with the global search? currently there are 2 search bars visible when graph view is open which seems unintuitive.

## Thinking

- Command node
    - finish implementing command type of nodes
- Draw on the canvas directly
