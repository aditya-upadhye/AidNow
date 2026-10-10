import { TRIAGE_JSON_SCHEMA, TRIAGE_SYSTEM_PROMPT, parseTriage } from '../core/triageSchema';
import type { Lang, Triage } from '../core/types';
import { config } from './config';

/**
 * Gemma 4 on the Gemini API: text and image in, structured JSON out. No audio (the API's Gemma 4
 * models don't take it); voice is transcribed on the phone first.
 * Only the text and photo of this request leave the phone.
 */
export async function triageOnline(input: { text: string; english?: string; photoBase64?: string; lang: Lang }): Promise<Triage | null> {
  if (!config.geminiApiKey) return null;

  const userText =
    `Resident's message (display language ${input.lang}):\n"""${input.text}"""` +
    (input.english && input.english !== input.text ? `\nOn-device English translation:\n"""${input.english}"""` : '') +
    (input.photoBase64 ? '\nA photo is attached.' : '\nNo photo.');

  const parts: object[] = [{ text: TRIAGE_SYSTEM_PROMPT + '\n\n' + userText }];
  if (input.photoBase64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: input.photoBase64 } });

  const body = (withSchema: boolean) =>
    JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: {
        temperature: 0,
        responseMimeType: 'application/json',
        ...(withSchema ? { responseSchema: toGeminiSchema(TRIAGE_JSON_SCHEMA) } : {}),
      },
    });

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.gemmaModel}:generateContent`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.photoBase64 ? config.onlineTimeoutWithPhotoMs : config.onlineTimeoutMs);
  try {
    const post = (withSchema: boolean) =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.geminiApiKey },
        body: body(withSchema),
        signal: controller.signal,
      });
    let res = await post(true);
    // If this model rejects a response schema, ask again with the schema in the prompt only.
    if (res.status === 400) res = await post(false);
    if (!res.ok) return null;
    const json = await res.json();
    const text: string = (json?.candidates?.[0]?.content?.parts ?? [])
      .filter((p: { thought?: boolean }) => !p.thought)
      .map((p: { text?: string }) => p.text ?? '')
      .join('');
    return parseTriage(text, input.lang, 'gemma_online');
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** The Gemini API's schema dialect: upper-case types, no minItems/maxItems on some models. */
function toGeminiSchema(s: unknown): unknown {
  if (Array.isArray(s)) return s.map(toGeminiSchema);
  if (!s || typeof s !== 'object') return s;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(s as Record<string, unknown>)) {
    if (k === 'minItems' || k === 'maxItems') continue;
    out[k] = k === 'type' && typeof v === 'string' ? v.toUpperCase() : toGeminiSchema(v);
  }
  return out;
}
