import { distanceKm } from './geo';
import type { Coords, Lang } from './types';

/**
 * Community layer: blood donors, neighbor volunteers and people who asked to be checked on.
 * Pure functions only, so matching rules are testable and never depend on a network or a model.
 */

export type BloodType = 'O-' | 'O+' | 'A-' | 'A+' | 'B-' | 'B+' | 'AB-' | 'AB+';
export const BLOOD_TYPES: BloodType[] = ['O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'];

/** Accepts "O+", "o pos", "O positive", "AB negatif"... Returns null when it can't be read. */
export function normalizeBloodType(raw?: string): BloodType | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase().replace(/\s+/g, '');
  const m = s.match(/^(AB|A|B|O)(\+|-|POS|POSITIVE|POSITIF|POSITIVO|NEG|NEGATIVE|NEGATIF|NEGATIVO)?$/);
  if (!m || !m[2]) return null;
  const sign = m[2].startsWith('P') || m[2] === '+' ? '+' : '-';
  return `${m[1]}${sign}` as BloodType;
}

/** Red-cell compatibility: which donor types can give to a recipient type. */
const CAN_RECEIVE_FROM: Record<BloodType, BloodType[]> = {
  'O-': ['O-'],
  'O+': ['O-', 'O+'],
  'A-': ['O-', 'A-'],
  'A+': ['O-', 'O+', 'A-', 'A+'],
  'B-': ['O-', 'B-'],
  'B+': ['O-', 'O+', 'B-', 'B+'],
  'AB-': ['O-', 'A-', 'B-', 'AB-'],
  'AB+': BLOOD_TYPES,
};

export function canDonateTo(donor: BloodType, recipient: BloodType): boolean {
  return CAN_RECEIVE_FROM[recipient].includes(donor);
}

/** Whole-blood donors must wait 56 days between donations (Red Cross / AABB standard). */
export const DONATION_GAP_DAYS = 56;

export function eligibleToDonate(lastDonation: string | undefined, now: Date = new Date()): boolean {
  if (!lastDonation) return true;
  const last = new Date(lastDonation);
  if (Number.isNaN(last.getTime())) return true;
  return (now.getTime() - last.getTime()) / 86_400_000 >= DONATION_GAP_DAYS;
}

export type Skill = 'first_aid' | 'transport' | 'supplies' | 'charging' | 'translation' | 'checkin';
export const SKILLS: Skill[] = ['first_aid', 'transport', 'supplies', 'charging', 'translation', 'checkin'];

export type NeedFlag = 'oxygen' | 'mobility' | 'alone' | 'elderly' | 'medication' | 'infant';
export const NEED_FLAGS: NeedFlag[] = ['oxygen', 'mobility', 'alone', 'elderly', 'medication', 'infant'];

/** What the directory knows about someone who opted in. Only a first name and an approximate location. */
export type Member = {
  id: string;
  kind: 'person' | 'org';
  /** First name for a person, organization name for an org. */
  name: string;
  /** Snapped to a ~1 km grid. Never an address. */
  coords: Coords;
  languages: Lang[];
  phone: string;
  donor?: { bloodType: BloodType; available: boolean; lastDonation?: string };
  volunteer?: { skills: Skill[] };
  /** Present when the person asked neighbors to check on them. */
  needsCheckIn?: { flags: NeedFlag[]; lastCheckIn?: string };
  /** Sample data, not a real person. Shown as such in the app. */
  sample?: boolean;
};

/** The resident's own opt-in choices. Everything is off until they turn it on. */
export type CommunitySettings = {
  donor: boolean;
  donorAvailable: boolean;
  lastDonation?: string; // YYYY-MM-DD
  volunteer: boolean;
  skills: Skill[];
  needsCheckIn: boolean;
  needFlags: NeedFlag[];
  /** The resident's own number, for people who match with them to text. Not the emergency contact's. */
  phone: string;
  /** The resident read the privacy note and agreed to be visible. Nothing is published before this. */
  consented: boolean;
};

export const DEFAULT_SETTINGS: CommunitySettings = {
  donor: false,
  donorAvailable: true,
  volunteer: false,
  skills: [],
  needsCheckIn: false,
  needFlags: [],
  phone: '',
  consented: false,
};

