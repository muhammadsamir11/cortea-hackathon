"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  CommandShortcut,
} from "@almedia/ui/components/command";
import { Tooltip, TooltipContent, TooltipTrigger } from "@almedia/ui/components/tooltip";
import { cn } from "@almedia/ui/lib/utils";
import { AlertTriangle, ArrowLeft, Download, FolderOpen, ShieldCheck } from "lucide-react";

import type { Citation } from "@almedia/forensic/types";
import type { DossierData } from "@/lib/audit-data";
import { AppDrawer } from "@/components/app-drawer";
import { WorkbenchShell } from "@/components/workbench-shell";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { AppSidebar, type WorkspaceTab } from "./app-sidebar";
import { verdictOf } from "./components";
import { ReportTab } from "./report-tab";
import { MoneyGraphView } from "./money-graph";
import { EvidenceViewer } from "./evidence-viewer";
import { DocumentsTab } from "./documents-tab";
import { InvestigatorTab } from "./investigator-tab";
import { TribunalTab } from "./tribunal-tab";
import { FindingDetail } from "./finding-detail";
import { clusterSchemes } from "./schemes";

function formatDossierLabel(slug: string) {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function Workspace({
  data,
  dossiers,
  activeNav,
  findingId,
  investigatorPrompt,
}: {
  data: DossierData;
  dossiers: string[];
  activeNav: WorkspaceTab;
  findingId?: string;
  investigatorPrompt?: string;
}) {
  const router = useRouter();
  const [viewer, setViewer] = useState<Citation | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const exportFn = useRef<(() => void) | null>(null);

  const integrity = (data.meta as { integrity?: { ok: boolean; checks: Array<{ ok: boolean }>; warnings: string[] } } | null)
    ?.integrity;
  const confirmed = data.findings.filter((finding) => verdictOf(finding) === "confirmed").length;
  const unreviewed = data.findings.filter((finding) => verdictOf(finding) === "unreviewed").length;
  const judgment = data.findings.filter((finding) => verdictOf(finding) === "needs-judgment").length;
  const companyName = typeof data.meta?.companyName === "string" ? data.meta.companyName : data.name;

  const { schemes, schemeOf } = useMemo(
    () => clusterSchemes(data.findings, data.entities, data.facts, data.graph.companyClusterId),
    [data],
  );
  const findingById = useMemo(() => new Map(data.findings.map((f) => [f.id, f])), [data.findings]);
  const selected = findingId ? (findingById.get(findingId) ?? null) : null;
  const selectedScheme = findingId ? schemes.find((s) => s.id === schemeOf.get(findingId)) ?? null : null;
  const siblings = selectedScheme
    ? selectedScheme.findingIds
        .filter((id) => id !== findingId)
        .map((id) => findingById.get(id)!)
        .filter(Boolean)
    : [];

  const listHref = `/audit/report?d=${encodeURIComponent(data.name)}` as "/audit/report";

  const switchDossier = (name: string) => {
    const params = new URLSearchParams();
    params.set("d", name);
    if (findingId) {
      router.push(`/audit/report?${params.toString()}`);
      return;
    }
    if (activeNav !== "findings") params.set("tab", activeNav);
    router.push(`/audit/report?${params.toString()}`);
  };

  const openFinding = (id: string) => {
    router.push(`/audit/report/${encodeURIComponent(id)}?d=${encodeURIComponent(data.name)}`);
  };

  const showFindingDetail = Boolean(findingId) && activeNav === "findings";

  return (
    <WorkbenchShell
      sidebar={
        <AppSidebar
          activeNav={activeNav}
          dossier={data.name}
          counts={{
            report: confirmed + judgment + unreviewed,
            documents: data.docs.length,
          }}
        />
      }
    >
      <WorkspacePageHeader
        title={
          <span className="flex w-full min-w-0 items-center gap-2">
            {showFindingDetail ? (
              <Button asChild variant="ghost" size="icon-sm" className="shrink-0" aria-label="Back to findings">
                <Link href={listHref}>
                  <ArrowLeft />
                </Link>
              </Button>
            ) : null}
            <span className="min-w-0 truncate">
              {showFindingDetail && selected ? selected.title : companyName}
            </span>
            {!showFindingDetail ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                aria-label="Switch dossier"
                onClick={() => setCommandOpen(true)}
              >
                <FolderOpen />
              </Button>
            ) : null}
          </span>
        }
        actions={
          <>
            {integrity && !showFindingDetail ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant={integrity.ok ? (integrity.warnings.length ? "warning" : "success") : "destructive"}
                    className="hidden max-w-88 lg:inline-flex"
                  >
                    {integrity.ok ? <ShieldCheck /> : <AlertTriangle />}{" "}
                    {integrity.checks.filter((check) => check.ok).length}/{integrity.checks.length} checks ·{" "}
                    {integrity.warnings.length} warning{integrity.warnings.length === 1 ? "" : "s"}
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-sm text-xs">
                  {integrity.warnings.join(" ") || "All required checks passed"}
                </TooltipContent>
              </Tooltip>
            ) : null}
            {!showFindingDetail ? (
              <Button
                onClick={() => exportFn.current?.()}
                variant="outline"
                size="sm"
                aria-label="Export report"
              >
                <Download />
                <span className="hidden sm:inline">Export</span>
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {showFindingDetail ? (
          <FindingDetail
            finding={selected}
            data={data}
            scheme={selectedScheme}
            siblings={siblings}
            onView={setViewer}
            onSelectFinding={openFinding}
          />
        ) : null}
        {activeNav === "findings" && !showFindingDetail ? (
          <ReportTab
            data={data}
            registerExport={(fn) => {
              exportFn.current = fn;
            }}
          />
        ) : null}
        {activeNav === "graph" && <MoneyGraphView data={data} onView={setViewer} />}
        {activeNav === "documents" && (
          <div className="h-full min-h-0 overflow-y-auto">
            <DocumentsTab data={data} onView={setViewer} />
          </div>
        )}
        {activeNav === "ask" && (
          <InvestigatorTab data={data} onView={setViewer} seedPrompt={investigatorPrompt} />
        )}
        {activeNav === "tribunal" && <TribunalTab data={data} />}
      </div>

      <AppDrawer
        open={Boolean(viewer)}
        onOpenChange={(open) => !open && setViewer(null)}
        size="lg"
        title={
          <span className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
            Evidence
          </span>
        }
        description="Source for the selected claim"
        bodyClassName="overflow-hidden"
      >
        {viewer ? (
          <EvidenceViewer
            key={`${viewer.docId}|${viewer.ref}|${viewer.quote}`}
            citation={viewer}
            data={data}
          />
        ) : null}
      </AppDrawer>

      <CommandDialog
        open={commandOpen}
        onOpenChange={setCommandOpen}
        title="Switch dossier"
        description="Open another sealed dossier"
      >
        <Command>
          <div className="border-b px-3 py-3">
            <p className="font-mono text-[0.6875rem] uppercase tracking-wider text-muted-foreground">
              Dossiers
            </p>
            <p className="mt-0.5 text-sm text-foreground">Open another sealed case</p>
          </div>
          {dossiers.length > 4 ? (
            <CommandInput placeholder="Filter by name…" />
          ) : null}
          <CommandList className="max-h-80 p-1">
            <CommandEmpty className="py-8 text-muted-foreground">
              No matching dossier.
            </CommandEmpty>
            <CommandGroup className="**:[[cmdk-group-items]]:flex **:[[cmdk-group-items]]:flex-col **:[[cmdk-group-items]]:gap-y-1">
              {dossiers.map((dossier) => {
                const active = dossier === data.name;
                const label =
                  active && companyName !== dossier
                    ? companyName
                    : formatDossierLabel(dossier);
                return (
                  <CommandItem
                    key={dossier}
                    value={`${label} ${dossier}`}
                    data-checked={active || undefined}
                    onSelect={() => {
                      setCommandOpen(false);
                      if (!active) switchDossier(dossier);
                    }}
                    className={cn(
                      "min-h-12 items-start gap-3 rounded-lg py-2.5",
                      active && "bg-muted/70 data-selected:bg-muted/70",
                    )}
                  >
                    <FolderOpen className="mt-0.5 size-4 text-muted-foreground" />
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate font-medium leading-snug">{label}</span>
                      <span className="truncate font-mono text-[0.6875rem] text-muted-foreground">
                        {dossier}
                      </span>
                    </span>
                    {active ? <CommandShortcut>Open</CommandShortcut> : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          <div className="border-t px-3 py-2">
            <p className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground">
              {dossiers.length} available
            </p>
          </div>
        </Command>
      </CommandDialog>
    </WorkbenchShell>
  );
}
