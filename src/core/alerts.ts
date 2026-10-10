import { approximate } from './community';
import { distanceKm } from './geo';
import type { Coords, Lang, Situation, Urgency } from './types';

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

/**
 * What neighbors read: the kind of emergency, named for someone looking in from outside ("Flooding", not the card
 * title "Water entering your home", which is written to the person it is happening to). `other` has no label:
 * the screen shows its own "Someone needs help". Spanish and Creole are drafts, like the guidance cards (NATIVE REVIEW).
 */
export const ALERT_CATEGORY: Record<Exclude<Situation, 'other'>, Record<Lang, string>> = {
  water_in_home: { en: 'Flooding', es: 'Inundación', ht: 'Inondasyon' },
  injury_trapped: { en: 'Person hurt or trapped', es: 'Persona herida o atrapada', ht: 'Moun blese oswa bloke' },
  fire_gas: { en: 'Fire or gas smell', es: 'Incendio u olor a gas', ht: 'Dife oswa odè gaz' },
  generator_fumes: { en: 'Generator fumes', es: 'Gases de generador', ht: 'Lafimen dèlko' },
  downed_line: { en: 'Downed power line', es: 'Cable eléctrico caído', ht: 'Kab elektrisite ki tonbe' },
  medical_device: { en: 'Medical device without power', es: 'Equipo médico sin electricidad', ht: 'Aparèy medikal san kouran' },
  power_outage: { en: 'Power outage', es: 'Apagón', ht: 'Blakawout' },
  street_hazard: { en: 'Tree, debris or flooding on road', es: 'Árbol, escombros o inundación en la calle', ht: 'Pyebwa, debri oswa dlo sou wout' },
  need_shelter: { en: 'Needs shelter', es: 'Necesita refugio', ht: 'Bezwen abri' },
  need_supplies: { en: 'Needs food, water or medicine', es: 'Necesita comida, agua o medicinas', ht: 'Bezwen manje, dlo oswa medikaman' },
};

/** The alert's category in the reader's language, or `fallback` when the situation is `other`. */
export function alertCategory(situation: Situation, lang: Lang, fallback: string): string {
  return situation === 'other' ? fallback : ALERT_CATEGORY[situation][lang];
}

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
