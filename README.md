# Flow

Capture. Connect. Complete.

Flow is a local Markdown-first workspace for notes, tasks, and execution commands.

You can use Flow as:

- a personal or team note-taking application for engineering context,
- a project planning board backed by plain files,
- a command runner linked to your work graph,
- a browser UI over local Markdown documents.

Flow keeps your records in `.flow/data/content` and rebuilds search/graph indexes from disk.

## Why Flow

Most planning tools split your work across docs, issue trackers, and scripts.
Flow keeps these in one local system:

- notes for context and decisions,
- tasks for execution state,
- commands for repeatable operations,
- links between nodes for traceability.

Everything stays in your repository as Markdown.

## 60-Second Start

```bash
# 1) In your project root
flow init

# 2) Add one note and one task
flow create note --file overview --graph design/20260502-001-FEAT-example --title "Feature overview"
flow create task --file implement --graph development/20260502-001-FEAT-example --title "Implement feature" --status Ready

# 3) Open the GUI
flow gui
```

## Core Concepts

- Graph: A directory path under `.flow/data/content`.
  Example: `development/20260502-001-FEAT-example`
- Node: A Markdown document (`note`, `task`, or `command`).
- ID: Derived as `<graph>/<file>` (without `.md`).
- Edge: A link between two nodes (`flow node connect ...`).

Recommended convention:

- Keep design notes in `design/YYYYMMDD-NNN-<type>-<title>`.
- Keep plan/implementation tasks in `development/YYYYMMDD-NNN-<type>-<title>`.

## Use Flow As A Notes App

For note-taking only, you can ignore tasks and commands and just capture structured notes.

```bash
flow create note --file api-notes --graph design/20260502-001-NOTE-api --title "API notes"
flow create note --file decisions --graph design/20260502-001-NOTE-api --title "Decisions"
flow node connect --from design/20260502-001-NOTE-api/api-notes --to design/20260502-001-NOTE-api/decisions --graph design/20260502-001-NOTE-api --relationship related
```

This gives you linked notes that are easy to browse in the GUI or query from CLI.

## Use Flow In A Git Project

Use Flow inside the same repository as your code.

```bash
cd /path/to/your-repo
flow init
git add .flow/data/content .flow/home.md .flow/.gitignore
git commit -m "Initialize Flow workspace"
```

Commit these:

- `.flow/data/content/**`
- `.flow/home.md`
- `.flow/.gitignore`

Do not commit these generated files:

- `.flow/config/flow.index`
- `.flow/config/gui-server.json`

Typical workflow:

1. Create/update notes and tasks for the feature.
2. Implement code and update task status (`Ready` -> `Running` -> `Done` and terminal outcomes such as `Success`, `Failed`, or `Interrupted`).
3. Record validation outcomes in notes.
4. Commit code plus Flow updates together for traceable history.

## Use flow skill In Project Work

`flow skill content` prints the Flow execution protocol used by agents and maintainers.

```bash
flow skill content
```

Recommended pattern:

1. Run `flow skill content` when starting a new feature branch.
2. Follow the protocol for design/planning/implementation/test/review/commit stages.
3. When tasks are implemented and committed, record commit IDs on those task nodes.

## GUI

Start GUI:

```bash
flow gui
```

Stop GUI:

```bash
flow gui stop
```

In the GUI you can:

- browse graph trees,
- open and edit node content,
- inspect links and neighbors,
- arrange graph visuals.

## CLI Quick Reference

```bash
flow --help
flow version
flow init
flow configure --gui-port 4317
flow search parser
flow node list --feature development --status Ready --compact
flow node read --id development/20260502-001-FEAT-example/implement
flow run build
```

All commands and subcommands support help:

```bash
flow <command> --help
flow node --help
flow node read --help
```

## Install

### From Release Assets

Flow provides release assets for:

- `linux/amd64`
- `darwin/amd64`
- `darwin/arm64`

Install from downloaded asset:

```bash
bash ./install.sh
bash ./install.sh 0.1.0
bash ./install.sh v0.1.0
```

If running installer from a repository checkout:

```bash
bash ./scripts/install.sh v0.1.0
```

### From Local Source

```bash
cd frontend
npm ci
npm run build

cd ..
go build ./cmd/flow
```

## Learn More

- [docs/architecture.md](docs/architecture.md)
- [docs/reference.md](docs/reference.md)
- [docs/release.md](docs/release.md)
