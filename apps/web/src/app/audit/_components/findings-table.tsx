/* Hallmark · pre-emit critique: P4 H5 E5 S4 R5 V4 */
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@almedia/ui/components/button";
import { Card, CardContent, CardHeader } from "@almedia/ui/components/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@almedia/ui/components/empty";
import { Slider } from "@almedia/ui/components/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@almedia/ui/components/table";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@almedia/ui/components/toggle-group";
import { cn } from "@almedia/ui/lib/utils";
import { X } from "lucide-react";
import type { Finding } from "@almedia/forensic/types";
import {
  Badge,
  eur,
  SEV,
  TIER,
  type ReviewVerdict,
  verdictOf,
} from "./components";

function compactEur(n: number) {
  if (n >= 1_000_000)
    return `€${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `€${Math.round(n / 1_000)}k`;
  return `€${Math.round(n)}`;
}

const SEV_RANK = { high: 3, medium: 2, low: 1 } as const;

const VERDICT_LABEL: Record<ReviewVerdict, string> = {
  confirmed: "Confirmed",
  "needs-judgment": "Needs judgment",
  unreviewed: "Unreviewed",
  acquitted: "Acquitted",
};

type TierFilter = "all" | "proven" | "corroborated" | "judgment";
type StateFilter = "open" | "confirmed" | "judgment" | "acquitted";

const STATE_FILTERS: { id: StateFilter; label: string; short: string }[] = [
  { id: "open", label: "Open", short: "Open" },
  { id: "confirmed", label: "Confirmed", short: "Confirmed" },
  { id: "judgment", label: "Needs judgment", short: "Judgment" },
  { id: "acquitted", label: "Acquitted", short: "Acquitted" },
];

const TIER_FILTERS: { id: TierFilter; label: string; short: string }[] = [
  { id: "all", label: "All tiers", short: "All" },
  { id: "proven", label: "Proven", short: "Proven" },
  { id: "corroborated", label: "Corroborated", short: "Multi-doc" },
  { id: "judgment", label: "Needs judgment", short: "Judgment" },
];

function matchesState(finding: Finding, stateF: StateFilter) {
  const v = verdictOf(finding);
  if (stateF === "acquitted") return v === "acquitted";
  if (v === "acquitted") return false;
  if (stateF === "confirmed") return v === "confirmed";
  if (stateF === "judgment")
    return v === "needs-judgment" || v === "unreviewed";
  return true;
}

export function FindingsTable({
  findings,
  dossier,
  heatmapFilter = null,
  heatmapFraudTypes = null,
  onClearHeatmapFilter,
}: {
  findings: Finding[];
  dossier: string;
  heatmapFilter?: { fraudType: string; severity: Finding["severity"] } | null;
  /** Concrete fraud types matching the heatmap cell (expands Other). */
  heatmapFraudTypes?: string[] | null;
  onClearHeatmapFilter?: () => void;
}) {
  const router = useRouter();
  const [tierF, setTierF] = useState<TierFilter>("all");
  const [stateF, setStateF] = useState<StateFilter>("open");
  const [materiality, setMateriality] = useState(0);

  const maxAmount = useMemo(
    () =>
      Math.max(0, ...findings.map((finding) => finding.amountInvolved ?? 0)),
    [findings],
  );

  const stateCounts = useMemo(() => {
    const counts = Object.fromEntries(
      STATE_FILTERS.map((s) => [s.id, 0]),
    ) as Record<StateFilter, number>;
    for (const f of findings) {
      for (const s of STATE_FILTERS) {
        if (matchesState(f, s.id)) counts[s.id]++;
      }
    }
    return counts;
  }, [findings]);

  const rows = useMemo(() => {
    return findings
      .filter((f) => {
        if (tierF !== "all" && f.tier !== tierF) return false;
        if (
          materiality > 0 &&
          (f.amountInvolved ?? Number.MAX_VALUE) < materiality
        )
          return false;
        if (heatmapFilter) {
          if (f.severity !== heatmapFilter.severity) return false;
          const types = heatmapFraudTypes?.length
            ? heatmapFraudTypes
            : [heatmapFilter.fraudType];
          if (!types.includes(f.fraudType || "other")) return false;
        }
        return matchesState(f, stateF);
      })
      .sort(
        (a, b) =>
          SEV_RANK[b.severity] - SEV_RANK[a.severity] ||
          (b.amountInvolved ?? 0) - (a.amountInvolved ?? 0),
      );
  }, [findings, tierF, stateF, materiality, heatmapFilter, heatmapFraudTypes]);

  const filtersActive =
    stateF !== "open" ||
    tierF !== "all" ||
    materiality > 0 ||
    Boolean(heatmapFilter);

  const clearFilters = () => {
    setStateF("open");
    setTierF("all");
    setMateriality(0);
    onClearHeatmapFilter?.();
  };

  const hrefFor = (id: string) =>
    `/audit/report/${encodeURIComponent(id)}?d=${encodeURIComponent(dossier)}` as const;

  return (
    <Card className="min-h-0 flex-1">
      <CardHeader className="border-b">
        <div className="flex flex-col gap-2.5 lg:flex-row lg:items-end lg:gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-3 sm:gap-y-2">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                State
              </span>
              <ToggleGroup
                type="single"
                value={stateF}
                onValueChange={(value) => {
                  if (value) setStateF(value as StateFilter);
                }}
                variant="outline"
                size="sm"
                spacing={0}
                className="max-w-full overflow-x-auto"
                aria-label="Filter by state"
              >
                {STATE_FILTERS.map((s) => (
                  <ToggleGroupItem
                    key={s.id}
                    value={s.id}
                    aria-label={`${s.label} (${stateCounts[s.id]})`}
                    className="h-8 gap-1 px-2 text-xs"
                  >
                    <span className="hidden sm:inline">{s.label}</span>
                    <span className="sm:hidden">{s.short}</span>
                    <span className="tabular-nums opacity-60">
                      {stateCounts[s.id]}
                    </span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                Evidence
              </span>
              <ToggleGroup
                type="single"
                value={tierF}
                onValueChange={(value) => {
                  if (value) setTierF(value as TierFilter);
                }}
                variant="outline"
                size="sm"
                spacing={0}
                className="max-w-full overflow-x-auto"
                aria-label="Filter by evidence tier"
              >
                {TIER_FILTERS.map((t) => (
                  <ToggleGroupItem
                    key={t.id}
                    value={t.id}
                    aria-label={t.label}
                    className="h-8 px-2 text-xs"
                  >
                    <span className="hidden md:inline">{t.label}</span>
                    <span className="md:hidden">{t.short}</span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>

            {filtersActive ? (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                className="h-8 gap-1 self-start text-muted-foreground sm:self-end"
                onClick={clearFilters}
              >
                <X className="size-3.5" />
                Clear
              </Button>
            ) : null}
          </div>

          {maxAmount > 0 ? (
            <div className="flex w-full min-w-0 flex-col gap-1 lg:max-w-[14rem] lg:shrink-0">
              <div className="flex items-center justify-between gap-2">
                <label
                  htmlFor="materiality-threshold"
                  className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground"
                >
                  Materiality
                </label>
                <span
                  id="materiality-value"
                  className="text-xs tabular-nums text-foreground"
                >
                  {materiality > 0 ? `≥ ${eur(materiality)}` : "Any amount"}
                </span>
              </div>
              <Slider
                id="materiality-threshold"
                aria-label="Materiality threshold"
                aria-describedby="materiality-value"
                min={0}
                max={maxAmount}
                step={Math.max(100, Math.round(maxAmount / 100))}
                value={[materiality]}
                onValueChange={(value) => setMateriality(value[0] ?? 0)}
              />
              <div className="flex justify-between text-[10px] tabular-nums leading-none text-muted-foreground">
                <span>{compactEur(0)}</span>
                <span>{compactEur(maxAmount)}</span>
              </div>
            </div>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="min-h-0 flex-1 overflow-auto">
        {rows.length === 0 ? (
          <Empty className="min-h-48">
            <EmptyHeader>
              <EmptyTitle>No matching findings</EmptyTitle>
              <EmptyDescription>
                Adjust the verdict state, evidence tier, or materiality
                threshold.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-sm pl-2 sm:pl-4">Title</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Tier</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Verdict</TableHead>
                <TableHead className="pr-2 sm:pr-4">Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((finding) => {
                const verdict = verdictOf(finding);
                const tier = TIER[finding.tier];
                const href = hrefFor(finding.id);
                return (
                  <TableRow
                    key={finding.id}
                    role="link"
                    tabIndex={0}
                    className="cursor-pointer"
                    aria-label={`Open finding: ${finding.title}`}
                    onClick={() => router.push(href)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        router.push(href);
                      }
                    }}
                  >
                    <TableCell className="max-w-0 truncate pl-2 font-medium sm:pl-4 sm:max-w-sm">
                      <span className="block truncate" title={finding.title}>
                        {finding.title}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={SEV[finding.severity]}
                        className="capitalize"
                      >
                        {finding.severity}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={cn("text-xs capitalize", tier?.text)}>
                        {finding.tier}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {finding.amountInvolved != null
                        ? eur(finding.amountInvolved)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {VERDICT_LABEL[verdict]}
                    </TableCell>
                    <TableCell className="max-w-40 truncate pr-3 text-xs text-muted-foreground sm:pr-4">
                      {finding.fraudType}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
