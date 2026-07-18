import { listDossiers, loadDossier } from "@/lib/audit-data";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@almedia/ui/components/card";
import { Workspace } from "./_components/workspace";
import { isAiConfigured } from "@almedia/forensic/llm";

export const dynamic = "force-dynamic";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const { d } = await searchParams;
  const dossiers = listDossiers();
  const name = d && dossiers.includes(d) ? d : (dossiers[0] ?? null);
  const data = name ? loadDossier(name) : null;
  if (data) data.meta = { ...(data.meta ?? {}), aiAvailable: isAiConfigured() };

  if (!data) {
    return (
      <main className="flex h-full items-center justify-center p-4">
        <Card className="w-full max-w-md gap-0 border-border shadow-none">
          <CardHeader className="border-b border-border">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Setup</p>
            <CardTitle className="font-heading text-xl tracking-tight">No dossier data yet</CardTitle>
            <CardDescription>
              Add and analyze a dossier before opening the Cortea workbench.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 py-4 font-mono text-xs text-muted-foreground">
            <p>
              1. Drop documents into{" "}
              <code className="text-clear">dossier/&lt;name&gt;/</code>
            </p>
            <p>
              2. <code className="text-clear">pnpm ingest &lt;name&gt;</code>
            </p>
            <p>
              3. <code className="text-clear">pnpm analyze &lt;name&gt;</code>
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }
  return <Workspace data={data} dossiers={dossiers} />;
}
