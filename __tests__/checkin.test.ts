import { CHECKIN_STATUSES, ago, composeCheckIn, groupByLanguage, mapLink, placeText, validPhone } from '../src/core/checkin';
import type { Contact, Lang } from '../src/core/types';

const LANGS: Lang[] = ['en', 'es', 'ht'];

describe('composeCheckIn', () => {
  test.each(LANGS.flatMap((l) => CHECKIN_STATUSES.map((s) => [l, s] as const)))('%s / %s names the sender, the place and the time', (lang, status) => {
    const m = composeCheckIn({ status, lang, name: 'Marie Joseph', place: '123 NW 54th St', time: '9:41 PM' });
    expect(m).toContain('Marie Joseph');
    expect(m).toContain('123 NW 54th St');
    expect(m).toContain('9:41 PM');
    expect(m.length).toBeLessThanOrEqual(320); // two SMS segments at most
  });

  test('the "need help" text tells family to call 911 if they cannot reach the sender, in every language', () => {
    for (const lang of LANGS) {
      expect(composeCheckIn({ status: 'need_help', lang, name: 'M', place: 'x', time: 't' })).toContain('911');
    }
  });

  test('the "I\'m OK" text does not mention 911 (no false alarm for family)', () => {
    for (const lang of LANGS) expect(composeCheckIn({ status: 'safe', lang, name: 'M', place: 'x', time: 't' })).not.toContain('911');
  });

  test('written in the recipient language, not the sender\'s', () => {
    expect(composeCheckIn({ status: 'safe', lang: 'ht', name: 'Marie', place: 'x', time: 't' })).toContain('Mwen byen');
    expect(composeCheckIn({ status: 'safe', lang: 'es', name: 'Marie', place: 'x', time: 't' })).toContain('Estoy bien');
  });

  test('a missing name falls back to AidNow', () => {
    expect(composeCheckIn({ status: 'safe', lang: 'en', name: '', place: 'x', time: 't' })).toMatch(/^AidNow \(AidNow\)/);
  });
});

describe('placeText and mapLink', () => {
  const here = { lat: 25.83271, lon: -80.19468 };
  test('the saved address is the place in words, whether or not there is a GPS fix', () => {
    expect(placeText('123 NW 54th St', here, 'en')).toBe('123 NW 54th St');
    expect(placeText('123 NW 54th St', null, 'en')).toBe('123 NW 54th St');
  });
  test('GPS numbers stand in for the address when the resident has none', () => {
    expect(placeText('', { lat: 25.8, lon: -80.2 }, 'en')).toBe('GPS 25.80000, -80.20000');
  });
  test('nothing known says so in the recipient language', () => {
    expect(placeText('  ', null, 'es')).toBe('desconocida');
  });
  test('the map link opens the exact position on any phone', () => {
    expect(mapLink(here)).toBe('https://maps.google.com/?q=25.83271,-80.19468');
    expect(mapLink({ lat: 25.8, lon: -80.2 })).toBe('https://maps.google.com/?q=25.80000,-80.20000');
  });
});

describe('the map link in a check-in text', () => {
  const url = 'https://maps.google.com/?q=25.83271,-80.19468';
  test.each(LANGS)('%s: the link is the very last thing, with no punctuation after it, so it stays tappable', (lang) => {
    const m = composeCheckIn({ status: 'need_help', lang, name: 'Marie', place: '123 NW 54th St', time: '9:41 PM', mapUrl: url });
    expect(m.endsWith(url)).toBe(true);
    expect(m).toContain('123 NW 54th St');
  });
  test('without a GPS fix there is no link and no stray space', () => {
    const m = composeCheckIn({ status: 'safe', lang: 'en', name: 'Marie', place: 'x', time: 't' });
    expect(m).not.toContain('http');
    expect(m.endsWith('.')).toBe(true);
  });
  test.each(LANGS.flatMap((l) => CHECKIN_STATUSES.map((s) => [l, s] as const)))('%s / %s with a link stays within five SMS segments', (lang, status) => {
    // Creole and Spanish use accents, so SMS counts 70 characters per segment, 67 once joined.
    const m = composeCheckIn({ status, lang, name: 'Marie Joseph', place: '123 Northwest 54th Street, Miami', time: '9:41 PM', mapUrl: url });
    expect(m.length).toBeLessThanOrEqual(335);
  });
});

describe('groupByLanguage', () => {
  const p = (name: string, language: Lang): Contact => ({ id: name, name, phone: '3055550000', language });
  test('one group per language, in first-seen order, nobody dropped', () => {
    const g = groupByLanguage([p('Ana', 'es'), p('Jean', 'ht'), p('Luis', 'es'), p('Sam', 'en')]);
    expect(g.map((x) => x.lang)).toEqual(['es', 'ht', 'en']);
    expect(g[0].people.map((x) => x.name)).toEqual(['Ana', 'Luis']);
    expect(g.flatMap((x) => x.people)).toHaveLength(4);
  });
  test('empty in, empty out', () => expect(groupByLanguage([])).toEqual([]));
});

describe('validation and time', () => {
  test('phone needs at least 7 digits', () => {
    expect(validPhone('(305) 555-0100')).toBe(true);
    expect(validPhone('555-01')).toBe(false);
    expect(validPhone('')).toBe(false);
  });
  test('ago picks minutes, hours, then days', () => {
    const now = new Date('2026-10-10T12:00:00Z');
    expect(ago('2026-10-10T11:59:40Z', now)).toEqual({ unit: 'min', count: 1 });
    expect(ago('2026-10-10T11:15:00Z', now)).toEqual({ unit: 'min', count: 45 });
    expect(ago('2026-10-10T09:00:00Z', now)).toEqual({ unit: 'hour', count: 3 });
    expect(ago('2026-10-08T12:00:00Z', now)).toEqual({ unit: 'day', count: 2 });
  });
});
