import { normalize } from './normalize';

/**
 * Phrases that deny or only fear a situation ("nobody is hurt", "not sparking", "afraid of a fire").
 * Removed before picking a card or a 911 phrase, so a message never states something the resident denied.
 * The danger-word override deliberately ignores this list: it may over-trigger, never under-trigger.
 * Spanish and Creole: NATIVE REVIEW.
 */
const NEGATED = [
  "nobody's hurt", 'nobody is hurt', 'nobody hurt', 'nobody was hurt', 'no one is hurt', 'no one hurt', 'not hurt', 'no injuries',
  'nadie está herido', 'nadie herido', 'nadie salió herido', 'nadie se lastimó',
  'pesonn pa blese', 'pa gen moun ki blese',
  'not sparking', 'no sparks', "isn't sparking", 'no está echando chispas', 'no echa chispas', 'sin chispas',
  'pa fè etensèl', 'pa gen etensèl',
  'afraid of a fire', 'scared of a fire', 'worried about a fire',
  'miedo de un incendio', 'miedo a un incendio', 'miedo de que haya un incendio',
  'pè dife', 'pè yon dife', 'pè ensandi',
].map(normalize);

/** Takes a normalized text and blanks out negated phrases. */
export function stripNegated(normalizedText: string): string {
  return NEGATED.reduce((n, neg) => n.split(neg).join(' '), normalizedText);
}
