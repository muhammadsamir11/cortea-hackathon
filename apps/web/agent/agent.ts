import { openai } from "@ai-sdk/openai";
import { defineAgent } from "eve";

export default defineAgent({
  description:
    "Forensic tribunal for the Cortea audit workbench: gives every deterministic finding a defense, then reaches a verdict with the auditor presiding.",
  model: openai(process.env.OPENAI_MODEL ?? "gpt-5-mini"),
  modelContextWindowTokens: 272_000,
});
