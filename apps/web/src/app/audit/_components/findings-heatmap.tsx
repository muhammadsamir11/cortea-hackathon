/* Hallmark · pre-emit critique: P4 H5 E5 S4 R5 V4 */
"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@almedia/ui/components/card";
import { cn } from "@almedia/ui/lib/utils";
import type { Finding } from "@almedia/forensic/types";
import { verdictOf } from "./components";
import { fraudLabel } from "./schemes";

const MAX_TYPES = 6;
const SEVERITIES = ["high", "medium", "low"] as const;
type Severity = (typeof SEVERITIES)[number];

const SEV_META: Record<
  Severity,
  { rowLabel: string; legend: string; token: string }
> = {
  high: { rowLabel: "High", legend: "High", token: "var(--destructive)" },
  medium: { rowLabel: "Med", legend: "Medium", token: "var(--warning)" },
  low: { rowLabel: "Low", legend: "Low", token: "var(--success)" },
};

export type HeatmapCellFilter = {
  fraudType: string;
  severity: Severity;
};

type Column = {
  fraudType: string;
  label: string;
  high: number;
  medium: number;
  low: number;
  total: number;
  /** When set, cell matches any of these fraud types (Other bucket). */
  members?: string[];
};

function aggregateColumns(findings: Finding[]): Column[] {
  const open = findings.filter((f) => verdictOf(f) !== "acquitted");
  const byType = new Map<
    string,
    { high: number; medium: number; low: number }
  >();

  for (const finding of open) {
    const key = finding.fraudType || "other";
    const bucket = byType.get(key) ?? { high: 0, medium: 0, low: 0 };
    bucket[finding.severity] += 1;
    byType.set(key, bucket);
  }

  const rows: Column[] = [...byType.entries()]
    .map(([fraudType, counts]) => ({
      fraudType,
      label: fraudLabel(fraudType),
      ...counts,
      total: counts.high + counts.medium + counts.low,
    }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));

  if (rows.length <= MAX_TYPES) return rows;

  const head = rows.slice(0, MAX_TYPES);
  const rest = rows.slice(MAX_TYPES);
  const other = rest.reduce(
    (acc, row) => {
      acc.high += row.high;
      acc.medium += row.medium;
      acc.low += row.low;
      acc.total += row.total;
      acc.members!.push(row.fraudType);
      return acc;
    },
    {
      fraudType: "__other__",
      label: "Other",
      high: 0,
      medium: 0,
      low: 0,
      total: 0,
      members: [] as string[],
    },
  );
  return [...head, other];
}

function cellVisual(
  token: string,
  count: number,
  max: number,
  severity: Severity,
): { backgroundColor: string; color: string } {
  // High/red stays closer to true destructive; med/low stay softer.
  const emptyMix = severity === "high" ? 18 : 14;
  const filledBase = severity === "high" ? 30 : 24;
  const filledSpan = severity === "high" ? 40 : 36;

  if (count <= 0) {
    return {
      backgroundColor: `color-mix(in oklch, ${token} ${emptyMix}%, var(--muted) ${100 - emptyMix}%)`,
      color: "color-mix(in oklch, var(--muted-foreground) 58%, transparent)",
    };
  }
  const intensity = max > 0 ? count / max : 1;
  const pct = Math.round(filledBase + intensity * filledSpan);
  return {
    backgroundColor: `color-mix(in oklch, ${token} ${pct}%, var(--muted) ${100 - pct}%)`,
    color: "var(--foreground)",
  };
}

function formatCount(n: number) {
  return n.toString().padStart(2, "0");
}

export function FindingsHeatmap({
  findings,
  filter,
  onFilterChange,
}: {
  findings: Finding[];
  filter: HeatmapCellFilter | null;
  onFilterChange: (next: HeatmapCellFilter | null) => void;
}) {
  const columns = useMemo(() => aggregateColumns(findings), [findings]);

  const maxBySeverity = useMemo(() => {
    const max = { high: 0, medium: 0, low: 0 };
    for (const col of columns) {
      max.high = Math.max(max.high, col.high);
      max.medium = Math.max(max.medium, col.medium);
      max.low = Math.max(max.low, col.low);
    }
    return max;
  }, [columns]);

  if (columns.length === 0) return null;

  const isSelected = (fraudType: string, severity: Severity) =>
    filter?.fraudType === fraudType && filter.severity === severity;

  return (
    <Card size="sm" className="h-full min-w-0">
      <CardContent className="flex h-full flex-col">
        <div className="min-h-0 flex-1 overflow-x-auto">
          <div
            className="grid min-w-md gap-1.5"
            style={{
              gridTemplateColumns: `4.25rem repeat(${columns.length}, minmax(4.75rem, 1fr))`,
            }}
            role="grid"
            aria-label="Findings heatmap by fraud type and severity"
          >
            <div role="columnheader" className="px-1" aria-hidden />
            {columns.map((col) => (
              <div
                key={col.fraudType}
                role="columnheader"
                className="flex min-w-0 items-end justify-center px-0.5 pb-1"
                title={col.label}
              >
                <span className="line-clamp-2 w-full text-center text-[10px] font-medium leading-tight tracking-wide text-foreground/80 capitalize">
                  {col.label}
                </span>
              </div>
            ))}

            {SEVERITIES.map((severity) => (
              <div key={severity} className="contents" role="row">
                <div
                  role="rowheader"
                  className="flex items-center gap-1.5 pr-1"
                >
                  <span
                    className="size-1.5 shrink-0 rounded-[2px]"
                    style={{ backgroundColor: SEV_META[severity].token }}
                    aria-hidden
                  />
                  <span className="font-mono text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                    {SEV_META[severity].rowLabel}
                  </span>
                </div>
                {columns.map((col) => {
                  const count = col[severity];
                  const selected = isSelected(col.fraudType, severity);
                  const visual = cellVisual(
                    SEV_META[severity].token,
                    count,
                    maxBySeverity[severity],
                    severity,
                  );
                  const label = `${formatCount(count)} ${SEV_META[severity].legend.toLowerCase()} in ${col.label}`;
                  return (
                    <button
                      key={`${col.fraudType}-${severity}`}
                      type="button"
                      role="gridcell"
                      aria-label={label}
                      aria-pressed={selected}
                      disabled={count === 0}
                      onClick={() =>
                        onFilterChange(
                          selected
                            ? null
                            : { fraudType: col.fraudType, severity },
                        )
                      }
                      className={cn(
                        "flex h-12 items-center justify-center rounded-md font-mono text-sm font-semibold tabular-nums transition-[filter,transform,background-color,box-shadow,opacity] duration-150 ease-out",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--color-focus) focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        count === 0
                          ? "cursor-default ring-1 ring-inset ring-border/60"
                          : "hover:brightness-[1.06] active:scale-[0.98]",
                        selected && "ring-1 ring-inset ring-border",
                        filter && !selected && "opacity-35",
                      )}
                      style={{
                        backgroundColor: visual.backgroundColor,
                        color: visual.color,
                      }}
                    >
                      {formatCount(count)}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Resolve heatmap “Other” bucket to concrete fraud types for table filtering. */
export function heatmapFraudTypes(
  findings: Finding[],
  fraudType: string,
): string[] {
  if (fraudType !== "__other__") return [fraudType];
  const columns = aggregateColumns(findings);
  const other = columns.find((c) => c.fraudType === "__other__");
  return other?.members?.length ? other.members : [];
}
