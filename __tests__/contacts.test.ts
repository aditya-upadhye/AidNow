import { addContact, contactProblem, contactsOf, firstName, migrateProfile, removeContact, updateContact, validPhone } from '../src/core/contacts';
import type { Contact } from '../src/core/types';

const jean: Contact = { id: 'a', name: 'Jean', phone: '(305) 555-0101', language: 'ht' };
const rosa: Contact = { id: 'b', name: 'Rosa', phone: '305-555-0102', language: 'es' };

describe('contactProblem', () => {
  const ok = { name: 'Ana', phone: '305 555 0199', language: 'en' as const };
  test('a complete, new contact is fine', () => expect(contactProblem(ok, [jean, rosa])).toBeNull());
  test('name is required', () => expect(contactProblem({ ...ok, name: '   ' }, [])).toBe('name'));
  test('phone needs at least 7 digits', () => {
    expect(contactProblem({ ...ok, phone: '555-01' }, [])).toBe('phone');
    expect(validPhone('+1 (305) 555-0100')).toBe(true);
  });
  test('the same number in a different format is a duplicate', () => {
    expect(contactProblem({ ...ok, phone: '3055550101' }, [jean])).toBe('duplicate');
    expect(contactProblem({ ...ok, phone: '+1 305 555 0101' }, [jean])).toBe('duplicate'); // US +1 prefix is the same number
    expect(contactProblem({ ...ok, phone: '+44 20 7946 0958' }, [jean])).toBeNull();
  });
  test('editing a contact does not make it a duplicate of itself', () => {
    expect(contactProblem({ name: 'Jean P.', phone: '(305) 555-0101', language: 'ht' }, [jean, rosa], 'a')).toBeNull();
    expect(contactProblem({ name: 'Jean', phone: '305-555-0102', language: 'ht' }, [jean, rosa], 'a')).toBe('duplicate');
  });
});

describe('add, update, remove', () => {
  test('there is no limit on how many contacts can be added', () => {
    let list: Contact[] = [];
    for (let i = 0; i < 25; i++) list = addContact(list, { name: `P${i}`, phone: `30555501${String(i).padStart(2, '0')}`, language: 'en' });
    expect(list).toHaveLength(25);
    expect(new Set(list.map((c) => c.id)).size).toBe(25);
  });
  test('add trims and keeps order', () => {
    const list = addContact([jean], { name: '  Rosa ', phone: ' 305-555-0102 ', language: 'es' });
    expect(list.map((c) => c.name)).toEqual(['Jean', 'Rosa']);
    expect(list[1].phone).toBe('305-555-0102');
  });
  test('update changes only the matching contact', () => {
    const list = updateContact([jean, rosa], 'b', { name: 'Rosa M', phone: '305-555-0102', language: 'en' });
    expect(list[0]).toEqual(jean);
    expect(list[1]).toMatchObject({ id: 'b', name: 'Rosa M', language: 'en' });
  });
  test('remove drops the contact, and can empty the list', () => {
    expect(removeContact([jean, rosa], 'a')).toEqual([rosa]);
    expect(removeContact([jean], 'a')).toEqual([]);
    expect(removeContact([jean], 'zzz')).toEqual([jean]);
  });
  test('does not mutate its input', () => {
    const list = [jean];
    removeContact(list, 'a');
    addContact(list, { name: 'X', phone: '3055550000', language: 'en' });
    expect(list).toEqual([jean]);
  });
});

describe('migrateProfile (profiles saved before multiple contacts)', () => {
  const base = { language: 'ht', fullName: 'Marie', address: '123 NW 54 St' };
  test('the single contact becomes the first of the list, in the resident language by default', () => {
    const p = migrateProfile({ ...base, contactName: 'Jean', contactPhone: '305-555-0101' });
    expect(p.contacts).toEqual([{ id: 'legacy-0', name: 'Jean', phone: '305-555-0101', language: 'ht' }]);
    expect(p).not.toHaveProperty('contactName');
    expect(p).not.toHaveProperty('contactPhone');
  });
  test('contactLanguage and the family circle carry over, without duplicates', () => {
    const p = migrateProfile({
      ...base,
      contactName: 'Jean',
      contactPhone: '305-555-0101',
      contactLanguage: 'en',
      familyCircle: [{ name: 'Rosa', phone: '305-555-0102', language: 'es' }, { name: 'Jean again', phone: '(305) 555-0101', language: 'en' }],
    });
    expect(p.contacts.map((c) => [c.name, c.language])).toEqual([['Jean', 'en'], ['Rosa', 'es']]);
    expect(p).not.toHaveProperty('familyCircle');
  });
  test('an unusable old number is dropped instead of crashing', () => {
    expect(migrateProfile({ ...base, contactName: 'Jean', contactPhone: '12' }).contacts).toEqual([]);
  });
  test('an already-migrated profile is left alone', () => {
    const p = migrateProfile({ ...base, contacts: [jean] });
    expect(p.contacts).toEqual([jean]);
  });
  test('other profile fields survive', () => {
    expect(migrateProfile({ ...base, bloodType: 'O+', contactName: 'J', contactPhone: '3055550101' })).toMatchObject({ bloodType: 'O+', fullName: 'Marie', address: '123 NW 54 St' });
  });
});

describe('helpers', () => {
  test('contactsOf is safe for no profile', () => {
    expect(contactsOf(null)).toEqual([]);
    expect(contactsOf(undefined)).toEqual([]);
  });
  test('firstName', () => {
    expect(firstName('Marie Joseph')).toBe('Marie');
    expect(firstName('  ')).toBe('  ');
  });
});
