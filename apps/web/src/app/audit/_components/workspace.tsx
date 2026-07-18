"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription, AlertTitle } from "@almedia/ui/components/alert";
import { Badge } from "@almedia/ui/components/badge";
import { Button } from "@almedia/ui/components/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@almedia/ui/components/command";
import { Kbd } from "@almedia/ui/components/kbd";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@almedia/ui/components/select";
import { Separator } from "@almedia/ui/components/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@almedia/ui/components/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@almedia/ui/components/tooltip";
import { AlertTriangle, Check, Download, FolderOpen, ShieldCheck } from "lucide-react";

import type { Citation } from "@almedia/forensic/types";
import type { DossierData } from "@/lib/audit-data";
import { WorkbenchShell } from "@/components/workbench-shell";
import { AppSidebar, type WorkspaceTab } from "./app-sidebar";
import { verdictOf } from "./components";
import { ReportTab } from "./report-tab";
import { MoneyGraphView } from "./money-graph";
import { EvidenceViewer } from "./evidence-viewer";
import { DocumentsTab } from "./documents-tab";
import { ChatTab } from "./chat-tab";

export function Workspace({
  data,
  dossiers,
  tab,
}: {
  data: DossierData;
  dossiers: string[];
  tab: WorkspaceTab;
}) {
  const router = useRouter();
  const [viewer, setViewer] = useState<Citation | null>(null);
  const [materiality, setMateriality] = useState(0);
  const [commandOpen, setCommandOpen] = useState(false);
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
  const companyName = typeof data.meta?.companyName === "string" ? data.meta.companyName : data.name;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const switchDossier = (name: string) => {
    const params = new URLSearchParams();
    params.set("d", name);
    if (tab !== "findings") params.set("tab", tab);
    router.push(`/audit?${params.toString()}`);
  };

  return (
    <WorkbenchShell
      sidebar={
        <AppSidebar
          tab={tab}
          dossier={data.name}
          materiality={materiality}
          onMaterialityChange={setMateriality}
          maxAmount={maxAmount}
          counts={{
            report: confirmed + judgment + unreviewed,
            documents: data.docs.length,
          }}
        />
      }
      header={
        <>
          <Separator orientation="vertical" className="hidden h-4 sm:block" />

          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
            <span className="hidden shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground sm:inline">
              Dossier
            </span>
            {dossiers.length > 1 ? (
              <Select value={data.name} onValueChange={switchDossier}>
                <SelectTrigger size="sm" className="max-w-56 font-mono" aria-label="Switch dossier">
                  <SelectValue placeholder={companyName} />
                </SelectTrigger>
                <SelectContent className="font-mono">
                  {dossiers.map((dossier) => (
                    <SelectItem key={dossier} value={dossier}>
                      {dossier}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="truncate font-mono text-xs text-foreground">{companyName}</span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="hidden sm:inline-flex"
              aria-label="Open dossier command palette"
              onClick={() => setCommandOpen(true)}
            >
              <FolderOpen />
            </Button>
            <Kbd className="hidden font-mono lg:inline-flex">⌘K</Kbd>
          </div>

          <div className="flex min-w-0 shrink-0 items-center gap-2">
            {integrity && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant={integrity.ok ? (integrity.warnings.length ? "warning" : "success") : "destructive"}
                    className="hidden max-w-[22rem] font-mono lg:inline-flex"
                  >
                    {integrity.ok ? <ShieldCheck /> : <AlertTriangle />}{" "}
                    {integrity.checks.filter((check) => check.ok).length}/{integrity.checks.length} checks ·{" "}
                    {integrity.warnings.length} warnings
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm font-mono text-xs">
                  {integrity.warnings.join(" ") || "All required integrity checks passed"}
                </TooltipContent>
              </Tooltip>
            )}
            <dl className="hidden items-center gap-2 font-mono text-[11px] xl:flex">
              <div className="flex gap-1">
                <dt className="text-muted-foreground">C</dt>
                <dd className="font-medium text-destructive">{confirmed}</dd>
              </div>
              <Separator orientation="vertical" className="h-3" />
              <div className="flex gap-1">
                <dt className="text-muted-foreground">U</dt>
                <dd className="font-medium text-warn">{unreviewed}</dd>
              </div>
              <Separator orientation="vertical" className="h-3" />
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
        </>
      }
    >
      {integrity && (!integrity.ok || integrity.warnings.length > 0) && (
        <Alert
          variant={integrity.ok ? "default" : "destructive"}
          className={`shrink-0 rounded-none border-x-0 border-t-0 ${
            integrity.ok ? "border-warn/30 bg-warn/10 text-warn" : ""
          }`}
        >
          <AlertTriangle />
          <AlertTitle className="font-mono text-[11px] uppercase tracking-[0.14em]">
            {integrity.ok ? "Integrity warnings" : "Integrity checks failed"}
          </AlertTitle>
          <AlertDescription className="font-mono text-[11px]">
            {integrity.ok
              ? integrity.warnings.join(" ")
              : "Required ingestion integrity checks failed. Re-run ingestion and inspect the completeness report."}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {tab === "findings" && (
          <ReportTab
            data={data}
            materiality={materiality}
            onView={setViewer}
            registerExport={(fn) => {
              exportFn.current = fn;
            }}
          />
        )}
        {tab === "graph" && <MoneyGraphView data={data} onView={setViewer} />}
        {tab === "documents" && (
          <div className="h-full min-h-0 overflow-y-auto">
            <DocumentsTab data={data} onView={setViewer} />
          </div>
        )}
        {tab === "ask" && <ChatTab data={data} onView={setViewer} />}
      </div>

      <Sheet open={Boolean(viewer)} onOpenChange={(open) => !open && setViewer(null)}>
        <SheetContent
          className="gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:w-[min(42rem,90vw)] data-[side=right]:sm:max-w-none"
          showCloseButton
        >
          <SheetHeader className="space-y-1 border-b border-border p-4 text-left">
            <SheetTitle className="flex items-center gap-2 font-heading text-base tracking-tight">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden />
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

      <CommandDialog open={commandOpen} onOpenChange={setCommandOpen} title="Switch dossier" description="Jump to another analyzed dossier">
        <Command>
          <CommandInput placeholder="Search dossiers…" className="font-mono" />
          <CommandList>
            <CommandEmpty>No dossier found.</CommandEmpty>
            <CommandGroup heading="Dossiers">
              {dossiers.map((dossier) => (
                <CommandItem
                  key={dossier}
                  value={dossier}
                  className="font-mono"
                  onSelect={() => {
                    setCommandOpen(false);
                    switchDossier(dossier);
                  }}
                >
                  <FolderOpen />
                  <span className="truncate">{dossier}</span>
                  {dossier === data.name && <Check className="ml-auto size-3.5" />}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </WorkbenchShell>
  );
}
