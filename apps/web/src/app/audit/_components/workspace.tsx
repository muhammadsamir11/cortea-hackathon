"use client";

import { useMemo, useRef, useState } from "react";
import { Badge } from "@almedia/ui/components/badge";
import { Button } from "@almedia/ui/components/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@almedia/ui/components/sheet";
import { Slider } from "@almedia/ui/components/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@almedia/ui/components/tabs";
import { AlertTriangle, Download, FileSearch, Files, MessageSquareText, Network, ShieldCheck } from "lucide-react";
import Link from "next/link";

import type { Citation } from "@almedia/forensic/types";
import type { DossierData } from "@/lib/audit-data";
import { eur, verdictOf } from "./components";
import { ReportTab } from "./report-tab";
import { MoneyGraphView } from "./money-graph";
import { EvidenceViewer } from "./evidence-viewer";
import { DocumentsTab } from "./documents-tab";
import { ChatTab } from "./chat-tab";

type Tab = "findings" | "graph" | "documents" | "ask";

const TAB_ICON = {
  findings: FileSearch,
  graph: Network,
  documents: Files,
  ask: MessageSquareText,
} satisfies Record<Tab, typeof FileSearch>;

export function Workspace({ data, dossiers }: { data: DossierData; dossiers: string[] }) {
  const [tab, setTab] = useState<Tab>("findings");
  const [viewer, setViewer] = useState<Citation | null>(null);
  const [materiality, setMateriality] = useState(0);
  const exportFn = useRef<(() => void) | null>(null);

  const integrity = (data.meta as { integrity?: { ok: boolean; checks: Array<{ ok: boolean }>; warnings: string[] } } | null)
    ?.integrity;
  const maxAmount = useMemo(
    () => Math.max(0, ...data.findings.map((finding) => finding.amountInvolved ?? 0)),
    [data.findings],
  );
  const confirmed = data.findings.filter((finding) => verdictOf(finding) === "confirmed").length;
  const unreviewed = data.findings.filter((finding) => verdictOf(finding) === "unreviewed").length;
  const judgment = data.findings.filter((finding) => verdictOf(finding) === "needs-judgment").length;
  const acquitted = data.findings.filter((finding) => verdictOf(finding) === "acquitted").length;

  const tabs: { id: Tab; label: string; short: string }[] = [
    { id: "findings", label: `Report (${confirmed + judgment + unreviewed})`, short: "Report" },
    { id: "graph", label: "Risk graph", short: "Graph" },
    { id: "documents", label: `Documents (${data.docs.length})`, short: "Docs" },
    { id: "ask", label: "Ask", short: "Ask" },
  ];

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-background text-foreground">
      {/* Instrument top bar */}
      <header className="flex min-w-0 flex-wrap items-center gap-2 border-b border-border px-3 py-2 sm:px-4">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          <span className="mr-1 shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Dossier
          </span>
          {dossiers.map((dossier) => (
            <Button
              key={dossier}
              asChild
              variant={dossier === data.name ? "secondary" : "ghost"}
              size="xs"
              className="font-mono"
              aria-current={dossier === data.name ? "page" : undefined}
            >
              <Link href={`/audit?d=${dossier}`}>{dossier}</Link>
            </Button>
          ))}
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-2">
          {integrity && (
            <Badge
              variant={integrity.ok ? (integrity.warnings.length ? "warning" : "success") : "destructive"}
              title={integrity.warnings.join(" ") || "All required integrity checks passed"}
              className="hidden max-w-[22rem] font-mono lg:inline-flex"
            >
              {integrity.ok ? <ShieldCheck /> : <AlertTriangle />} {integrity.checks.filter((check) => check.ok).length}/{integrity.checks.length} checks · {integrity.warnings.length} warnings
            </Badge>
          )}
          <dl className="hidden items-center gap-3 font-mono text-[11px] xl:flex">
            <div className="flex gap-1">
              <dt className="text-muted-foreground">C</dt>
              <dd className="font-medium text-destructive">{confirmed}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-muted-foreground">U</dt>
              <dd className="font-medium text-warn">{unreviewed}</dd>
            </div>
            <div className="flex gap-1">
              <dt className="text-muted-foreground">A</dt>
              <dd className="font-medium text-clear">{acquitted}</dd>
            </div>
          </dl>
          <Button
            onClick={() => exportFn.current?.()}
            variant="outline"
            size="sm"
            className="font-mono"
            aria-label="Export report"
          >
            <Download />
            <span className="hidden sm:inline">Export</span>
          </Button>
        </div>
      </header>

      {integrity && (!integrity.ok || integrity.warnings.length > 0) && (
        <div
          className={`flex items-start gap-2 border-b px-3 py-2 font-mono text-[11px] ${
            integrity.ok
              ? "border-warn/30 bg-warn/10 text-warn"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {integrity.ok
              ? integrity.warnings.join(" ")
              : "Required ingestion integrity checks failed. Re-run ingestion and inspect the completeness report."}
          </span>
        </div>
      )}

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as Tab)}
        orientation="vertical"
        className="flex min-h-0 min-w-0 flex-1 flex-row gap-0"
      >
        {/* Side rail */}
        <div className="flex w-14 shrink-0 flex-col border-r border-border bg-muted/40 sm:w-36">
          <TabsList
            variant="line"
            className="h-auto w-full flex-col items-stretch gap-0 rounded-none bg-transparent p-0"
          >
            {tabs.map((item) => {
              const Icon = TAB_ICON[item.id];
              return (
                <TabsTrigger
                  key={item.id}
                  value={item.id}
                  className="h-auto justify-center gap-2 rounded-none border-0 border-l-2 border-transparent px-2 py-3 font-mono text-[11px] data-[state=active]:border-l-cortea data-[state=active]:bg-background data-[state=active]:shadow-none sm:justify-start sm:px-3"
                >
                  <Icon className="size-3.5 shrink-0" />
                  <span className="hidden sm:inline">{item.short}</span>
                  <span className="sr-only sm:hidden">{item.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
          {tab === "findings" && maxAmount > 0 && (
            <div className="mt-auto hidden space-y-2 border-t border-border p-3 sm:block">
              <label className="block font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Materiality ≥ {eur(materiality)}
              </label>
              <Slider
                aria-label="Materiality threshold"
                min={0}
                max={maxAmount}
                step={Math.max(100, Math.round(maxAmount / 100))}
                value={[materiality]}
                onValueChange={(value) => setMateriality(value[0] ?? 0)}
              />
            </div>
          )}
        </div>

        <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
          <TabsContent value="findings" className="mt-0 h-full min-h-0">
            <ReportTab
              data={data}
              materiality={materiality}
              onView={setViewer}
              registerExport={(fn) => {
                exportFn.current = fn;
              }}
            />
          </TabsContent>
          <TabsContent value="graph" className="mt-0 h-full">
            <MoneyGraphView data={data} onView={setViewer} />
          </TabsContent>
          <TabsContent value="documents" className="mt-0 h-full overflow-y-auto">
            <DocumentsTab data={data} onView={setViewer} />
          </TabsContent>
          <TabsContent value="ask" className="mt-0 h-full">
            <ChatTab data={data} onView={setViewer} />
          </TabsContent>
        </main>
      </Tabs>

      <Sheet open={Boolean(viewer)} onOpenChange={(open) => !open && setViewer(null)}>
        <SheetContent className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:w-[min(42rem,90vw)] data-[side=right]:sm:max-w-none" showCloseButton>
          <SheetHeader className="space-y-1 border-b border-border p-4 text-left">
            <SheetTitle className="flex items-center gap-2 font-heading text-base tracking-tight">
              <span className="size-1.5 rounded-full bg-cortea" aria-hidden />
              Evidence
            </SheetTitle>
            <SheetDescription className="font-mono text-[11px]">
              Machine-verifiable source for the selected claim
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-hidden">
            {viewer && (
              <EvidenceViewer
                key={`${viewer.docId}|${viewer.ref}|${viewer.quote}`}
                citation={viewer}
                data={data}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
