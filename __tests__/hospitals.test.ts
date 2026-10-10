import { dialable, findHospitals, fullAddress } from '../src/core/hospitals';
import { DEMO_ORIGIN } from '../src/data/communitySeed';
import { HOSPITALS } from '../src/data/hospitals';

describe('bundled hospital list', () => {
  test('has the 20 Miami-Dade hospitals from the CMS registry, each with a phone and coordinates', () => {
    expect(HOSPITALS).toHaveLength(20);
    for (const h of HOSPITALS) {
      expect(dialable(h.phone)).toHaveLength(10);
      // Inside Miami-Dade County, roughly.
      expect(h.coords.lat).toBeGreaterThan(25.4);
      expect(h.coords.lat).toBeLessThan(26.0);
      expect(h.coords.lon).toBeGreaterThan(-80.55);
      expect(h.coords.lon).toBeLessThan(-80.1);
    }
  });
  test('ids are unique', () => {
    expect(new Set(HOSPITALS.map((h) => h.id)).size).toBe(HOSPITALS.length);
  });
  test('Jackson Health System is a known anchor: correct main number and emergency flag', () => {
    const j = HOSPITALS.find((h) => h.name === 'Jackson Health System')!;
    expect(j.phone).toBe('(305) 585-1111');
    expect(j.emergency).toBe(true);
  });
});

describe('findHospitals', () => {
  test('returns the nearest first, capped by the limit', () => {
    const r = findHospitals(HOSPITALS, DEMO_ORIGIN, 5);
    expect(r).toHaveLength(5);
    expect(r.map((h) => h.km)).toEqual([...r.map((h) => h.km)].sort((a, b) => a - b));
  });
  test('from Little Haiti the closest is a Miami hospital within a few km', () => {
    const [first] = findHospitals(HOSPITALS, DEMO_ORIGIN, 1);
    expect(first.km).toBeLessThan(5);
  });
  test('radius excludes far hospitals', () => {
    expect(findHospitals(HOSPITALS, { lat: 25.2, lon: -80.9 }, 5, 10)).toHaveLength(0);
  });
});

describe('helpers', () => {
  test('dialable strips punctuation', () => expect(dialable('(786) 596-1960')).toBe('7865961960'));
  test('fullAddress is a one-line maps query', () => {
    const j = HOSPITALS.find((h) => h.name === 'Jackson Health System')!;
    expect(fullAddress(j)).toBe('Jackson Health System, 1611 NW 12th Ave, Miami, FL 33136');
  });
});
