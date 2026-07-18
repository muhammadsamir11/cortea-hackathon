"use client";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@almedia/ui/components/sidebar";

import { ModeToggle } from "./mode-toggle";

/**
 * Circle-style inset shell: sidebar on bg-sidebar, content floats as a rounded card
 * with a slim top bar (trigger + optional chrome + theme toggle).
 */
export function WorkbenchShell({
  sidebar,
  header,
  children,
  sidebarWidth = "12rem",
}: {
  sidebar: React.ReactNode;
  /** Extra header chrome between SidebarTrigger and theme toggle (dossier, status, actions). */
  header?: React.ReactNode;
  children: React.ReactNode;
  sidebarWidth?: string;
}) {
  return (
    <SidebarProvider
      className="h-svh overflow-hidden"
      style={
        {
          "--sidebar-width": sidebarWidth,
          "--sidebar-width-icon": "3.25rem",
        } as React.CSSProperties
      }
    >
      {sidebar}
      <SidebarInset className="min-h-0 min-w-0 overflow-hidden md:border" id="main-content">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          {header ?? <div className="min-w-0 flex-1" />}
          <ModeToggle />
        </header>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
