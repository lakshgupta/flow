## How to Use This Skill (Notes Mode)

| Work | Section |
|---|---|
| Record keeping — lightened, notes-first | [1. Record Keeping Protocol](#1-record-keeping-protocol) |
| Capture a new note | [Notes Mode: Capture](#notes-mode-capture) |
| Organize notebooks and books | [Notes Mode: Organize](#notes-mode-organize) |
| Link notes together | [Notes Mode: Link](#notes-mode-link) |
| Find notes again | [Notes Mode: Search And Retrieval](#notes-mode-search-and-retrieval) |
| Graph structure and canvas | [3. Graph Engineering](#3-graph-engineering) |

<!-- flow:modes:split -->

## Notes Mode

This mode adapts Flow for general note-taking: ad-hoc notes, books, design manuals, software architecture documentation, journals, and research notebooks. The development stage workflows (design/plan/implement/fix/refactor/test/review/commit) do not apply in this mode. The record-keeping protocol applies in a lightened form: notes are the primary node type; statuses, acceptance criteria, commit ids, and commit gates are not required.

The `flow` CLI remains the record-keeping interface (`flow create note`, `flow node update`, `flow node connect`). Graph engineering principles still help (explicit structure, context on edges), but nothing in this mode gates or blocks writes.

### Naming — Relaxed

The `YYYYMMDD-NNN-<type>-<title>` sub-graph convention is **not required** in this mode. Notebooks are free-form:

- Use any graph directory name that reads well: `notebooks/trip-planning`, `books/my-novel`, `manuals/team-handbook`, `architecture/payments-platform`.
- Organize by subject, not by date or type prefix. Dates belong in note titles or bodies when they matter.
- One graph per notebook, book, manual, or doc area. Chapters/sections are individual notes ordered by links or a table-of-contents note.

### Notes Mode: Capture

1. Create a note in the matching notebook graph: `flow create note --file <name> --graph <graph> --title "..." --body "..."`.
2. Tag freely (`--tag`) for retrieval; tags drive search and filtering.
3. Ad-hoc thoughts without a home yet go into an inbox-style notebook (for example `notebooks/inbox`) and are re-homed later.

### Notes Mode: Organize

- Group related notes under one graph; split a notebook into a new graph when it develops a distinct subject.
- Maintain an index or table-of-contents note per book/manual, linked to each chapter note with `--relationship relates-to --context "chapter order"`.

### Notes Mode: Link

- Connect notes with explicit relationships and context: `flow node connect --from ... --to ... --relationship relates-to --context "why"`.
- Use `[[inline references]]` inside bodies for soft navigation; promote to hard links only when the connection is structural.
- Use `evolves-from` when a note revises an earlier one; keep both.

### Notes Mode: Search And Retrieval

- Prefer `flow search --title/--description/--tag` filters before reading bodies.
- `flow node neighbors` and `flow graph path` answer "how is this connected?" questions across notebooks.

A capture/organization session is complete when new notes exist in the right graphs, links carry context, and search finds what was written. There is no commit gate and no approval protocol in this mode.
