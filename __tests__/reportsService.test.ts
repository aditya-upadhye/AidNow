import AsyncStorage from '@react-native-async-storage/async-storage';

import { aggregate } from '../src/core/reports';
import { areaFor, feed, submitReport } from '../src/services/reports';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));

const LITTLE_HAITI = { lat: 25.8327, lon: -80.1946 };
const base = { situation: 'street_hazard' as const, coords: LITTLE_HAITI, address: '123 NW 54th St, Miami, FL 33127' };
const own = async () => (await feed.events(new Date())).filter((e) => e.id.startsWith('own-'));

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('tapping Report', () => {
  test('counts the problem the resident chose, for their ZIP code', async () => {
    expect(await submitReport(base)).toBe('counted');
    const [e] = await own();
    expect(e.situation).toBe('street_hazard');
    expect(typeof e.zip).toBe('string');
  });

  test('the count shows up in the city view totals straight away', async () => {
    const before = aggregate(await feed.events(new Date()), { hours: 24, now: new Date() }).total;
    await submitReport(base);
    const after = aggregate(await feed.events(new Date()), { hours: 24, now: new Date() }).total;
    expect(after).toBe(before + 1);
  });

  test('it only records: no agency is contacted and nothing but the five anonymous fields is stored', async () => {
    await submitReport(base);
    const [e] = await own();
    expect(Object.keys(e).sort()).toEqual(['agency', 'at', 'id', 'situation', 'zip']);
    const stored = String(await AsyncStorage.getItem('aidnow.civic.events'));
    expect(stored).not.toContain('NW 54th');
    expect(stored).not.toContain('25.83');
    expect(e.at.endsWith(':00:00.000Z')).toBe(true);
  });

  test('emergencies and unclassified problems are never counted', async () => {
    for (const situation of ['water_in_home', 'injury_trapped', 'fire_gas', 'generator_fumes', 'other'] as const) {
      expect(await submitReport({ ...base, situation })).toBe('skipped');
    }
    expect(await own()).toHaveLength(0);
  });

  test('reporting the same problem again in the same hour does not double the count, and says so', async () => {
    expect(await submitReport(base)).toBe('counted');
    expect(await submitReport(base)).toBe('already');
    expect(await own()).toHaveLength(1);
  });

  test('a different problem in the same hour is a separate report', async () => {
    await submitReport(base);
    expect(await submitReport({ ...base, situation: 'power_outage' })).toBe('counted');
    expect(await own()).toHaveLength(2);
  });

  test('with no way to tell the ZIP code nothing is counted, and the result says why', async () => {
    expect(await submitReport({ ...base, coords: null, address: '' })).toBe('no_area');
    expect(await submitReport({ ...base, coords: { lat: 28.5, lon: -81.4 }, address: 'Orlando FL 32801' })).toBe('no_area');
    expect(await own()).toHaveLength(0);
  });

  test('the ZIP typed in the address is used when there are no coordinates', async () => {
    expect(await submitReport({ ...base, coords: null })).toBe('counted');
    expect((await own())[0].zip).toBe('33127');
  });
});

describe('areaFor', () => {
  test('coordinates win over the address', () => expect(areaFor(LITTLE_HAITI, 'x FL 33010')).not.toBe('33010'));
  test('falls back to the address, then to nothing', () => {
    expect(areaFor(null, 'Hialeah FL 33010')).toBe('33010');
    expect(areaFor(undefined, 'somewhere')).toBeNull();
  });
});
