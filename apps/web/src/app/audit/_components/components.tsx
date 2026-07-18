"use client";

import { Button } from "@almedia/ui/components/button";
import { FileSearch } from "lucide-react";
import type { Citation, DossierDoc, Finding } from "@almedia/forensic/types";

export { Badge } from "@almedia/ui/components/badge";

export type ReviewVerdict = "confirmed" | "needs-judgment" | "acquitted" | "unreviewed";
export const verdictOf = (finding: Finding): ReviewVerdict => {
  if (finding.tribunal?.verdict) return finding.tribunal.verdict;
  if (
    finding.aiStatus === "confirmed" ||
    finding.aiStatus === "needs-judgment" ||
    finding.aiStatus === "acquitted"
  ) {
    return finding.aiStatus;
  }
  return "unreviewed";
};

export const eur = (n: number) =>
  "€" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export type StatusVariant = "secondary" | "destructive" | "warning" | "info" | "success" | "outline";

export const SEV: Record<string, StatusVariant> = {
  high: "destructive",
  medium: "warning",
  low: "secondary",
};

export const TIER: Record<string, { label: string; variant: StatusVariant; text: string }> = {
  proven: { label: "Proven (by math)", variant: "destructive", text: "text-destructive" },
  corroborated: { label: "Backed by several documents", variant: "warning", text: "text-warn" },
  judgment: { label: "Needs your judgment", variant: "info", text: "text-sky-600 dark:text-sky-300" },
};

export function CitationChip({
  citation,
  docs,
  onView,
  muted = false,
}: {
  citation: Citation;
  docs: DossierDoc[];
  onView: (c: Citation) => void;
  muted?: boolean;
}) {
  const file = docs.find((d) => d.id === citation.docId)?.filename ?? citation.docId;
  const label = `${file} · ${citation.ref}`;
  return (
    <Button
      onClick={() => onView(citation)}
      title={`“${citation.quote}” · ${label}`}
      variant={muted ? "secondary" : "outline"}
      size="xs"
      className={
        muted
          ? "h-7 max-w-full min-w-0 justify-start gap-x-1 overflow-hidden text-muted-foreground"
          : "h-auto max-w-full min-w-0 justify-start gap-x-1 overflow-hidden border-primary/25 bg-primary/10 py-1 text-left text-primary hover:bg-primary/20"
      }
    >
      <FileSearch className="size-3.5 shrink-0" />
      <span className="min-w-0 truncate">{label}</span>
    </Button>
  );
}
