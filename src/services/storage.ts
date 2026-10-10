import AsyncStorage from '@react-native-async-storage/async-storage';

import type { CommunitySettings } from '../core/community';
import { migrateProfile } from '../core/contacts';
import type { Profile } from '../core/types';

/** Everything stays on the phone. Nothing here is ever sent to a server. */
const KEYS = { profile: 'aidnow.profile', queue: 'aidnow.queue', cache: 'aidnow.cache.', community: 'aidnow.community', claimed: 'aidnow.community.claimed', lastCheckIn: 'aidnow.lastCheckIn', alerts: 'aidnow.alerts', device: 'aidnow.device', shareEmergencies: 'aidnow.shareEmergencies' };

export async function loadProfile(): Promise<Profile | null> {
  const raw = await AsyncStorage.getItem(KEYS.profile);
  return raw ? migrateProfile(JSON.parse(raw)) : null;
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

export async function loadCommunity(): Promise<CommunitySettings | null> {
  const raw = await AsyncStorage.getItem(KEYS.community);
  return raw ? (JSON.parse(raw) as CommunitySettings) : null;
}

export async function saveCommunity(c: CommunitySettings): Promise<void> {
  await AsyncStorage.setItem(KEYS.community, JSON.stringify(c));
}

/** Neighbors this volunteer said they would check on: member id -> ISO time. Stays on the phone. */
export async function loadClaimed(): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(KEYS.claimed);
  return raw ? (JSON.parse(raw) as Record<string, string>) : {};
}

export async function saveClaimed(c: Record<string, string>): Promise<void> {
  await AsyncStorage.setItem(KEYS.claimed, JSON.stringify(c));
}

export type LastCheckIn = { at: string; status: string; count: number };

/** When and what the resident last told family. Stays on the phone. */
export async function loadLastCheckIn(): Promise<LastCheckIn | null> {
  const raw = await AsyncStorage.getItem(KEYS.lastCheckIn);
  return raw ? (JSON.parse(raw) as LastCheckIn) : null;
}

export async function saveLastCheckIn(c: LastCheckIn): Promise<void> {
  await AsyncStorage.setItem(KEYS.lastCheckIn, JSON.stringify(c));
}

/** A random id for this install, used only so the server can limit how often one phone posts alerts. Not linked to a name. */
export async function loadDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(KEYS.device);
  if (existing) return existing;
  const id = `d-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  await AsyncStorage.setItem(KEYS.device, id);
  return id;
}

/** Alerts posted from this phone while no server is set up. */
export async function loadLocalAlerts<T>(): Promise<T[]> {
  const raw = await AsyncStorage.getItem(KEYS.alerts);
  return raw ? (JSON.parse(raw) as T[]) : [];
}

export async function saveLocalAlerts<T>(list: T[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.alerts, JSON.stringify(list));
}

/**
 * Whether an emergency result tells volunteers nearby, with no question asked at the time. On unless the resident
 * switched it off in My role.
 */
export async function loadShareEmergencies(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.shareEmergencies)) !== '0';
}

export async function saveShareEmergencies(on: boolean): Promise<void> {
  await AsyncStorage.setItem(KEYS.shareEmergencies, on ? '1' : '0');
}
