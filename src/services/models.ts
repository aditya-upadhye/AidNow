import { Directory, File, Paths } from 'expo-file-system';

/**
 * Open-weight models that run on the phone. Downloaded once on Wi-Fi, then used offline.
 * Whisper: multilingual ggml (not `.en`, which is English-only). Gemma 3 1B: text-only, small enough to download
 * on a phone (806 MB). It is weak outside English, so offline it reads Whisper's English translation first.
 */
export const MODELS = {
  whisper: {
    file: 'ggml-base.bin',
    url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin',
    bytes: 147_951_465,
  },
  gemma: {
    file: 'gemma-3-1b-it-Q4_K_M.gguf',
    url: 'https://huggingface.co/unsloth/gemma-3-1b-it-GGUF/resolve/main/gemma-3-1b-it-Q4_K_M.gguf',
    bytes: 806_058_272,
  },
} as const;

export type ModelId = keyof typeof MODELS;

function dir(): Directory {
  const d = new Directory(Paths.document, 'models');
  if (!d.exists) d.create({ intermediates: true });
  return d;
}

export function modelFile(id: ModelId): File {
  return new File(dir(), MODELS[id].file);
}

export function hasModel(id: ModelId): boolean {
  const f = modelFile(id);
  // A partial download is smaller than 90% of the expected size.
  return f.exists && (f.size ?? 0) > MODELS[id].bytes * 0.9;
}

export async function downloadModel(id: ModelId, onProgress: (fraction: number) => void): Promise<void> {
  const f = modelFile(id);
  if (f.exists) f.delete();
  await File.downloadFileAsync(MODELS[id].url, f, {
    idempotent: true,
    onProgress: ({ bytesWritten, totalBytes }) => onProgress(bytesWritten / (totalBytes > 0 ? totalBytes : MODELS[id].bytes)),
  });
}

/** Remove model files the app no longer uses (e.g. the earlier 3.1 GB Gemma 4 E2B download). */
export function removeStaleModels(): void {
  const keep = new Set<string>(Object.values(MODELS).map((m) => m.file));
  for (const entry of dir().list()) {
    if (entry instanceof File && !keep.has(entry.name)) entry.delete();
  }
}

export function deleteModel(id: ModelId): void {
  const f = modelFile(id);
  if (f.exists) f.delete();
}
