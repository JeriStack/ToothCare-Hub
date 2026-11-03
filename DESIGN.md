---
name: ToothCare Hub
description: Healthier Smiles. Brighter Futures.
colors:
  navy: "#12304A"
  navy-deep: "#0B1D2D"
  teal: "#0D9488"
  teal-deep: "#0F766E"
  teal-soft: "#CCFBF1"
  canvas: "#F5F8FA"
  body-slate: "#334155"
typography:
  headline:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.33
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.5
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  body-compact:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.5
  button:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  2xs: "2px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "12px"
  2xl: "16px"
  3xl: "24px"
  4xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.teal}"
    textColor: "#FFFFFF"
    typography: "{typography.button}"
    rounded: "{rounded.md}"
    padding: "10px 24px"
  button-primary-hover:
    backgroundColor: "{colors.teal-deep}"
  button-secondary:
    backgroundColor: "#FFFFFF"
    textColor: "#475569"
    typography: "{typography.body-compact}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
  card-default:
    backgroundColor: "#FFFFFF"
    rounded: "{rounded.xl}"
    padding: "24px"
  navigation-active:
    backgroundColor: "{colors.teal-soft}"
    textColor: "{colors.teal-deep}"
    typography: "{typography.body-compact}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
---

## Overview

**Creative North Star: "Calm Clinical Precision"**

ToothCare Hub should feel like a capable clinic team: calm, clear, and dependable. Its existing deep-navy structure, restrained teal actions, cool light canvas, and Inter typography already establish a coherent healthcare identity. Preserve and formalize that visual language rather than replacing it with a new brand.

The interface is an operational tool, not a medical-marketing campaign. Make the next action and the appointment facts easy to find. Patient booking should communicate progress and selection clearly; admin and dentist views should prioritize the work each role needs to scan. Reuse shared patterns without flattening those different priorities.

This design record describes the existing React/Vite/Tailwind JSX prototype and the approved direction for future frontend work. TypeScript and shadcn/ui are goals in the project brief, not libraries currently evidenced in the frontend package or source.

**Key Characteristics:**
- Deep navy provides stable structure; teal marks action and selection.
- Cool, light surfaces keep forms and schedules legible.
- Inter and compact, consistent type hierarchy support frequent scanning.
- Shared patterns adapt to patient, admin, and dentist tasks.
- Accessibility and responsive behavior are design requirements, not a claim of conformance.

## Colors

The palette is a cool clinical neutral base with navy structure and a focused teal action color.

### Primary
- **Clinic Teal** (`#0D9488`): Primary actions, progress, and selected controls. Use intentionally rather than as decoration.
- **Deep Teal** (`#0F766E`): Darker action and selected-state text; use for hover treatment on primary actions.

### Secondary
- **Clinical Navy** (`#12304A`): Main application header and prominent headings.
- **Night Navy** (`#0B1D2D`): Dark utility and role-switcher surfaces.

### Neutral
- **Cool Canvas** (`#F5F8FA`): Page background.
- **Soft Teal** (`#CCFBF1`): Active navigation and selection background.
- **Slate Body** (`#334155`): Default body text.
- White surfaces and Tailwind slate borders separate cards and controls from the canvas.

### Named Rules
**The Navy-for-Structure Rule.** Keep navy on navigation, headers, and high-priority headings; do not make every card or action a navy block.

**The Teal-for-Action Rule.** Reserve the strongest teal treatment for primary actions, progress, and selected states. Do not use the action color as a substitute for status meaning.

## Typography

**Display Font:** Inter (with the system sans-serif fallbacks in the frontend stylesheet)

**Body Font:** Inter (with system sans-serif fallbacks)

**Label/Mono Font:** No separate label or monospace family is established.

**Character:** Neutral, compact, and highly legible. Use weight and size to make hierarchy clear; do not introduce a decorative display face.

### Hierarchy
- **Headline** (700, `1.5rem`, `1.33`): Page-level headings and prominent dashboard summaries.
- **Title** (700, `1.125rem`, `1.5`): Card and section headings.
- **Body** (400, `1rem`, `1.5`): Global browser body size and longer reading content.
- **Compact body** (400, `0.875rem`, `1.5`): Dense dashboard and form copy; allow larger body text when reading comfort requires it.
- **Label** (600, `0.75rem`, `1.5`): Field labels, compact metadata, and table context; never rely on tiny text for essential instructions.
- **Button** (600, `0.875rem`, `1.25`): Action labels with clear, concise wording.

