/* Hallmark · pre-emit critique: P4 H5 E5 S4 R5 V4 */
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@almedia/ui/components/card";
import { cn } from "@almedia/ui/lib/utils";
import {
  CircleDollarSign,
  FileSearch,
  Files,
  type LucideIcon,
  Scale,
} from "lucide-react";
import type { DossierData } from "@/lib/audit-data";
import { clusterSchemes, summarize } from "./schemes";
import {
  FindingsHeatmap,
  heatmapFraudTypes,
  type HeatmapCellFilter,
} from "./findings-heatmap";
import { FindingsTable } from "./findings-table";
import { QuadrantRiskChart } from "./quadrant-risk-chart";

function MetricCard({
  label,
  value,
  sub,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "danger" | "warn" | "clear" | "ink";
  icon: LucideIcon;
}) {
  const toneClass =
    tone === "danger"
      ? "text-destructive"
      : tone === "warn"
        ? "text-warn"
        : tone === "clear"
          ? "text-clear"
          : "text-foreground";
  return (
    <Card size="sm">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardDescription className="text-[10px] uppercase tracking-[0.14em]">{label}</CardDescription>
          <Icon className="size-6 shrink-0 text-muted-foreground" aria-hidden />
        </div>
        <CardTitle className={cn("text-lg font-semibold tabular-nums tracking-tight", toneClass)}>
          {value}
        </CardTitle>
        {sub ? <CardDescription className="text-[11px] leading-snug">{sub}</CardDescription> : null}
      </CardHeader>
    </Card>
  );
}

export function ReportTab({
  data,
  registerExport,
}: {
  data: DossierData;
  registerExport: (fn: () => void) => void;
}) {
  const [heatmapFilter, setHeatmapFilter] = useState<HeatmapCellFilter | null>(null);
  const validation = (data.meta as { validation?: { citations: number; verifiedCitations: number } } | null)
    ?.validation;
  const { schemes, schemeOf } = useMemo(
    () => clusterSchemes(data.findings, data.entities, data.facts, data.graph.companyClusterId),
    [data],
  );
  const summary = useMemo(() => summarize(data.findings, schemes, validation), [data.findings, schemes, validation]);

  useEffect(() => {
    registerExport(async () => {
      const { buildReport, downloadReport } = await import("./export-report");
      const md = buildReport(data, schemes, schemeOf, summary);
      downloadReport(`forensic-report-${data.name}.md`, md);
    });
  }, [registerExport, data, schemes, schemeOf, summary]);

  const primaryMeters = [
    {
      label: "Net exposure",
      value: `€${Math.round(summary.netExposure).toLocaleString("en-US")}`,
      sub: "cash + profit impact; controls excluded",
      tone: "danger" as const,
      icon: CircleDollarSign,
    },
    {
      label: "Open findings",
      value: String(summary.openCount),
      sub: `${summary.schemeCount} schemes`,
      icon: FileSearch,
    },
    {
      label: "Evidence",
      value: summary.citationsTotal
        ? `${Math.round((summary.citationsVerified / summary.citationsTotal) * 100)}%`
        : "—",
      sub: `${summary.citationsVerified}/${summary.citationsTotal} cites`,
      tone: "clear" as const,
      icon: Scale,
    },
    {
      label: "Corroborated",
      value: String(summary.byTier.corroborated),
      sub: "multi-doc",
      tone: "warn" as const,
      icon: Files,
    },
  ];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 p-3 sm:p-4 lg:p-5">
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {primaryMeters.map((meter) => (
            <MetricCard key={meter.label} {...meter} />
          ))}
        </section>

        <section className="grid min-w-0 grid-cols-1 items-stretch gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
          <FindingsHeatmap
            findings={data.findings}
            filter={heatmapFilter}
            onFilterChange={setHeatmapFilter}
          />
          <QuadrantRiskChart findings={data.findings} />
        </section>

        <FindingsTable
          findings={data.findings}
          dossier={data.name}
          heatmapFilter={heatmapFilter}
          heatmapFraudTypes={
            heatmapFilter
              ? heatmapFraudTypes(data.findings, heatmapFilter.fraudType)
              : null
          }
          onClearHeatmapFilter={() => setHeatmapFilter(null)}
        />
      </div>
    </div>
  );
}
