# Design — Cortea

A locked design system for this app. Every page redesign reads this file before
emitting code. Do not regenerate per page — extend or amend this file when the
system needs to grow.

## Genre
modern-minimal

## Macrostructure family
- Marketing pages: Marquee Hero (when added later)
- App pages: Workbench — instrument panel, functional chrome, dense mono for facts
- Content pages: Long Document (reports / exports)

## Theme
Custom OKLCH anchored on evidence-emerald (citation / verified signal).

- `--color-paper`   oklch(0.99 0.002 155)
- `--color-paper-2` oklch(0.965 0.005 155)
- `--color-ink`     oklch(0.18 0.012 155)
- `--color-ink-2`   oklch(0.48 0.012 155)
- `--color-rule`    oklch(0.90 0.006 155)
- `--color-accent`  oklch(0.62 0.15 155)
- `--color-focus`   oklch(0.55 0.14 155)
- `--color-danger`  oklch(0.55 0.2 25)
- `--color-warn`    oklch(0.72 0.14 75)
- `--color-clear`   oklch(0.62 0.15 155)

Dark paper band uses the same hue anchors at lower L.

## Typography
- Display: Inter, weight 600, style normal (shadcn preset b27GcrRo)
- Body:    Inter, weight 400
- Mono:    system ui-monospace (preset does not specify a mono face)
- Display tracking: default
- Type scale anchor: instrument labels at 0.6875rem mono uppercase; body 0.875rem

## Spacing
4-point named scale in `tokens.css`. Pages must use named tokens, never raw values.

## Motion
- Easings: `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)`
- Reveal pattern: none on app surfaces; opacity ≤ 150 ms for state changes only
- Reduced-motion fallback: opacity-only, ≤ 150 ms

## Microinteractions stance
- silent success / celebratory toasts: never
- hover delay 800 ms · focus delay 0 ms
- selection uses left accent bar + paper-2 fill, not glow

## CTA voice
- Primary CTA: filled ink, 6 px radius, mono label where forensic action
- Secondary CTA: outline on rule, same radius, mono for audit actions

## Per-page allowances
- Marketing pages MAY use enrichment (Tier-A CSS art, Tier-B SVG, etc.).
- App pages MUST NOT use enrichment — function carries the page.
- Content pages: typography only.

## What pages MUST share
- The Cortea wordmark / logotype.
- The accent colour and its placement (≤ 5 % per viewport — citations, verified, focus).
- The display + body + mono fonts.
- The CTA voice (button shape, border-radius, padding rhythm).
- Instrument chrome: hairline rules, mono meters, no gradient washes.

## What pages MAY differ on
- Macrostructure within the page-type family.
- Pane density (list vs graph vs chat).
- Enrichment — only on marketing pages, only Tier-A or Tier-B.

## Workbench chrome (app)
- Top: dossier switcher + verdict meters + export
- Side rail: Report / Graph / Documents / Ask (icon + short label)
- Main: active tool surface
- Evidence: right sheet, accent title mark

## Exports

### tokens.css
See `packages/ui/src/styles/tokens.css`.

### shadcn/ui CSS variables
Mapped in `packages/ui/src/styles/globals.css` from Hallmark tokens.
