import { defineTool } from "eve/tools";
import { z } from "zod";
import { loadDocs, loadUnits, searchEvidence } from "../lib/dossier";

const MAX_HITS = 12;
const SNIPPET_CHARS = 700;

/** Connector/boilerplate tokens that would otherwise match most of the corpus. */
const STOPWORDS = new Set([
  "or", "and", "the", "for", "von", "und", "oder", "der", "die", "das",
  "ein", "eine", "mit", "gmbh", "co", "kg", "se", "e.k",
]);

export default defineTool({
  description:
    "Defense counsel's full-text search across every evidence unit in the dossier (ledgers, invoices, contracts, emails). Pass 2-5 plain space-separated keywords — rare, specific terms rank highest; boolean operators like OR are ignored. Returns citable units {docId, filename, ref, text}, best matches first. The corpus is largely German — search German terms for German documents.",
  inputSchema: z.object({
    dossier: z.string().regex(/^[a-z0-9_-]+$/i),
    query: z
      .string()
      .min(2)
      .describe("2-5 space-separated keywords; no boolean operators"),
    docId: z.string().optional().describe("Restrict the search to one document"),
  }),
  async execute({ dossier, query, docId }) {
    const indexed = searchEvidence(dossier, query, docId);
    if (indexed) {
      return {
        hits: indexed.hits.map((hit) => ({ ...hit, text: hit.text.slice(0, SNIPPET_CHARS) })),
        totalMatches: indexed.totalMatches,
      };
    }
    const terms = [
      ...new Set(
        query
          .toLowerCase()
          .split(/[^\p{L}\p{N}.,-]+/u)
          .filter((term) => term.length >= 3 && !STOPWORDS.has(term)),
      ),
    ];
    if (terms.length === 0) return { hits: [], totalMatches: 0 };

    const units = loadDocs(dossier)
      .filter((doc) => !docId || doc.id === docId)
      .flatMap((doc) =>
        loadUnits(dossier, doc.id).map((unit) => ({
          docId: doc.id,
          filename: doc.filename,
          unit,
          haystack: unit.text.toLowerCase(),
        })),
      );

    // Inverse document frequency so that rare, specific terms dominate the
    // ranking and ubiquitous ones (years, "Zahlung", …) barely contribute.
    const unitFrequency = new Map(
      terms.map((term) => [
        term,
        units.reduce((count, entry) => count + (entry.haystack.includes(term) ? 1 : 0), 0),
      ]),
    );
    const weightOf = (term: string) => {
      const frequency = unitFrequency.get(term) ?? 0;
      return frequency === 0 ? 0 : Math.log(units.length / frequency);
    };

    const hits = units
      .map((entry) => ({
        docId: entry.docId,
        filename: entry.filename,
        ref: entry.unit.ref,
        text: entry.unit.text.slice(0, SNIPPET_CHARS),
        score: terms.reduce(
          (sum, term) => sum + (entry.haystack.includes(term) ? weightOf(term) : 0),
          0,
        ),
      }))
      .filter((hit) => hit.score > 0);
    hits.sort((a, b) => b.score - a.score);

    // Only hits carrying at least half the best score count as real matches;
    // the long tail of single-common-term hits is noise.
    const threshold = (hits[0]?.score ?? 0) / 2;
    const relevant = hits.filter((hit) => hit.score >= threshold);
    return {
      hits: relevant.slice(0, MAX_HITS).map(({ score: _score, ...hit }) => hit),
      totalMatches: relevant.length,
    };
  },
});
