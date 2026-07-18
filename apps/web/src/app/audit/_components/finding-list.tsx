"use client";

import { useMemo, useState } from "react";
import { Button } from "@almedia/ui/components/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@almedia/ui/components/empty";
import { ToggleGroup, ToggleGroupItem } from "@almedia/ui/components/toggle-group";
import { cn } from "@almedia/ui/lib/utils";
import type { Finding } from "@almedia/forensic/types";
import { eur, TIER, verdictOf } from "./components";
import type { Scheme } from "./schemes";
import type { Decision, ReviewEntry } from "./use-review";

const SEV_DOT: Record<string, string> = {
  high: "bg-destructive",
  medium: "bg-warn",
  low: "bg-muted-foreground/40",
};

const DECISION_ICON: Record<Decision | "pending", { icon: string; cls: string; title: string }> = {
  confirmed: { icon: "✓", cls: "text-destructive", title: "confirmed" },
  dismissed: { icon: "✕", cls: "text-clear", title: "dismissed" },
  info: { icon: "?", cls: "text-warn", title: "needs info" },
  pending: { icon: "○", cls: "text-muted-foreground", title: "pending" },
};

const SEV_RANK = { high: 3, medium: 2, low: 1 } as const;

type TierFilter = "all" | "proven" | "corroborated" | "judgment";
type StateFilter = "open" | "pending" | "confirmed" | "acquitted";

export function FindingList({
  findings,
  schemes,
  schemeOf,
  selectedId,
  reviewMap,
  materiality,
  onSelect,
}: {
  findings: Finding[];
  schemes: Scheme[];
  schemeOf: Map<string, string>;
  selectedId: string | null;
  reviewMap: Record<string, ReviewEntry>;
  materiality: number;
  onSelect: (id: string) => void;
}) {
  const [tierF, setTierF] = useState<TierFilter>("all");
  const [stateF, setStateF] = useState<StateFilter>("open");

  const findingById = useMemo(() => new Map(findings.map((f) => [f.id, f])), [findings]);

  const passes = (f: Finding) => {
    if (tierF !== "all" && f.tier !== tierF) return false;
    if (materiality > 0 && (f.amountInvolved ?? Number.MAX_VALUE) < materiality) return false;
    const v = verdictOf(f);
    const d = reviewMap[f.id]?.decision;
    if (stateF === "acquitted") return v === "acquitted";
    if (v === "acquitted") return false; // acquitted only shown in its own filter
    if (stateF === "pending") return !d;
    if (stateF === "confirmed") return d === "confirmed";
    return true; // "open"
  };

  const visibleSchemes = schemes
    .map((s) => ({ scheme: s, items: s.findingIds.map((id) => findingById.get(id)!).filter(Boolean).filter(passes) }))
    .filter((x) => x.items.length > 0)
    .map((x) => ({
      ...x,
      items: x.items.sort(
        (a, b) => SEV_RANK[b.severity] - SEV_RANK[a.severity] || (b.amountInvolved ?? 0) - (a.amountInvolved ?? 0),
      ),
    }));

  const tierFilters: TierFilter[] = ["all", "proven", "corroborated", "judgment"];
  const stateFilters: { id: StateFilter; label: string }[] = [
    { id: "open", label: "Open" },
    { id: "pending", label: "Pending" },
    { id: "confirmed", label: "Confirmed" },
    { id: "acquitted", label: "Acquitted" },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="space-y-2 border-b p-2.5">
        <ToggleGroup
          type="single"
          value={stateF}
          onValueChange={(value) => value && setStateF(value as StateFilter)}
          variant="outline"
          size="sm"
          spacing={1}
          aria-label="Finding review state"
          className="flex-wrap"
        >
          {stateFilters.map((s) => (
            <ToggleGroupItem
              key={s.id}
              value={s.id}
              className="font-mono text-[11px]"
            >
              {s.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <ToggleGroup
          type="single"
          value={tierF}
          onValueChange={(value) => value && setTierF(value as TierFilter)}
          size="sm"
          spacing={1}
          aria-label="Evidence tier"
          className="flex-wrap"
        >
          {tierFilters.map((t) => (
            <ToggleGroupItem
              key={t}
              value={t}
              className="font-mono text-[10px] uppercase"
            >
              {t}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {visibleSchemes.map(({ scheme, items }) => (
          <div key={scheme.id} className="border-b">
            {items.length > 1 && (
              <div className="flex items-center gap-2 bg-muted/40 px-3 py-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${SEV_DOT[scheme.severity]}`} />
                <span className="truncate font-mono text-[11px] text-muted-foreground" title={scheme.title}>
                  {scheme.entityNames[0] ?? "scheme"} · {items.length} linked
                </span>
                {scheme.netAmount > 0 && (
                  <span className="ml-auto font-mono text-[10px] text-muted-foreground">{eur(scheme.netAmount)}</span>
                )}
              </div>
            )}
            {items.map((f) => {
              const v = verdictOf(f);
              const d = (reviewMap[f.id]?.decision ?? "pending") as Decision | "pending";
              const di = DECISION_ICON[v === "acquitted" ? "pending" : d];
              return (
                <Button
                  key={f.id}
                  onClick={() => onSelect(f.id)}
                  variant="ghost"
                  aria-pressed={selectedId === f.id}
                  className={cn(
                    "h-auto w-full items-start justify-start rounded-none border-l-2 border-transparent px-3 py-2.5 text-left font-normal",
                    selectedId === f.id
                      ? "border-l-primary bg-primary/10"
                      : "hover:bg-muted/50",
                    items.length > 1 && "pl-5",
                  )}
                >
                  <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${SEV_DOT[f.severity]}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-foreground">{f.title}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                      <span className={TIER[f.tier]!.text}>
                        {f.tier}
                      </span>
                      {f.amountInvolved != null && <span>· {eur(f.amountInvolved)}</span>}
                    </span>
                  </span>
                  <span className={`shrink-0 font-mono text-sm ${di.cls}`} title={di.title}>
                    {di.icon}
                  </span>
                </Button>
              );
            })}
          </div>
        ))}
        {visibleSchemes.length === 0 && (
          <Empty className="h-full min-h-40">
            <EmptyHeader>
              <EmptyTitle>No matching findings</EmptyTitle>
              <EmptyDescription>Adjust the review state, evidence tier, or materiality threshold.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  );
}
