import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadFindings, loadUnits, saveFindings } from "../lib/dossier";

export default defineTool({
  description:
    "Enter the final verdict for one finding into the court record (the dossier's findings file). Call only after the defense and judgment phases. defenseCitations must be verbatim quotes taken from search_evidence results; unverifiable quotes are dropped.",
  inputSchema: z.object({
    findingId: z.string(),
    verdict: z.enum(["confirmed", "needs-judgment", "acquitted"]),
    defense: z
      .string()
      .describe(
        "2-3 sentences: the strongest innocent explanation found, or a statement that none was found",
      ),
    reasoning: z.string().describe("Terse judicial reasoning for the verdict"),
    defenseCitations: z
      .array(z.object({ docId: z.string(), ref: z.string(), quote: z.string() }))
      .default([]),
  }),
  async execute({ findingId, verdict, defense, reasoning, defenseCitations }) {
    const findings = loadFindings();
    const finding = findings.find((candidate) => candidate.id === findingId);
    if (!finding) return { ok: false as const, error: `Unknown finding: ${findingId}` };
    const verified = defenseCitations.filter((citation) =>
      loadUnits(citation.docId).some(
        (unit) => unit.ref === citation.ref && unit.text.includes(citation.quote),
      ),
    );
    finding.tribunal = { defense, defenseCitations: verified, verdict, reasoning };
    finding.aiStatus = verdict;
    if (verdict === "needs-judgment") finding.tier = "judgment";
    saveFindings(findings);
    return {
      ok: true as const,
      findingId,
      verdict,
      citationsVerified: verified.length,
      citationsDropped: defenseCitations.length - verified.length,
    };
  },
});
