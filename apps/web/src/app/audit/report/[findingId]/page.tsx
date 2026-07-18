import { notFound } from "next/navigation";
import { listDossiers, loadDossier } from "@/lib/audit-data";
import { Workspace } from "../../_components/workspace";
import { isAiConfigured } from "@almedia/forensic/llm";

export const dynamic = "force-dynamic";

export default async function FindingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ findingId: string }>;
  searchParams: Promise<{ d?: string }>;
}) {
  const { findingId } = await params;
  const { d } = await searchParams;
  const dossiers = listDossiers();
  const name = d && dossiers.includes(d) ? d : (dossiers[0] ?? null);
  const data = name ? loadDossier(name) : null;
  if (!data) notFound();
  data.meta = { ...(data.meta ?? {}), aiAvailable: isAiConfigured() };

  const finding = data.findings.find((f) => f.id === findingId);
  if (!finding) notFound();

  return <Workspace data={data} dossiers={dossiers} activeNav="findings" findingId={finding.id} />;
}
