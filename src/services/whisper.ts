import { initWhisper, type WhisperContext } from 'whisper.rn';

import type { Lang } from '../core/types';
import { releaseOthers, registerRelease } from './memory';
import { hasModel, modelFile } from './models';

let ctx: WhisperContext | null = null;
let loading: Promise<WhisperContext> | null = null;

async function context(): Promise<WhisperContext> {
  if (ctx) return ctx;
  if (!loading) {
    loading = releaseOthers('whisper').then(() => initWhisper({ filePath: modelFile('whisper').uri })).then((c) => (ctx = c));
    loading.catch(() => (loading = null));
  }
  return loading;
}

export const whisperReady = () => hasModel('whisper');

/** Load ahead of time so the first voice note isn't slow. */
export function warmUpWhisper(): void {
  if (whisperReady()) context().catch(() => {});
}

/**
 * Two passes on the phone: the transcript in the resident's language (shown, editable),
 * and Whisper's own translation to English (used for keywords and the on-device model).
 * Whisper's language code for Haitian Creole is "ht".
 */
export async function transcribe(wavUri: string, lang: Lang): Promise<{ text: string; english: string; detected: string }> {
  const c = await context();
  const original = await c.transcribe(wavUri, { language: lang }).promise;
  const english = lang === 'en' ? original : await c.transcribe(wavUri, { language: lang, translate: true }).promise;
  return { text: original.result.trim(), english: english.result.trim(), detected: original.language };
}

export async function releaseWhisper(): Promise<void> {
  const c = ctx ?? (loading ? await loading.catch(() => null) : null);
  ctx = null;
  loading = null;
  if (c) await c.release();
}

registerRelease('whisper', releaseWhisper);
