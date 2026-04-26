# Backlog

This document tracks planned feature work derived from approved architecture entries.

## FEAT-20260425-0001: Inline References And Thread View

Status: In Progress

- [x] Add backend parsing, validation, and index rebuild support for inline body references so `[[...]]` tokens become derived reference relationships without changing frontmatter `links` behavior.
- [x] Add a dedicated reference-target lookup surface that can resolve authoring targets for inline references.
- [x] Render resolved inline references distinctly from frontmatter links in the GUI and support reference-node navigation from document content.
- [x] Rewrite inline references during document and graph rename flows so canonical breadcrumb tokens stay in sync.
- [ ] Add the thread-view navigation state described in the architecture.

