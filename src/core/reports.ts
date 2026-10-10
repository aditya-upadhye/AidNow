import { distanceKm } from './geo';
import type { Coords, Situation } from './types';
import { ZIP_CENTROIDS, type ZipPoint } from '../data/zipCentroids';

/**
 * The city view: what residents report to 311, FPL and 211, counted by ZIP code and kind of problem.
 * Pure functions, so the privacy rules below are tested rather than promised.
 *
 * What a report event holds, and nothing more: the kind of problem, the ZIP code, which agency, and the hour.
 * Never a name, address, language, the words the resident said, exact location, or minutes.
 */

export const REPORT_SITUATIONS = ['street_hazard', 'power_outage', 'downed_line', 'need_shelter', 'need_supplies', 'medical_device'] as const;
export type ReportSituation = (typeof REPORT_SITUATIONS)[number];

/** Emergencies (911) are never counted here: only reports that go to an agency line. */
export function isReportable(s: Situation): s is ReportSituation {
  return (REPORT_SITUATIONS as readonly string[]).includes(s);
}

export type ReportEvent = {
  id: string;
  situation: ReportSituation;
  zip: string;
  agency: string;
  /** ISO time rounded down to the hour. */
  at: string;
};

/** An area with fewer reports than this is hidden: a count of 1 or 2 can point at a household. */
export const MIN_COUNT = 3;
/** The breakdown by problem is shown only for areas with at least this many reports: a split of 3 reports can point at a household. */
export const MIN_FOR_BREAKDOWN = 10;

export function hourBucket(d: Date): string {
  const t = new Date(d);
  t.setUTCMinutes(0, 0, 0);
  return t.toISOString();
}

/** Builds the only record that ever leaves a report: everything else is dropped here. */
export function makeEvent(args: { id: string; situation: ReportSituation; zip: string; agency: string; now: Date }): ReportEvent {
  return { id: args.id, situation: args.situation, zip: args.zip, agency: args.agency, at: hourBucket(args.now) };
}

/** The ZIP area whose center is nearest, if the point is inside Miami-Dade's ZIPs (within `maxKm` of one). */
export function zipFor(c: Coords, zips: ZipPoint[] = ZIP_CENTROIDS, maxKm = 6): string | null {
  let best: { zip: string; km: number } | null = null;
  for (const z of zips) {
    const km = distanceKm(c, { lat: z.lat, lon: z.lon });
    if (!best || km < best.km) best = { zip: z.zip, km };
  }
  return best && best.km <= maxKm ? best.zip : null;
}

/** A Miami-Dade ZIP typed in the saved address, as a fallback when there are no coordinates. */
export function zipFromAddress(address: string, zips: ZipPoint[] = ZIP_CENTROIDS): string | null {
  for (const m of address.matchAll(/\b(\d{5})\b/g)) if (zips.some((z) => z.zip === m[1])) return m[1];
  return null;
}

/** The only choice: how far back to look. What is going on is worked out from the reports, not picked. */
export type Window = { hours: number; now: Date };

export type ProblemStat = { situation: ReportSituation; count: number; /** 0 to 1 of all matching reports. */ share: number };

export type AreaStat = {
  zip: string;
  total: number;
  /** Most reported first. null when the area has too few reports for a breakdown to be anonymous. */
  problems: ProblemStat[] | null;
};

export type Summary = {
  /** Every matching report, including those in hidden areas. */
  total: number;
  areas: AreaStat[];
  /** Areas left out because they have fewer than MIN_COUNT reports. */
  hiddenAreas: number;
  /** What is going on across the county, most reported first. A problem with fewer than MIN_COUNT reports is left out. */
  problems: ProblemStat[];
};

const zeroSit = (): Record<ReportSituation, number> => ({ street_hazard: 0, power_outage: 0, downed_line: 0, need_shelter: 0, need_supplies: 0, medical_device: 0 });

function rank(counts: Record<ReportSituation, number>, total: number, minCount: number): ProblemStat[] {
  return REPORT_SITUATIONS.map((situation) => ({ situation, count: counts[situation], share: total ? counts[situation] / total : 0 }))
    .filter((p) => p.count >= minCount)
    .sort((a, b) => b.count - a.count || REPORT_SITUATIONS.indexOf(a.situation) - REPORT_SITUATIONS.indexOf(b.situation));
}

export function aggregate(events: ReportEvent[], w: Window, minCount = MIN_COUNT): Summary {
  const since = w.now.getTime() - w.hours * 3_600_000;
  const matching = events.filter((e) => {
    const at = new Date(e.at).getTime();
    return at >= since && at <= w.now.getTime();
  });

  const byZip = new Map<string, ReportEvent[]>();
  for (const e of matching) byZip.set(e.zip, [...(byZip.get(e.zip) ?? []), e]);

  const areas: AreaStat[] = [];
  let hiddenAreas = 0;
  for (const [zip, list] of byZip) {
    if (list.length < minCount) {
      hiddenAreas += 1;
      continue;
    }
    const counts = zeroSit();
    for (const e of list) counts[e.situation] += 1;
    areas.push({ zip, total: list.length, problems: list.length >= MIN_FOR_BREAKDOWN ? rank(counts, list.length, 1) : null });
  }
  areas.sort((a, b) => b.total - a.total || a.zip.localeCompare(b.zip));

  const all = zeroSit();
  for (const e of matching) all[e.situation] += 1;
  return { total: matching.length, areas, hiddenAreas, problems: rank(all, matching.length, minCount) };
}

/** 0 to 1 against the busiest shown area, for map color and size. */
export function heat(area: AreaStat, areas: AreaStat[]): number {
  const max = Math.max(1, ...areas.map((a) => a.total));
  return area.total / max;
}
