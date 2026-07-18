import { listDossiers, loadDossier } from "@/lib/audit-data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@almedia/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@almedia/ui/components/empty";
import { Separator } from "@almedia/ui/components/separator";
import { WorkbenchShell } from "@/components/workbench-shell";
import { Workspace } from "./_components/workspace";
import { AppSidebarBrand, type WorkspaceTab } from "./_components/app-sidebar";
import { isAiConfigured } from "@almedia/forensic/llm";

export const dynamic = "force-dynamic";

const TABS: WorkspaceTab[] = ["findings", "graph", "documents", "ask"];

function tabFromParam(value: string | undefined): WorkspaceTab {
  return value && TABS.includes(value as WorkspaceTab) ? (value as WorkspaceTab) : "findings";
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; tab?: string }>;
}) {
  const { d, tab } = await searchParams;
  const dossiers = listDossiers();
  const name = d && dossiers.includes(d) ? d : (dossiers[0] ?? null);
  const data = name ? loadDossier(name) : null;
  if (data) data.meta = { ...(data.meta ?? {}), aiAvailable: isAiConfigured() };

  if (!data) {
    return (
      <WorkbenchShell sidebar={<AppSidebarBrand />}>
        <main className="flex h-full items-center justify-center p-4">
          <Card className="w-full max-w-md gap-0 border-border shadow-none">
            <CardHeader className="border-b border-border">
              <Empty className="border-0 p-0">
                <EmptyHeader className="items-start text-left">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Setup</p>
                  <EmptyTitle className="font-heading text-xl tracking-tight">No dossier data yet</EmptyTitle>
                  <EmptyDescription>
                    Add and analyze a dossier before opening the Cortea workbench.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
              <CardTitle className="sr-only">No dossier data yet</CardTitle>
              <CardDescription className="sr-only">
                Add and analyze a dossier before opening the Cortea workbench.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 py-4 font-mono text-xs text-muted-foreground">
              <p>
                1. Drop documents into{" "}
                <code className="text-clear">dossier/&lt;name&gt;/</code>
              </p>
              <Separator />
              <p>
                2. <code className="text-clear">pnpm ingest &lt;name&gt;</code>
              </p>
              <Separator />
              <p>
                3. <code className="text-clear">pnpm analyze &lt;name&gt;</code>
              </p>
            </CardContent>
          </Card>
        </main>
      </WorkbenchShell>
    );
  }
  return <Workspace data={data} dossiers={dossiers} tab={tabFromParam(tab)} />;
}
