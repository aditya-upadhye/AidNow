import lists from '../data/danger-words.json';
import { hasPhrase, normalize } from './normalize';

const ALL_TERMS: string[] = [...lists.en, ...lists.es, ...lists.ht];

/**
 * Returns the danger words found in any of the texts (original transcript, English translation, typed text).
 * Every language list is checked against every text: residents code-switch, and Whisper's
 * translation may be the only place an English danger word appears.
 * Negation ("not on fire") is deliberately not handled; over-triggering costs one tap.
 */
export function findDangerWords(...texts: (string | undefined | null)[]): string[] {
  const hits = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    const n = normalize(text);
    for (const term of ALL_TERMS) {
      if (hasPhrase(n, term)) hits.add(term);
    }
  }
  return [...hits];
}
