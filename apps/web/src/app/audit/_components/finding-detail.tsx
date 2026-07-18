"use client";

import { useMemo } from "react";
import { Alert, AlertDescription, AlertTitle } from "@almedia/ui/components/alert";
import { Button } from "@almedia/ui/components/button";
import { Card, CardContent } from "@almedia/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@almedia/ui/components/empty";
import { Textarea } from "@almedia/ui/components/textarea";
import type { Citation, Fact, Finding } from "@almedia/forensic/types";
import type { DossierData } from "@/lib/audit-data";
import { Badge, CitationChip, eur, SEV, TIER, verdictOf } from "./components";
import type { Scheme } from "./schemes";
import type { Decision, ReviewEntry } from "./use-review";

function factLine(f: Fact): string {
  const bits: string[] = [f.kind.replace("_", " ")];
  if (f.date) bits.push(f.date);
  if (f.docNumber) bits.push(f.docNumber);
  if (f.payerName && f.payeeName) bits.push(`${f.payerName} → ${f.payeeName}`);
  else if (f.entityName) bits.push(f.entityName);
  else if (f.accountRef) bits.push(f.accountRef);
  if (f.amount != null) bits.push(eur(f.amount));
  if (f.label) bits.push(f.label);
  return bits.join(" · ");
}

const VERDICT_PILL = {
  confirmed: "destructive",
  "needs-judgment": "warning",
  acquitted: "success",
  unreviewed: "secondary",
} as const;

const ACTIONS: { d: Decision; label: string; on: string; key: string }[] = [
  { d: "confirmed", label: "Confirm", on: "border-destructive/40 bg-destructive/15 text-destructive", key: "C" },
  { d: "info", label: "Needs info", on: "border-warn/40 bg-warn/15 text-warn", key: "I" },
  { d: "dismissed", label: "Dismiss", on: "border-clear/40 bg-clear/15 text-clear", key: "X" },
];

