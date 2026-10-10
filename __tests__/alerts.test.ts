import {
  ALERT_POLL_MS,
  ALERT_RADIUS_KM,
  ALERT_CATEGORY,
  ALERT_TTL_HOURS,
  alertCategory,
  alertsNearby,
  isAlertable,
  isExpired,
  makeAlert,
  minutesAgo,
  type CommunityAlert,
} from '../src/core/alerts';
import { DEMO_ORIGIN } from '../src/data/communitySeed';

const NOW = new Date('2026-10-10T12:00:00Z');
const HERE = DEMO_ORIGIN; // Little Haiti
/** A point `km` due north of HERE (1 degree of latitude is about 111.2 km). */
const north = (km: number) => ({ lat: HERE.lat + km / 111.2, lon: HERE.lon });
const alert = (over: Partial<CommunityAlert> & { id: string }): CommunityAlert => ({
  urgency: 'emergency',
  situation: 'water_in_home',
  coords: north(1),
  at: NOW.toISOString(),
  ...over,
});

describe('who can be alerted', () => {
  test('only emergencies and urgent safety problems are shared, never a non-emergency', () => {
    expect(isAlertable('emergency')).toBe(true);
    expect(isAlertable('urgent_safety')).toBe(true);
    expect(isAlertable('non_emergency')).toBe(false);
  });

  test('emergencies reach 5 km and urgent problems 2 km', () => {
    expect(ALERT_RADIUS_KM).toEqual({ emergency: 5, urgent_safety: 2 });
  });

  test('the screen asks the server every 5 seconds', () => {
    expect(ALERT_POLL_MS).toBe(5000);
  });
});

describe('what an alert holds', () => {
  test('only kind, seriousness, a ~1 km area and the minute: no name, address, photo or free text', () => {
    const a = makeAlert({
      id: 'x',
      urgency: 'emergency',
      situation: 'fire_gas',
      coords: { lat: 25.83271, lon: -80.19462 },
      now: new Date('2026-10-10T12:34:56.789Z'),
      // @ts-expect-error extra fields must never make it into the record
      name: 'Marie',
      address: '123 NW 54th St',
    });
    expect(Object.keys(a).sort()).toEqual(['at', 'coords', 'id', 'situation', 'urgency']);
    expect(a.coords).toEqual({ lat: 25.83, lon: -80.19 });
    expect(a.at).toBe('2026-10-10T12:34:00.000Z');
  });
});

describe('alertsNearby', () => {
  test('an emergency 4 km away reaches a volunteer; an urgent one 4 km away does not', () => {
    const list = [alert({ id: 'e', urgency: 'emergency', coords: north(4) }), alert({ id: 'u', urgency: 'urgent_safety', coords: north(4) })];
    expect(alertsNearby(list, HERE, NOW).map((a) => a.id)).toEqual(['e']);
  });

  test('beyond the radius nothing arrives', () => {
    const list = [alert({ id: 'e', urgency: 'emergency', coords: north(6) }), alert({ id: 'u', urgency: 'urgent_safety', coords: north(2.5) })];
    expect(alertsNearby(list, HERE, NOW)).toEqual([]);
  });

  test('an alert older than the time limit is dropped', () => {
    const old = new Date(NOW.getTime() - (ALERT_TTL_HOURS * 60 + 1) * 60_000).toISOString();
    const fresh = new Date(NOW.getTime() - (ALERT_TTL_HOURS * 60 - 1) * 60_000).toISOString();
    expect(isExpired(alert({ id: 'o', at: old }), NOW)).toBe(true);
    expect(alertsNearby([alert({ id: 'o', at: old }), alert({ id: 'f', at: fresh })], HERE, NOW).map((a) => a.id)).toEqual(['f']);
  });

  test('emergencies first, then nearest, then newest', () => {
    const list = [
      alert({ id: 'u-near', urgency: 'urgent_safety', coords: north(0.5) }),
      alert({ id: 'e-far', urgency: 'emergency', coords: north(4) }),
      alert({ id: 'e-near-old', urgency: 'emergency', coords: north(1), at: '2026-10-10T11:00:00.000Z' }),
      alert({ id: 'e-near-new', urgency: 'emergency', coords: north(1), at: '2026-10-10T11:50:00.000Z' }),
    ];
    expect(alertsNearby(list, HERE, NOW).map((a) => a.id)).toEqual(['e-near-new', 'e-near-old', 'e-far', 'u-near']);
  });

  test('reports how far away each one is', () => {
    const [a] = alertsNearby([alert({ id: 'e', coords: north(3) })], HERE, NOW);
    expect(a.km).toBeGreaterThan(2.9);
    expect(a.km).toBeLessThan(3.1);
  });
});

describe('minutesAgo', () => {
  test('whole minutes, and never negative when the phone clock is behind', () => {
    expect(minutesAgo('2026-10-10T11:57:30.000Z', NOW)).toBe(2);
    expect(minutesAgo('2026-10-10T12:05:00.000Z', NOW)).toBe(0);
  });
});

describe('alertCategory', () => {
  it('names water entering a home as flooding for neighbors, not "your home"', () => {
    expect(alertCategory('water_in_home', 'en', '')).toBe('Flooding');
    expect(alertCategory('water_in_home', 'es', '')).toBe('Inundación');
  });

  it('has a label in every language for every situation except other', () => {
    for (const labels of Object.values(ALERT_CATEGORY)) {
      for (const lang of ['en', 'es', 'ht'] as const) expect(labels[lang].length).toBeGreaterThan(0);
    }
  });

  it('uses the fallback for other', () => {
    expect(alertCategory('other', 'en', 'Someone needs help')).toBe('Someone needs help');
  });
});
