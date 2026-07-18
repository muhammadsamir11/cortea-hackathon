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
}: {
  citation: Citation;
  docs: DossierDoc[];
  onView: (c: Citation) => void;
}) {
  const file = docs.find((d) => d.id === citation.docId)?.filename ?? citation.docId;
  return (
    <Button
      onClick={() => onView(citation)}
      title={`“${citation.quote}”`}
      variant="outline"
      size="xs"
      className="max-w-full border-primary/25 bg-primary/10 font-mono text-primary hover:bg-primary/20"
    >
      <FileSearch />
      <span className="truncate">{file}</span>
      <span className="text-emerald-500/70">· {citation.ref}</span>
    </Button>
  );
}
