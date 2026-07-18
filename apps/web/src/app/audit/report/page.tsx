import { listDossiers, loadDossier } from "@/lib/audit-data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@almedia/ui/components/card";
import { Separator } from "@almedia/ui/components/separator";
import { WorkbenchShell } from "@/components/workbench-shell";
import { WorkspacePageHeader } from "@/components/workspace-page-header";
import { Workspace } from "../_components/workspace";
import { AppSidebarBrand, type WorkspaceTab } from "../_components/app-sidebar";
import { isAiConfigured } from "@almedia/forensic/llm";

export const dynamic = "force-dynamic";

const TABS: WorkspaceTab[] = ["findings", "graph", "documents", "ask", "tribunal"];

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
        <WorkspacePageHeader
          title="Setup"
          description="Add and analyze a dossier to open Cortea."
        />
        <div className="min-h-0 flex-1 overflow-auto p-4 lg:p-6">
          <main className="flex justify-center">
            <Card className="w-full max-w-md">
              <CardHeader className="border-b">
                <CardTitle>No dossier yet</CardTitle>
                <CardDescription>
                  Put files in a local folder, then run ingest and analyze.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-muted-foreground text-sm">
                <p>
                  1. Drop documents into <code className="text-primary">dossier/&lt;name&gt;/</code>
                </p>
                <Separator />
                <p>
                  2. <code className="text-primary">pnpm ingest &lt;name&gt;</code>
                </p>
                <Separator />
                <p>
                  3. <code className="text-primary">pnpm analyze &lt;name&gt;</code>
                </p>
              </CardContent>
            </Card>
          </main>
        </div>
      </WorkbenchShell>
    );
  }
  return <Workspace data={data} dossiers={dossiers} activeNav={tabFromParam(tab)} />;
}
