"use client";

import { SidebarTrigger } from "@almedia/ui/components/sidebar";

import { ThemeToggle } from "./theme-toggle";

/**
 * Single workbench header: sidebar trigger, page title, actions, theme toggle.
 */
export function WorkspacePageHeader({
  actions,
  description,
  title,
}: {
  actions?: React.ReactNode;
  description?: React.ReactNode;
  title: React.ReactNode;
}) {
  return (
    <header className="flex shrink-0 flex-col gap-3 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between lg:px-6">
      <div className="flex min-w-0 flex-1 items-start gap-2 sm:items-center">
        <SidebarTrigger className="mt-0.5 shrink-0 sm:mt-0" />
        <div className="min-w-0 flex-1 max-w-md overflow-hidden">
          <h1 className="min-w-0 truncate  font-semibold text-xl tracking-tight">
            {title}
          </h1>
          {description ? (
            <p className="mt-1 max-w-2xl truncate text-muted-foreground text-sm">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        {actions}
        <ThemeToggle />
      </div>
    </header>
  );
}
