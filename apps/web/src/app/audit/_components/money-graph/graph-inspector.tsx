"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@almedia/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@almedia/ui/components/empty";
import { Separator } from "@almedia/ui/components/separator";
import type { Citation, Fact, Finding, FindingLineItem } from "@almedia/forensic/types";
import type { DossierData } from "@/lib/audit-data";
import { AppDrawer } from "@/components/app-drawer";
import { CitationChip, eur } from "../components";

export type InspectorInfo = {
  title: string;
  subtitle: string;
  facts: Fact[];
  findings: Finding[];
  lineItems: FindingLineItem[];
};

export function GraphInspector({
  info,
  open,
  docs,
  onView,
  onOpenChange,
}: {
  info: InspectorInfo | null;
  open: boolean;
  docs: DossierData["docs"];
  onView: (c: Citation) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const hasFindings = (info?.findings.length ?? 0) > 0;
  const hasLineItems = (info?.lineItems.length ?? 0) > 0;
  const hasFacts = (info?.facts.length ?? 0) > 0;
  const hasEvidence = hasFindings || hasLineItems || hasFacts;

  return (
    <AppDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={info?.title ?? "Selection"}
      description={info?.subtitle ?? "Related findings and evidence"}
      size="md"
    >
      <div className="space-y-4 pb-2">
        {!info || !hasEvidence ? (
          <Empty className="min-h-0 border-0 p-0">
            <EmptyHeader className="gap-1">
              <EmptyTitle className="text-xs">No evidence for this selection</EmptyTitle>
              <EmptyDescription className="text-[11px]">
                Try another node or edge tied to an open finding.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {info && hasFindings ? (
          <section className="space-y-2">
            <h3 className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Related findings
            </h3>
            <div className="space-y-2">
              {info.findings.map((finding) => (
                <Card key={finding.id} size="sm">
                  <CardHeader>
                    <CardTitle className="text-xs leading-snug text-destructive">
                      {finding.title}
                    </CardTitle>
                    {finding.amountInvolved != null ? (
                      <CardDescription className="tabular-nums">
                        {eur(finding.amountInvolved)}
                      </CardDescription>
                    ) : null}
                  </CardHeader>
                  {finding.citations.length > 0 ? (
                    <CardContent>
                      <div className="flex flex-wrap gap-1.5">
                        {finding.citations.slice(0, 8).map((citation, index) => (
                          <CitationChip
                            key={`${citation.ref}-${index}`}
                            citation={citation}
                            docs={docs}
                            onView={onView}
                          />
                        ))}
                      </div>
                    </CardContent>
                  ) : null}
                </Card>
              ))}
            </div>
          </section>
        ) : null}

        {info && hasFindings && hasLineItems ? <Separator /> : null}

        {info && hasLineItems ? (
          <section className="space-y-2">
            <h3 className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
              Evidence
            </h3>
            <div className="space-y-3">
              {info.lineItems.map((item) => (
                <div key={item.id} className="border-l-2 border-border pl-3">
                  <p className="text-[11px] leading-relaxed break-words text-muted-foreground">
                    {[
                      item.date,
                      item.documentNumber,
                      eur(item.amount),
                      item.description ?? item.label,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {item.citations.length > 0 ? (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {item.citations.map((citation, index) => (
                        <CitationChip
                          key={`${item.id}-${index}`}
                          citation={citation}
                          docs={docs}
                          onView={onView}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {info && hasFacts ? (
          <>
            {(hasFindings || hasLineItems) && <Separator />}
            <section className="space-y-2">
              <h3 className="text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                Linked facts
              </h3>
              <div className="space-y-3">
                {info.facts.map((fact) => (
                  <div key={fact.id} className="border-l-2 border-border pl-3">
                    <p className="text-[11px] leading-relaxed break-words text-muted-foreground">
                      {[
                        fact.date,
                        fact.docNumber,
                        fact.amount != null ? eur(fact.amount) : null,
                        fact.description ?? fact.label,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {fact.citations.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {fact.citations.map((citation, index) => (
                          <CitationChip
                            key={`${fact.id}-${index}`}
                            citation={citation}
                            docs={docs}
                            onView={onView}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </AppDrawer>
  );
}
