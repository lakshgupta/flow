# FLOW — DESIGN LANGUAGE SPECIFICATION & COMPONENT LIBRARY SPEC

Flow is a modern, minimal, calm, typographic-first productivity app.  
All UI generated for Flow must follow this design language and use the component library rules below.

---

# 🎨 1. DESIGN LANGUAGE SPECIFICATION

## ✨ Visual Philosophy
- Clean, modern, minimal, calm.
- Typography-first with clear hierarchy.
- Generous spacing and breathable layouts.
- Neutral color palette with subtle accents.
- Soft shadows, subtle separators, minimal chrome.
- Functional clarity over decoration.
- Progressive disclosure: show controls only when needed.

---

## 🎨 Color System

### Theme Modes
Flow supports three theme modes: Light, Dark, and System (follows OS preference).

### Color Tokens

| Token | Light Mode | Dark Mode | Description |
|-------|------------|-----------|-------------|
| `--background` | `#ffffff` | `#0a0a0a` | Main background color |
| `--foreground` | `#0a0a0a` | `#ededed` | Primary text color |
| `--muted` | `#f5f5f5` | `#262626` | Muted background for secondary surfaces |
| `--muted-foreground` | `#a3a3a3` | `#a3a3a3` | Muted text color |
| `--popover` | `#ffffff` | `#0a0a0a` | Popover background |
| `--popover-foreground` | `#0a0a0a` | `#ededed` | Popover text |
| `--border` | `#e5e5e5` | `#262626` | Border color |
| `--input` | `#ffffff` | `#0a0a0a` | Input field background |
| `--card` | `#ffffff` | `#0a0a0a` | Card background |
| `--card-foreground` | `#0a0a0a` | `#ededed` | Card text |
| `--primary` | `#0a0a0a` | `#ededed` | Primary button background |
| `--primary-foreground` | `#ffffff` | `#0a0a0a` | Primary button text |
| `--secondary` | `#f5f5f5` | `#262626` | Secondary button background |
| `--secondary-foreground` | `#0a0a0a` | `#ededed` | Secondary button text |
| `--accent` | `#f5f5f5` | `#262626` | Accent color for highlights |
| `--accent-foreground` | `#0a0a0a` | `#ededed` | Accent text |
| `--destructive` | `#ef4444` | `#dc2626` | Error/destructive color |
| `--destructive-foreground` | `#ffffff` | `#ffffff` | Destructive text |
| `--ring` | `#d4d4d8` | `#d4d4d8` | Focus ring color |

### Usage Rules
- Accent is used sparingly: active states, selection, primary actions.
- Avoid saturated colors beyond the defined tokens.
- Avoid heavy gradients; subtle gradients only when meaningful.
- All colors are implemented as CSS custom properties for dynamic theming.

---

## 🖋 Typography

### Font
- Inter, Geist, or SF Pro.

### Hierarchy
- Titles: `font-semibold`
- Section labels: `font-medium`
- Body: `font-normal`
- Line height: generous (`leading-relaxed`)

### Rules
- No all caps.
- No tight letter spacing.
- Use weight shifts instead of color shifts for hierarchy.

---

## 📐 Spacing & Layout
- Prefer large spacing scale (`p-6`, `p-8`, `gap-6`).
- Panels should feel airy, not boxed.
- Avoid heavy borders; use:
  - `border-border/40`
  - `bg-muted`
  - `shadow-sm`

---

## 🧭 Motion
- Transitions: 150–200ms.
- Easing: `ease-out` or `ease-in-out`.
- Hover states: soft background tint.
- Panel transitions: subtle slide or fade.
- Avoid distracting or large animations.

---

# 🧩 2. COMPONENT LIBRARY SPEC (shadcn/ui)

Flow uses shadcn/ui components exclusively.  
All UI must reference these components and follow the styling rules below.

---

## Core Components
- `ScrollArea` — for any panel with overflow.
- `Separator` — soft dividers between sections.
- `Button` — primary, secondary, ghost actions.
- `DropdownMenu` — node actions, canvas actions.
- `Command` — global search / quick actions.
- `Dialog` — node creation, rename, delete.
- `Tooltip` — canvas tools, icons.
- `Card` — node previews, canvas elements.
- `Sheet` — mobile layout.
- `Popover` — inline formatting tools.
- `Tabs` — switching note modes (edit/preview).

---

## Component Styling Rules

### Buttons
- **Primary**: accent background, white text.
- **Secondary**: `bg-muted`.
- **Ghost**: transparent with subtle hover tint.
- Use rounded corners (`rounded-md` or `rounded-lg`).

### Cards
- Soft shadow (`shadow-sm`).
- Rounded corners (`rounded-lg`).
- Minimal borders.

### Inputs
- Minimal borders.
- Large padding.
- Clear focus ring.
- Avoid dense or compact input styles.

---

## Interaction Patterns
- Hover: subtle background tint.
- Selection: accent border or background.
- Dragging: soft shadow + slight scale (`scale-[1.01]`).
- Context menus: minimal chrome using `DropdownMenu`.
- Inline actions appear on hover (progressive disclosure).

---

# 🧭 3. PANEL-SPECIFIC UI GUIDELINES

Flow has a fixed three-panel layout.  
All UI must respect this structure.

---

## 📁 LEFT PANEL — TREE VIEW

### Purpose
Navigation + structure.

### Visual Style
- Narrow column with soft background tint.
- Minimal borders.
- Indented tree structure.
- Icons + labels with medium weight.

### Components
- `ScrollArea`
- Custom `Tree` component
- `DropdownMenu` for node actions
- `Separator` for grouping

### Layout
- Header with title + ghost “+” button.
- Optional search bar.
- Collapsible tree groups.
- Hover: `bg-muted`.
- Active: accent left border.

### Interaction
- Right-click → context menu.
- Drag to reorder.
- Hover reveals inline actions.

---

## 🧭 MIDDLE PANEL — INFINITE CANVAS

### Purpose
Primary workspace for visual thinking.

### Visual Style
- Neutral background.
- No visible borders.
- Floating toolbars.
- Minimal chrome.

### Components
- Custom canvas renderer.
- `Tooltip` for tools.
- `Popover` for formatting.
- `DropdownMenu` for canvas actions.

### Layout
- Canvas fills entire middle area.
- Floating toolbar (top-left or top-center).
- Zoom controls bottom-right.
- Node cards with soft shadows.

### Interaction
- Pan with spacebar + drag.
- Zoom with trackpad or controls.
- Nodes animate gently when selected.
- Right-click → context menu.

---

## 📝 RIGHT PANEL — NOTE CONTENT

### Purpose
Clean, modern document editor.

### Visual Style
- White or soft-gray background.
- Generous padding.
- Clear typographic hierarchy.
- Minimal toolbar.

### Components
- `ScrollArea`
- Custom editor (MDX or rich text)
- `Popover` for inline formatting
- `Tabs` for Edit / Preview

### Layout
- Title field at top.
- Minimal formatting toolbar.
- Body text with generous spacing.
- Subtle separators between sections.

### Interaction
- Inline formatting on text selection.
- Drag images or blocks.
- Smooth transitions between edit/preview.