## Layout

Use a centered application frame up to the existing `max-w-7xl` width, with `16px` page gutters growing to `24px` at the `sm` breakpoint. The current desktop shell places a `240px` navigation rail beside the main work area; below `lg`, navigation becomes a toggleable mobile menu. Keep the content order and primary action clear when the layout stacks.

The booking flow is a focused, narrower task surface (`max-w-3xl`) with visible progress, readable service and dentist choices, and a clear review/confirmation state. Preserve its established business sequence while improving scanability and touch-friendly selection.

Use Tailwind's existing spacing scale, based on `4px` with its available half-steps, increasing whitespace around page and section headings rather than adding arbitrary one-off gaps. On narrow screens, prioritize appointment facts and actions; avoid forcing wide tables into clipped view.

## Elevation & Depth

Depth is restrained and secondary to borders and tonal separation. Cards use a light border and subtle shadow; the sticky header and dialogs may use stronger elevation to distinguish persistent navigation and modal focus. Keep the resting interface calm and avoid stacking multiple shadow layers.

### Shadow Vocabulary
- **Surface** (`shadow-sm`): Default cards and small contained surfaces.
- **Header** (`shadow-md`): Sticky application header.
- **Dialog** (`shadow-xl` / `shadow-2xl`): Modal emphasis above a scrim.

## Shapes

Use soft, consistent corners: `8px` for controls and navigation items, `12px` for common cards, and up to `16px` for focused task containers. Reserve fully rounded shapes for avatars and compact status chips. Light slate borders define edges; avoid ornamental clipping or excessive pill-shaped containers.

## Components

### Buttons
- **Shape:** `8px` corners.
- **Primary:** Teal fill, white text, `10px 24px` padding, and semibold Inter. Darken to deep teal on hover.
- **Secondary:** White or transparent surface with a slate border and slate text.
- **Hover / Focus:** Keep hover treatment restrained. Provide a visible keyboard focus indicator consistent with the global teal focus ring.

### Chips
- **Style:** Compact text labels with a quiet neutral or soft-teal surface.
- **State:** Selected filters may use teal; appointment status colors must be semantic and paired with readable text, never color alone.

### Cards / Containers
- **Corner Style:** `12px` for standard cards; `16px` for focused booking containers.
- **Background:** White against the cool canvas.
- **Shadow Strategy:** Light shadow at rest, with borders carrying most of the separation.
- **Border:** Thin slate border.
- **Internal Padding:** Start at `24px`; increase to `32px` on wider task surfaces when the content benefits from breathing room.

### Inputs / Fields
- **Style:** White fill, slate border, `8px` corners, and comfortable horizontal padding.
- **Focus:** Clearly visible teal border/focus ring with adequate contrast.
- **Error / Disabled:** Pair color with explicit text or state cues; retain readable labels and do not communicate validation by color alone.

### Navigation
- **Style:** Navy application header; white rail surface with slate text.
- **Active:** Soft-teal background and deep-teal text.
- **Mobile:** Collapsible navigation below the `lg` breakpoint, with a clear accessible toggle and preserved page context.

### Appointment Booking
The current prototype uses a visible stepper and selectable service, dentist, date, and slot options. Keep progress, selected state, duration/price context, review, and final confirmation easy to distinguish without changing the product's booking rules.

## Do's and Don'ts

### Do:
- **Do** use the existing navy, teal, cool-canvas, and Inter identity as the baseline for new frontend screens.
- **Do** reserve teal for primary actions, progress, and selected states.
- **Do** give each role's dashboard a task-specific information hierarchy while sharing component behavior.
- **Do** use semantic HTML, labels, keyboard access, visible focus, readable contrast, and responsive layouts.
- **Do** pair status color with text and keep sensitive health details out of decorative or unnecessary UI surfaces.

### Don't:
- **Don't** replace the established palette or typography without an explicit redesign decision.
- **Don't** imply WCAG conformance until the rendered interface has been tested.
- **Don't** present TypeScript or shadcn/ui as already installed or implemented.
- **Don't** use color alone for appointment status or form errors.
- **Don't** change backend behavior, database structure, API contracts, or appointment workflows as part of a visual-system task.
