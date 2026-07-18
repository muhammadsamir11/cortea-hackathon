import fs from "node:fs";
import path from "node:path";
import { dossierFilePath } from "@/lib/audit-data";

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv; charset=utf-8",
  ".eml": "message/rfc822",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string; docId: string }> },
) {
  const { name, docId } = await params;
  const hit = dossierFilePath(name, docId);
  if (!hit) return new Response("not found", { status: 404 });
  const ext = path.extname(hit.filename).toLowerCase();
  return new Response(new Uint8Array(fs.readFileSync(hit.file)), {
    headers: {
      "content-type": MIME[ext] ?? "application/octet-stream",
      "content-disposition": `inline; filename="${hit.filename}"`,
    },
  });
}
