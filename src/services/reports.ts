import AsyncStorage from '@react-native-async-storage/async-storage';

import { isReportable, makeEvent, zipFor, zipFromAddress, type ReportEvent } from '../core/reports';
import type { Coords, Situation } from '../core/types';
import { sampleReports } from '../data/sampleReports';

/**
 * Where the city view's counts come from. Today: sample reports plus the resident's own, all on this phone.
 * In production, implement this against a server that receives only the anonymous events below and returns counts. The screens and the privacy rules (core/reports.ts) do not change.
 */
export interface ReportsFeed {
  events(now: Date): Promise<ReportEvent[]>;
  /** Resolves true when the report was added, false when the same one was already counted this hour. */
  submit(event: ReportEvent): Promise<boolean>;
}

const KEYS = { own: 'aidnow.civic.events' };
const KEEP = 200;

async function ownEvents(): Promise<ReportEvent[]> {
  const raw = await AsyncStorage.getItem(KEYS.own);
  return raw ? (JSON.parse(raw) as ReportEvent[]) : [];
}

export const localFeed: ReportsFeed = {
  events: async (now) => [...sampleReports(now), ...(await ownEvents())],
  submit: async (e) => {
    const own = await ownEvents();
    // The same problem from the same ZIP in the same hour counts once.
    if (own.some((o) => o.situation === e.situation && o.zip === e.zip && o.at === e.at)) return false;
    await AsyncStorage.setItem(KEYS.own, JSON.stringify([...own, e].slice(-KEEP)));
    return true;
  },
};

export const feed: ReportsFeed = localFeed;

/** The ZIP area the resident is in: from their saved location, else the ZIP in their address. */
export function areaFor(coords: Coords | null | undefined, address: string): string | null {
  return (coords ? zipFor(coords) : null) ?? zipFromAddress(address);
}

export type ReportResult =
  /** One was added to the count. */
  | 'counted'
  /** The same problem was already reported from this ZIP this hour, so the count did not change. */
  | 'already'
  /** There is no way to tell the resident's ZIP code. */
  | 'no_area'
  /** Not something the city view counts: an emergency, or a problem the app could not classify. */
  | 'skipped';

/**
 * Records one problem the resident chose to report in the city view. Tapping Report is the resident's consent: this
 * contacts no one. Only the kind of problem, ZIP, agency and the hour are kept: see makeEvent.
 */
export async function submitReport(args: { situation: Situation; coords?: Coords | null; address?: string; agency?: string }): Promise<ReportResult> {
  try {
    if (!isReportable(args.situation)) return 'skipped';
    const zip = areaFor(args.coords, args.address ?? '');
    if (!zip) return 'no_area';
    const added = await feed.submit(makeEvent({ id: `own-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`, situation: args.situation, zip, agency: args.agency ?? 'city', now: new Date() }));
    return added ? 'counted' : 'already';
  } catch {
    return 'skipped';
  }
}

/** The ZIP a report would be counted in, for telling the resident before and after. */
export { areaFor as zipForResident };
