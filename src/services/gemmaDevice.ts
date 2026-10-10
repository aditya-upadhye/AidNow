import { initLlama, type LlamaContext } from 'llama.rn';

import { TRIAGE_JSON_SCHEMA, TRIAGE_SYSTEM_PROMPT, parseTriage } from '../core/triageSchema';
import type { Lang, Triage } from '../core/types';
import { hasModel, modelFile } from './models';
import { registerRelease, releaseOthers } from './memory';

/**
 * Gemma 3 1B on the phone through llama.rn (llama.cpp). Offline only. It picks a situation and fills
 * the 911 fields; the JSON schema becomes a grammar, so it cannot answer with anything else.
 */
let ctx: LlamaContext | null = null;

export const gemmaDeviceReady = () => hasModel('gemma');

async function context(): Promise<LlamaContext> {
  if (ctx) return ctx;
  // Whisper and Gemma load one at a time to keep peak memory down.
  await releaseOthers('gemma');
  ctx = await initLlama({
    model: modelFile('gemma').uri,
    n_ctx: 2048,
    n_gpu_layers: 99,
    use_mlock: false,
  });
  return ctx;
}

export async function triageOnDevice(input: { text: string; english?: string; lang: Lang }): Promise<Triage | null> {
  if (!gemmaDeviceReady()) return null;
  try {
    const c = await context();
    // The 1B model reads English far better than Spanish or Creole, so Whisper's translation goes first.
    const hasEnglish = !!input.english && input.english !== input.text;
    const user = hasEnglish
      ? `Resident's message, translated to English:\n"""${input.english}"""\nOriginal (${input.lang}):\n"""${input.text}"""`
      : `Resident's message:\n"""${input.text}"""`;
    const result = await c.completion({
      messages: [
        { role: 'system', content: TRIAGE_SYSTEM_PROMPT },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_schema', json_schema: { strict: true, schema: TRIAGE_JSON_SCHEMA as unknown as object } },
      n_predict: 300,
      temperature: 0,
      jinja: true,
      enable_thinking: false,
    });
    return parseTriage(result.text, input.lang, 'gemma_device');
  } catch {
    return null;
  }
}

export async function releaseGemma(): Promise<void> {
  if (ctx) await ctx.release();
  ctx = null;
}

registerRelease('gemma', releaseGemma);
