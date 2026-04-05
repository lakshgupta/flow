# Backlog

This document tracks planned feature work derived from approved architecture entries.

## FEAT-20241010-0002: Modern Sleek UI Redesign

- Status: Completed
- Source: Approved Feature Designs - Modern Sleek UI Redesign
- Summary: Redesign Flow's UI to be more modern and sleek, inspired by Noteey, Affine, and Arky, while maintaining the three-panel layout. Update component styling, spacing, typography, and visual hierarchy for a cleaner interface.

### Tasks

- [x] Update global CSS and component styles to implement generous spacing and breathable layouts
- [x] Redesign header area with settings icon in top-right corner and improved typography
- [x] Modernize left panel navigation rail with collapsible sections and cleaner tree styling
- [x] Enhance middle panel canvas with updated background, controls, and node styling
- [x] Redesign right panel document editor with minimal chrome and better content hierarchy
- [x] Implement subtle CSS transitions for hover states, focus, and panel interactions
- [x] Update all shadcn/ui component usage to follow new design tokens and spacing
- [x] Add settings dropdown component with theme selection and workspace actions
- [x] Optimize animations for performance to keep app lightweight and fast
- [x] Update component tests for new styling and interactions
- [x] Conduct visual regression testing across different screen sizes and themes

## FEAT-20241010-0001: Theme Settings - Light/Dark/System Mode

- Status: Completed
- Source: Approved Feature Designs - Theme Settings
- Summary: Implement theme settings UI in the top-right corner with immediate application, supporting light, dark, and system modes using the defined color tokens from design-language.md.
- Note: This functionality was implemented as part of FEAT-20241010-0002 (Modern Sleek UI Redesign).

### Tasks

- [x] Update global CSS to define color tokens as CSS custom properties for light and dark modes.
- [x] Implement theme context/provider for managing current theme state (light/dark/system) with OS detection for system mode.
- [x] Create theme settings dropdown component with light/dark/system options, positioned in top-right corner.
- [x] Add theme persistence using localStorage to remember user preference across sessions.
- [x] Integrate theme switching logic to update CSS variables and apply changes immediately without page reload.
- [x] Update existing components to use the new color tokens instead of hardcoded colors.
- [x] Add unit tests for theme switching logic and component rendering in different modes.
- [x] Add end-to-end tests to verify theme persistence and immediate application.
- [x] Update user documentation to describe theme settings functionality.

## FEAT-20260320-0001: Arky-Inspired Graph Workspace Enhancements

- Status: In Progress
- Source: Feature: Arky-Inspired Graph Workspace Enhancements
- Summary: Extend the graph workspace with PDF source ingestion, highlight-to-note capture, graph groups with convergence toward nested scopes, docs view, node-scoped focus mode, conceptual edges with derived labels, and a cleaner modern shadcn/ui-driven shell inspired by Arky's visual polish.

### Tasks

- [x] Add a shadcn/ui-based graph workspace design system for tabs, dialogs, sheets, breadcrumbs, menus, forms, and command surfaces with tokens and component usage that support a cleaner modern visual direction.
- [x] Refactor the GUI shell and graph-workspace chrome to use the approved shadcn/ui patterns and a cleaner modern Arky-inspired layout, spacing, hierarchy, and surface treatment.
- [ ] Add workspace-managed PDF source storage and metadata handling, grouped by graph path or named source collection.
- [ ] Add backend PDF import and highlight-to-note creation flows that always create notes first and store source snippets directly in note bodies.
- [ ] Implement title generation for highlight-created notes using excerpt text by default with source-plus-page fallback.
- [ ] Add graph-group persistence, nesting, and convergence bookkeeping in derived workspace state with a design compatible with future canonical nested scopes.
- [ ] Add graph workspace APIs that return groups, conceptual edges, derived edge labels, focus metadata, and graph/source collection information.
- [ ] Add docs-view projection for graph scopes with ordering driven by group structure first and deterministic fallback for ungrouped nodes.
- [ ] Add focus mode for any node with breadcrumb-based return to the parent graph scope.
- [ ] Add conceptual edge authoring plus separate derived edge-label state, and write eligible note-to-note conceptual edges back into canonical references.
- [ ] Add frontend PDF source browsing, highlight drag-to-note creation, graph group interactions, docs view switching, focus mode, and conceptual edge labeling.
- [ ] Add backend and frontend tests covering PDF import, highlight-to-note creation, docs-view ordering, focus mode, group persistence, conceptual edge writeback, and derived edge labels.
- [ ] Document the shipped graph workspace, PDF source workflow, grouping semantics, and canonical-versus-derived boundaries in user-facing docs after implementation.

## FEAT-20260329-0001: Modern UI Redesign: Home, Favorites, and Rich Center Pane

- Status: Completed
- Source: Feature: Modern UI Redesign: Home, Favorites, and Rich Center Pane
- Summary: Add Home link, Favorites collection, and graph tree view in the left sidebar, plus a full-width rich text editor for home.md in the middle panel when Home is selected.

### Tasks

- [x] Create a local persistence module (e.g. leveraging `localStorage`) on the frontend to manage starred/favorited graphs.
- [x] Refactor the left navigation panel (`AppSidebar`) to include static sections for "Home", "Favorites" (from local persistence), and "Content" (nested tree of all graphs).
- [x] Add a hover interaction in the left panel's "Content" tree to present a star icon, enabling the toggle of a graph's favorite status.
- [x] Update frontend routing/state to support distinguishing between "Home selected" and "Graph selected" modes.
- [x] Create the `HomeRichTextEditor` component that renders a full-width ProseKit-based rich text editor using shadcn/ui spacing and typography.
- [x] Wire the `HomeRichTextEditor` to fetch and parse the `home.md` file from the API, pre-populating both YAML frontmatter and markdown body content.
- [x] Render the `HomeRichTextEditor` in the center pane (replacing the infinite canvas) when the "Home" mode is selected.
- [x] Implement an explicit save or auto-save flow for `home.md` modifications from the `HomeRichTextEditor`.
- [x] Add unit tests for the favorite toggling logic and local persistence management.
- [x] Add integration tests verifying that selecting "Home" removes the canvas and renders the `home.md` document contents correctly via `HomeRichTextEditor`.
