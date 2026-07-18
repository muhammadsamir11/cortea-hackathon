"use client";

import {
  SidebarInset,
  SidebarProvider,
} from "@almedia/ui/components/sidebar";

/**
 * Circle-style inset shell: sidebar on bg-sidebar, content floats as a
 * rounded bordered card. Page chrome (trigger, title, actions) lives in
 * WorkspacePageHeader so there is a single header bar.
 */
export function WorkbenchShell({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider className="h-svh overflow-hidden">
      {sidebar}
      <SidebarInset className="min-h-0 min-w-0 overflow-hidden md:border" id="main-content">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
