"use client";

import Link from "next/link";
import { Badge } from "@almedia/ui/components/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
  useSidebar,
} from "@almedia/ui/components/sidebar";
import { Button } from "@almedia/ui/components/button";
import { Slider } from "@almedia/ui/components/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@almedia/ui/components/tooltip";
import { FileSearch, Files, MessageSquareText, Network, SlidersHorizontal } from "lucide-react";

import { CorteaLogo, CorteaMark } from "@/components/cortea-logo";
import { eur } from "./components";

export type WorkspaceTab = "findings" | "graph" | "documents" | "ask";

/** Compact cash for range ticks in the narrow rail. */
function compactEur(n: number) {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `€${Math.round(n / 1_000)}k`;
  return `€${Math.round(n)}`;
}

const NAV: {
  id: WorkspaceTab;
  label: string;
  shortLabel: string;
  icon: typeof FileSearch;
  countKey?: "report" | "documents";
}[] = [
  { id: "findings", label: "Report", shortLabel: "Report", icon: FileSearch, countKey: "report" },
  { id: "graph", label: "Graph", shortLabel: "Graph", icon: Network },
  { id: "documents", label: "Documents", shortLabel: "Docs", icon: Files, countKey: "documents" },
  { id: "ask", label: "Ask", shortLabel: "Ask", icon: MessageSquareText },
];

function SidebarBrandHeader() {
  return (
    <SidebarHeader className="h-14 justify-center border-b border-sidebar-border/80">
      <div className="flex min-w-0 items-center gap-2 px-1 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
        <Link
          href="/audit"
          className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden rounded-md outline-none ring-sidebar-ring focus-visible:ring-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-0"
          aria-label="Cortea audit workspace"
        >
          <CorteaMark className="hidden size-5 shrink-0 text-primary group-data-[collapsible=icon]:block" />
          <CorteaLogo className="h-[18px] w-auto text-primary group-data-[collapsible=icon]:hidden" />
        </Link>
        <Badge
          variant="secondary"
          className="h-5 shrink-0 border-primary/15 bg-primary/10 px-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-primary group-data-[collapsible=icon]:hidden"
        >
          Workbench
        </Badge>
      </div>
    </SidebarHeader>
  );
}

export function AppSidebar({
  tab,
  dossier,
  materiality,
  onMaterialityChange,
  maxAmount,
  counts,
}: {
  tab: WorkspaceTab;
  dossier: string;
  materiality: number;
  onMaterialityChange: (value: number) => void;
  maxAmount: number;
  counts: { report: number; documents: number };
}) {
  const { isMobile, setOpen, setOpenMobile } = useSidebar();

  const hrefFor = (next: WorkspaceTab) => {
    const params = new URLSearchParams();
    params.set("d", dossier);
    if (next !== "findings") params.set("tab", next);
    return `/audit?${params.toString()}` as "/audit";
  };

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarBrandHeader />

      <SidebarContent>
        <nav aria-label="Workbench tools">
          <SidebarGroup className="pt-2">
            <SidebarGroupLabel className="mb-1 h-auto px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Tools
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="gap-1">
                {NAV.map((item) => {
                  const Icon = item.icon;
                  const count = item.countKey ? counts[item.countKey] : undefined;
                  const tooltip =
                    count !== undefined ? `${item.label} (${count})` : item.label;
                  const active = tab === item.id;
                  return (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={tooltip}
                        className="h-9 rounded-lg font-mono text-[12px] text-sidebar-foreground/75 transition-colors duration-150 hover:bg-primary/8 hover:text-sidebar-foreground data-active:bg-primary/15 data-active:font-medium data-active:text-primary data-active:hover:bg-primary/20 data-active:hover:text-primary"
                      >
                        <Link
                          href={hrefFor(item.id)}
                          aria-label={tooltip}
                          aria-current={active ? "page" : undefined}
                          onClick={() => {
                            if (isMobile) setOpenMobile(false);
                          }}
                        >
                          <Icon strokeWidth={active ? 2.25 : 1.75} />
                          <span>{item.shortLabel}</span>
                        </Link>
                      </SidebarMenuButton>
                      {count !== undefined && count > 0 && (
                        <SidebarMenuBadge className="right-2 font-mono text-[10px] tabular-nums text-muted-foreground peer-data-active/menu-button:text-primary">
                          {count}
                        </SidebarMenuBadge>
                      )}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </nav>
      </SidebarContent>

      {tab === "findings" && maxAmount > 0 && (
        <>
          <SidebarSeparator className="mx-3" />
          <SidebarFooter>
            {/* Expanded: instrument control */}
            <div className="space-y-2.5 px-1 pb-1 group-data-[collapsible=icon]:hidden">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Materiality
                  </p>
                  <p
                    id="materiality-value"
                    className={`mt-0.5 font-mono text-[13px] font-medium tabular-nums tracking-tight ${
                      materiality > 0 ? "text-primary" : "text-sidebar-foreground"
                    }`}
                  >
                    ≥ {eur(materiality)}
                  </p>
                </div>
                {materiality > 0 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    className="shrink-0 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground hover:text-sidebar-foreground"
                    onClick={() => onMaterialityChange(0)}
                  >
                    Reset
                  </Button>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <Slider
                  id="materiality-threshold"
                  aria-label="Materiality threshold"
                  aria-describedby="materiality-value materiality-hint"
                  min={0}
                  max={maxAmount}
                  step={Math.max(100, Math.round(maxAmount / 100))}
                  value={[materiality]}
                  onValueChange={(value) => onMaterialityChange(value[0] ?? 0)}
                />
                <div className="flex items-center justify-between gap-2 font-mono text-[9px] tabular-nums text-muted-foreground">
                  <span>{compactEur(0)}</span>
                  <span>{compactEur(maxAmount)}</span>
                </div>
              </div>
              <p id="materiality-hint" className="sr-only">
                Hide findings below this cash amount from the Report list.
              </p>
            </div>

            {/* Collapsed: opens rail so the slider is reachable */}
            <div className="hidden justify-center group-data-[collapsible=icon]:flex">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className={
                      materiality > 0
                        ? "relative text-primary hover:text-primary"
                        : "relative text-sidebar-foreground/70 hover:text-sidebar-foreground"
                    }
                    aria-label={`Materiality ≥ ${eur(materiality)}. Expand sidebar to adjust.`}
                    onClick={() => setOpen(true)}
                  >
                    <SlidersHorizontal />
                    {materiality > 0 ? (
                      <span
                        className="absolute top-1 right-1 size-1.5 rounded-full bg-primary"
                        aria-hidden
                      />
                    ) : null}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-52 font-mono text-xs">
                  <span className="block text-muted-foreground">Materiality filter</span>
                  <span className="tabular-nums">≥ {eur(materiality)}</span>
                  <span className="mt-1 block text-muted-foreground">Click to expand and adjust</span>
                </TooltipContent>
              </Tooltip>
            </div>
          </SidebarFooter>
        </>
      )}
      <SidebarRail />
    </Sidebar>
  );
}

/** Brand-only sidebar for empty / setup states (same inset chrome, no tools). */
export function AppSidebarBrand() {
  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarBrandHeader />
      <SidebarContent />
      <SidebarRail />
    </Sidebar>
  );
}
