import { loadEvidence } from "@/lib/audit-data";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const url = new URL(request.url);
  const docId = url.searchParams.get("docId") ?? "";
  const ref = url.searchParams.get("ref") ?? undefined;
  const packet = loadEvidence(name, docId, ref);
  if (!packet) return Response.json({ error: "Evidence not found" }, { status: 404 });
  return Response.json(packet);
}
