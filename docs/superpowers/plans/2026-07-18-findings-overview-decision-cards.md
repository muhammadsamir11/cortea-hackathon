# Findings overview decision cards — Implementation Plan

> **For agentic workers:** Implement task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Redesign report overview meters and finding-detail calculation block so auditors trust the dossier first, then act on material risk and verdict readiness.

**Architecture:** In-place UI in `report-tab.tsx` and `finding-detail.tsx`; extend `summarize()` with clearance queue counts; read integrity from dossier meta.

**Tech Stack:** Next.js app router, existing `@almedia/ui` Card/Badge, Cortea tokens from DESIGN.md

## Global Constraints

- No invented metrics — only existing dossier fields
- Instrument calm — no identical hero-card grid, no celebratory chrome
- Status not color-only
- No click-to-filter in v1

---

### Task 1: Extend summary with clearance queue

**Files:** `apps/web/src/app/audit/_components/schemes.ts`

- [x] Add `queue: { unreviewed, needsJudgment, confirmed }` to `ExecSummary`
- [x] Compute from `verdictOf` on open (or all non-acquitted) findings

### Task 2: Report trust strip + supporting meters

**Files:** `apps/web/src/app/audit/_components/report-tab.tsx`

- [x] Replace four equal MetricCards with trust strip + three supporting meters
- [x] Wire integrity from `data.meta.integrity` and citation summary

### Task 3: Finding detail lead + readiness

**Files:** `apps/web/src/app/audit/_components/finding-detail.tsx`

- [x] Material figure + secondary calc rows
- [x] Readiness cue; thin header badges

### Task 4: Verify

- [x] Typecheck / lint touched files
- [ ] Spot-check Muster dossier in browser if available (dev server exited; restart `pnpm run dev`)
