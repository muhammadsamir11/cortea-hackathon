"use client";

import { useMemo } from "react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@almedia/ui/components/alert";
import { Button } from "@almedia/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@almedia/ui/components/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@almedia/ui/components/collapsible";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@almedia/ui/components/empty";
import type { Citation, Fact, Finding } from "@almedia/forensic/types";
import { ChevronRight } from "lucide-react";
import type { DossierData } from "@/lib/audit-data";
import { Badge, CitationChip, eur, SEV, TIER, verdictOf } from "./components";
import { MoneyGraphView } from "./money-graph";
import type { Scheme } from "./schemes";

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

export function FindingDetail({
  finding,
  data,
  scheme,
  siblings,
  onView,
  onSelectFinding,
}: {
  finding: Finding | null;
  data: DossierData;
  scheme: Scheme | null;
  siblings: Finding[];
  onView: (c: Citation) => void;
  onSelectFinding: (id: string) => void;
}) {
  const facts = useMemo(
    () => new Map(data.facts.map((f) => [f.id, f])),
    [data.facts],
  );

  if (!finding) {
    return (
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyTitle>Select a finding</EmptyTitle>
          <EmptyDescription>
            Inspect its evidence, calculations, and tribunal reasoning.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const verdict = verdictOf(finding);
  const tier = TIER[finding.tier]!;
  const chainFacts = finding.factIds
    .map((id) => facts.get(id))
    .filter(Boolean) as Fact[];
  const looseCitations = chainFacts.length === 0 ? finding.citations : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4 sm:p-5">
        {/* header */}
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {finding.title}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <Badge variant={tier.variant}>{tier.label}</Badge>
            <Badge variant={SEV[finding.severity]}>{finding.severity}</Badge>
            <Badge variant="secondary">{finding.fraudType}</Badge>
            {finding.amountInvolved != null && (
              <Badge variant="outline">{eur(finding.amountInvolved)}</Badge>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="text-muted-foreground">
              tribunal: {verdict}
            </Badge>
            <Badge variant="outline" className="text-muted-foreground">
              engine: {finding.engineStatus ?? "detected"}
            </Badge>
            <Badge variant="outline" className="text-muted-foreground">
              AI: {finding.aiStatus ?? "not-run"}
            </Badge>
          </div>
        </div>

        {/* scheme strip */}
        {scheme && siblings.length > 0 && (
          <Alert className="border-border bg-muted/30">
            <AlertTitle className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Part of scheme - {scheme.title}
            </AlertTitle>
            <AlertDescription className="mt-1.5 flex flex-wrap gap-1.5">
              {siblings.map((s) => (
                <Button
                  key={s.id}
                  onClick={() => onSelectFinding(s.id)}
                  variant="outline"
                  size="xs"
                  className="h-auto max-w-full whitespace-normal text-left text-[11px]"
                >
                  {s.title}
                </Button>
              ))}
            </AlertDescription>
          </Alert>
        )}

        {finding.calculations && finding.calculations.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {finding.calculations.map((calculation) => (
              <Card key={calculation.label} size="sm">
                <CardHeader>
                  <CardDescription className="text-[10px] uppercase tracking-widest">
                    {calculation.label}
                  </CardDescription>
                  <CardTitle className="text-lg font-semibold tabular-nums">
                    {eur(calculation.value)}
                  </CardTitle>
                  <CardDescription className="text-[10px]">
                    {calculation.expression}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}

        {/* narrative */}
        <Card size="sm">
          <CardContent>
            <p className="leading-relaxed text-foreground/85">
              {finding.narrative}
            </p>
          </CardContent>
        </Card>

        <MoneyGraphView
          data={data}
          onView={onView}
          findingId={finding.id}
          variant="mini"
        />

        {finding.lineItems && finding.lineItems.length > 0 && (
          <Collapsible className="group/line-items">
            <Card size="sm" className="gap-0 py-0">
              <CollapsibleTrigger className="flex w-full items-center gap-2 px-(--card-spacing) py-3 text-left outline-none hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/line-items:rotate-90" />
                <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                  Calculation line items · {finding.lineItems.length}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="overflow-x-auto border-t">
                  <table className="min-w-full text-[11px]">
                    <thead className="bg-muted/30 text-left text-muted-foreground">
                      <tr>
                        <th className="px-3 py-2">Date / document</th>
                        <th className="px-3 py-2">Counterparty / detail</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2">Evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {finding.lineItems.map((item) => (
                        <tr key={item.id} className="border-t align-top">
                          <td className="whitespace-nowrap px-3 py-2">
                            {item.date ?? "-"}
                            <br />
                            <span className="text-muted-foreground">
                              {item.documentNumber ?? item.label}
                            </span>
                          </td>
                          <td className="max-w-72 px-3 py-2">
                            {item.counterparty ?? item.label}
                            <br />
                            <span className="text-muted-foreground">
                              {item.description}
                            </span>
                          </td>
                          <td className="whitespace-nowrap px-3 py-2 text-right">
                            {eur(item.amount)}
                            <br />
                            <span className="text-[9px] uppercase text-muted-foreground">
                              {item.amountType}
                            </span>
                          </td>
                          <td className="min-w-56 px-3 py-2">
                            <div className="flex flex-wrap gap-1">
                              {item.citations.map((citation, index) => (
                                <CitationChip
                                  key={`${citation.ref}-${index}`}
                                  citation={citation}
                                  docs={data.docs}
                                  onView={onView}
                                  muted
                                />
                              ))}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}

        {/* proof chain */}
        <div>
          <p className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">
            Proof chain - {finding.checkId}
          </p>
          <div className="space-y-2.5">
            {chainFacts.map((f) => (
              <div key={f.id}>
                <p className="text-xs text-muted-foreground">{factLine(f)}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {f.citations.map((c, i) => (
                    <CitationChip
                      key={i}
                      citation={c}
                      docs={data.docs}
                      onView={onView}
                      muted
                    />
                  ))}
                </div>
              </div>
            ))}
            {looseCitations.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {looseCitations.map((c, i) => (
                  <CitationChip
                    key={i}
                    citation={c}
                    docs={data.docs}
                    onView={onView}
                    muted
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* tribunal */}
        {finding.tribunal && (
          <Card size="sm">
            <CardHeader>
              <CardDescription className="text-[11px] uppercase tracking-widest">
                Tribunal transcript
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                <b className="text-foreground">Defense:</b>{" "}
                {finding.tribunal.defense}
              </p>
              {finding.tribunal.defenseCitations.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {finding.tribunal.defenseCitations.map((c, i) => (
                    <CitationChip
                      key={i}
                      citation={c}
                      docs={data.docs}
                      onView={onView}
                      muted
                    />
                  ))}
                </div>
              )}
              <p className="text-sm text-muted-foreground">
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
    </div>
  );
}
