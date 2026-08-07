---
id: design/20260806-001-FEAT-ui-pastel-notion-lookfe/design-summary
type: note
graph: design/20260806-001-FEAT-ui-pastel-notion-lookfe
title: 'Design summary: pastel Notion-inspired UI refresh'
description: Approved 20260806; pastel palette, flat surfaces, tighter spacing
---

Proposal approved 20260806 by user ("approve").

Decisions:

- Palette: pastel light theme — warm off-white canvas, pastel indigo/lavender primary (~#7c8cf8), mint/blush/butter/sky pastel accents, hairline borders; keep dark theme, desaturated with tinted accents.
- Surfaces: flat, minimal shadows; crisp 1px borders; subtle tinted hover/active states (Notion/Evernote direction).
- Space: reduce app-shell outer padding (0.85rem -> 0.5rem), slimmer header (2.9rem -> 2.6rem), compact sidebar rows (~0.45rem vertical), remove card-in-card chrome; panels contiguous with hairline separators.
- Editor: keep ProseKit + Plus Jakarta Sans; reading measure comfortable; per-graph directory pastel tints preserved (graphDirectoryColors).
- Graph canvas: soft pastel node fills with tinted borders matching existing per-graph colors.
- No component structure, layout arrangement, data model, or backend changes. Purely presentational (styles.css tokens + class cleanup).
- Create docs/DESIGN.md as canonical visual-language source (referenced by AGENTS.md but missing); update docs/architecture.md UI refs.

Validation: npm test (vitest) green; visual regression baselines regenerated intentionally; manual check home/document/graph-canvas/search/calendar/settings/dark mode.

Open questions: none blocking. Brand wordmark (Major Mono Display) kept.
