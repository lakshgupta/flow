---
id: home
type: home
title: Home
---

## Backlog

- feature to move a sub-graph to a top level graph, or a top level graph to a sub-graph of an another graph.
    
- ability to add a tag using `#` trigger. typing `#` and typing without any space should show user options to select an already used tags or type in a new one fully. the tag could be added anywhere in the page.
    
- simplify the global search option. I would still like to be able to search with either or and condition with the title, tags, description or content. Is there a way to use a single search bar instead of multiple as used currently?
    
- Is there a way to combine the graph local title search with the global search? currently there are 2 search bars visible when graph view is open which seems unintuitive.
    
- ubuntu builds are failing with
    
    ```
        Run bash ./scripts/build-package-linux.sh amd64
        a packager must be specified if target is a directory or blank
        Error: Process completed with exit code 1.
    ```
    
- deleting a tag should delete it from the memory of the app in case it was the last of it's kind. for example, if there is no longer a tag name 'test' in any of the page then the `#` trigger should not show `test` as an option to select.
    
- fix all the problems detected by VSCode
    

## Thinking

- finish implementing command type of nodes
    
- enable status tracking on the tasks
    
- refine skills- summarize, link with related work
