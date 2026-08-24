## How to Use This Skill (Tracked Work Mode)

| Work | Section |
|---|---|
| Record keeping — lightened, notes-first | [1. Record Keeping Protocol](#1-record-keeping-protocol) |
| Capture and organize notes | [Notes Mode](#notes-mode) |
| Work with synced Jira/Aha tickets | [Synced External Nodes — Read-Only Discipline](#synced-external-nodes-read-only-discipline) |
| Plan around tracked tickets | [Planning With Tickets](#planning-with-tickets) |
| Graph structure and canvas | [3. Graph Engineering](#3-graph-engineering) |

<!-- flow:modes:split -->

## Tracked Work (PM) Mode

This mode is the notes-mode baseline plus the discipline for working with externally tracked work (Jira today, Aha later). Use it when the workspace mirrors tickets from a tracker and plans reference them.

Everything in the Notes mode applies: free-form naming, note-first record keeping, capture/organize/link/search workflows. This section adds only the external-node discipline.

### Synced External Nodes — Read-Only Discipline

Nodes under `external/` graphs (for example `external/jira/<PROJECT>/`) are **mirrors** of tracker records. They are refreshed by `flow sync jira`, never by hand:

- **Never edit** a mirrored node's body, title, or tags manually. Manual edits are silently overwritten on the next sync.
- **Never delete** mirrored nodes. When a ticket is deleted in the tracker, sync marks its node with an archived-source tag instead — the node and its edges stay intact.
- **Link, don't copy**: to bring ticket context into a plan or design note, connect it with an edge (`--relationship relates-to --context "why this ticket matters here"`). Do not paste ticket bodies into other nodes; link so updates stay visible.
- Mirrored node ids are stable and derived from issue keys; links survive re-syncs.
- Treat mirrored bodies as reference material: descriptions, status, labels, and URL are accurate as of the last sync (recorded in the body).

### Planning With Tickets

- Designs and task graphs may connect to any number of mirrored tickets; the ticket is context, not the plan itself.
- Acceptance criteria that live in the tracker stay in the tracker — reference the ticket node instead of duplicating.
- When a synced ticket's status changes materially (for example resolved), run sync before planning around it.

A planning session in this mode is complete when plans link the relevant mirrored tickets with contextual edges and no mirrored node was edited by hand.
