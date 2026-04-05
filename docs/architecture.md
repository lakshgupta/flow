# Architecture

This document describes the architecture of Flow, a local-first planning tool for software projects. It covers the system design, data model, components, and key architectural decisions.

## Index

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Data Architecture](#data-architecture)
- [Component Architecture](#component-architecture)
- [UI Architecture](#ui-architecture)
- [Control Flow](#control-flow)
- [Constraints](#constraints)
- [Testing Strategy](#testing-strategy)
- [Risks and Tradeoffs](#risks-and-tradeoffs)
- [Approved Feature Designs](#approved-feature-designs)
  - [Theme Settings - Light/Dark/System Mode](#feature-theme-settings---lightdarksystem-mode)
  - [Modern Sleek UI Redesign](#feature-modern-sleek-ui-redesign)
  - [Modern UI Redesign: Home, Favorites, and Rich Center Pane](#feature-modern-ui-redesign-home-favorites-and-rich-center-pane)

## Overview

Flow is a local-first planning tool for software projects that stores all data as canonical Markdown documents. It supports both project-local and user-global workspaces, providing a CLI, TUI, and browser-based GUI.

Key features include:
- **Layered Task Graph Planner**: Manages notes, tasks, and commands as dependency-driven work items stored in Markdown.
- **Three-Panel Workspace GUI**: Desktop-first interface with hierarchical tree view, infinite canvas, and content editor.
- **Local-first Design**: No cloud sync, Git-friendly, with rebuildable SQLite index for search and graph queries.

The system uses Go for the backend, React for the frontend, and SQLite for indexing, shipping as a single binary.

## Cross-Cutting Constraints

The following constraints apply across the system:

- Markdown files are the canonical source of truth.
- Markdown remains canonical for document content and graph semantics.
- `.flow/config/flow.index` keeps derived search and graph-query data, and may also store workspace-scoped GUI layout state in separate tables.
- File location is authoritative for graph membership when it disagrees with document frontmatter.
- Graph documents are classified by frontmatter `type`, not by type-specific directories.
- `flow init` always rebuilds the index and must not modify Markdown note, task, or command files.
- `flow search` auto-rebuilds a missing index.
- Local and global workspaces share the same schema and command behavior.
- GUI server ports are configured per workspace and server startup fails instead of auto-falling back when the configured port is unavailable.
- The first rewrite keeps note, task, and command frontmatter close to the current design.
- Hard links represent same-type dependencies only.
- Soft links represent references only and never affect readiness or layering.
- Notes are relationship-oriented and not treated as dependency-layered work.
- Tasks and commands are the only layered executable work types in v1.
- The first browser GUI milestone is read-only and focuses on note canvas and layered views.
- Release automation starts with `linux/amd64` binaries before broader platform coverage.

## UI Design Guidelines

Refer to [docs/design-language.md](design-language.md) for all UI, component, and styling rules.

You are a senior product designer and front‑end architect specializing in modern, minimal, typographic interfaces similar to Noteey, Arky, Linear, Notion, affine and Superlist. You design exclusively using shadcn/ui components and Tailwind CSS tokens.

Your job is to design UI for an app named Flow. Flow has a three‑panel layout:
1. Left panel: hierarchical tree view of notes, tasks, and command graph nodes.
2. Middle panel: infinite canvas for visual thinking.
3. Right panel: note content editor.

Designs must follow these principles:
- Clean, modern, minimal, calm.
- Typography-first with clear hierarchy.
- Neutral color palette with subtle accents.
- Soft shadows, subtle separators, generous spacing.
- Avoid clutter, heavy borders, or dense UI.
- Use progressive disclosure and contextual actions.
- Use shadcn/ui components wherever possible.

When responding, always provide:
1. High-level layout description.
2. Component-by-component breakdown.
3. Interaction and motion notes.
4. Suggested shadcn/ui components.
5. Example JSX snippets when helpful.
6. Styling guidelines (spacing, color, typography).

Never introduce new layout paradigms. Always keep the three-panel structure. Prioritize clarity, simplicity, and modern aesthetics.

## System Architecture

### Technology Stack

- **Backend**: Go runtime for CLI, TUI, server, indexing, graph computation, and execution.
- **Frontend**: React with TypeScript, embedded as static assets in the binary.
- **Database**: SQLite for the derived index (`modernc.org/sqlite` driver).
- **UI Libraries**: `@xyflow/react` for canvas and graph interaction, `markdown-it` for rendering.
- **Server**: Loopback-only HTTP server for GUI, served on configurable ports per workspace.

### Package Layout

- `cmd/flow`: Main CLI entrypoint.
- `internal/workspace`: Workspace resolution and GUI server ownership.
- `internal/config`: Configuration parsing and validation.
- `internal/markdown`: Markdown parsing, serialization, and frontmatter handling.
- `internal/index`: Index rebuild, search, and graph projections.
- `internal/graph`: Layer computation and graph snapshots.
- `internal/execution`: Command execution and environment handling.
- `internal/httpapi`: Embedded asset serving and APIs.
- `internal/tui`: TUI implementation.

### Core Principles

- Markdown files are canonical; index is derived and rebuildable.
- UI state is transient; save flows write Markdown first, then refresh index.
- Local and global workspaces share schema but have separate GUI servers.

## Data Architecture

### Workspace Layout

- `.flow/config/flow.yaml`: Workspace configuration.
- `.flow/config/flow.index`: Rebuildable SQLite index.
- `.flow/config/gui-server.json`: GUI server state.
- `.flow/data/home.md`: Home document.
- `.flow/data/graphs/<graph-path>/*.md`: Graph documents.

### Document Types

- **Note**: Knowledge content with bidirectional relationships.
- **Task**: Dependency-driven work items.
- **Command**: Executable workflows.

### Frontmatter Conventions

Shared fields: `id`, `type`, `graph`, `title`, `description`, `tags`, `createdAt`, `updatedAt`.

Type-specific:
- Task: `status`, `dependsOn`, `references`.
- Command: `name`, `dependsOn`, `references`, `env`, `run`.
- Note: `references`.

### Link Semantics

- **Hard links**: Same-type dependencies (tasks/commands only).
- **Soft links**: Cross-type references (notes to tasks/commands, etc.).

### Graph Cardinality

- Local: 1 notes graph, 1 tasks graph, multiple command graphs.
- Global: Multiple graphs for all types.

## Component Architecture

### Key Responsibilities

- **Workspace**: Local vs global resolution, GUI server management.
- **Config**: YAML parsing, port configuration.
- **Markdown**: Parsing/serialization, canonical paths.
- **Index**: SQLite operations, search, projections.
- **Graph**: Layer computation, relationship views.
- **Execution**: Process spawning, environment overlay.
- **HTTP API**: Asset serving, read/query APIs (mutation deferred).
- **TUI**: Terminal UI built on shared backend logic.

### API Surface

Read/Query APIs:
- `GET /api/workspace`
- `GET /api/graphs/:type`
- `GET /api/layers/tasks`
- `GET /api/layers/commands`
- `GET /api/notes/graph`
- `GET /api/documents/:id`
- `GET /api/search`
- `POST /api/gui/stop`

Deferred Mutation APIs:
- `POST /api/documents`
- `PUT /api/documents/:id`
- `DELETE /api/documents/:id`

## Control Flow

### Initialization
`flow init` creates workspace files and rebuilds index from Markdown without modifying documents.

### Search
Queries index; auto-rebuilds if missing.

### Command Execution
Resolves command, checks dependencies, overlays environment, executes via shell.

### GUI Server
Starts on configured port per workspace; fails on port conflict; opens browser.

### Save Flow
Validates change, writes Markdown, refreshes index.

### Graph/Layer Views
Derived from index; support focused views with boundary markers.

### Note Canvas
Bidirectional relationship graph; not dependency-layered.

## Constraints

- Markdown canonical; index derived.
- File location authoritative for graph membership.
- Documents classified by frontmatter `type`.
- Hard links same-type only; soft links references only.
- Notes relationship-oriented; tasks/commands layered.
- GUI ports per workspace; startup fails on conflict.
- Release starts with `linux/amd64` binaries.

## Testing Strategy

- Unit tests for parsing, validation, computation.
- Integration tests for init, search, GUI server, APIs.
- CI focuses on Linux binary production initially.

## Risks and Tradeoffs

- Go rewrite simplifies delivery but discards TS work.
- SQLite derived data; acceptable for rebuildability.
- Browser GUI reduces packaging complexity vs embedded shell.
- Deferring rich editing reduces v1 risk.
- Separate workspaces increase flexibility but require targeting.

## Approved Feature Designs

### Feature: Theme Settings - Light/Dark/System Mode

#### Status

Approved

#### Summary

Add a settings option allowing users to select between light mode, dark mode, or system preference. Implement specific color tokens for consistent theming across the app. Theme changes apply immediately with smooth transitions.

#### Problem

Users need theme options for visual comfort. Current UI lacks theming, forcing a single appearance.

#### Goals

- Provide Light, Dark, System theme selection.
- Implement provided color tokens.
- Persist theme choice.
- Detect system preference.
- Smooth transitions.

#### Non-Goals

- Custom themes.
- High contrast mode.

#### User Experience

Settings icon in top-right header opens dropdown for theme selection. Changes apply immediately.

#### Architecture

Client-side theme management with CSS variables. Store in localStorage and config.

#### Data And Interfaces

New `ui.theme` field in config. CSS variables for colors.

#### Control Flow

Load theme on init, update on change, listen for system changes.

#### Edge Cases And Failure Modes

Fallback to light if system detection fails.

#### Testing Strategy

Unit and integration tests for theme switching.

#### Risks And Tradeoffs

Minimal risk; improves UX.

#### Open Questions

None.

### Feature: Modern Sleek UI Redesign

#### Status

Approved

#### Summary

Redesign Flow's UI to be more modern and sleek, inspired by Noteey, Affine, and Arky, while maintaining the three-panel layout and blending with Flow's graph-first functionality. Update component styling, spacing, typography, and visual hierarchy to create a cleaner, more breathable interface.

#### Problem

Flow's current UI is functional but lacks the modern, minimal aesthetic of contemporary productivity apps. The interface feels dated with heavy borders, dense layouts, and inconsistent spacing that doesn't match the design language specifications.

#### Goals

- Create a modern, minimal interface that feels calm and typographic-first
- Improve visual hierarchy with better spacing and typography
- Update component styling to be more consistent with shadcn/ui patterns
- Maintain the three-panel layout while making it feel more integrated
- Ensure the design works well with the planned theme system
- Keep all existing functionality while improving the user experience

#### Non-Goals

- Changing the three-panel layout structure
- Removing or significantly altering core functionality
- Implementing new features beyond UI improvements
- Breaking existing workflows or keyboard shortcuts

#### User Experience

Users will experience a cleaner, more breathable interface with:
- Generous white space and subtle separators
- Consistent typography hierarchy using Inter/Geist fonts
- Soft shadows and minimal borders
- Smooth transitions and hover states
- Better visual distinction between panels
- More intuitive navigation and context actions

The left panel becomes a sleek navigation rail with collapsible sections. The middle canvas feels more like a modern infinite workspace. The right panel transforms into a clean document editor with minimal chrome.

A settings icon appears in the top-right corner of the header, opening a dropdown menu that includes theme selection (Light, Dark, System) and other workspace actions. Theme changes apply immediately with smooth transitions.

#### Architecture

The redesign maintains the existing React component structure but updates:
- Global CSS variables for consistent theming
- Component styling to use design tokens
- Layout improvements for better space utilization
- Enhanced visual feedback for interactions
- Subtle animations for state transitions (hover, focus, panel changes) implemented with CSS transitions for performance

#### Data And Interfaces

No data model changes. UI state remains the same. The design leverages existing shadcn/ui components with updated styling.

#### Control Flow

No changes to runtime flows. The redesign is purely visual and interaction improvements.

#### Edge Cases And Failure Modes

- Theme switching should work seamlessly with the new design
- Responsive behavior maintained for different screen sizes
- Accessibility considerations preserved (focus states, keyboard navigation)
- Animation performance optimized to avoid impacting app responsiveness

#### Testing Strategy

- Visual regression testing for component styling
- User interaction testing for hover states and transitions
- Cross-browser compatibility testing
- Theme switching validation
- Performance testing to ensure animations don't impact frame rates

#### Risks And Tradeoffs

- Risk: Extensive CSS changes could introduce layout bugs
- Tradeoff: More generous spacing reduces information density but improves readability
- Alternative: Could implement incrementally per panel instead of all-at-once
- Performance consideration: Subtle animations prioritized over complex effects

#### Open Questions

- What icon should be used for the settings button?
- Should the settings dropdown include other options beyond theme selection?

### Feature: Modern UI Redesign: Home, Favorites, and Rich Center Pane

#### Status

Approved

#### Summary

Redesign the GUI to feature a modern, sleek interface inspired by tools like Obsidian and Logseq. The left navigation pane will be restructured to contain a Home link, a Favorites section, and a Content section with a tree view of graphs supporting a favorite toggle. The center pane will display `home.md` in a clean, full-width rich text editor when the Home link is active, pulling initial content from the markdown frontmatter.

#### Problem

The current UI lacks quick access to important high-level views (Home, Favorites) and defaults to graph-first displays everywhere, making it hard to author or view general overview content like a homepage. The layout needs a modern, sleek polish with better spacing and organization.

#### Goals

- Restructure the left pane into: Home link, Favorites section, and Content section (tree view of all graphs).
- Allow users to mark/unmark graphs as favorites from the Content tree view.
- Render `home.md` in a single rich-text editor in the center pane when Home is selected.
- Pre-populate and edit the `home.md` content and metadata via its frontmatter.
- Make the overall look and feel modern, sleek, minimal, and typography-focused using shadcn/ui.

#### Non-Goals

- Changing the canonical markdown storage format.
- Adding arbitrary file-system exploration (only graphs and `home.md` are exposed in this model).
- Collaborative editing or multi-user features.

#### User Experience

- **Left Panel**: A clean navigation rail. The top item is a static "Home" navigation button. Below is "Favorites", listing user-starred graphs. Below that is "Content", showing a nested tree of graphs. Hovering a graph node in the Content section displays a star icon to toggle its favorite status.
- **Center Panel**: If "Home" is selected, the infinite canvas is hidden. Instead, a centered, max-width rich-text editor takes over the middle pane. The title, description, and tags from `home.md`'s frontmatter populate the top of the editor seamlessly, feeling like a single document.
- **Visuals**: Generous padding, no heavy borders, soft hover states, bringing the sleek aesthetic into line with the design guidelines.

#### Architecture

- **State Management**: A new piece of frontend workspace state will track favorite graphs. Depending on requirements, this can be stored in the frontend's `localStorage` or added to the backend configuration.
- **UI Routing/Selection**: The top-level application state needs to distinguish between "Home selected" and "Graph selected". When Home is selected, it mounts a localized rich text editor component instead of the `GraphWorkspaceDesignSystem` or canvas.

#### Data And Interfaces

- A persistent list of favorite graph paths/IDs is required.
- `home.md` needs standard document API interactions (likely reusing existing `GET /api/documents/:id` and save flows).
- A rich text editor component (likely using `ProseKit` based on current dependencies, or similar) designed specifically for the document view mode.

#### Control Flow

1. User clicks the favorite star on a graph in the left pane tree.
2. The UI pushes the graph to the favorites list and updates local persistence.
3. The Left pane re-renders instantly, adding the graph to the Favorites section.
4. User clicks "Home".
5. The center pane unmounts the current graph canvas.
6. The `home.md` document is fetched via REST API.
7. The `HomeRichTextEditor` component mounts in the center pane, initializing with the document's frontmatter and body.

#### Edge Cases And Failure Modes

- `home.md` might not exist on first load. The API should return a default empty structure, or the backend should ensure `home.md` is created automatically during `flow init`.
- Navigating to a favorited graph that was externally deleted from the file system should be handled gracefully (e.g., prompting the user to remove it from favorites).

#### Testing Strategy

- Unit tests for the favorite toggle logic and state management.
- Integration tests ensuring `HomeRichTextEditor` successfully mounts and parses frontmatter when Home is selected.
- Visual regression testing for the new modernized Left and Center pane layouts.

#### Risks And Tradeoffs

- **Risk**: Replacing the infinite canvas with an editor for Home introduces a dual modal state into the center pane, increasing state complexity.
- **Tradeoff**: Managing favorites locally (`localStorage`) is faster to implement but doesn't sync across machines. Managing it in the backend config requires expanding the mutation API scope.

#### Open Questions

- Should favorites be persisted in the backend configuration (e.g., `.flow/config/gui-server.json`), or is frontend `localStorage` sufficient for this iteration?
- Should the `home.md` rich text editor auto-save on every keystroke, on blur, or rely on explicit manual save behavior?
