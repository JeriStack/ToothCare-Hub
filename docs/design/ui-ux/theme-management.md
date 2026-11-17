# ToothCare Hub — Dark Mode & Theme Management Architecture

**Document Status:** Implemented & Active  
**Applies To:** ToothCare Hub Web Application (`frontend/`)  
**Default Theme:** Light Mode (`"light"`) — strict explicit opt-in Dark Mode (`"dark"`)

---

## 1. Overview & Policy

ToothCare Hub uses a centralized, class-driven Light/Dark theme system built on Tailwind CSS (`darkMode: 'class'`) and CSS custom properties defined in `frontend/src/styles/global.css`.

### Core Theme Guarantees

- **Strict Light Mode Default:** First-time visitors and users without a saved preference always start in Light Mode (`"light"`). Existing Light Mode visuals remain unchanged.
- **Explicit Two-State Selection Only:** Only `'light'` and `'dark'` are supported (`THEMES.LIGHT` and `THEMES.DARK`). There is **no System / Automatic mode**, and the application never auto-switches users based on OS `prefers-color-scheme`.
- **No-Flicker Pre-Paint Initialization:** An inline synchronous script in `frontend/index.html` reads `localStorage` under `'toothcare_theme'` before React mounts, setting the `dark` class, `data-theme`, `color-scheme` CSS property, and `<meta name="color-scheme">` atomically prior to first paint.
- **Cross-Tab Synchronization & Safe Storage Fallback:** `ThemeProvider` listens for `window` `storage` events on `'toothcare_theme'` and guards all `localStorage` reads/writes with `try/catch`, safely falling back to Light Mode in restricted storage environments.

---

## 2. Core Files & Architecture

| Module | Path | Responsibility |
|---|---|---|
| Theme Utilities | `frontend/src/utils/theme.js` | `THEME_STORAGE_KEY` (`'toothcare_theme'`), `THEMES`, `DEFAULT_THEME`, `normalizeTheme`, `readStoredTheme`, `persistTheme`, `applyThemeToDocument`, `initializeTheme` |
| React Context & Hook | `frontend/src/contexts/ThemeContext.jsx` | `ThemeProvider`, `useTheme()`, `useOptionalTheme()` managing live state and cross-tab sync |
| Toggle Control | `frontend/src/components/ui/ThemeToggle.jsx` | Accessible Sun/Moon button (`header` and `surface` variants, `aria-pressed`, `aria-label`, `data-testid="theme-toggle"`, reduced-motion safe) |
| Pre-Paint Bootstrap | `frontend/index.html` | `<meta name="color-scheme" content="light" />` and inline synchronous initialization script |
| Semantic CSS Tokens | `frontend/src/styles/global.css` | Centralized `:root` (Light) and `.dark` / `:root.dark` (Dark) CSS custom properties, scrollbars, `:focus-visible`, `forced-colors` support |
| Tailwind Mapping | `frontend/tailwind.config.js` | `darkMode: 'class'` and semantic color tokens (`canvas`, `surface`, `foreground`, `popover`, `sidebar`, `primary`, `accent`, `destructive`, `line`, `chart`) |
| App Shell Wiring | `frontend/src/app/App.jsx` | Wraps application in `ThemeProvider` and mounts `ThemeToggle` in public header/landing/auth & portal navigation |

---

## 3. Centralized Semantic Design Tokens

All color variables are declared in `frontend/src/styles/global.css` and exposed via `frontend/tailwind.config.js`.

