import { aqiCategory, summarizeAirNow } from '../src/core/airQuality';

/** Real response from /aq/observation/current/ziplatlong/ for Miami, 2026-10-10 03:00 EDT. */
const LIVE = [
  { dateObserved: '2026-10-10', hourObserved: '03:00', localTimeZone: 'EDT', reportingAreaName: 'Miami', siteName: 'NCORE', parameterName: 'PM2.5', nowcastAQI: 21, aqiCategoryName: 'Good' },
  { dateObserved: '2026-10-10', hourObserved: '03:00', localTimeZone: 'EDT', reportingAreaName: 'Miami', siteName: 'Rosenstiel', parameterName: 'OZONE', nowcastAQI: 17, aqiCategoryName: 'Good' },
  { dateObserved: '2026-10-10', hourObserved: '03:00', localTimeZone: 'EDT', reportingAreaName: 'Miami', siteName: 'NCORE', parameterName: 'PM10', nowcastAQI: 7, aqiCategoryName: 'Good' },
];

describe('AirNow', () => {
  test('summarizes the live Miami response by its worst pollutant', () => {
    expect(summarizeAirNow(LIVE)).toEqual({ aqi: 21, category: 1, categoryName: 'Good', pollutant: 'PM2.5', area: 'Miami', observedAt: '2026-10-10 03:00 EDT' });
  });
  test('EPA category breakpoints', () => {
    expect([0, 50, 51, 100, 101, 150, 151, 200, 201, 300, 301].map(aqiCategory)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6]);
  });
  test('error bodies and empty lists give nothing to cache', () => {
    expect(summarizeAirNow({ WebServiceError: [{ Message: 'retired' }] })).toBeNull();
    expect(summarizeAirNow([])).toBeNull();
  });
});
