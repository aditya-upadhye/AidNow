import { composeCheckIn, groupByLanguage, mapLink, placeText, type CheckInStatus } from '../core/checkin';
import type { Contact, Coords, Lang, Profile } from '../core/types';
import { textMany } from './actions';
import { getCoords } from './location';

/**
 * Every "text my contacts" button goes through here: the SOS screen, the emergency result and the family
 * check-in. Contacts are grouped by language, and each group gets one Messages composer in its own language.
 * AidNow never sends anything: the resident taps send in each composer.
 */
export async function textGroups(contacts: Contact[], build: (lang: Lang) => string): Promise<void> {
  for (const g of groupByLanguage(contacts)) await textMany(g.people.map((p) => p.phone), build(g.lang));
}

/** A GPS fix works with no data, but a slow one must never hold up an emergency text. */
export async function quickCoords(timeoutMs = 4000): Promise<Coords | null> {
  return Promise.race([getCoords(timeoutMs), new Promise<null>((r) => setTimeout(() => r(null), timeoutMs + 500))]);
}

/** Tell these contacts how the resident is, with their address and a map link to where they are now. */
export async function notifyStatus(profile: Profile, contacts: Contact[], status: CheckInStatus): Promise<void> {
  if (contacts.length === 0) return;
  const coords = await quickCoords();
  const time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  await textGroups(contacts, (lang) => composeCheckIn({ status, lang, name: profile.fullName, place: placeText(profile.address, coords, lang), time, mapUrl: coords ? mapLink(coords) : undefined }));
}