| Semantic Token | Light Mode (`:root`) | Dark Mode (`.dark`) | Usage |
|---|---|---|---|
| `--bg-canvas` (`bg-canvas`) | `#F4F7FA` | `#111827` | Root page canvas |
| `--bg-card` (`bg-surface`) | `#FFFFFF` | `#1F2937` | Cards, panels, tables, modals |
| `--bg-elevated` (`bg-surface-elevated`) | `#FFFFFF` | `#263244` | Elevated overlays / hover containers |
| `--bg-muted` (`bg-surface-muted`) | `#F1F5F9` | `#1E293B` | Table headers, subtle wells, muted pills |
| `--bg-input` (`bg-surface-input`) | `#FFFFFF` | `#1F2937` | Form inputs, selects, textareas |
| `--bg-popover` (`bg-popover`) | `#FFFFFF` | `#1F2937` | Dropdown menus, popovers |
| `--bg-sidebar` (`bg-sidebar`) | `#FFFFFF` | `#1F2937` | Portal navigation sidebar |
| `--text-primary` (`text-foreground`) | `#102F49` | `#F9FAFB` | Primary headings and body ink |
| `--text-secondary` (`text-foreground-secondary`) | `#64748B` | `#9CA3AF` | Descriptions, metadata, table subtitles |
| `--color-primary` (`bg-primary`) | `#0D9488` | `#0D9488` | Primary brand actions |
| `--color-accent` (`text-accent`) | `#0D9488` | `#2DD4BF` | Highlights, focus accents, dark-surface teal ink |
| `--color-destructive` (`bg-destructive`) | `#DC2626` | `#EF4444` | Destructive actions and error states |
| `--border-default` (`border-line`) | `#E2E8F0` | `#374151` | Card dividers and borders |
| `--border-input` (`border-line-input`) | `#CBD5E1` | `#4B5563` | Form field borders |
| `--ring-focus` | `#0D9488` | `#2DD4BF` | Keyboard `:focus-visible` outlines |
| `--chart-1..5`, `--chart-grid` | Clinical Light ramp / `#E2E8F0` | Luminous Dark ramp / `#374151` | SVG charts, sparklines, odontogram bars |

### WCAG 2.2 AA Contrast & Clinical Safety Rules

1. **Primary CTA Contrast in Dark Mode:** Never place white text (`text-white`) on `#2DD4BF`. Solid primary action buttons use `bg-[#0D9488] dark:bg-[#0F766E] text-white`, reserving `#2DD4BF` (`dark:text-[#2DD4BF]` / `dark:text-teal-300`) for dark-surface text links and icons.
2. **Native Controls (`<select>`, `date`, `time`, `datetime-local`):** Root `color-scheme: light` / `color-scheme: dark` ensures browser popups and native pickers follow the active theme when controls carry dark backgrounds and text colors (`dark:bg-gray-700 dark:text-slate-100 dark:border-gray-600`).
3. **Dental Charts & Badges:** Clinical FDI odontogram surfaces (`FdiTeethSelector.jsx`), alert banners (`amber` / `rose`), and `StatusBadge` preserve semantic hue recognition with tuned dark-surface backgrounds (`dark:bg-*-900/40`, `dark:border-*-800`) and legible ink (`dark:text-*-300`).
4. **Reduced Motion & Forced Colors:** Theme background transitions and toggle animations honor `prefers-reduced-motion: reduce`, and `:focus-visible` adapts cleanly under `@media (forced-colors: active)`.

---

## 4. Developer Guidelines for New Components

1. Wrap every test that reads theme context directly in `<ThemeProvider>` (or use `ThemeToggle`, which also supports `useOptionalTheme()`).
2. Always pair explicit light surfaces and text classes with semantic tokens or matching `dark:` variants (`bg-white dark:bg-gray-800`, `text-[#12304A] dark:text-slate-50`, `border-slate-200 dark:border-gray-700`).
3. Avoid inline `style={{ backgroundColor: '#fff' }}` or hardcoded dark navy ink (`text-slate-900`) without a `dark:` pairing.
4. Keep focus rings visible on both light (`focus-visible:ring-[#0D9488]`) and dark (`dark:focus-visible:ring-[#2DD4BF]`) surfaces.

---

## 5. Verification & Test Coverage

- **Unit & Component Tests (Vitest + React Testing Library):**
  - `frontend/src/tests/theme/ThemeContext.test.jsx` — verifies strict `'light'` default, normalization of unknown/system values, OS `matchMedia` non-interference, toggling & persistence under `'toothcare_theme'`, throwing-storage safety, cross-tab `storage` events, `initializeTheme()`, and `useTheme()` guard.
  - `frontend/src/tests/theme/ThemeToggleAndPrimitives.test.jsx` — verifies `ThemeToggle` ARIA state (`aria-pressed`, `aria-label`, `data-theme-state`), header/surface/standalone variants, and dark-mode class coverage across `Button`, `Input`, `Modal`, `StatusBadge`, `EmptyState`, `Skeleton`, and `GlobalLoadingBar`.
- **CI Integration:** `.github/workflows/ci.yml` executes `npm test -- --run` and `npm run build` in `frontend/`.
