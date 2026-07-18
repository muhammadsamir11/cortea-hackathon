"use client";

import type { ReactNode } from "react";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@almedia/ui/components/empty";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@almedia/ui/components/table";
import type { Citation, Fact, Finding, FindingLineItem } from "@almedia/forensic/types";
import type { DossierData } from "@/lib/audit-data";
import { AppDrawer } from "@/components/app-drawer";
import { Badge, CitationChip, eur, SEV } from "../components";
import { fraudLabel } from "../schemes";

export type InspectorInfo = {
  title: string;
  subtitle: string;
  facts: Fact[];
  findings: Finding[];
  lineItems: FindingLineItem[];
};

function CitationCell({
  citations,
  docs,
  onView,
  limit,
}: {
  citations: Citation[];
  docs: DossierData["docs"];
  onView: (c: Citation) => void;
  limit?: number;
}) {
  if (citations.length === 0) {
    return <span className="text-[11px] text-muted-foreground">—</span>;
  }
  const shown = limit != null ? citations.slice(0, limit) : citations;
  const hidden = limit != null ? Math.max(0, citations.length - limit) : 0;

  return (
    <div className="flex w-full min-w-0 max-w-48 flex-col items-stretch gap-1">
      {shown.map((citation, index) => (
        <CitationChip
          key={`${citation.docId}-${citation.ref}-${index}`}
          citation={citation}
          docs={docs}
          onView={onView}
          muted
        />
      ))}
      {hidden > 0 ? (
        <span className="text-[10px] tabular-nums text-muted-foreground">
          +{hidden} more
        </span>
      ) : null}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="mb-2 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

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
      description={info?.subtitle ?? "Related findings and sources"}
      size="md"
    >
      <div className="space-y-5 pb-2">
        {!info || !hasEvidence ? (
          <Empty className="min-h-0 border-0 p-0">
            <EmptyHeader className="gap-1">
              <EmptyTitle className="text-xs">No evidence for this selection</EmptyTitle>
              <EmptyDescription className="text-[11px]">
                Try another person, account, or payment linked to an open finding.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}

        {info && hasFindings ? (
          <section>
            <SectionLabel>Related findings · {info.findings.length}</SectionLabel>
            <div className="overflow-hidden rounded-md border border-border">
              <Table className="text-[11px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-8 bg-muted/30 px-3 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                      Finding
                    </TableHead>
                    <TableHead className="h-8 bg-muted/30 px-3 text-right text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                      Amount
                    </TableHead>
                    <TableHead className="h-8 bg-muted/30 px-3 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                      Citations
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {info.findings.map((finding) => (
                    <TableRow key={finding.id} className="align-top">
                      <TableCell className="max-w-48 whitespace-normal px-3 py-2.5">
                        <p className="text-xs leading-snug font-medium text-foreground text-pretty">
                          {finding.title}
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          <Badge variant={SEV[finding.severity]} className="text-[9px]">
                            {finding.severity}
                          </Badge>
                          <Badge variant="secondary" className="text-[9px]">
                            {fraudLabel(finding.fraudType)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                        {finding.amountInvolved != null ? (
                          <span className="text-xs font-semibold">
                            {eur(finding.amountInvolved)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="min-w-40 whitespace-normal px-3 py-2.5">
                        <CitationCell
                          citations={finding.citations}
                          docs={docs}
                          onView={onView}
                          limit={6}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        ) : null}

        {info && hasLineItems ? (
          <section>
            <SectionLabel>Evidence · {info.lineItems.length}</SectionLabel>
            <div className="overflow-hidden rounded-md border border-border">
              <Table className="text-[11px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-8 bg-muted/30 px-3 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                      Date / document
                    </TableHead>
                    <TableHead className="h-8 bg-muted/30 px-3 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                      Detail
                    </TableHead>
                    <TableHead className="h-8 bg-muted/30 px-3 text-right text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                      Amount
                    </TableHead>
                    <TableHead className="h-8 bg-muted/30 px-3 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                      Citations
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {info.lineItems.map((item) => (
                    <TableRow key={item.id} className="align-top">
                      <TableCell className="px-3 py-2.5 whitespace-nowrap">
                        <p className="text-xs text-foreground">{item.date ?? "—"}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {item.documentNumber ?? item.label}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-44 whitespace-normal px-3 py-2.5">
                        <p className="text-xs leading-snug text-foreground">
                          {item.counterparty ?? item.label}
                        </p>
                        {item.description ? (
                          <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground text-pretty">
                            {item.description}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-right whitespace-nowrap">
                        <p className="text-xs font-semibold tabular-nums">
                          {eur(item.amount)}
                        </p>
                        <p className="mt-0.5 text-[9px] tracking-wide text-muted-foreground uppercase">
                          {item.amountType}
                        </p>
                      </TableCell>
                      <TableCell className="min-w-40 whitespace-normal px-3 py-2.5">
                        <CitationCell
                          citations={item.citations}
                          docs={docs}
                          onView={onView}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        ) : null}

        {info && hasFacts ? (
          <section>
            <SectionLabel>Linked records · {info.facts.length}</SectionLabel>
            <div className="overflow-hidden rounded-md border border-border">
              <Table className="text-[11px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="h-8 bg-muted/30 px-3 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                      Date / document
                    </TableHead>
                    <TableHead className="h-8 bg-muted/30 px-3 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                      Detail
                    </TableHead>
                    <TableHead className="h-8 bg-muted/30 px-3 text-right text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                      Amount
                    </TableHead>
                    <TableHead className="h-8 bg-muted/30 px-3 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
                      Citations
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {info.facts.map((fact) => (
                    <TableRow key={fact.id} className="align-top">
                      <TableCell className="px-3 py-2.5 whitespace-nowrap">
                        <p className="text-xs text-foreground">{fact.date ?? "—"}</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">
                          {fact.docNumber ?? fact.kind.replace("_", " ")}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-44 whitespace-normal px-3 py-2.5">
                        <p className="text-xs leading-snug text-foreground">
                          {fact.description ?? fact.label ?? fact.kind.replace("_", " ")}
                        </p>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                        {fact.amount != null ? (
                          <span className="text-xs font-semibold">{eur(fact.amount)}</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="min-w-40 whitespace-normal px-3 py-2.5">
                        <CitationCell
                          citations={fact.citations}
                          docs={docs}
                          onView={onView}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        ) : null}
      </div>
    </AppDrawer>
  );
}