export function FindingDetail({
  finding,
  data,
  scheme,
  siblings,
  entry,
  onDecision,
  onNote,
  onView,
  onSelectFinding,
}: {
  finding: Finding | null;
  data: DossierData;
  scheme: Scheme | null;
  siblings: Finding[];
  entry: ReviewEntry;
  onDecision: (id: string, d: Decision) => void;
  onNote: (id: string, note: string) => void;
  onView: (c: Citation) => void;
  onSelectFinding: (id: string) => void;
}) {
  const facts = useMemo(() => new Map(data.facts.map((f) => [f.id, f])), [data.facts]);

  if (!finding) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyTitle>Select a finding</EmptyTitle>
          <EmptyDescription>Review its evidence and record your auditor decision.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const verdict = verdictOf(finding);
  const tier = TIER[finding.tier]!;
  const chainFacts = finding.factIds.map((id) => facts.get(id)).filter(Boolean) as Fact[];
  const looseCitations = chainFacts.length === 0 ? finding.citations : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-5">
        {/* header */}
        <div>
          <h2 className="font-heading text-lg font-semibold tracking-tight text-foreground">{finding.title}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant={tier.variant}>{tier.label}</Badge>
            <Badge variant={SEV[finding.severity]}>{finding.severity}</Badge>
            <Badge variant="secondary">{finding.fraudType}</Badge>
            {finding.amountInvolved != null && (
              <Badge variant="outline">{eur(finding.amountInvolved)}</Badge>
            )}
            <Badge variant={VERDICT_PILL[verdict]}>human: {verdict}</Badge>
            <Badge variant={finding.engineStatus === "detected" ? "destructive" : "secondary"}>
              engine: {finding.engineStatus ?? "detected"}
            </Badge>
            <Badge variant={finding.aiStatus === "not-run" || !finding.aiStatus ? "outline" : "info"}>
              AI: {finding.aiStatus ?? "not-run"}
            </Badge>
          </div>
        </div>

        {/* scheme strip */}
        {scheme && siblings.length > 0 && (
          <Alert className="border-border bg-muted/30">
            <AlertTitle className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Part of scheme — {scheme.title}
            </AlertTitle>
            <AlertDescription className="mt-1.5 flex flex-wrap gap-1.5">
              {siblings.map((s) => (
                <Button
                  key={s.id}
                  onClick={() => onSelectFinding(s.id)}
                  variant="outline"
                  size="xs"
                  className="h-auto max-w-full whitespace-normal text-left font-mono text-[11px]"
                >
                  {s.title}
                </Button>
              ))}
            </AlertDescription>
          </Alert>
        )}

        {/* narrative */}
        <p className="leading-relaxed text-foreground/85">{finding.narrative}</p>

        {finding.calculations && finding.calculations.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {finding.calculations.map((calculation) => (
              <Card key={calculation.label} className="bg-muted/20">
                <CardContent>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{calculation.label}</p>
                  <p className="mt-1 font-mono text-lg font-semibold">{eur(calculation.value)}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{calculation.expression}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {finding.lineItems && finding.lineItems.length > 0 && (
          <details open className="group rounded-lg border bg-muted/10">
            <summary className="cursor-pointer list-none px-3 py-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              <span className="mr-2 inline-block transition-transform group-open:rotate-90">›</span>
              Calculation line items — {finding.lineItems.length}
            </summary>
            <div className="overflow-x-auto border-t">
              <table className="min-w-full font-mono text-[11px]">
                <thead className="bg-muted/30 text-left text-muted-foreground">
                  <tr><th className="px-3 py-2">Date / document</th><th className="px-3 py-2">Counterparty / detail</th><th className="px-3 py-2 text-right">Amount</th><th className="px-3 py-2">Evidence</th></tr>
                </thead>
                <tbody>
                  {finding.lineItems.map((item) => (
                    <tr key={item.id} className="border-t align-top">
                      <td className="whitespace-nowrap px-3 py-2">{item.date ?? "—"}<br/><span className="text-muted-foreground">{item.documentNumber ?? item.label}</span></td>
                      <td className="max-w-72 px-3 py-2">{item.counterparty ?? item.label}<br/><span className="text-muted-foreground">{item.description}</span></td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">{eur(item.amount)}<br/><span className="text-[9px] uppercase text-muted-foreground">{item.amountType}</span></td>
                      <td className="min-w-56 px-3 py-2"><div className="flex flex-wrap gap-1">{item.citations.map((citation, index) => <CitationChip key={`${citation.ref}-${index}`} citation={citation} docs={data.docs} onView={onView} />)}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}

        {/* proof chain */}
        <div>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Proof chain — {finding.checkId}
          </p>
          <div className="space-y-2.5 border-l-2 border-cortea/40 pl-3">
            {chainFacts.map((f) => (
              <div key={f.id}>
                <p className="font-mono text-xs text-muted-foreground">{factLine(f)}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {f.citations.map((c, i) => (
                    <CitationChip key={i} citation={c} docs={data.docs} onView={onView} />
                  ))}
                </div>
              </div>
            ))}
            {looseCitations.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {looseCitations.map((c, i) => (
                  <CitationChip key={i} citation={c} docs={data.docs} onView={onView} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* tribunal */}
        {finding.tribunal && (
          <Card className="bg-muted/20">
            <CardContent>
            <p className="mb-1 font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Tribunal transcript
            </p>
            <p className="text-sm text-muted-foreground">
              <b className="text-foreground">Defense:</b> {finding.tribunal.defense}
            </p>
            {finding.tribunal.defenseCitations.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {finding.tribunal.defenseCitations.map((c, i) => (
                  <CitationChip key={i} citation={c} docs={data.docs} onView={onView} />
                ))}
              </div>
            )}
            <p className="mt-2 text-sm text-muted-foreground">
              <b
                className={
                  verdict === "confirmed"
                    ? "text-destructive"
                    : verdict === "acquitted"
                      ? "text-clear"
                      : "text-warn"
                }
              >
                Verdict: {verdict}.
              </b>{" "}
              {finding.tribunal.reasoning}
            </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* sticky review action bar */}
      <div className="border-t border-border bg-background p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Auditor decision
          </span>
          <div className="flex w-full gap-1.5 sm:ml-auto sm:w-auto">
            {ACTIONS.map((a) => {
              const active = entry.decision === a.d;
              return (
                <Button
                  key={a.d}
                  onClick={() => onDecision(finding.id, a.d)}
                  title={`shortcut: ${a.key}`}
                  variant={active ? "secondary" : "outline"}
                  size="sm"
                  aria-pressed={active}
                  className={`flex-1 font-mono text-xs sm:flex-none ${active ? a.on : ""}`}
                >
                  {active ? "● " : ""}
                  {a.label}
                </Button>
              );
            })}
          </div>
        </div>
        <Textarea
          value={entry.note ?? ""}
          onChange={(e) => onNote(finding.id, e.target.value)}
          placeholder="Add a review note (appears in the exported report)…"
          rows={2}
          className="mt-2 w-full resize-none font-mono text-xs"
        />
      </div>
    </div>
  );
}
