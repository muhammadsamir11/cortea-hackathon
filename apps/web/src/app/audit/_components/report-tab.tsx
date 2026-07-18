"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@almedia/ui/components/card";
import { cn } from "@almedia/ui/lib/utils";
import type { DossierData } from "@/lib/audit-data";
import { clusterSchemes, summarize } from "./schemes";
import {
  FindingsHeatmap,
  heatmapFraudTypes,
  type HeatmapCellFilter,
} from "./findings-heatmap";
import { FindingsTable } from "./findings-table";
import { QuadrantRiskChart } from "./quadrant-risk-chart";
import { verdictOf } from "./components";

function SupportMeter({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "danger" | "warn" | "clear" | "ink";
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
        <CardDescription className="text-[10px] uppercase tracking-[0.14em]">
          {label}
        </CardDescription>
        <CardTitle
          className={cn(
            "text-base font-semibold tabular-nums tracking-tight sm:text-lg",
            toneClass,
          )}
        >
          {value}
        </CardTitle>
        {sub ? (
          <CardDescription className="text-[11px] leading-snug">{sub}</CardDescription>
        ) : null}
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
  const [heatmapFilter, setHeatmapFilter] = useState<HeatmapCellFilter | null>(
    null,
  );
  const validation = (
    data.meta as {
      validation?: { citations: number; verifiedCitations: number };
    } | null
  )?.validation;

  const { schemes, schemeOf } = useMemo(
    () =>
      clusterSchemes(
        data.findings,
        data.entities,
        data.facts,
        data.graph.companyClusterId,
      ),
    [data],
  );
  const summary = useMemo(
    () => summarize(data.findings, schemes, validation),
    [data.findings, schemes, validation],
  );
  const review = useMemo(() => {
    const confirmed = data.findings.filter((finding) => verdictOf(finding) === "confirmed").length;
    const acquitted = data.findings.filter((finding) => verdictOf(finding) === "acquitted").length;
    const needsJudgment = data.findings.filter((finding) => verdictOf(finding) === "needs-judgment").length;
    const pending = data.findings.filter((finding) => verdictOf(finding) === "unreviewed").length;
    const reviewed = confirmed + acquitted;
    return {
      confirmed,
      acquitted,
      needsJudgment,
      pending,
      reviewed,
      precision: reviewed ? confirmed / reviewed : null,
    };
  }, [data.findings]);

  useEffect(() => {
    registerExport(async () => {
      const { buildReport, downloadReport } = await import("./export-report");
      const md = buildReport(data, schemes, schemeOf, summary);
      downloadReport(`forensic-report-${data.name}.md`, md);
    });
  }, [registerExport, data, schemes, schemeOf, summary]);

  const tierSub = [
    `${summary.byTier.corroborated} from several documents`,
    `${summary.byTier.proven} proven by math`,
    summary.byTier.judgment > 0
      ? `${summary.byTier.judgment} need a decision`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 p-3 sm:p-4 lg:p-5">
        <section
          aria-label="Summary numbers"
          className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          <SupportMeter
            label="Amount at risk"
            value={`€${Math.round(summary.netExposure).toLocaleString("en-US")}`}
            sub="Cash and profit impact; control issues not included"
            tone="danger"
          />
          <SupportMeter
            label="Still to review"
            value={String(summary.openCount)}
            sub={`${summary.queue.unreviewed} not reviewed · ${summary.queue.needsJudgment} need a decision · ${summary.queue.confirmed} confirmed`}
          />
          <SupportMeter
            label="Strong evidence"
            value={String(
              summary.byTier.corroborated + summary.byTier.proven,
            )}
            sub={tierSub || "no open findings"}
            tone="warn"
          />
          <SupportMeter
            label="Reviewed precision"
            value={review.precision == null ? "—" : `${Math.round(review.precision * 100)}%`}
            sub={`${review.confirmed} confirmed · ${review.acquitted} cleared · ${review.needsJudgment + review.pending} open; recall cannot be measured without labels`}
            tone={review.precision == null ? "ink" : review.precision >= 0.8 ? "clear" : "warn"}
          />
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
