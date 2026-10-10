import { phoneKey, validPhone, type ContactDraft } from './contacts';
import type { Contact, Lang } from './types';

/**
 * Turns the phone's address book into rows a person can pick from. Pure, so it is tested without a device.
 * The address book itself is read in components/ContactPicker.tsx, only after the resident asks for it.
 */

/** The parts of an `expo-contacts` contact this app uses. */
export type PhoneContact = {
  id?: string;
  name?: string;
  phoneNumbers?: { number?: string; label?: string }[];
};

/** One selectable row: one person's one number. A person with two numbers gets two rows. */
export type PhoneRow = { key: string; name: string; number: string; label: string };

const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function phoneRows(contacts: PhoneContact[]): PhoneRow[] {
  const rows: PhoneRow[] = [];
  for (const [i, c] of contacts.entries()) {
    const seen = new Set<string>();
    for (const [j, p] of (c.phoneNumbers ?? []).entries()) {
      const number = (p.number ?? '').trim();
      // A person can list the same number twice (mobile and iPhone); show it once.
      if (!validPhone(number) || seen.has(phoneKey(number))) continue;
      seen.add(phoneKey(number));
      rows.push({ key: `${c.id ?? i}:${j}`, name: (c.name ?? '').trim() || number, number, label: (p.label ?? '').trim() });
    }
  }
  return rows.sort((a, b) => fold(a.name).localeCompare(fold(b.name)) || a.number.localeCompare(b.number));
}

/** Matches by name (any case, accents ignored) or by the digits of a number. */
export function filterRows(rows: PhoneRow[], query: string): PhoneRow[] {
  const q = fold(query.trim());
  if (!q) return rows;
  const digits = q.replace(/\D/g, '');
  return rows.filter((r) => fold(r.name).includes(q) || (digits.length >= 3 && r.number.replace(/\D/g, '').includes(digits)));
}

export const isAdded = (row: PhoneRow, existing: Contact[]) => existing.some((c) => phoneKey(c.phone) === phoneKey(row.number));

/**
 * The contacts to add for the rows the resident ticked. Numbers already in the list are skipped, and so is
 * the same number ticked under two names, so nobody is texted twice.
 */
export function draftsFromRows(rows: PhoneRow[], selected: ReadonlySet<string>, existing: Contact[], language: Lang): ContactDraft[] {
  const taken = new Set(existing.map((c) => phoneKey(c.phone)));
  const out: ContactDraft[] = [];
  for (const r of rows) {
    if (!selected.has(r.key) || taken.has(phoneKey(r.number))) continue;
    taken.add(phoneKey(r.number));
    out.push({ name: r.name, phone: r.number, language });
  }
  return out;
}
