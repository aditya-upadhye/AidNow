export const config = {
  geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY ?? '',
  airNowApiKey: process.env.EXPO_PUBLIC_AIRNOW_API_KEY ?? '',
  gemmaModel: process.env.EXPO_PUBLIC_GEMMA_MODEL || 'gemma-4-26b-a4b-it',
  /** On unless explicitly "0". In demo mode nothing ever dials or texts a real line. */
  demoMode: process.env.EXPO_PUBLIC_DEMO_MODE !== '0',
  /**
   * Where demo mode sends everything. Defaults to 305-555-0100, a number reserved for fiction, so testing reaches
   * no one. Set a teammate's phone in .env for the live demo, so "send" visibly arrives somewhere.
   */
  demoRecipient: process.env.EXPO_PUBLIC_DEMO_RECIPIENT || '+13055550100',
  /** Gemma 4 usually answers in about 2 s; past this, fall back to the on-device path. */
  onlineTimeoutMs: 8000,
  /** Requests with a photo took up to ~7.6 s in testing. */
  onlineTimeoutWithPhotoMs: 15000,
};
