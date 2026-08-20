---
id: development/20260820-005-FIX-sidebar-brand-constellation/fix-notes
type: note
graph: development/20260820-005-FIX-sidebar-brand-constellation
title: Root cause and validation for sidebar brand constellation
description: 'Wordmark bolded via text stroke (font has no bold weight); constellation SVG restored behind hero (commit: f23c1da)'
tags:
    - ui
    - frontend
links:
    - node: development/20260820-005-FIX-sidebar-brand-constellation/fix-sidebar-brand-constellation
      context: Fix task
      relationships:
        - maps-to
---

## Root Cause

1. **The wordmark was not actually bold.** The sidebar brand uses Major Mono
   Display, which ships only a single Regular weight — the font file is
   `MajorMonoDisplay-Regular.ttf` — so `font-weight: 800` on
   `.shell-sidebar-brand` had no visible effect. The wordmark rendered at the
   typeface's natural (thin, monospaced) weight.
2. **The constellation backdrop had been removed.** An earlier commit
   (38311bd) introduced a connected-graph-nodes SVG constellation behind the
   brand hero, then a later UI pass disabled it (`.shell-sidebar-brand-hero::before
   { display: none }`) and moved the pattern off the sidebar entirely. The
   brand hero is now transparent.

## Fix

- **Bold wordmark:** added `-webkit-text-stroke: 1.25px` (color-mixed indigo
  to match the gradient fill) to `.shell-sidebar-brand` and its dark-mode
  variant, and bumped the size to 2rem. The collapsed `F` pill gets the same
  stroke treatment. Faux-bold via stroke is the correct approach for a
  single-weight display font.
- **Constellation backdrop:** re-enabled `.shell-sidebar-brand-hero::before`
  with a pastel SVG data-URI (12 graph nodes in the chart palette connected by
  hairlines, plus star sparkles), softened by a top-left indigo radial glow and
  a bottom fade mask so it reads as texture behind the wordmark rather than a
  competing graphic. Dark mode gets a desaturated, dimmed variant
  (`opacity: 0.45`).

## Follow-up: full-width constellation

The first pass painted the constellation with `background-size: cover`, which
kept the 280px SVG's aspect ratio — on a sidebar narrower than 280px the
pattern was horizontally cropped instead of spanning the panel. Two fixes:

1. `.shell-sidebar-header` grid now uses `grid-template-columns: minmax(0, 1fr)`
   — the header is a `display: grid` container and its default auto-sized
   column collapsed the brand hero to the wordmark's own width (~138px), so the
   constellation only painted a fraction of the sidebar. The single full-width
   column makes the hero (and its `::before` layer) span the entire panel.
2. Replaced the 280×88 SVG with a **560×88 tile** painted at natural aspect
   (`background-size: auto 100%`, `no-repeat left top`). The 280px drawing
   letterboxed under `preserveAspectRatio` when stretched to a wide hero — at
   519px wide the content centered and the constellation drifted right of the
   logo. The 560px-wide tile (≥ the 520px max sidebar width) is anchored
   top-left, so it always fills edge-to-edge with no distortion or cropping,
   and widening the panel reveals more of the sky to the right while the logo
   stays over the constellation.
3. **Randomized node connections.** The first 560px tile connected nodes in a
   near-sequential chain (each node linked to its immediate neighbor), which
   read as an orderly polyline. Edge generation now uses a seeded PRNG: each
   node links to 1–2 random nearby neighbors (distance-weighted) plus a few
   long-range jumps (40–220px), so the graph reads as an organic constellation
   web. Generated deterministically (seed `20260820`) so the tile is stable
   across builds; 37 edges across 34 nodes, verified via an ASCII rendering of
   the decoded SVG.

Verified headless at 256px, 400px, and 520px panel widths: the hero matches
the sidebar width (255/399/519px), constellation pixels reach the right edge
in every case, and colored nodes sit behind the logo band (x 18–120) at all
widths. Full suite 238/238, `tsc --noEmit` clean.

## Validation

- Rebuilt frontend + binary; headless Chromium against the built app:
  - The `::before` layer resolves to the 280×88 SVG data-URI and the image
    decodes (naturalWidth 280, naturalHeight 88).
  - Light hero screenshot: ~11% of pixels are colored pastels; dark hero:
    ~9.6% — the constellation is visibly rendered in both themes.
  - Wordmark computed `font-size: 32px` with `-webkit-text-stroke: 1.25px`.
- Full frontend suite: **238/238 pass**; `tsc --noEmit` clean.
- DESIGN.md brand note updated to document the faux-bold + constellation
  treatment.
