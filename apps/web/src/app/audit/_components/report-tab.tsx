"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@almedia/ui/components/button";
import { Progress } from "@almedia/ui/components/progress";
import { cn } from "@almedia/ui/lib/utils";
import { ArrowLeft, RotateCcw } from "lucide-react";
import type { Citation } from "@almedia/forensic/types";
import type { DossierData } from "@/lib/audit-data";
import { eur, verdictOf } from "./components";
import { clusterSchemes, summarize } from "./schemes";
import { useReview, type Decision } from "./use-review";
import { FindingList } from "./finding-list";
import { FindingDetail } from "./finding-detail";

function Meter({
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
    <div className="min-w-0 border-r border-border px-3 py-2 last:border-r-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 font-mono text-base font-semibold tracking-tight", toneClass)}>{value}</p>
      {sub && <p className="font-mono text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function ReportTab({
  data,
  materiality,
  onView,
  registerExport,
}: {
  data: DossierData;
  materiality: number;
  onView: (c: Citation) => void;
  registerExport: (fn: () => void) => void;
}) {
  const validation = (data.meta as { validation?: { citations: number; verifiedCitations: number } } | null)
    ?.validation;
  const { schemes, schemeOf } = useMemo(
    () => clusterSchemes(data.findings, data.entities, data.facts, data.graph.companyClusterId),
    [data],
  );
  const summary = useMemo(() => summarize(data.findings, schemes, validation), [data.findings, schemes, validation]);
  const financial = (data.meta as { financial?: { reportedProfit: number | null; adjustedProfit: number | null } } | null)?.financial;
  const profitAdjustment =
    financial?.reportedProfit != null && financial?.adjustedProfit != null
      ? financial.reportedProfit - financial.adjustedProfit
      : null;

  const openFindings = useMemo(() => data.findings.filter((f) => verdictOf(f) !== "acquitted"), [data.findings]);
  const review = useReview(data.name, openFindings.length);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  useEffect(() => {
    if (!selectedId && schemes[0]?.findingIds[0]) setSelectedId(schemes[0].findingIds[0]);
  }, [schemes, selectedId]);

  const flatOrder = useMemo(() => schemes.flatMap((s) => s.findingIds), [schemes]);
  const findingById = useMemo(() => new Map(data.findings.map((f) => [f.id, f])), [data.findings]);
  const selected = selectedId ? (findingById.get(selectedId) ?? null) : null;
  const selectedScheme = selectedId ? schemes.find((s) => s.id === schemeOf.get(selectedId)) ?? null : null;
  const siblings = selectedScheme
    ? selectedScheme.findingIds.filter((id) => id !== selectedId).map((id) => findingById.get(id)!).filter(Boolean)
    : [];

  useEffect(() => {
    registerExport(async () => {
      const { buildReport, downloadReport } = await import("./export-report");
      const md = buildReport(data, schemes, schemeOf, summary, review.map);
      downloadReport(`forensic-report-${data.name}.md`, md);
    });
  }, [registerExport, data, schemes, schemeOf, summary, review.map]);

  const move = useCallback(
    (delta: number) => {
      if (!selectedId) return;
      const i = flatOrder.indexOf(selectedId);
      const next = flatOrder[Math.min(flatOrder.length - 1, Math.max(0, i + delta))];
      if (next) setSelectedId(next);
    },
    [selectedId, flatOrder],
  );
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest("button, a, input, textarea, select, [contenteditable=true], [role=slider]"))
        return;
      const k = e.key.toLowerCase();
      if (k === "j") move(1);
      else if (k === "k") move(-1);
      else if (selectedId && (k === "c" || k === "x" || k === "i")) {
        const map: Record<string, Decision> = { c: "confirmed", x: "dismissed", i: "info" };
        review.set(selectedId, map[k]!);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [move, selectedId, review]);

  const pct = review.progress.total ? Math.round((review.progress.decided / review.progress.total) * 100) : 0;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Verdict + meters */}
      <div className="border-b border-border">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border px-3 py-2.5 sm:px-4">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Verdict</span>
          <p className="min-w-0 text-sm font-medium tracking-tight text-foreground">{summary.headline}</p>
        </div>
        <div className="grid grid-cols-2 overflow-x-auto sm:grid-cols-4 lg:grid-cols-8">
          <Meter
            label="Net exposure"
            value={`€${Math.round(summary.netExposure).toLocaleString("en-US")}`}
            sub="cash + profit impact; controls excluded"
            tone="danger"
          />
          <Meter label="Gross cash paid" value={`€${Math.round(summary.grossExposure).toLocaleString("en-US")}`} sub="vendor-control scheme" tone="danger" />
          <Meter label="Reported profit" value={financial?.reportedProfit == null ? "—" : eur(financial.reportedProfit)} sub="draft financials" />
          <Meter
            label="Adjusted profit"
            value={financial?.adjustedProfit == null ? "—" : eur(financial.adjustedProfit)}
            sub={
              profitAdjustment == null
                ? "after detected adjustments"
                : `after ${eur(profitAdjustment)} adjustment`
            }
            tone="clear"
          />
          <Meter label="Open findings" value={String(summary.openCount)} sub={`${summary.schemeCount} schemes`} />
          <Meter label="Corroborated" value={String(summary.byTier.corroborated)} sub="multi-doc" tone="warn" />
          <Meter label="Counterparties" value={String(summary.entitiesInvolved)} sub={`${summary.acquitted} acquitted`} />
          <Meter
            label="Evidence"
            value={
              summary.citationsTotal
                ? `${Math.round((summary.citationsVerified / summary.citationsTotal) * 100)}%`
                : "—"
            }
            sub={`${summary.citationsVerified}/${summary.citationsTotal} cites`}
            tone="clear"
          />
        </div>
        <div className="flex items-center gap-3 px-3 py-2 sm:px-4">
          <span className="whitespace-nowrap font-mono text-[11px] text-muted-foreground">
            Reviewed {review.progress.decided}/{review.progress.total}
          </span>
          <Progress value={pct} className="min-w-16 flex-1" />
          {review.progress.decided > 0 && (
            <Button onClick={review.reset} variant="ghost" size="xs" className="font-mono">
              <RotateCcw /> reset
            </Button>
          )}
          <span className="hidden font-mono text-[10px] text-muted-foreground md:block">j/k · c/x/i</span>
        </div>
      </div>

      {/* Two-pane console */}
      <div className="flex min-h-0 min-w-0 flex-1">
        <div className={cn("w-full shrink-0 overflow-hidden border-r border-border lg:w-[20rem]", mobileDetail && "hidden lg:block")}>
          <FindingList
            findings={data.findings}
            schemes={schemes}
            schemeOf={schemeOf}
            selectedId={selectedId}
            reviewMap={review.map}
            materiality={materiality}
            onSelect={(id) => {
              setSelectedId(id);
              setMobileDetail(true);
            }}
          />
        </div>
        <div className={cn("min-w-0 flex-1 flex-col", mobileDetail ? "flex" : "hidden lg:flex")}>
          <div className="border-b border-border p-2 lg:hidden">
            <Button variant="ghost" size="sm" onClick={() => setMobileDetail(false)}>
              <ArrowLeft /> Back to findings
            </Button>
          </div>
          <FindingDetail
            finding={selected}
            data={data}
            scheme={selectedScheme}
            siblings={siblings}
            entry={selectedId ? review.get(selectedId) : {}}
            onDecision={review.set}
            onNote={review.setNote}
            onView={onView}
            onSelectFinding={setSelectedId}
          />
        </div>
      </div>
    </div>
  );
}
