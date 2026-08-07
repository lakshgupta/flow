# Design — Visual Language & Styling Guide

This document is the canonical source of truth for Flow's UI look and feel: palette, typography, spacing, surfaces, and component styling rules. Keep it in sync when the visual language changes. Design decisions are recorded in the Flow design graph (see [design/20260806-001-FEAT-ui-pastel-notion-lookfe](../.flow/data/content/design/20260806-001-FEAT-ui-pastel-notion-lookfe/)).

## Design Direction

Flow is a note-taking and planning app. The UI follows a **sleek, modern, pastel** aesthetic inspired by Notion and Evernote:

- **Flat, quiet surfaces** — hairline borders over heavy shadows. Depth is expressed with tinted fills and layering, not drop shadows.
- **Pastel palette** — soft, low-saturation colors; the primary color is a pastel indigo/lavender rather than a saturated one.
- **No wasted space** — compact frames, slim headers, tight sidebar rows, contiguous panels. Every pixel either shows content or separates it.
- **Focus on the writing surface** — the document editor is the hero; chrome is secondary.

## Palette

All color tokens are defined as CSS custom properties in `frontend/src/styles.css` (`:root` for light, `.dark` for dark). Components must use the semantic tokens (`--background`, `--card`, `--primary`, `--muted`, ...), never raw hex values, so theme switching keeps working.

### Light theme

| Token | Value | Use |
|---|---|---|
| `--background` | warm off-white (e.g. `#faf9f7` family) | app canvas behind panels |
| `--card` / `--popover` | white (`#ffffff`) | cards, popovers, dialogs |
| `--primary` | pastel indigo ~`#7c8cf8` | primary buttons, active states, focus rings, graph edges |
| `--primary-hover` | slightly deeper lavender | primary hover |
| `--accent` | pastel tint (mint/lavender family) | selected/hover fills |
| `--secondary` / `--muted` | soft neutral (`#f4f4f5` family) | secondary surfaces |
| `--muted-foreground` | soft gray (`#71717a` family) | secondary text, icons, placeholders |
| `--border` | hairline rgba black (~8%) | separators, card borders |
| `--success` / `--warn` / `--destructive` | pastel-tinted greens/ambers/reds | status colors with matching soft backgrounds |

Pastel accent family (used for graph directory colors, badges, charts):

- Mint `#d7f2e6` / `#7fd1b9`
- Sky `#dbeafe` / `#7ab8f5`
- Lavender `#e4e0f7` / `#8b7cf8`
- Blush `#fde2e8` / `#f291b2`
- Butter `#fdf0d5` / `#f2c14e`

### Dark theme

Same structure under `.dark`, desaturated: near-black surfaces (`#141417` family), pastel accents used sparingly for emphasis (tinted borders, subtle fills), text `#fafafa`. Contrast on dark surfaces must remain readable — verify pastel accents against `#141417`.

## Typography

- **UI + body font:** Plus Jakarta Sans (loaded via Google Fonts in `frontend/index.html`). It is the app-wide font.
- **Monospace:** IBM Plex Mono for code blocks and editor code.
- **Brand wordmark:** Major Mono Display, used only for the "Flow" sidebar brand block.
- Type scale and weights follow the existing conventions in `frontend/src/styles.css`; keep body text at a comfortable reading size with relaxed line-height in the editor.

## Spacing & Layout

- **App frame:** `.app-shell` outer padding is `0.5rem` (was `0.85rem`). Panels sit contiguous, separated by hairline borders, not floating cards.
- **Header:** `.workspace-shell-header` min-height `2.6rem` (was `2.9rem`); flat, border-bottom only, ghost icon buttons.
- **Sidebar rows:** `.ui-sidebar-menu-button` vertical padding ~`0.45rem`; active row = pastel-tinted fill + subtle left accent; flat (no shadow).
- **Cards:** borders yes, shadows minimal. Remove nested card-within-card chrome (e.g. `.shell-rail-card` inside `.ds-card`) — one border per surface.
- **Radius:** keep the existing token scale (`--radius`, `--radius-sm/md/lg`, `--radius-pill`). Pills are fine for buttons and chips.
- **Editor:** `center-document` measure comfortable for reading; per-graph pastel tint (`graphDirectoryColors`) applies to documents and graph canvas nodes.

## Component Rules

- Buttons: primary = pastel indigo fill, white text; secondary/ghost = transparent with border or soft neutral fill. Use pills (radius pill) as today.
- Badges/chips: pastel-tinted backgrounds with matching foreground (e.g. `--badge-bg`/`--badge-fg` pattern).
- Focus states: 2px `--ring` outline (pastel indigo), `outline-offset: 2px`.
- Graph canvas nodes: soft pastel fills with tinted borders matching the node's graph directory color; edges colored but dimmed (`--graph-edge-dim`).
- Menus/popovers: white (`--popover`) with hairline border and minimal shadow; keep the existing `fadeIn` animation.
- Overlays/modals: keep the existing backdrop blur; contents on `--popover` background.

## Dark Mode

Toggle via the theme system (`lib/theme.tsx`, `.dark` class on `<html>`). Every component must define a dark equivalent through the token system — never hardcode light-only colors in components.

## Change Management

- Token changes belong in `frontend/src/styles.css` `:root`/`.dark` blocks.
- Class-level style changes must keep component structure intact (no markup changes just for styling).
- After any visual change, run `cd frontend && npm test` and regenerate visual regression baselines (`npm run test:visual`), confirming the diffs are the intended restyle.
- Update this document and the Flow design graph when the visual language changes.

## Related Documents

- [docs/architecture.md](architecture.md) — backend model and UI component arrangement.
- [docs/reference.md](reference.md) — workspace layout and CLI reference.
