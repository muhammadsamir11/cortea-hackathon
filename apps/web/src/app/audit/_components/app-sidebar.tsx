"use client";

import Link from "next/link";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@almedia/ui/components/sidebar";
import { FileSearch, Files, Gavel, Network, ScanSearch } from "lucide-react";

import { CorteaLogo, CorteaMark } from "@/components/cortea-logo";
import { GridShimmeringDots } from "@/components/visuals/grid-shimmering-dots";

export type WorkspaceTab = "findings" | "graph" | "documents" | "ask" | "tribunal";

type NavItem = {
  id: WorkspaceTab;
  label: string;
  icon: typeof FileSearch;
  countKey?: "report" | "documents";
};

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Analysis",
    items: [
      { id: "findings", label: "Report", icon: FileSearch, countKey: "report" },
      { id: "graph", label: "Graph", icon: Network },
    ],
  },
  {
    label: "Assist",
    items: [
      { id: "tribunal", label: "Review", icon: Gavel },
      { id: "ask", label: "Investigator", icon: ScanSearch },
    ],
  },
  {
    label: "Workspace",
    items: [
      { id: "documents", label: "Documents", icon: Files, countKey: "documents" },
    ],
  },
];

function SidebarGridBackground() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 bottom-0 z-0 h-[28rem] overflow-hidden mask-[radial-gradient(ellipse_at_bottom_left,black_25%,transparent_70%)]"
    >
      <GridShimmeringDots
        colors={["#525252", "#737373", "#a3a3a3"]}
        dotSize={2.5}
        gap={18}
        opacity={0.55}
        speed={70}
      />
    </div>
  );
}

function SidebarBrandHeader({ dossier }: { dossier?: string }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const homeHref = (dossier
    ? `/audit/report?d=${encodeURIComponent(dossier)}`
    : "/audit/report") as "/audit/report";

  return (
    <SidebarHeader className="h-14 justify-center">
      <div
        className={
          collapsed
            ? "flex min-w-0 items-center justify-center gap-2 px-0"
            : "flex min-w-0 items-center gap-2 px-2"
        }
      >
        {collapsed ? (
          <Link href={homeHref} aria-label="Cortea audit workspace">
            <CorteaMark className="size-6 text-foreground" />
          </Link>
        ) : (
          <Link href={homeHref} className="flex min-w-0 items-center" aria-label="Cortea audit workspace">
            <CorteaLogo className="h-5 w-auto text-foreground" />
          </Link>
        )}
      </div>
    </SidebarHeader>
  );
}

export function AppSidebar({
  activeNav,
  dossier,
  counts,
}: {
  activeNav: WorkspaceTab;
  dossier: string;
  counts: { report: number; documents: number };
}) {
  const { isMobile, setOpenMobile } = useSidebar();

  const hrefFor = (next: WorkspaceTab) => {
    const params = new URLSearchParams();
    params.set("d", dossier);
    if (next !== "findings") params.set("tab", next);
    return `/audit/report?${params.toString()}` as "/audit/report";
  };

  const closeMobile = () => {
    if (isMobile) setOpenMobile(false);
  };

  return (
    <Sidebar collapsible="icon" variant="inset">
      <div className="relative flex size-full min-h-0 flex-col overflow-hidden">
        <SidebarBrandHeader dossier={dossier} />

        <SidebarContent className="relative z-10">
          <nav aria-label="Workspace tools">
            {NAV_GROUPS.map((group) => (
              <SidebarGroup key={group.label}>
                <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const count = item.countKey ? counts[item.countKey] : undefined;
                      const tooltip =
                        count !== undefined ? `${item.label} (${count})` : item.label;
                      const active = activeNav === item.id;
                      return (
                        <SidebarMenuItem key={item.id}>
                          <SidebarMenuButton asChild isActive={active} tooltip={tooltip}>
                            <Link
                              href={hrefFor(item.id)}
                              aria-label={tooltip}
                              aria-current={active ? "page" : undefined}
                              onClick={closeMobile}
                            >
                              <Icon />
                              <span>{item.label}</span>
                            </Link>
                          </SidebarMenuButton>
                          {count !== undefined && count > 0 ? (
                            <SidebarMenuBadge>{count}</SidebarMenuBadge>
                          ) : null}
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            ))}
          </nav>
        </SidebarContent>

        <SidebarGridBackground />
      </div>
    </Sidebar>
  );
}

export function AppSidebarBrand() {
  return (
    <Sidebar collapsible="icon" variant="inset">
      <div className="relative flex size-full min-h-0 flex-col overflow-hidden">
        <SidebarBrandHeader />
        <SidebarContent className="relative z-10" />
        <SidebarGridBackground />
      </div>
    </Sidebar>
  );
}
