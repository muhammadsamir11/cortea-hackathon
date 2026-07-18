import { listRecordTables, loadRecords } from "@/lib/audit-data";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const url = new URL(request.url);
  const table = url.searchParams.get("table");
  if (!table) return Response.json({ tables: listRecordTables(name) });
  const result = loadRecords(
    name,
    table,
    Number(url.searchParams.get("page") ?? 1),
    Number(url.searchParams.get("pageSize") ?? 50),
  );
  if (!result) return Response.json({ error: "Table not found" }, { status: 404 });
  return Response.json(result);
}
