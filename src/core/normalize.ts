/**
 * Lowercase, strip accents, turn punctuation into spaces and pad with spaces,
 * so phrases can be matched on word boundaries with a plain `includes`.
 * Whisper output for Creole often drops diacritics (fè/fe), so both sides go through this.
 */
export function normalize(text: string): string {
  return (
    ' ' +
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[’‘`]/g, "'")
      .replace(/[^a-z0-9']+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() +
    ' '
  );
}

/** True if `phrase` occurs in `normalizedText` as whole words. */
export function hasPhrase(normalizedText: string, phrase: string): boolean {
  return normalizedText.includes(normalize(phrase));
}
