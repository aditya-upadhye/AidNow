import {
  approximate,
  canDonateTo,
  checkInMessage,
  donorRequestMessage,
  eligibleToDonate,
  findDonors,
  findHelpers,
  findNeighborsToCheck,
  normalizeBloodType,
  toMember,
  DEFAULT_SETTINGS,
  type Member,
} from '../src/core/community';
import en from '../src/i18n/en';
import { SAMPLE_MEMBERS, DEMO_ORIGIN } from '../src/data/communitySeed';

const NOW = new Date('2026-10-10T12:00:00Z');

describe('blood types', () => {
  test.each([
    ['O+', 'O+'],
    ['o pos', 'O+'],
    ['AB negative', 'AB-'],
    ['a positif', 'A+'],
    ['B-', 'B-'],
  ])('normalizes %s', (raw, want) => expect(normalizeBloodType(raw)).toBe(want));

  test.each(['', 'C+', 'O', 'positive', undefined])('rejects %p', (raw) => expect(normalizeBloodType(raw as string)).toBeNull());

  test('O- gives to everyone, AB+ receives from everyone', () => {
    for (const r of ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'] as const) expect(canDonateTo('O-', r)).toBe(true);
    for (const d of ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'] as const) expect(canDonateTo(d, 'AB+')).toBe(true);
  });
  test('incompatible pairs are refused', () => {
    expect(canDonateTo('A+', 'O+')).toBe(false);
    expect(canDonateTo('B+', 'A+')).toBe(false);
    expect(canDonateTo('O+', 'O-')).toBe(false);
    expect(canDonateTo('AB+', 'AB-')).toBe(false);
  });
});

describe('donation gap', () => {
  test('no record means eligible', () => expect(eligibleToDonate(undefined, NOW)).toBe(true));
  test('55 days ago is too soon, 56 is fine', () => {
    expect(eligibleToDonate('2026-08-16', NOW)).toBe(false);
    expect(eligibleToDonate('2026-08-15', NOW)).toBe(true);
  });
  test('an unreadable date does not block a donor', () => expect(eligibleToDonate('soon', NOW)).toBe(true));
});

describe('findDonors', () => {
  test('returns only compatible, available, rested donors, exact type first', () => {
    const r = findDonors(SAMPLE_MEMBERS, 'O+', DEMO_ORIGIN, 40, NOW);
    const names = r.map((m) => m.name);
    expect(names).toContain('Jean'); // O+, last gave in May
    expect(names).toContain('Marisol'); // O-, compatible
    expect(names).not.toContain('Andre'); // O+ but unavailable
    expect(names).not.toContain('Daniel'); // A+ cannot give to O+
    expect(r[0].donor!.bloodType).toBe('O+'); // exact match ahead of the universal donor
  });
  test('a donor who gave 3 weeks ago is excluded', () => {
    expect(findDonors(SAMPLE_MEMBERS, 'A+', DEMO_ORIGIN, 40, NOW).map((m) => m.name)).not.toContain('Daniel');
  });
  test('radius is respected', () => {
    expect(findDonors(SAMPLE_MEMBERS, 'O-', DEMO_ORIGIN, 1, NOW)).toHaveLength(0);
  });
  test('never returns organizations or people who did not opt in as donors', () => {
    const r = findDonors(SAMPLE_MEMBERS, 'AB+', DEMO_ORIGIN, 100, NOW);
    expect(r.every((m) => m.kind === 'person' && m.donor)).toBe(true);
  });
});

describe('neighbors and helpers', () => {
  test('oxygen and mobility needs sort ahead of closer, lower-risk needs', () => {
    const near: Member = { id: 'a', kind: 'person', name: 'Near', coords: DEMO_ORIGIN, languages: ['en'], phone: '', needsCheckIn: { flags: ['alone'] } };
    const far: Member = { id: 'b', kind: 'person', name: 'Far', coords: { lat: 25.86, lon: -80.2 }, languages: ['en'], phone: '', needsCheckIn: { flags: ['oxygen'] } };
    expect(findNeighborsToCheck([near, far], DEMO_ORIGIN).map((m) => m.name)).toEqual(['Far', 'Near']);
  });
  test('skill filter keeps only matching volunteers and groups', () => {
    const r = findHelpers(SAMPLE_MEMBERS, DEMO_ORIGIN, 'first_aid', 30);
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((m) => m.volunteer!.skills.includes('first_aid'))).toBe(true);
  });
});

describe('privacy', () => {
  const base = { id: 'me', firstName: 'Marie', coords: { lat: 25.83271, lon: -80.19468 }, language: 'ht' as const, bloodType: 'O+' as const };
  const on = { ...DEFAULT_SETTINGS, consented: true, phone: '3055550000', donor: true };

  test('nothing is published without consent, a phone or a role', () => {
    expect(toMember({ ...base, settings: { ...on, consented: false } })).toBeNull();
    expect(toMember({ ...base, settings: { ...on, phone: '' } })).toBeNull();
    expect(toMember({ ...base, settings: { ...on, donor: false } })).toBeNull();
  });
  test('location is rounded to about 1 km and only switched-on roles appear', () => {
    const m = toMember({ ...base, settings: on })!;
    expect(m.coords).toEqual({ lat: 25.83, lon: -80.19 });
    expect(m.donor?.bloodType).toBe('O+');
    expect(m.volunteer).toBeUndefined();
    expect(m.needsCheckIn).toBeUndefined();
    expect(JSON.stringify(m)).not.toContain('25.83271');
  });
  test('donor role needs a blood type', () => {
    expect(toMember({ ...base, bloodType: null, settings: on })!.donor).toBeUndefined();
  });
  test('approximate snaps both axes', () => expect(approximate({ lat: 25.8349, lon: -80.1951 })).toEqual({ lat: 25.83, lon: -80.2 }));
});

describe('messages', () => {
  const t = (key: string, opts?: Record<string, unknown>) => {
    const val = key.split('.').reduce<any>((o, k) => o[k], en);
    return String(val).replace(/\{\{(\w+)\}\}/g, (_, k) => String(opts?.[k] ?? ''));
  };
  test('donor request names the type and hospital and fits in two SMS segments', () => {
    const m = donorRequestMessage(t, { requester: 'Marie', type: 'O+', hospital: 'Jackson Memorial' });
    expect(m).toContain('O+');
    expect(m).toContain('Jackson Memorial');
    expect(m.length).toBeLessThanOrEqual(320);
  });
  test('without a hospital the message has no dangling "at"', () => {
    expect(donorRequestMessage(t, { requester: 'Marie', type: 'O+', hospital: '' })).not.toMatch(/\bat\s*\./);
  });
  test('check-in message names both people', () => {
    const m = checkInMessage(t, { volunteer: 'Rosa', neighbor: 'Marie' });
    expect(m).toContain('Rosa');
    expect(m).toContain('Marie');
  });
});
