import { listRecordTables, loadDossier } from "@/lib/audit-data";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const dossier = loadDossier(name);
  if (!dossier) return Response.json({ error: "Dossier not found" }, { status: 404 });
  return Response.json({ ...dossier, tables: listRecordTables(name) });
}
