import type { Contact, Coords, Lang } from './types';

/**
 * "Let family know": a status text to the emergency contact and a small family circle, each in their own
 * language. Built from templates, never by a model. The resident taps send; AidNow never sends it.
 */

export type CheckInStatus = 'safe' | 'need_help' | 'evacuating' | 'no_power';
export const CHECKIN_STATUSES: CheckInStatus[] = ['safe', 'need_help', 'evacuating', 'no_power'];

const LINE: Record<CheckInStatus, Record<Lang, string>> = {
  safe: { en: "I'm OK.", es: 'Estoy bien.', ht: 'Mwen byen.' },
  need_help: {
    en: "I need help. Please call me. If you can't reach me, call 911 and give them my location.",
    es: 'Necesito ayuda. Por favor llámame. Si no logras comunicarte conmigo, llama al 911 y da mi ubicación.',
    ht: 'Mwen bezwen èd. Tanpri rele m. Si w pa ka jwenn mwen, rele 911 epi bay yo kote m ye a.',
  },
  evacuating: { en: "I'm evacuating.", es: 'Estoy evacuando.', ht: 'M ap evakye.' },
  no_power: { en: "The power is out, but I'm safe.", es: 'No hay luz, pero estoy a salvo.', ht: 'Pa gen kouran, men mwen an sekirite.' },
};

const FRAME: Record<Lang, { where: string; sent: string }> = {
  en: { where: 'Location', sent: 'Sent' },
  es: { where: 'Ubicación', sent: 'Enviado' },
  ht: { where: 'Kote', sent: 'Voye' },
};

const NO_LOCATION: Record<Lang, string> = { en: 'unknown', es: 'desconocida', ht: 'pa konnen' };

/**
 * A link that opens the position in a map app. Google's works on every phone (iPhone, Android, a browser),
 * which matters when family is in another state on a different device. Five decimals is about a metre.
 */
export function mapLink(coords: Coords): string {
  return `https://maps.google.com/?q=${coords.lat.toFixed(5)},${coords.lon.toFixed(5)}`;
}

/** The place in words: the saved address, else raw GPS numbers, else "unknown". The map link goes at the end of the text. */
export function placeText(address: string, coords: Coords | null, lang: Lang): string {
  return address.trim() || (coords ? `GPS ${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}` : NO_LOCATION[lang]);
}

export function composeCheckIn(args: { status: CheckInStatus; lang: Lang; name: string; place: string; time: string; mapUrl?: string }): string {
  const { status, lang, name, place, time, mapUrl } = args;
  const F = FRAME[lang];
  // The link is last and has no punctuation after it, so messaging apps make all of it tappable.
  return `${name || 'AidNow'} (AidNow): ${LINE[status][lang]} ${F.where}: ${place}. ${F.sent} ${time}.${mapUrl ? ` ${mapUrl}` : ''}`;
}

/** One composer per language, so each person reads the text in their own. Order is stable. */
export function groupByLanguage(people: Contact[]): { lang: Lang; people: Contact[] }[] {
  const groups = new Map<Lang, Contact[]>();
  for (const p of people) groups.set(p.language, [...(groups.get(p.language) ?? []), p]);
  return [...groups].map(([lang, list]) => ({ lang, people: list }));
}

export { validPhone } from './contacts';

export type Ago = { unit: 'min' | 'hour' | 'day'; count: number };

export function ago(iso: string, now: Date = new Date()): Ago {
  const mins = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return { unit: 'min', count: Math.max(1, mins) };
  if (mins < 60 * 24) return { unit: 'hour', count: Math.round(mins / 60) };
  return { unit: 'day', count: Math.round(mins / (60 * 24)) };
}
