# Flow Design System

## Purpose

This document defines the visual and interaction language for Flow.
It is the source of truth for UI tone, styling, and behavior.

Goals:

- Keep the interface calm, clear, and content-first.
- Prioritize readability and hierarchy over decoration.
- Ensure consistency across the CLI-driven GUI surfaces.
- Keep implementation practical for React + CSS variable theming.

---

## 1. Visual Principles

- Minimal and spacious: favor whitespace and clear grouping.
- Typography-led: hierarchy should come from size, weight, and rhythm first.
- Neutral-first palette: color should support meaning, not dominate.
- Soft structure: subtle borders and restrained shadows.
- Progressive disclosure: reveal advanced controls when context requires them.

---

## 2. Color System

### Theme Modes

- Light
- Dark
- System (follows OS preference)

### Core Tokens

Use CSS custom properties for all theme values.

| Token | Light | Dark | Purpose |
|------|------|------|------|
| `--background` | `#ffffff` | `#0a0a0a` | App canvas |
| `--foreground` | `#0a0a0a` | `#ededed` | Primary text |
| `--muted` | `#f5f5f5` | `#262626` | Secondary surfaces |
| `--muted-foreground` | `#737373` | `#a3a3a3` | Secondary text |
| `--border` | `rgba(0,0,0,0.1)` | `rgba(255,255,255,0.16)` | Dividers and outlines |
| `--primary` | `#0b6fd6` | `#4da3ff` | Primary actions |
| `--primary-foreground` | `#ffffff` | `#0a0a0a` | Text on primary |
| `--accent` | `#eef5ff` | `#1f2f45` | Selection/highlight surfaces |
| `--accent-foreground` | `#0a0a0a` | `#e6f0ff` | Text on accent surfaces |
| `--destructive` | `#dc2626` | `#ef4444` | Destructive actions |
| `--ring` | `#60a5fa` | `#60a5fa` | Focus ring |

### Usage Rules

- Use `--primary` for primary actions only.
- Keep neutral tones dominant in high-density screens.
- Avoid large decorative gradients in core workflows.
- Keep success/warning/error colors semantic and restrained.

---

## 3. Typography

### Font Stack

Primary stack:

`Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif`

### Type Scale

| Role | Size | Weight | Line Height | Notes |
|------|------|------|------|------|
| Display | 48-64px | 700 | 1.00-1.10 | Landing and major headings |
| Section H1 | 32-40px | 700 | 1.10-1.20 | Major page sections |
| Section H2 | 24-28px | 600-700 | 1.20-1.30 | Subsections |
| Title | 20-22px | 600-700 | 1.25-1.35 | Card/panel titles |
| Body | 16px | 400 | 1.50 | Default reading text |
| Body Emphasis | 16px | 500-600 | 1.50 | Labels and active text |
| Caption | 12-14px | 400-500 | 1.35-1.45 | Metadata and helper text |

### Typography Rules

- Avoid all-caps in normal UI labels.
- Prefer weight changes over color-only emphasis.
- Keep long-form text around 65-80 characters per line where possible.

---

## 4. Spacing, Radius, and Depth

### Spacing Scale

Base spacing unit: `8px`

Recommended scale: `4, 8, 12, 16, 24, 32, 48, 64`

### Radius Scale

- `4px`: inputs, compact controls
- `8px`: standard controls and compact cards
- `12px`: default cards and panels
- `16px`: featured containers
- `9999px`: badges/chips

### Shadow Scale

- `--shadow-soft`: subtle card elevation
- `--shadow-deep`: overlays and floating panels

Use low-opacity, layered shadows. Avoid heavy drop shadows.

---

## 5. Component Styling

### Buttons

Variants:

- Primary: `--primary` background, strong contrast text
- Secondary: muted background, standard text
- Ghost: transparent, subtle hover tint
- Destructive: semantic destructive color

Behavior:

- Hover: subtle luminance shift
- Active: small pressed feedback
- Focus: visible ring using `--ring`

### Inputs

- Clear border and focus ring
- Comfortable padding
- High-contrast placeholder and value text
- No overly dense field heights

### Cards and Panels

- Soft border + subtle radius
- Light elevation where needed
- Clear title/body/action regions

### Badges and Chips

- Pill shape
- Small text, medium weight
- Use semantic color only when meaning requires it

---

## 6. Layout Patterns

### Three-Pane Workspace Model

Flow UI is centered on three cooperating regions:

- Left: navigation tree and graph hierarchy
- Center: main canvas or document workspace
- Right: properties/details/editor support

### Layout Guidelines

- Preserve readable line lengths in document panels.
- Keep navigation widths stable and user-adjustable.
- Prioritize content area on smaller viewports.
- Use separators and spacing, not heavy chrome.

---

## 7. Interaction and Motion

### Motion Principles

- Subtle and purposeful
- 150-200ms duration for common transitions
- `ease-out` or `ease-in-out` timing

### Interaction Patterns

- Hover reveals contextual controls where appropriate.
- Selection states are always visible and unambiguous.
- Drag interactions should include gentle visual feedback.
- Keyboard focus must be visible in every interactive surface.

---

## 8. Accessibility

- Ensure keyboard access for all controls.
- Maintain visible focus indicators.
- Preserve sufficient color contrast in all themes.
- Do not rely on color alone for state meaning.
- Respect reduced-motion preferences where applicable.

---

## 9. Responsive Behavior

Suggested breakpoints:

- Small mobile: `< 400px`
- Mobile: `400-640px`
- Tablet: `640-1024px`
- Desktop: `1024-1440px`
- Large desktop: `> 1440px`

Behavior:

- Collapse dense multi-column layouts into stacked flows on narrow screens.
- Keep touch targets comfortable.
- Prefer vertical rhythm over horizontal compression.

---

## 10. Implementation Guidance

- Use tokens from this document as CSS variables.
- Keep component variants explicit and limited.
- Avoid one-off inline styles that bypass the system.
- Add new tokens only when reuse is clear.

---

## 11. Status

This design system is active and should be treated as authoritative for UI contributions.
