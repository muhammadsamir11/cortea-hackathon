"use client";

import { Button } from "@almedia/ui/components/button";
import { FileSearch } from "lucide-react";
import type { Citation, DossierDoc, Finding } from "@almedia/forensic/types";

export { Badge } from "@almedia/ui/components/badge";

export type ReviewVerdict = "confirmed" | "needs-judgment" | "acquitted" | "unreviewed";
export const verdictOf = (finding: Finding): ReviewVerdict => finding.tribunal?.verdict ?? "unreviewed";

export const eur = (n: number) =>
  "€" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export type StatusVariant = "secondary" | "destructive" | "warning" | "info" | "success" | "outline";

export const SEV: Record<string, StatusVariant> = {
  high: "destructive",
  medium: "warning",
  low: "secondary",
};

export const TIER: Record<string, { label: string; variant: StatusVariant; text: string }> = {
  proven: { label: "PROVEN (arithmetic)", variant: "destructive", text: "text-destructive" },
  corroborated: { label: "CORROBORATED (multi-doc)", variant: "warning", text: "text-warn" },
  judgment: { label: "JUDGMENT REQUIRED", variant: "info", text: "text-sky-600 dark:text-sky-300" },
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
  return (
    <Button
      onClick={() => onView(citation)}
      title={`“${citation.quote}” · ${file} · ${citation.ref}`}
      variant={muted ? "secondary" : "outline"}
      size="xs"
      className={
        muted
          ? "h-7 max-w-56 justify-start gap-x-1 text-muted-foreground"
          : "h-auto max-w-full flex-wrap justify-start gap-x-1 border-primary/25 bg-primary/10 py-1 text-left text-primary hover:bg-primary/20"
      }
    >
      <FileSearch className="shrink-0" />
      <span className={muted ? "min-w-0 truncate" : "min-w-0 break-all"}>{file}</span>
      <span className={muted ? "shrink-0 text-muted-foreground/70" : "shrink-0 text-emerald-500/70"}>
        · {citation.ref}
      </span>
    </Button>
  );
}
