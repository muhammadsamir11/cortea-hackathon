import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadFindings } from "../lib/dossier";

export default defineTool({
  description:
    "Read the docket: every finding the deterministic engine detected in the dossier, with narrative, amounts, calculations, line items, and prosecution citations.",
  inputSchema: z.object({}),
  async execute() {
    return loadFindings().map((finding) => ({
      id: finding.id,
      checkId: finding.checkId,
      title: finding.title,
      tier: finding.tier,
      severity: finding.severity,
      fraudType: finding.fraudType,
      narrative: finding.narrative,
      amountInvolved: finding.amountInvolved,
      calculations: finding.calculations ?? [],
      lineItems: (finding.lineItems ?? []).map((item) => ({
        label: item.label,
        date: item.date,
        counterparty: item.counterparty,
        amount: item.amount,
      })),
      citations: finding.citations,
      aiStatus: finding.aiStatus ?? "not-run",
    }));
  },
});
