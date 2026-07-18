import { redirect } from "next/navigation";

export default async function AuditIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ d?: string; tab?: string }>;
}) {
  const { d, tab } = await searchParams;
  const params = new URLSearchParams();
  if (d) params.set("d", d);
  if (tab) params.set("tab", tab);
  const qs = params.toString();
  redirect(qs ? `/audit/report?${qs}` : "/audit/report");
}
