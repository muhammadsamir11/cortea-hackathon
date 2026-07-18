# Findings overview decision cards — design

**Date:** 2026-07-18  
**Status:** Approved for implementation  
**Surfaces:** Findings report meters + finding detail calculation block

## Goal

Help auditors decide quickly with confidence: trust the dossier first, then prioritize work; on a finding, see material amount and verdict readiness at a glance.

## Decisions (locked)

- Scope: report overview meters **and** finding-detail calculation cards
- Report hierarchy: primary **trust/integrity** strip; supporting meters for material risk + clearance queue + evidence tier
- Detail: lead with material figure **and** compact readiness cue; secondary calcs as dense rows
- Approach: Trust strip + supporting meters (not single instrument bar; not click-to-filter in v1)

## Report overview

### Primary — trust strip (full width)

- Integrity status from `data.meta.integrity` (ok / warnings / failed); if absent: “Integrity not assessed”
- Citation coverage: verified / total + %
- One reason string (first warning, or “All required integrity checks passed”)

### Supporting — three meters

1. **Net exposure** — existing `summary.netExposure`
2. **Clearance queue** — unreviewed · needs-judgment · confirmed counts
3. **Evidence tier** — corroborated / proven among open (note judgment if any)

### Visual

- Not four identical hero cards
- Trust strip is the instrument; supporting meters quieter
- Status not color-only; no invented metrics

## Finding detail

### Lead block

- Material figure: `amountInvolved` when set, else primary calculation (highest value)
- Label + expression under number
- Secondary calculations as compact rows (label · value · expression)

### Verdict readiness

Deterministic mapping from existing fields:

| Condition | Cue |
| --- | --- |
| acquitted | Cleared |
| confirmed + (proven \| corroborated) | Ready to stand |
| needs-judgment **or** tier judgment | Needs your call |
| unreviewed | Not yet reviewed |

Also show: tier label, citation/fact counts when available.

### Header

- Keep title + severity / fraud-type (+ tier optional once)
- Remove tribunal/engine/AI badge pile; fold into readiness cue

## Files

- `apps/web/src/app/audit/_components/report-tab.tsx`
- `apps/web/src/app/audit/_components/finding-detail.tsx`
- `apps/web/src/app/audit/_components/schemes.ts` — extend summary with queue counts if needed
- `apps/web/src/app/audit/_components/workspace.tsx` — pass integrity into ReportTab if not readable from meta

## Out of scope

- Click-to-filter meters
- Heatmap / table redesign
- New backend fields
- Export copy changes

## Edges

- No integrity → citation coverage + “Integrity not assessed”
- Zero citations → “—” for %
- No amount / no calcs → readiness still shows; omit material or show “No quantified exposure”
- Mobile: trust stacks; supporting 2×2 → 1-col
