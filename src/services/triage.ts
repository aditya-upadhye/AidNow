import { classifyByKeywords } from '../core/keywordClassifier';
import { fallbackTriage } from '../core/triageSchema';
import type { Lang, Triage } from '../core/types';
import { triageOnDevice } from './gemmaDevice';
import { triageOnline } from './gemmaOnline';

export type TriageInput = { text: string; english?: string; photoBase64?: string; lang: Lang; online: boolean };

/**
 * Online: Gemma 4 on the Gemini API. Offline, or if that fails: Gemma on the phone.
 * If no model is available: keywords. If nothing matches: Emergency with a question.
 * Whichever path answers, the code router decides the outcome.
 */
export async function runTriage(input: TriageInput): Promise<Triage> {
  const texts = [input.text, input.english ?? ''];

  if (input.online) {
    const t = await triageOnline(input);
    if (t) return withKeywordBackup(t, texts, input.lang);
  }
  const device = await triageOnDevice(input);
  if (device) return withKeywordBackup(device, texts, input.lang);

  const kw = classifyByKeywords(texts, input.lang);
  return kw.situations[0] === 'other' && !kw.vulnerable.length ? { ...fallbackTriage(input.lang), source: 'keywords' } : kw;
}

/** If the model says "other" but keywords recognise the situation, use the keywords' situation. */
function withKeywordBackup(t: Triage, texts: string[], lang: Lang): Triage {
  if (t.situations[0] !== 'other') return t;
  const kw = classifyByKeywords(texts, lang);
  if (kw.situations[0] === 'other') return t;
  return { ...t, situations: kw.situations, vulnerable: [...new Set([...t.vulnerable, ...kw.vulnerable])] };
}
