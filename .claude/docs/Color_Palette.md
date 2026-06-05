# tabNest Color Palette

This document is the single source of truth for all color decisions in tabNest. Every value below maps directly to a CSS custom property in `src/styles/tokens.css`.

---

## Brand Palette

The brand color is a medium blue — assertive but not aggressive, legible on both white and dark surfaces. Only four steps are defined; extend deliberately.

| Token | Hex | Usage |
|---|---|---|
| `--color-brand-100` | `#EBF0FF` | Hover tints on brand-colored interactive elements |
| `--color-brand-400` | `#3F83F8` | Lighter variant for icons, secondary actions |
| `--color-brand-500` | `#1A56DB` | Primary buttons, links, focus rings, accent fills |
| `--color-brand-600` | `#1340A8` | Pressed/active states on brand elements |

> `--color-info` and `--border-focus` both alias `--color-brand-500` — they share the same source value but are semantically distinct tokens, so use the semantic one.

---

## Backgrounds

Three surface levels create depth without shadows. The rule: lighter = closer to the user.

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--bg-base` | `#FFFFFF` | `#111827` | Page canvas, root background |
| `--bg-surface` | `#F9FAFB` | `#1F2937` | Cards, panels, sidebars |
| `--bg-elevated` | `#F3F4F6` | `#374151` | Hover states, collapsed headers, inline chips |
| `--bg-overlay` | `rgba(0,0,0,0.45)` | `rgba(0,0,0,0.65)` | Modal backdrop |

---

## Text

Four roles. Use only these — never reach for a background value to style text.

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--text-primary` | `#111827` | `#F9FAFB` | Body copy, headings, interactive labels |
| `--text-secondary` | `#6B7280` | `#9CA3AF` | Supporting info, metadata, timestamps |
| `--text-muted` | `#9CA3AF` | `#6B7280` | Placeholder text, disabled states, hints |
| `--text-inverse` | `#FFFFFF` | `#111827` | Text on filled brand/colored backgrounds |

---

## Borders

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--border-default` | `#E5E7EB` | `#374151` | General dividers, input outlines, card edges |
| `--border-strong` | `#D1D5DB` | `#4B5563` | Emphasized separators, scrollbar thumb |
| `--border-focus` | *(aliases brand-500)* | *(aliases brand-500)* | Keyboard focus ring — always brand blue |

---

## Semantic Colors

One value per intent. These do not change between light and dark because the hue itself carries meaning.

| Token | Hex | Usage |
|---|---|---|
| `--color-success` | `#059669` | Sync confirmed, save complete, positive states |
| `--color-warning` | `#D97706` | Duplicate tab badge, non-blocking caution |
| `--color-danger` | `#DC2626` | Destructive actions (delete, discard), error states |
| `--color-info` | *(aliases brand-500)* | Informational callouts |

---

## Shadows

Shadows use black at low opacity rather than colored values — they work on any surface color.

| Token | Value | Usage |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift on chips or small cards (0.30 in dark) |
| `--shadow-md` | `0 4px 8px rgba(0,0,0,0.08)` | Dropdowns, floating buttons (0.40 in dark) |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.12)` | Modals, overlaid panels (0.50 in dark) |

> `--shadow-xl` (`0 20px 60px rgba(0,0,0,0.25)`) appears as an inline default in Modal and Settings but is not yet a declared token. Promote it to `tokens.css` when the pattern solidifies.

---

## Category Colors (User-assigned)

Categories can be assigned any arbitrary hex string. The default seeded category uses `#6366f1` (Indigo-500 from Tailwind). There is no enforced palette for user content — the color picker in Settings is freeform. Consider restricting to a curated set in a future iteration for visual coherence.

The workspace `accent_color` field defaults to `#1A56DB` (brand-500).

---

## Gaps & Inconsistencies

These are known divergences from the token system that should be resolved:

| Location | Issue |
|---|---|
| `src/components/ErrorBoundary.tsx` | Uses raw hex values (`#374151`, `#6b7280`, etc.) — not tokenized |
| `src/components/GroupCard/GroupCard.tsx:475` | References `--color-brand-200` which is not defined in `tokens.css` |
| `src/components/Settings/SettingsModal.tsx` | References `--color-error` and `--shadow-xl` which are not declared tokens |
| `src/components/Modal/Modal.tsx` | Same `--shadow-xl` fallback |
| `src/components/Onboarding/OnboardingOverlay.tsx` | Same `--shadow-xl` fallback |

---

## Usage Rules

1. **Never use raw hex** in component files. Always reference a token via `var(--token-name)`.
2. **Choose the semantic token over the primitive.** Use `--color-info` not `--color-brand-500` for informational UI; use `--border-focus` not `--color-brand-500` for focus rings.
3. **Light/dark is handled by `tokens.css`.** Do not write `@media (prefers-color-scheme)` or `[data-theme]` blocks in component stylesheets — put overrides in `tokens.css` only.
4. **Compact mode only overrides spacing.** Color tokens are never overridden in `[data-compact]`.
5. **User content colors (category, accent) are data, not design system values.** Render them inline; don't create tokens for them.
