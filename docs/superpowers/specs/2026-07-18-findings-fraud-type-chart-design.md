# Findings by fraud type chart

## Goal

Add a stacked bar chart on the audit report page showing open findings by fraud type and severity, placed after the overview metric cards and before the findings table.

## Approach

CSS heatmap grid (Approach A), columns = fraud type.

## Behavior

- Rows: high / medium / low severity
- Columns: fraud type (human-readable labels), top 6 + Other
- Cell color: severity token mixed by count intensity
- Aggregate open findings (exclude acquitted)
- Click cell → filter findings table; click again / Clear → reset

## Files

- `findings-heatmap.tsx` in audit `_components`
- Wire into `report-tab.tsx` after metrics; filter props on `findings-table.tsx`
