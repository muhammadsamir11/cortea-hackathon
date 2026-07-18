import { z } from "zod";
import type { DossierDoc } from "../types";
import { dossierAsPrompt } from "../ingest";
import { callObject } from "../llm";

const classificationSchema = z.object({
  companyName: z
    .string()
    .describe("The audited company the dossier is about (the entity whose books these are)"),
  fiscalPeriod: z.string().describe("e.g. '2024'"),
  docs: z.array(
    z.object({
      docId: z.string(),
      docType: z.enum([
        "general_ledger",
        "bank_confirmation",
        "bank_statement",
        "trial_balance",
        "financial_statements",
        "invoice",
        "credit_note",
        "purchase_orders",
        "payment_run",
        "contract",
        "policy",
        "board_minutes",
        "correspondence",
        "other",
      ]),
      language: z.enum(["de", "en", "mixed"]),
      summary: z.string().describe("One sentence: what this document contains"),
    }),
  ),
});

export type Classification = z.infer<typeof classificationSchema>;

export async function classify(docs: DossierDoc[]): Promise<Classification> {
  return callObject({
    label: "classify",
    schema: classificationSchema,
    system:
      "You are a forensic audit assistant. Classify each document in the dossier. " +
      "Documents are German and/or English. Return one entry per document id.",
    prompt: dossierAsPrompt(docs),
  });
}
