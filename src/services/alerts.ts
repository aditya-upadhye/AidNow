import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { ALERT_POLL_MS, alertsNearby, isExpired, makeAlert, type AlertUrgency, type CommunityAlert, type NearAlert } from '../core/alerts';
import type { Coords, Situation } from '../core/types';
import { DEMO_ORIGIN } from '../data/communitySeed';
import { config } from './config';
import { quickCoords } from './notify';
import { loadDeviceId, loadLocalAlerts, saveLocalAlerts } from './storage';

/**
 * Where neighbor alerts come from and go. With a Supabase project set in .env, alerts are shared through it.
 * Without one, they stay on this phone, so the whole flow still works in a demo.
 *
 * iPhones cannot receive remote push without a paid Apple Developer account, so alerts reach volunteers by the
 * "What is happening" screen asking for new ones every few seconds while it is open.
 */
export interface AlertsFeed {
  post(alert: CommunityAlert): Promise<PostResult>;
  /** Alerts that reach `origin`, as the server sees them. */
  nearby(origin: Coords): Promise<CommunityAlert[]>;
}

export type PostResult = 'posted' | 'rate_limited' | 'error';

export const alertsConfigured = config.supabaseUrl !== '' && config.supabaseAnonKey !== '';

async function rpc<T>(fn: string, body: object, timeoutMs = 4000): Promise<{ ok: boolean; status: number; data: T | null; message: string }> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${config.supabaseUrl}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'Content-Type': 'application/json', apikey: config.supabaseAnonKey, Authorization: `Bearer ${config.supabaseAnonKey}` },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data: res.ok ? (json as T) : null, message: String((json as { message?: string } | null)?.message ?? '') };
  } finally {
    clearTimeout(timer);
  }
}

type Row = { id: string; created_at: string; situation: Situation; urgency: AlertUrgency; lat: number; lon: number; mine: boolean };

export const supabaseFeed: AlertsFeed = {
  async post(a) {
    try {
      const r = await rpc<string>('post_alert', {
        p_situation: a.situation,
        p_urgency: a.urgency,
        p_lat: a.coords.lat,
        p_lon: a.coords.lon,
        p_device: await loadDeviceId(),
      });
      if (r.ok) return 'posted';
      return r.message.includes('rate_limited') ? 'rate_limited' : 'error';
    } catch {
      return 'error';
    }
  },
  async nearby(origin) {
    const r = await rpc<Row[]>('nearby_alerts', { p_lat: origin.lat, p_lon: origin.lon, p_device: await loadDeviceId() });
    if (!r.ok || !r.data) throw new Error(`nearby_alerts ${r.status}`);
    return r.data.map((x) => ({ id: x.id, urgency: x.urgency, situation: x.situation, coords: { lat: x.lat, lon: x.lon }, at: x.created_at, mine: x.mine }));
  },
};

export const localFeed: AlertsFeed = {
  async post(a) {
    const now = new Date();
    const kept = (await loadLocalAlerts<CommunityAlert>()).filter((x) => !isExpired(x, now));
    await saveLocalAlerts([...kept, { ...a, mine: true }].slice(-20));
    return 'posted';
  },
  async nearby() {
    const now = new Date();
    return (await loadLocalAlerts<CommunityAlert>()).filter((x) => !isExpired(x, now));
  },
};

export const alertsFeed: AlertsFeed = alertsConfigured ? supabaseFeed : localFeed;

