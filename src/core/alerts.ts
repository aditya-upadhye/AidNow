import { approximate } from './community';
import { distanceKm } from './geo';
import type { Coords, Situation, Urgency } from './types';

/**
 * Neighbor alerts: a resident who is in trouble can tell volunteers nearby. Pure functions, so who hears about it,
 * how far, and what the alert contains are tested rather than promised.
 *
 * An alert holds the kind of problem, how serious it is, an area about 1 km wide and the minute it was posted.
 * Never a name, address, photo, phone number, medical detail or the words the resident said.
 */

/** Only these two are shared. A non-emergency (311, FPL, 211) is never broadcast to neighbors. */
export type AlertUrgency = Extract<Urgency, 'emergency' | 'urgent_safety'>;

/** How far an alert travels, by how serious it is. */
export const ALERT_RADIUS_KM: Record<AlertUrgency, number> = { emergency: 5, urgent_safety: 2 };

/** An alert disappears after this long, so an old problem never looks current. */
export const ALERT_TTL_HOURS = 6;

/** How often "What is happening" asks the server for new alerts while it is on screen. */
export const ALERT_POLL_MS = 5000;

export function isAlertable(u: Urgency): u is AlertUrgency {
  return u === 'emergency' || u === 'urgent_safety';
}

export type CommunityAlert = {
  id: string;
  urgency: AlertUrgency;
  situation: Situation;
  /** Snapped to a ~1 km grid. Never the exact point. */
  coords: Coords;
  /** ISO time, to the minute. */
  at: string;
  /** Posted from this phone. Shown as "Your alert", never hidden, so the resident sees it worked. */
  mine?: boolean;
};

/** Builds the only record that ever leaves the phone: everything else is dropped here. */
export function makeAlert(args: { id: string; urgency: AlertUrgency; situation: Situation; coords: Coords; now: Date }): CommunityAlert {
  const at = new Date(args.now);
  at.setUTCSeconds(0, 0);
  return { id: args.id, urgency: args.urgency, situation: args.situation, coords: approximate(args.coords), at: at.toISOString() };
}

export function isExpired(a: CommunityAlert, now: Date): boolean {
  return now.getTime() - new Date(a.at).getTime() > ALERT_TTL_HOURS * 3_600_000;
}

export type NearAlert = CommunityAlert & { km: number };

/**
 * Alerts that reach `origin`: still current and inside the radius for their seriousness. Emergencies first,
 * then nearest, then newest. The server applies the same rule, so a stale or over-broad answer is trimmed here too.
 */
export function alertsNearby(alerts: CommunityAlert[], origin: Coords, now: Date = new Date()): NearAlert[] {
  return alerts
    .filter((a) => !isExpired(a, now))
    .map((a) => ({ ...a, km: distanceKm(origin, a.coords) }))
    .filter((a) => a.km <= ALERT_RADIUS_KM[a.urgency])
    .sort((a, b) => rank(b.urgency) - rank(a.urgency) || a.km - b.km || b.at.localeCompare(a.at));
}

const rank = (u: AlertUrgency) => (u === 'emergency' ? 1 : 0);

/** Whole minutes since the alert, never negative (phone clocks drift). */
export function minutesAgo(at: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(at).getTime()) / 60_000));
}
