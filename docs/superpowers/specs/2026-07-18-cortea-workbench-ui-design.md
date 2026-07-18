# Cortea Workbench UI/UX Redesign

**Date:** 2026-07-18  
**Status:** Implemented  
**Approach:** Instrument polish + shadcn component swaps + shell restructure (1+2+3)  
**Depth:** Even across Report, Graph, Documents, Ask  
**Design system:** Locked `design.md` (modern-minimal · Workbench · evidence-emerald · radix-rhea)

---

## 1. Goals

Improve the Cortea forensic audit web app UI/UX by:

1. Restructuring app chrome with shadcn Sidebar + Resizable panes
2. Replacing ad-hoc controls (native `<select>`, custom boxes) with shadcn primitives
3. Polishing hierarchy, empty/error/loading states, and keyboard affordances evenly across all four tool surfaces

Home remains a redirect to `/audit`. No marketing page. No engine/API/data-model changes.

---

## 2. Constraints

- Honor locked `design.md`: Workbench chrome, evidence-emerald accent (≤5% viewport), Inter, mono instrument labels, no enrichment on app pages
- Selection: left accent bar + paper-2/muted fill — no glow
- Motion: opacity ≤150ms for state changes; respect `prefers-reduced-motion`
- Preserve review keyboard shortcuts (`j`/`k`, `c`/`x`/`i`) and export behavior
- No invented metrics or copy
- Mobile: no horizontal scroll; Sidebar collapses; Report keeps list → detail + Back
- In-place edits; do not delete route trees or production files without explicit confirmation

---

## 3. Shell & chrome

### 3.1 Sidebar navigation

Replace the narrow vertical `Tabs` rail with shadcn **Sidebar**:

| Item | Job |
|------|-----|
| Report | Findings review console |
| Graph | Risk / money graph |
| Documents | Source artifact browser |
| Ask | Citation-backed chat |

- Desktop: collapsible (icon-only ↔ icon + short label)
- Mobile: Sheet/drawer trigger from header or sidebar collapse control
- Active state: left accent bar (`border-l-cortea` / design tokens) + muted fill
- Materiality **Slider** remains in sidebar footer when Report is active (desktop); Tooltip on label

Tab content switching may still use Tabs primitives internally, or Sidebar + local state — implementation chooses the cleaner wiring. Jobs and routes stay the same (`/audit`).

### 3.2 Header

| Zone | Content |
|------|---------|
| Brand | Cortea wordmark + “Forensic workbench” mono label |
| Dossier | **Select** and/or **Command** (⌘K) dossier switcher |
| Status | Integrity **Badge** + **Tooltip**; C/U/A meters with **Separator** |
| Actions | Export **Button**; theme **ModeToggle** |

Integrity banner → shadcn **Alert** (destructive when checks failed; warning when warnings only).

### 3.3 Evidence

Keep right **Sheet** (not a permanent third pane) so Graph/Ask retain width. Accent title mark + mono description unchanged in intent.

### 3.4 Report panes

Desktop: **ResizablePanelGroup** for findings list | detail.  
Mobile: stacked list → detail with Back button (existing pattern).

---

## 4. Per-tab surfaces

### 4.1 Report

- Verdict + meter strip: clearer type hierarchy; **Separator** between meter cells where helpful
- List filters: existing **ToggleGroup**; materiality via sidebar Slider + Tooltip
- Decision actions: **Button Group** + **Kbd** hints for `j/k · c/x/i`
- Reset review: **Alert Dialog** confirmation before clearing decisions
- Empty / no-match: **Empty**; optional **Skeleton** for deferred UI only (data is server-loaded today — no fake loading if data is already present)
- Finding detail: keep Alert/Card/Badge patterns; unify spacing and badge overflow wrapping

### 4.2 Graph

- Restyle React Flow nodes/edges to design tokens (remove hard-coded zinc/emerald/red utility classes that bypass Cortea tokens)
- Side inspector: **ScrollArea** + **Card** / **Item** for selected entity + citations
- Empty / no-selection: **Empty**

### 4.3 Documents

- Native `<select>` → **Select**
- Search → **Input Group** (Search icon + Input)
- Kind filter: Select or ToggleGroup
- Table: sticky header, row hover, empty **Empty**
- Mobile cards: keep Card; accent links use `text-clear` / cortea tokens (no ad-hoc emerald)

### 4.4 Ask

