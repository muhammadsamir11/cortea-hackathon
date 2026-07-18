import { z } from "zod";
import type { DossierDoc, Fact, FactKind } from "../types";
import { callObject, pool } from "../llm";
import type { Classification } from "./classify";

// All optional payload fields are nullable-required: far more reliable than
// optionals across providers' structured-output modes.
const rawFactSchema = z.object({
  kind: z.enum([
    "transaction",
    "invoice",
    "purchase_order",
    "balance",
    "entity",
    "statement_line",
    "contract_term",
    "event",
  ]),
  date: z.string().nullable().describe("ISO YYYY-MM-DD or null"),
  amount: z.number().nullable().describe("absolute normalized decimal, e.g. 12500.0"),
  currency: z.string().nullable(),
  payerName: z.string().nullable(),
  payerIban: z.string().nullable(),
  payeeName: z.string().nullable(),
  payeeIban: z.string().nullable(),
  docNumber: z.string().nullable().describe("this record's own number (invoice no, PO no)"),
  relatedDocNumbers: z.array(z.string()).nullable().describe("referenced document numbers"),
  entityName: z.string().nullable(),
  entityIban: z.string().nullable(),
  entityVatId: z.string().nullable(),
  entityAddress: z.string().nullable(),
  entityRole: z.string().nullable(),
  accountRef: z.string().nullable().describe("for balances: IBAN (no spaces) or account label"),
  balanceSource: z
    .enum(["bank_confirmation", "ledger", "trial_balance", "financial_statement", "other"])
    .nullable(),
  label: z.string().nullable().describe("statement line item / contract topic / event label"),
  description: z.string().nullable(),
  citations: z
    .array(
      z.object({
        ref: z.string().describe("the [REF ...] marker the quote appears under"),
        quote: z
          .string()
          .describe(
            "verbatim substring copied character-for-character from the document, 10-80 chars, including original formatting and umlauts",
          ),
      }),
    )
    .min(1),
});

const extractionSchema = z.object({ facts: z.array(rawFactSchema) });

function extractionSystem(companyName: string): string {
  return `You are a forensic audit clerk transcribing a document into a typed fact database.
The audited company is "${companyName}". Documents are German or English.

RULES:
- Extract EVERY money-relevant record: transactions, invoices, purchase orders, balances, entities, financial-statement lines, contract terms about money/payment/approval, and dated events describing money movements in prose.
- Ledger rows / payment lists: one "transaction" fact per row. Negative amounts or outgoing payments: payerName = "${companyName}", payeeName = counterparty. Incoming: reversed. Always set the counterparty's IBAN (payeeIban for outflows) when shown in the row.
- "invoice" facts: docNumber = invoice number, payeeName = issuing vendor, payerName = billed party, payeeIban = bank details on the invoice, relatedDocNumbers = referenced PO numbers.
- "purchase_order" facts: docNumber = PO number, payeeName = vendor.
- "balance" facts: one per asserted account balance (bank confirmations, trial balance rows, financial statement cash lines). accountRef = IBAN without spaces if shown, else the account label. Set balanceSource by document type. date = the balance cutoff date.
- "statement_line" facts for P&L / balance-sheet / trial-balance line items (label = line name).
- "entity" facts: one per distinct company/person, with IBAN/VAT-ID/address/role when stated.
- "contract_term" facts: fees, payment terms, REQUIRED bank accounts, approval thresholds (put threshold amount in "amount").
- Money movements described in prose (emails, minutes): create a "transaction" fact per described movement AND an "event" fact; note "as described in correspondence" in description.
- Normalize: amounts to absolute decimals (German "12.500,00" → 12500.0), dates to ISO, IBANs without spaces. Currency ISO code.
- CITATIONS ARE SACRED: every fact needs ≥1 citation = the [REF ...] marker + a verbatim quote copied EXACTLY from the text (keep original number formatting, umlauts, case). Quotes must be exact substrings — they are machine-verified; facts with wrong quotes are discarded.
- Do not invent or infer numbers that are not in the document.`;
}

function toFact(raw: z.infer<typeof rawFactSchema>, docId: string, idx: number): Fact {
  const clean = <T>(v: T | null): T | undefined => (v == null ? undefined : v);
  return {
    id: `f-${docId}-${idx}`,
    docId,
    kind: raw.kind as FactKind,
    date: clean(raw.date),
    amount: clean(raw.amount),
    currency: clean(raw.currency)?.toUpperCase(),
    payerName: clean(raw.payerName),
    payerIban: clean(raw.payerIban)?.replace(/\s+/g, "").toUpperCase(),
    payeeName: clean(raw.payeeName),
    payeeIban: clean(raw.payeeIban)?.replace(/\s+/g, "").toUpperCase(),
    docNumber: clean(raw.docNumber),
    relatedDocNumbers: clean(raw.relatedDocNumbers),
    entityName: clean(raw.entityName),
    entityIban: clean(raw.entityIban)?.replace(/\s+/g, "").toUpperCase(),
    entityVatId: clean(raw.entityVatId)?.replace(/\s+/g, ""),
    entityAddress: clean(raw.entityAddress),
    entityRole: clean(raw.entityRole),
    accountRef: clean(raw.accountRef),
    balanceSource: clean(raw.balanceSource),
    label: clean(raw.label),
    description: clean(raw.description),
    citations: raw.citations.map((c) => ({ docId, ref: c.ref, quote: c.quote })),
    verified: false,
  };
}

export async function extractFacts(
  docs: DossierDoc[],
  classification: Classification,
): Promise<Fact[]> {
  const system = extractionSystem(classification.companyName);
  const jobs: { docId: string; content: string; label: string }[] = [];
  for (const doc of docs) {
    const meta = classification.docs.find((d) => d.docId === doc.id);
    const head = `Document id: ${doc.id}\nFilename: ${doc.filename}\nType: ${meta?.docType ?? "unknown"}\n\n`;
    if (doc.units.length > 3) {
      // Big tabular docs: extract per unit to stay inside output limits.
      for (const [i, unit] of doc.units.entries()) {
        jobs.push({
          docId: doc.id,
          label: `extract ${doc.id} [${i + 1}/${doc.units.length}]`,
          content: `${head}[REF ${unit.ref}]\n${unit.text}`,
        });
      }
    } else {
      jobs.push({
        docId: doc.id,
        label: `extract ${doc.id}`,
        content: head + doc.units.map((u) => `[REF ${u.ref}]\n${u.text}`).join("\n"),
      });
    }
  }
  const results = await pool(
    jobs.map((job) => async () => {
      try {
        const { facts } = await callObject({
          label: job.label,
          schema: extractionSchema,
          system,
          prompt: job.content,
        });
        return { docId: job.docId, facts };
      } catch (err) {
        console.error(`  extraction failed for ${job.label}:`, err);
        return { docId: job.docId, facts: [] };
      }
    }),
  );
  const all: Fact[] = [];
  const counters = new Map<string, number>();
  for (const r of results) {
    for (const raw of r.facts) {
      const n = (counters.get(r.docId) ?? 0) + 1;
      counters.set(r.docId, n);
      all.push(toFact(raw, r.docId, n));
    }
  }
  return all;
}