/** ~0.01° of latitude is about 1.1 km. Others see this, never the exact point. */
export function approximate(c: Coords): Coords {
  const snap = (v: number) => Math.round(v * 100) / 100;
  return { lat: snap(c.lat), lon: snap(c.lon) };
}

export type Ranked<T> = T & { km: number };

function byDistance<T extends Member>(origin: Coords, list: T[], radiusKm: number): Ranked<T>[] {
  return list
    .map((m) => ({ ...m, km: distanceKm(origin, m.coords) }))
    .filter((m) => m.km <= radiusKm)
    .sort((a, b) => a.km - b.km);
}

/** Donors who can give to `needed`, are available, past the donation gap, within range. Nearest first. */
export function findDonors(
  members: Member[],
  needed: BloodType,
  origin: Coords,
  radiusKm = 25,
  now: Date = new Date(),
): Ranked<Member>[] {
  const matches = members.filter(
    (m) => m.kind === 'person' && m.donor && m.donor.available && canDonateTo(m.donor.bloodType, needed) && eligibleToDonate(m.donor.lastDonation, now),
  );
  // Exact type match first (less strain on the universal O- supply), then by distance.
  return byDistance(origin, matches, radiusKm).sort((a, b) => {
    const exactA = a.donor!.bloodType === needed ? 0 : 1;
    const exactB = b.donor!.bloodType === needed ? 0 : 1;
    return exactA - exactB || a.km - b.km;
  });
}

/** People who asked for check-ins, nearest first, with those relying on oxygen or a mobility aid ahead of the rest at similar range. */
export function findNeighborsToCheck(members: Member[], origin: Coords, radiusKm = 10): Ranked<Member>[] {
  const urgency = (m: Member) => (m.needsCheckIn?.flags.some((f) => f === 'oxygen' || f === 'mobility') ? 0 : 1);
  return byDistance(origin, members.filter((m) => m.kind === 'person' && m.needsCheckIn), radiusKm).sort(
    (a, b) => urgency(a) - urgency(b) || a.km - b.km,
  );
}

/** Volunteers and organizations who can help, optionally filtered by skill, nearest first. */
export function findHelpers(members: Member[], origin: Coords, skill: Skill | null, radiusKm = 15): Ranked<Member>[] {
  const matches = members.filter((m) => m.volunteer && (!skill || m.volunteer.skills.includes(skill)));
  return byDistance(origin, matches, radiusKm);
}

/** The record the resident would publish: first name, rounded location, only the roles they switched on. */
export function toMember(args: {
  id: string;
  firstName: string;
  coords: Coords;
  language: Lang;
  bloodType: BloodType | null;
  settings: CommunitySettings;
}): Member | null {
  const { settings: s } = args;
  if (!s.consented || !s.phone.trim() || (!s.donor && !s.volunteer && !s.needsCheckIn)) return null;
  return {
    id: args.id,
    kind: 'person',
    name: args.firstName,
    coords: approximate(args.coords),
    languages: [args.language],
    phone: s.phone.trim(),
    donor: s.donor && args.bloodType ? { bloodType: args.bloodType, available: s.donorAvailable, lastDonation: s.lastDonation } : undefined,
    volunteer: s.volunteer ? { skills: s.skills } : undefined,
    needsCheckIn: s.needsCheckIn ? { flags: s.needFlags } : undefined,
  };
}

type T = (key: string, opts?: Record<string, unknown>) => string;

/**
 * Text to a donor, written from a template in the donor's own language. No model writes it.
 * The resident taps send; AidNow never sends it.
 */
export function donorRequestMessage(t: T, a: { requester: string; type: BloodType; hospital: string }): string {
  return t(a.hospital ? 'community.msg.donorWithHospital' : 'community.msg.donor', { name: a.requester, type: a.type, hospital: a.hospital });
}

/** Text from a volunteer to someone who asked to be checked on. */
export function checkInMessage(t: T, a: { volunteer: string; neighbor: string }): string {
  return t('community.msg.checkIn', { volunteer: a.volunteer, name: a.neighbor });
}

/** Distance as shown to a person: whole km above 10, one decimal below. */
export function formatKm(km: number): string {
  return km < 10 ? km.toFixed(1) : String(Math.round(km));
}