- AI unavailable: **Empty** + **Alert** (replace custom amber box)
- Empty chat: suggestion outline buttons; composer **Input Group** (field + send)
- Messages: keep **Bubble**; streaming status via **Spinner** / muted line
- **Sonner**: send/network failures only — silent success, no celebratory toasts (`design.md`)

### 4.5 Empty dossier (`/audit` with no data)

Keep Card setup instructions; align typography/spacing with workbench voice; use **Empty** or Card consistently with the rest of the app.

---

## 5. Component inventory

### Already in `@almedia/ui`

Alert, Badge, Bubble, Button, Card, Dropdown Menu, Empty, Input, Progress, Scroll Area, Sheet, Slider, Table, Tabs, Textarea, Toggle, Toggle Group, Tooltip

### Add via shadcn CLI into `packages/ui`

| Component | Primary use |
|-----------|-------------|
| Sidebar | App nav rail |
| Select | Dossier switcher, document kind filter |
| Separator | Header meters, meter strip |
| Kbd | Shortcut hints |
| Input Group | Search, Ask composer |
| Resizable | Report list \| detail |
| Command | ⌘K dossier / jump palette |
| Alert Dialog | Reset review confirm; optional export confirm if needed |
| Skeleton | Deferred placeholders only |
| Sonner | Quiet error toasts |
| Button Group | Finding decision actions |
| Spinner | Ask streaming / busy |
| Item | Graph inspector / doc rows (optional if Card suffices) |

Install into `packages/ui` using existing `components.json` (style: radix-rhea). Wire exports so `@almedia/ui/components/*` resolves.

### Providers

- Ensure `TooltipProvider` remains at app root
- Add Sonner toaster in providers/layout
- Sidebar provider wraps audit workspace (or app shell) as required by shadcn Sidebar

---

## 6. Files expected to change

**Create / add**

- `packages/ui/src/components/{sidebar,select,separator,kbd,input-group,resizable,command,alert-dialog,skeleton,sonner,button-group,spinner,item}.tsx` (exact set may vary with CLI output)
- Possibly `apps/web/src/app/audit/_components/app-sidebar.tsx` (nav extraction)

**Modify**

- `packages/ui/src/styles/globals.css` — only if Sidebar/shadcn requires CSS variables already partially present (`--sidebar-*` exists)
- `apps/web/src/components/header.tsx`, `header-slot.tsx`, `providers.tsx`
- `apps/web/src/app/audit/page.tsx`
- `apps/web/src/app/audit/_components/workspace.tsx`
- `apps/web/src/app/audit/_components/report-tab.tsx`
- `apps/web/src/app/audit/_components/finding-list.tsx`
- `apps/web/src/app/audit/_components/finding-detail.tsx`
- `apps/web/src/app/audit/_components/money-graph.tsx`
- `apps/web/src/app/audit/_components/documents-tab.tsx`
- `apps/web/src/app/audit/_components/chat-tab.tsx`
- Evidence/pdf viewers only if token/class consistency requires it

**Do not delete** route trees, dossiers, or forensic packages as part of this work.

---

## 7. UX / a11y / error handling

- All interactive controls: visible `:focus-visible` ring (shadcn defaults + design focus token)
- Tooltips: 800ms hover delay, 0ms focus delay where configurable
- Alert Dialog for destructive/clear actions (reset review)
- Sonner for Ask send failures; never for successful review decisions
- Empty states explain next action (“Select a finding”, “No documents match”, “Configure API key…”)
- Keyboard: preserve j/k navigation and c/x/i decisions; surface **Kbd** in UI; Command palette for dossier switch without breaking Link-based deep links (`?d=`)

---

## 8. Out of scope

- Marketing / landing redesign
- Forensic engine, ingestion, analysis scripts
- Changing finding/scheme algorithms or review persistence model
- Dark-theme palette rewrite beyond token-consistent Sidebar/components
- Permanent three-pane evidence layout

---

## 9. Success criteria

1. All four tabs feel like one instrument (shared chrome, density, type, accent discipline)
2. No native browser form controls remain for dossier/kind where Select/Command exist
3. Report list|detail is resizable on desktop; mobile list/detail flow intact
4. Graph nodes use Cortea/shadcn tokens, not one-off color classes
5. Ask unavailable + empty + error states use Empty/Alert/Sonner consistently
6. Shortcuts still work; export still downloads the markdown report
7. Visual check at ~320 / 375 / 768 / 1280 widths: no horizontal scroll, usable nav

---

## 10. Implementation note

After this spec is approved, write an implementation plan (`writing-plans`) then execute: install components → shell → Report → Graph → Documents → Ask → empty dossier → visual QA.
