import type { Contact, Lang, Profile } from './types';

/**
 * Emergency contacts: any number of people, each with the language to write to them in.
 * Pure functions, so the rules (what counts as valid, no duplicates, how old profiles migrate) are testable.
 */

export const digitsOf = (phone: string) => phone.replace(/\D/g, '');

/** Same person, same key: "+1 (305) 555-0101" and "305-555-0101" are one number, so one text. */
export const phoneKey = (phone: string) => {
  const d = digitsOf(phone);
  return d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
};

/** At least 7 digits, so a stray "555-01" is not saved as a phone number. */
export const validPhone = (phone: string) => digitsOf(phone).length >= 7;

export type ContactDraft = { name: string; phone: string; language: Lang };
export type ContactProblem = 'name' | 'phone' | 'duplicate';

/**
 * What is wrong with a contact, if anything. The same number can't be listed twice (it would text them twice);
 * when editing, the contact being edited doesn't count as a duplicate of itself.
 */
export function contactProblem(draft: ContactDraft, existing: Contact[], editingId?: string): ContactProblem | null {
  if (!draft.name.trim()) return 'name';
  if (!validPhone(draft.phone)) return 'phone';
  if (existing.some((c) => c.id !== editingId && phoneKey(c.phone) === phoneKey(draft.phone))) return 'duplicate';
  return null;
}

let counter = 0;
export function newId(): string {
  counter += 1;
  return `c${Date.now().toString(36)}${counter}${Math.random().toString(36).slice(2, 6)}`;
}

const clean = (d: ContactDraft) => ({ name: d.name.trim(), phone: d.phone.trim(), language: d.language });

export function addContact(list: Contact[], draft: ContactDraft): Contact[] {
  return [...list, { id: newId(), ...clean(draft) }];
}

export function updateContact(list: Contact[], id: string, draft: ContactDraft): Contact[] {
  return list.map((c) => (c.id === id ? { ...c, ...clean(draft) } : c));
}

export function removeContact(list: Contact[], id: string): Contact[] {
  return list.filter((c) => c.id !== id);
}

export const contactsOf = (profile: Profile | null | undefined): Contact[] => profile?.contacts ?? [];

export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/**
 * Profiles saved before multiple contacts had one `contactName` / `contactPhone` (and, briefly, a
 * `contactLanguage` and a `familyCircle`). Fold them into `contacts`, keeping the original contact first.
 */
export function migrateProfile(raw: Record<string, any>): Profile {
  const { contactName, contactPhone, contactLanguage, familyCircle, ...rest } = raw;
  if (Array.isArray(rest.contacts)) return rest as Profile;
  const legacy: Contact[] = [];
  if (typeof contactPhone === 'string' && validPhone(contactPhone)) {
    legacy.push({ id: 'legacy-0', name: String(contactName ?? '').trim(), phone: contactPhone.trim(), language: contactLanguage ?? rest.language ?? 'en' });
  }
  for (const [i, c] of (Array.isArray(familyCircle) ? familyCircle : []).entries()) {
    if (c && typeof c.phone === 'string' && validPhone(c.phone) && !legacy.some((l) => phoneKey(l.phone) === phoneKey(c.phone))) {
      legacy.push({ id: `legacy-${i + 1}`, name: String(c.name ?? '').trim(), phone: c.phone.trim(), language: c.language ?? rest.language ?? 'en' });
    }
  }
  return { ...rest, contacts: legacy } as Profile;
}
