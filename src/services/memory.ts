/** Whisper and the on-device Gemma never sit in memory together. Each frees the other before loading. */
const releasers = new Map<string, () => Promise<void>>();

export function registerRelease(name: string, release: () => Promise<void>): void {
  releasers.set(name, release);
}

export async function releaseOthers(name: string): Promise<void> {
  for (const [other, release] of releasers) if (other !== name) await release();
}
