---
id: development/20260805-001-FEAT-skills-packaging-init/commit-notes
type: note
graph: development/20260805-001-FEAT-skills-packaging-init
title: 'Commit: skills packaging, embed, and skill init/list CLI'
description: Commit scope, task mapping, validation status
---

Commit scope:

- `packaging/skills/` — canonical skill tree (moved from `.agents/skills/` and `packaging/SKILL.md`); frontmatter added to `flow/SKILL.md`.
- `skillcontent.go`, `skillcontent_test.go` — single embed.FS over `packaging/skills`; `SkillNames()`, `SkillMarkdownByName()`.
- `cmd/flow/main.go`, `cmd/flow/main_test.go` — `flow skill list`, `flow skill init [--skill] [--project] [--force] [--quiet]`, content default `flow` + alias; `userHomeDir` in commandEnv.
- `AGENTS.md`, `docs/architecture.md`, `docs/reference.md`, `docs/skill.md`, `knowledge.md` — routing and documentation for the new layout and commands.
- `.gitignore` — `.agents/skills/` ignored (generated).
- `.flow/data/home.md` — backlog item marked designed+implemented; some unrelated pre-existing cleanup edits ride along.
- Flow records: `design/20260805-001-FEAT-skills-packaging-init/` and `development/20260805-001-FEAT-skills-packaging-init/` (tasks `move-skills`, `embed-fs`, `skill-init`, `docs-and-agents`, `tests` all Done; `impl-notes`, `review`, `commit-notes` notes).

Excluded from this commit (unrelated pre-existing working-tree changes):

- repo-root `flow` binary (rebuilt), `internal/buildinfo/VERSION` (0.8.0-dev bump), `frontend/package.json`/`package-lock.json` version bumps.
- `.flow/config/flow.yaml` GUI config drift; other `.flow/data/content/**` frontmatter migration edits; excalidraw screenshots.

Validation:

- `go build ./...`, `go vet ./...`, `go test ./...` green (root skillcontent tests + cmd/flow CLI tests + all packages).
