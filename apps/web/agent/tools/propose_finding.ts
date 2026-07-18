import { createHash } from "node:crypto";
import { defineTool } from "eve/tools";
import { always } from "eve/tools/approval";
import { z } from "zod";
import type { Finding } from "@almedia/forensic/types";
import { loadFindings, loadUnits, saveFindings } from "../lib/dossier";

export default defineTool({
  description:
    "Record a NEW finding uncovered by the investigation into the audit file. Requires the auditor's explicit approval before it is written. Citations must be verbatim quotes taken from search_evidence results; unverifiable quotes are dropped, and a finding with no verifiable citation is rejected.",
  approval: always(),
  inputSchema: z.object({
    title: z.string().min(8).describe("Short factual title, like the engine's findings"),
    narrative: z
      .string()
      .min(20)
      .describe("2-4 terse sentences: what the evidence shows and why it matters"),
    fraudType: z
      .string()
      .describe("snake_case category, e.g. duplicate_invoice, round_tripping, unusual_payment"),
    severity: z.enum(["high", "medium", "low"]),
    amountInvolved: z.number().nullable().describe("EUR amount, or null if not quantifiable"),
    citations: z
      .array(z.object({ docId: z.string(), ref: z.string(), quote: z.string() }))
      .min(1)
      .describe("Verbatim quotes from search_evidence results backing the narrative"),
  }),
  async execute({ title, narrative, fraudType, severity, amountInvolved, citations }) {
    const verified = citations.filter((citation) =>
      loadUnits(citation.docId).some(
        (unit) => unit.ref === citation.ref && unit.text.includes(citation.quote),
      ),
    );
    if (verified.length === 0) {
      return {
        ok: false as const,
        error:
          "No citation could be verified against the evidence; re-check docId/ref and use exact quotes from search_evidence results.",
      };
    }
    const findings = loadFindings();
    const id = `finding-inv-${createHash("sha1").update(title).digest("hex").slice(0, 12)}`;
    if (findings.some((finding) => finding.id === id)) {
      return { ok: false as const, error: "A finding with this title was already recorded." };
    }
    const finding: Finding = {
      id,
      checkId: "investigator",
      title,
      tier: "judgment",
      fraudType,
      narrative,
      amountInvolved,
      severity,
      factIds: [],
      citations: verified,
      lineItems: [],
      engineStatus: "detected",
      aiStatus: "needs-judgment",
    };
    findings.push(finding);
    saveFindings(findings);
    return {
      ok: true as const,
      findingId: id,
      citationsVerified: verified.length,
      citationsDropped: citations.length - verified.length,
    };
  },
});
