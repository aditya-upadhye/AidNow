import { hourBucket, REPORT_SITUATIONS, type ReportEvent, type ReportSituation } from '../core/reports';

/**
 * SAMPLE DATA for the demo: invented reports, generated the same way every time. The ZIP codes are real, but the
 * counts and problems are made up to show what the city view would look like with many residents.
 * Nothing here is a real report or says anything true about a real neighborhood. A production build replaces
 * this with counts from a server that holds only opted-in, anonymous events (see services/reports.ts).
 */

type Profile = {
  zip: string;
  /** Relative number of reports. */
  weight: number;
  /** Share of reports that are street flooding or debris; the rest split between power and the others. */
  street: number;
};

const AREAS: Profile[] = [
  { zip: '33127', weight: 44, street: 0.6 },
  { zip: '33138', weight: 28, street: 0.5 },
  { zip: '33150', weight: 30, street: 0.4 },
  { zip: '33147', weight: 22, street: 0.35 },
  { zip: '33142', weight: 20, street: 0.35 },
  { zip: '33137', weight: 24, street: 0.65 },
  { zip: '33139', weight: 30, street: 0.8 },
  { zip: '33140', weight: 18, street: 0.75 },
  { zip: '33010', weight: 26, street: 0.25 },
  { zip: '33012', weight: 24, street: 0.2 },
  { zip: '33013', weight: 20, street: 0.25 },
  { zip: '33014', weight: 14, street: 0.2 },
  { zip: '33016', weight: 16, street: 0.25 },
  { zip: '33018', weight: 12, street: 0.2 },
  { zip: '33125', weight: 18, street: 0.3 },
  { zip: '33135', weight: 14, street: 0.3 },
  { zip: '33145', weight: 12, street: 0.3 },
  { zip: '33176', weight: 9, street: 0.2 },
  { zip: '33133', weight: 7, street: 0.45 },
  { zip: '33141', weight: 2, street: 0.5 }, // too few to be shown: demonstrates the privacy rule
];

// A small seeded generator, so the sample looks the same on every launch and in every test.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AGENCY: Record<ReportSituation, string> = { street_hazard: '311', power_outage: 'fpl', downed_line: 'fpl', need_shelter: '311', need_supplies: '211', medical_device: '311' };

/** Reports across the 48 hours before `now`, busiest in the most recent hours. */
export function sampleReports(now: Date): ReportEvent[] {
  const rand = rng(20261010);
  const out: ReportEvent[] = [];
  for (const a of AREAS) {
    for (let i = 0; i < a.weight; i++) {
      const s = rand();
      const situation: ReportSituation =
        s < a.street ? 'street_hazard' : s < a.street + (1 - a.street) * 0.6 ? 'power_outage' : (['downed_line', 'need_shelter', 'need_supplies', 'medical_device'] as const)[Math.floor(rand() * 4)];
      // Squared, so most reports are recent.
      const hoursAgo = Math.floor(rand() * rand() * 48);
      const at = hourBucket(new Date(now.getTime() - hoursAgo * 3_600_000));
      out.push({ id: `sample-${a.zip}-${i}`, situation, zip: a.zip, agency: AGENCY[situation], at });
    }
  }
  return out;
}

export { REPORT_SITUATIONS };
