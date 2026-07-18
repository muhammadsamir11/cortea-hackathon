import { env } from "@almedia/env/server";
import { createOpenAI } from "@ai-sdk/openai";
import { google } from "@ai-sdk/google";
import { generateObject, type LanguageModel } from "ai";
import type { z } from "zod";

/** Optional prose model. Structured accounting analysis never depends on it. */
export function pickModel(): { model: LanguageModel; name: string } | null {
  if (env.OPENAI_API_KEY) {
    const name = env.OPENAI_MODEL ?? "gpt-5-mini";
    const openai = createOpenAI({ apiKey: env.OPENAI_API_KEY });
    return { model: openai(name), name };
  }
  if (env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const name = env.GOOGLE_MODEL ?? "gemini-2.5-pro";
    return { model: google(name), name };
  }
  return null;
}

let cached: { model: LanguageModel; name: string } | null = null;
export function getModel() {
  cached ??= pickModel();
  if (!cached) throw new Error("Optional AI review is not configured. Set OPENAI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY, or use --no-ai.");
  return cached;
}

export function isAiConfigured(): boolean {
  return pickModel() !== null;
}

export async function callObject<T>(opts: {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  label: string;
  maxRetries?: number;
}): Promise<T> {
  const { model, name } = getModel();
  const started = Date.now();
  const { object } = await generateObject({
    model,
    system: opts.system,
    prompt: opts.prompt,
    schema: opts.schema,
    maxRetries: opts.maxRetries ?? 2,
  });
  console.log(`  [llm:${name}] ${opts.label} — ${((Date.now() - started) / 1000).toFixed(1)}s`);
  return object as T;
}

/** Run promise factories with bounded concurrency. */
export async function pool<T>(factories: (() => Promise<T>)[], limit = 6): Promise<T[]> {
  const results: T[] = new Array(factories.length);
  let next = 0;
  async function worker() {
    while (next < factories.length) {
      const i = next++;
      results[i] = await factories[i]!();
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, factories.length) }, worker));
  return results;
}
