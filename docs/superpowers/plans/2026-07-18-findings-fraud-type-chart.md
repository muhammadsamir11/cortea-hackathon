# Findings Fraud Type Chart Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stacked bar chart of findings by fraud type × severity on the report page.

**Architecture:** shadcn Chart wrapper in `@almedia/ui`, thin audit component that aggregates findings and renders a stacked BarChart, inserted in `ReportTab` after metric cards.

**Tech Stack:** Next.js, Recharts, shadcn Chart, existing forensic `Finding` types.

### Task 1: Add shadcn chart to UI package

- Run `pnpm dlx shadcn@latest add chart` in `packages/ui`
- Ensure `recharts` is a dependency of `@almedia/ui`

### Task 2: Build chart component + wire into report

- Create `findings-fraud-type-chart.tsx`
- Aggregate open findings by fraudType × severity
- Insert into `report-tab.tsx` after overview cards
