import { draftsFromRows, filterRows, isAdded, phoneRows, type PhoneContact } from '../src/core/phonebook';
import type { Contact } from '../src/core/types';

const book: PhoneContact[] = [
  { id: '1', name: 'Zoë Martin', phoneNumbers: [{ number: '(305) 555-0101', label: 'mobile' }] },
  { id: '2', name: 'Abuela Rosa', phoneNumbers: [{ number: '+1 305 555 0102', label: 'home' }, { number: '305-555-0103', label: 'mobile' }] },
  { id: '3', name: 'No Phone', phoneNumbers: [] },
  { id: '4', name: 'Bad Number', phoneNumbers: [{ number: '12' }] },
  { id: '5', name: 'Jean Pierre', phoneNumbers: [{ number: '305-555-0104', label: 'mobile' }, { number: '(305) 555-0104', label: 'iPhone' }] },
  { id: '6', phoneNumbers: [{ number: '305-555-0105' }] },
];

describe('phoneRows', () => {
  const rows = phoneRows(book);
  test('one row per usable number; people without a phone or with a junk number are left out', () => {
    expect(rows.map((r) => r.name)).toEqual(['305-555-0105', 'Abuela Rosa', 'Abuela Rosa', 'Jean Pierre', 'Zoë Martin']);
  });
  test('the same number listed twice for one person shows once', () => {
    expect(rows.filter((r) => r.name === 'Jean Pierre')).toHaveLength(1);
  });
  test('a person with two numbers gets two rows with distinct keys', () => {
    const rosa = rows.filter((r) => r.name === 'Abuela Rosa');
    expect(rosa).toHaveLength(2);
    expect(new Set(rows.map((r) => r.key)).size).toBe(rows.length);
  });
  test('a contact with no name falls back to the number', () => {
    expect(rows.find((r) => r.number === '305-555-0105')!.name).toBe('305-555-0105');
  });
  test('an empty address book is fine', () => expect(phoneRows([])).toEqual([]));
});

describe('filterRows', () => {
  const rows = phoneRows(book);
  test('empty query keeps everything', () => expect(filterRows(rows, '  ')).toHaveLength(rows.length));
  test('name search ignores case and accents', () => {
    expect(filterRows(rows, 'zoe').map((r) => r.name)).toEqual(['Zoë Martin']);
    expect(filterRows(rows, 'ROSA')).toHaveLength(2);
  });
  test('number search matches digits however the number is formatted', () => {
    expect(filterRows(rows, '555-0104').map((r) => r.name)).toEqual(['Jean Pierre']);
    expect(filterRows(rows, '0102')).toHaveLength(1);
  });
  test('too few digits do not match every number', () => expect(filterRows(phoneRows(book.slice(0, 5)), '30')).toHaveLength(0));
});

describe('draftsFromRows', () => {
  const rows = phoneRows(book);
  const existing: Contact[] = [{ id: 'x', name: 'Rosa', phone: '3055550102', language: 'es' }];
  const keyOf = (name: string, i = 0) => rows.filter((r) => r.name === name)[i].key;

  test('only ticked rows become contacts, in the chosen language', () => {
    const d = draftsFromRows(rows, new Set([keyOf('Zoë Martin'), keyOf('Jean Pierre')]), [], 'ht');
    expect(d).toEqual([
      { name: 'Jean Pierre', phone: '305-555-0104', language: 'ht' },
      { name: 'Zoë Martin', phone: '(305) 555-0101', language: 'ht' },
    ]);
  });
  test('a number already in the list is skipped, even in another format', () => {
    // "+1 305 555 0102" is the same number as the saved "3055550102".
    expect(draftsFromRows(rows, new Set([keyOf('Abuela Rosa', 0)]), existing, 'en')).toEqual([]);
    expect(isAdded(rows.find((r) => r.number === '+1 305 555 0102')!, existing)).toBe(true);
    expect(isAdded(rows.find((r) => r.number === '305-555-0103')!, existing)).toBe(false);
  });
  test('the other number of the same person can still be added', () => {
    expect(draftsFromRows(rows, new Set([keyOf('Abuela Rosa', 1)]), existing, 'en').map((d) => d.phone)).toEqual(['305-555-0103']);
  });
  test('nothing ticked adds nothing', () => expect(draftsFromRows(rows, new Set(), [], 'en')).toEqual([]));
});
