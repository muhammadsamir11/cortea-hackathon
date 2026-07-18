# Money Graph Investigation Shell — Design

**Date:** 2026-07-18  
**Status:** Approved for implementation  
**Approach:** Focused Investigation Shell (React Flow + dagre)

## Goals

- Cleaner Graph chrome for forensic investigation
- Hybrid selection: on-canvas chip → full side inspector
- Focused tools: finding scope, search, min amount, risk-only, fit/reset
- Stay on `@xyflow/react` v12 + existing `MoneyGraph` data (no backend changes)

## Layout

- Full-height canvas with top toolbar (`Panel`)
- Right inspector slides in on confirmed selection
- Legend bottom-left; `Controls` + `MiniMap` bottom-right
- Selection chip as canvas `Panel` near selection state

## Filter pipeline

`scope → risk-only → min-amount → search (dim) → dagre layout → React Flow`

## Interactions

- First click: select + chip; second click / chip CTA: open inspector
- Esc / pane click: clear selection and close inspector
- `/` focus search, `f` fit view

## Out of scope

Pathfinding, PNG export, graph engine swap, collaborative cursors