/** Tell volunteers nearby. Only the fields makeAlert keeps leave the phone: see core/alerts.ts. */
export async function postAlert(args: { urgency: AlertUrgency; situation: Situation; coords: Coords }): Promise<PostResult> {
  const id = `a-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  return alertsFeed.post(makeAlert({ id, urgency: args.urgency, situation: args.situation, coords: args.coords, now: new Date() }));
}

export type AlertsState = {
  alerts: NearAlert[];
  /** 'idle' before the first answer, 'ok' while answers arrive, 'error' when the last ask failed (the list shown is the last good one). */
  status: 'idle' | 'ok' | 'error';
  updatedAt: Date | null;
};

/**
 * Asks for nearby alerts now and then every ALERT_POLL_MS. One request at a time, paused while the app is in the
 * background, and stopped when `enabled` is false or the screen unmounts, so the server is only asked while someone looks.
 */
export function useNearbyAlerts(origin: Coords | null, enabled: boolean): AlertsState {
  const [state, setState] = useState<AlertsState>({ alerts: [], status: 'idle', updatedAt: null });
  const lat = origin?.lat;
  const lon = origin?.lon;
  const active = useRef(AppState.currentState === 'active');

  useEffect(() => {
    if (!enabled || lat == null || lon == null) return;
    const here = { lat, lon };
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;

    const tick = async () => {
      if (stopped || inFlight || !active.current) return;
      inFlight = true;
      try {
        const list = await alertsFeed.nearby(here);
        const now = new Date();
        if (!stopped) setState({ alerts: alertsNearby(list, here, now), status: 'ok', updatedAt: now });
      } catch {
        if (!stopped) setState((s) => ({ ...s, status: 'error' }));
      } finally {
        inFlight = false;
        if (!stopped && active.current) timer = setTimeout(tick, ALERT_POLL_MS);
      }
    };

    tick();
    const sub = AppState.addEventListener('change', (next) => {
      active.current = next === 'active';
      clearTimeout(timer);
      if (active.current) tick();
    });
    return () => {
      stopped = true;
      clearTimeout(timer);
      sub.remove();
    };
  }, [enabled, lat, lon]);

  return state;
}

/**
 * Where an alert starts from, which must be where volunteers search from: the saved address, else Little Haiti in
 * demo builds (as everywhere in Community), else the phone's GPS fix, else a quick one now.
 */
export async function alertCoords(addressCoords: Coords | undefined, gps: Coords | null): Promise<Coords | null> {
  return addressCoords ?? (config.demoMode ? DEMO_ORIGIN : (gps ?? (await quickCoords())));
}

export type EmergencyAlertStatus = 'off' | 'idle' | 'waiting' | 'sending' | 'retrying' | 'sent' | 'limited';

const RETRY_MS = 10_000;
const MAX_ATTEMPTS = 4;

/**
 * An emergency result tells volunteers nearby by itself: the resident is never asked, because in an emergency they
 * should not have to. One alert per triage result (`key`), however many times the screen re-renders or a question
 * is answered. Without internet it waits and sends when the connection returns; after a failure it tries again
 * a few times. `enabled` is the resident's own switch in My role.
 */
export function useEmergencyAlert(args: {
  key: object | null;
  situation: Situation | null;
  addressCoords?: Coords;
  gps: Coords | null;
  online: boolean;
  enabled: boolean;
}): EmergencyAlertStatus {
  const { key, situation, online, enabled } = args;
  const [result, setResult] = useState<{ key: object; state: 'sent' | 'retrying' | 'limited' } | null>(null);
  const started = useRef<object | null>(null);
  // Read the latest location when sending, without restarting an alert that is already on its way.
  const where = useRef({ addressCoords: args.addressCoords, gps: args.gps });
  // Declared before the sending effect, so it is current whenever that one runs.
  useEffect(() => {
    where.current = { addressCoords: args.addressCoords, gps: args.gps };
  });

  useEffect(() => {
    if (!enabled || !key || !situation || started.current === key || (alertsConfigured && !online)) return;
    started.current = key;
    let cancelled = false;
    let finished = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const attempt = async () => {
      const coords = await alertCoords(where.current.addressCoords, where.current.gps);
      const r = coords ? await postAlert({ urgency: 'emergency', situation, coords }) : 'error';
      if (cancelled) return;
      if (r === 'posted' || r === 'rate_limited') {
        finished = true;
        setResult({ key, state: r === 'posted' ? 'sent' : 'limited' });
      } else if (++attempts < MAX_ATTEMPTS) {
        setResult({ key, state: 'retrying' });
        timer = setTimeout(attempt, RETRY_MS);
      } else {
        // Give up for now; going offline and back, or a new result, starts it again.
        started.current = null;
        setResult({ key, state: 'retrying' });
      }
    };
    attempt();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      // Interrupted before it was delivered (for example the connection dropped): let the next run start it again.
      if (!finished) started.current = null;
    };
  }, [key, situation, online, enabled]);

  if (!enabled) return 'off';
  if (!key) return 'idle';
  if (result && result.key === key) return result.state;
  return alertsConfigured && !online ? 'waiting' : 'sending';
}
