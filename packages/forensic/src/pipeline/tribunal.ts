import { z } from "zod";
import type { DossierDoc, Finding } from "../types";
import type { Candidate } from "../engine/checks";
import { dossierAsPrompt } from "../ingest";
import { callObject, pool } from "../llm";
import { quoteInText } from "../normalize";

const defenseSchema = z.object({
  defense: z
    .string()
    .describe("the strongest innocent explanation, grounded in the documents; or state that none exists"),
  defenseCitations: z.array(
    z.object({ docId: z.string(), ref: z.string(), quote: z.string() }),
  ),
  strength: z.enum(["none", "weak", "strong"]),
});

const verdictSchema = z.object({
  verdict: z.enum(["confirmed", "needs-judgment", "acquitted"]),
  reasoning: z.string(),
});

/** Every candidate stands trial: a defense agent hunts for the innocent
 * explanation (credit notes, corrections, FX, timing); a judge weighs it.
 * This is the false-positive firewall. */
export async function tribunal(
  candidates: Candidate[],
  docs: DossierDoc[],
  companyName: string,
): Promise<Finding[]> {
  const dossier = dossierAsPrompt(docs);
  return pool(
    candidates.map((cand) => async (): Promise<Finding> => {
      try {
        const defense = await callObject({
          label: `defense: ${cand.title.slice(0, 40)}`,
          schema: defenseSchema,
          system: `You are defense counsel for the management of ${companyName} in an audit.
An automated forensic engine raised an allegation. Search the FULL dossier for the strongest
INNOCENT explanation: credit notes, correcting entries, FX or timing differences, legitimate
business reasons, documents the engine may have missed. Cite verbatim quotes (machine-verified).
If no honest defense exists, say so plainly — do not invent one.`,
          prompt: `ALLEGATION:\n${JSON.stringify({ title: cand.title, narrative: cand.narrative, fraudType: cand.fraudType }, null, 1)}\n\nDOSSIER:\n${dossier}`,
        });
        const validCitations = defense.defenseCitations.filter((cit) => {
          const doc = docs.find((d) => d.id === cit.docId);
          const unit = doc?.units.find((u) => u.ref === cit.ref) ?? doc?.units.find((u) => quoteInText(cit.quote, u.text));
          if (unit) cit.ref = unit.ref;
          return !!unit && quoteInText(cit.quote, unit.text);
        });
        const { verdict, reasoning } = await callObject({
          label: `verdict: ${cand.title.slice(0, 40)}`,
          schema: verdictSchema,
          system: `You are a skeptical senior auditor ruling on an allegation.
Rules:
- "acquitted" ONLY if the defense's cited evidence concretely and fully neutralizes the allegation
  (e.g. a credit note that exactly reverses an apparent duplicate, a documented FX rate explaining a difference).
- "confirmed" when the documentary evidence supports the allegation and the defense is absent, speculative, or only partial.
- "needs-judgment" when material questions remain that an auditor must resolve with additional evidence.
- False accusations are costly; so is letting fraud through. Decide on the evidence, not on suspicion.
- Note: defense citations listed as INVALID failed machine verification against the documents — ignore them.`,
          prompt:
            `ALLEGATION (tier: ${cand.tier}):\n${JSON.stringify({ title: cand.title, narrative: cand.narrative }, null, 1)}` +
            `\n\nDEFENSE (claimed strength: ${defense.strength}):\n${defense.defense}` +
            `\nVALID defense citations: ${JSON.stringify(validCitations)}` +
            `\nINVALID (failed verification): ${defense.defenseCitations.length - validCitations.length}`,
        });
        return { ...cand, tribunal: { defense: defense.defense, defenseCitations: validCitations, verdict, reasoning } };
      } catch (err) {
        console.error(`  tribunal failed for ${cand.id}:`, err);
        return {
          ...cand,
          tribunal: {
            defense: "Tribunal unavailable (LLM error) — verdict defaults to auditor judgment.",
            defenseCitations: [],
            verdict: "needs-judgment",
            reasoning: "Automated tribunal errored; treat with manual care.",
          },
        };
      }
    }),
    4,
  );
}
