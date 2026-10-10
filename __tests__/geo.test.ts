import { zoneAt, type ZoneCollection } from '../src/core/geo';
import zones from '../src/data/zones.json';

const Z = zones as unknown as ZoneCollection;

/** Expected values are the County server's own answers for these points (queried 2026-10-09). */
describe('storm surge zone lookup on the County polygons', () => {
  test('Miami Beach point is Zone B', () => {
    expect(zoneAt({ lat: 25.7907, lon: -80.13 }, Z)).toBe('B');
  });
  test('Downtown Miami point is Zone B', () => {
    expect(zoneAt({ lat: 25.7743, lon: -80.1904 }, Z)).toBe('B');
  });
  test('Hialeah point is outside the surge zones (N)', () => {
    expect(zoneAt({ lat: 25.8576, lon: -80.2781 }, Z)).toBe('N');
  });
  test('Little Haiti point is outside the surge zones (N)', () => {
    expect(zoneAt({ lat: 25.8327, lon: -80.1946 }, Z)).toBe('N');
  });
});
