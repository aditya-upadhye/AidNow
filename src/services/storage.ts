import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Profile } from '../core/types';

/** Everything stays on the phone. Nothing here is ever sent to a server. */
const KEYS = { profile: 'aidnow.profile', queue: 'aidnow.queue', cache: 'aidnow.cache.' };

export async function loadProfile(): Promise<Profile | null> {
  const raw = await AsyncStorage.getItem(KEYS.profile);
  return raw ? (JSON.parse(raw) as Profile) : null;
}

export async function saveProfile(p: Profile): Promise<void> {
  await AsyncStorage.setItem(KEYS.profile, JSON.stringify(p));
}

export type QueuedReport = {
  id: string;
  createdAt: string;
  agency: string;
  englishReport: string;
};

/** Non-emergency reports only. Emergency messages are never queued. */
export async function loadQueue(): Promise<QueuedReport[]> {
  const raw = await AsyncStorage.getItem(KEYS.queue);
  return raw ? (JSON.parse(raw) as QueuedReport[]) : [];
}

export async function enqueueReport(r: Omit<QueuedReport, 'id' | 'createdAt'>): Promise<void> {
  const q = await loadQueue();
  q.push({ ...r, id: String(Date.now()), createdAt: new Date().toISOString() });
  await AsyncStorage.setItem(KEYS.queue, JSON.stringify(q));
}

export async function removeQueued(id: string): Promise<void> {
  const q = (await loadQueue()).filter((r) => r.id !== id);
  await AsyncStorage.setItem(KEYS.queue, JSON.stringify(q));
}

export type Cached<T> = { savedAt: string; data: T };

export async function readCache<T>(key: string): Promise<Cached<T> | null> {
  const raw = await AsyncStorage.getItem(KEYS.cache + key);
  return raw ? (JSON.parse(raw) as Cached<T>) : null;
}

export async function writeCache<T>(key: string, data: T): Promise<void> {
  await AsyncStorage.setItem(KEYS.cache + key, JSON.stringify({ savedAt: new Date().toISOString(), data }));
}
