import { aggregate, heat, hourBucket, isReportable, makeEvent, MIN_COUNT, MIN_FOR_BREAKDOWN, zipFor, zipFromAddress, type ReportEvent, type ReportSituation, type Window } from '../src/core/reports';
import { sampleReports } from '../src/data/sampleReports';
import { ZIP_CENTROIDS } from '../src/data/zipCentroids';

const NOW = new Date('2026-10-10T18:30:00Z');
const w = (hours = 24): Window => ({ hours, now: NOW });
const ev = (i: number, zip: string, situation: ReportSituation = 'street_hazard', hoursAgo = 1): ReportEvent => ({
  id: String(i),
  situation,
  zip,
  agency: '311',
  at: hourBucket(new Date(NOW.getTime() - hoursAgo * 3_600_000)),
});
const many = (n: number, zip: string, situation: ReportSituation = 'street_hazard', hoursAgo = 1) => Array.from({ length: n }, (_, i) => ev(i, zip, situation, hoursAgo));

describe('what a report event keeps', () => {
  test('only the kind, ZIP, agency and the hour: nothing that could identify someone, not even language', () => {
    const e = makeEvent({ id: 'x', situation: 'power_outage', zip: '33127', agency: 'fpl', now: new Date('2026-10-10T18:47:31.123Z') });
    expect(Object.keys(e).sort()).toEqual(['agency', 'at', 'id', 'situation', 'zip']);
    expect(e.at).toBe('2026-10-10T18:00:00.000Z'); // minutes and seconds dropped
  });
  test('emergencies and unclassified problems are never reportable', () => {
    for (const s of ['water_in_home', 'injury_trapped', 'fire_gas', 'generator_fumes', 'other'] as const) expect(isReportable(s)).toBe(false);
    for (const s of ['street_hazard', 'power_outage', 'downed_line', 'need_shelter', 'need_supplies', 'medical_device'] as const) expect(isReportable(s)).toBe(true);
  });
});

describe('ZIP lookup', () => {
  test('a point in Little Haiti is in 33127 or its neighbor, never a far-away ZIP', () => {
    expect(['33127', '33138', '33137', '33150']).toContain(zipFor({ lat: 25.8327, lon: -80.1946 })!);
  });
  test('Hialeah resolves to a Hialeah ZIP', () => expect(zipFor({ lat: 25.8576, lon: -80.2781 })!.startsWith('330')).toBe(true));
  test('a point far outside Miami-Dade has no ZIP', () => {
    expect(zipFor({ lat: 28.5, lon: -81.4 })).toBeNull();
    expect(zipFor({ lat: 25.77, lon: -81.5 })).toBeNull();
  });
  test('a ZIP typed in an address is found only if it is a Miami-Dade ZIP', () => {
    expect(zipFromAddress('123 NW 54th St, Miami, FL 33127')).toBe('33127');
    expect(zipFromAddress('12 Main St, Orlando FL 32801')).toBeNull();
    expect(zipFromAddress('Apt 12345, Miami')).toBeNull();
  });
  test('the bundled list covers the county', () => expect(ZIP_CENTROIDS.length).toBeGreaterThan(70));
});

describe('aggregate: privacy rules', () => {
  test('an area with fewer than 3 reports is hidden, and counted as hidden', () => {
    const s = aggregate([...many(2, '33141'), ...many(5, '33127')], w());
    expect(s.areas.map((a) => a.zip)).toEqual(['33127']);
    expect(s.hiddenAreas).toBe(1);
    expect(MIN_COUNT).toBe(3);
  });
  test('3 reports is enough to show an area, but not its breakdown by problem', () => {
    const [a] = aggregate([...many(2, '33127', 'street_hazard'), ...many(1, '33127', 'downed_line')], w()).areas;
    expect(a.total).toBe(3);
    expect(a.problems).toBeNull();
  });
  test('10 reports unlocks the breakdown, most reported first', () => {
    const [a] = aggregate([...many(6, '33127', 'street_hazard'), ...many(3, '33127', 'power_outage'), ...many(1, '33127', 'need_shelter')], w()).areas;
    expect(MIN_FOR_BREAKDOWN).toBe(10);
    expect(a.problems!.map((p) => [p.situation, p.count])).toEqual([['street_hazard', 6], ['power_outage', 3], ['need_shelter', 1]]);
  });
  test('the county-wide list leaves out a problem reported fewer than 3 times, even though its reports are counted', () => {
    const s = aggregate([...many(8, '33127', 'street_hazard'), ...many(2, '33010', 'downed_line')], w());
    expect(s.problems.map((p) => p.situation)).toEqual(['street_hazard']);
    expect(s.total).toBe(10);
  });
});

describe('aggregate: what is going on', () => {
  const events = [...many(6, '33127', 'street_hazard', 2), ...many(4, '33127', 'power_outage', 30), ...many(5, '33010', 'power_outage', 3)];
  test('the problems are worked out from the reports, most reported first, with their share', () => {
    const s = aggregate(events, w(48));
    expect(s.problems.map((p) => [p.situation, p.count])).toEqual([['power_outage', 9], ['street_hazard', 6]]);
    expect(s.problems[0].share).toBeCloseTo(9 / 15);
  });
  test('the answer changes with the time window', () => {
    expect(aggregate(events, w(6)).problems.map((p) => p.situation)).toEqual(['street_hazard', 'power_outage']);
    expect(aggregate(events, w(6)).total).toBe(11);
  });
  test('a report from the future is not counted', () => {
    expect(aggregate([ev(1, '33127', 'street_hazard', -5)], w()).total).toBe(0);
  });
  test('areas are sorted busiest first, ties by ZIP', () => {
    expect(aggregate(events, w(48)).areas.map((a) => a.zip)).toEqual(['33127', '33010']);
  });
  test('no reports gives empty lists and zero, not NaN', () => {
    expect(aggregate([], w())).toEqual({ total: 0, areas: [], hiddenAreas: 0, problems: [] });
  });
  test('heat is relative to the busiest shown area', () => {
    const s = aggregate([...many(10, '33127'), ...many(5, '33010')], w());
    expect(heat(s.areas[0], s.areas)).toBe(1);
    expect(heat(s.areas[1], s.areas)).toBeCloseTo(0.5);
  });
});

describe('sample data', () => {
  const sample = sampleReports(NOW);
  test('is identical on every run', () => expect(sampleReports(NOW)).toEqual(sample));
  test('uses only real Miami-Dade ZIPs', () => {
    const known = new Set(ZIP_CENTROIDS.map((z) => z.zip));
    expect(sample.every((e) => known.has(e.zip))).toBe(true);
  });
  test('holds no language and only whole-hour times within the last 48 hours', () => {
    for (const e of sample) {
      expect(Object.keys(e).sort()).toEqual(['agency', 'at', 'id', 'situation', 'zip']);
      expect(e.at.endsWith(':00:00.000Z')).toBe(true);
      const age = (NOW.getTime() - new Date(e.at).getTime()) / 3_600_000;
      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThanOrEqual(49);
    }
  });
  test('tells a believable story: street flooding leads on the coast, and a tiny area stays hidden', () => {
    const s = aggregate(sample, w(48));
    expect(s.problems[0].situation).toBe('street_hazard');
    const beach = s.areas.find((a) => a.zip === '33139')!;
    expect(beach.problems![0].situation).toBe('street_hazard');
    expect(s.areas.find((a) => a.zip === '33141')).toBeUndefined();
    expect(s.hiddenAreas).toBeGreaterThanOrEqual(1);
  });
  test('sample ids are marked as sample', () => expect(sample.every((e) => e.id.startsWith('sample-'))).toBe(true));
});
