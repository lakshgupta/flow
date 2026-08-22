---
id: home
type: home
title: Home
---

## Backlog

- New features
    - Have an option to export a note as pdf. eventually exporting a graph should come out as a book in the form of pdf.
    - Need a presentation mode as well. Each node could be shown in the presentation node. using the left-right arrow keyboard buttons we should be able to move from one node in the graph to another. the next connected nodes if multiple should be accessible using the up and down keys. 
    - canvas where all the nodes graph is displayed should have a toggle mode to have a grid as days for column and rows as the hourly section divided in 15 mins sub sections. the nodes in the canvas could be free flowing but in case there is a start date and a due date for task then arrange them as per the grid.
- Fix
- Tagging
    - ability to add a tag using `#` trigger. typing `#` and typing without any space should show user options to select an already used tags or type in a new one fully. the tag could be added anywhere in the page.
    - deleting a tag should delete it from the memory of the app in case it was the last of it's kind. for example, if there is no longer a tag name 'test' in any of the page then the `#` trigger should not show `test` as an option to select.
- Search
    - simplify the global search option. I would still like to be able to search with either or and condition with the title, tags, description or content. Is there a way to use a single search bar instead of multiple as used currently?//
    - Is there a way to combine the graph local title search with the global search? currently there are 2 search bars visible when graph view is open which seems unintuitive.
- Skills
    - along with the research used in creating the current skills in packaging/skills and docs/skills.md, we should explore how Flow app can be used to plan things beforehand and record in flow and then start the developement of all the planned features together. All the research should blend in together to create something which is useful for the user and also make sense for the flow app.
        - Designed and approved 2026-08-22 — see `design/20260822-004-FEAT-modes-batch-sync-program` roadmap linking three member designs: workspace modes (`flow skill init --mode dev|note|pm`), roadmap planning + parallel batch development (`flow roadmap`, execution packets, session claims), and external ticket sync (Jira first, read-only mirrors under `external/jira/`).
        - Planned 2026-08-22 — all three features now have development task graphs: `development/20260822-001-FEAT-workspace-modes-skill-init` (7 tasks), `development/20260822-002-FEAT-roadmap-batch-parallel-dev` (8 tasks), `development/20260822-003-FEAT-jira-aha-ticket-sync` (8 tasks). First cross-feature dependency recorded: Jira sync's pm-mode doc task depends on modes' content-authoring task. Ready to batch-implement in parallel.
        - Completed 2026-08-22 (uncommitted) — all three program features implemented, tested, reviewed: 001 workspace modes (`flow skill init --mode dev|note|pm`, composition engine in skillcontent.go), 002 roadmap + parallel batch development (`flow roadmap [--next|--claim]`, session claims with 4h staleness, skill §2.9, AC/evidence planning rules), 003 Jira sync (`flow sync jira` mirroring into `external/jira/<PROJECT>/` as read-only nodes, archived-source tagging). Full test suite green; three Low findings recorded in review notes. Commits pending.

## Thinking

- Command node
    - finish implementing command type of nodes
- Draw on the canvas directly
- Skill to work with Aha and JIRA
    - Designed and approved 2026-08-22 — `design/20260822-003-FEAT-jira-aha-ticket-sync` (Jira first; Aha later behind the same client interface).
