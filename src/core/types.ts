export type Lang = 'en' | 'es' | 'ht';

export type Urgency = 'emergency' | 'urgent_safety' | 'non_emergency';

/** One per guidance card, plus `other` for anything the model can't place. */
export type Situation =
  | 'water_in_home'
  | 'injury_trapped'
  | 'fire_gas'
  | 'generator_fumes'
  | 'downed_line'
  | 'medical_device'
  | 'power_outage'
  | 'street_hazard'
  | 'need_shelter'
  | 'need_supplies'
  | 'other';

export const SITUATIONS: Situation[] = [
  'water_in_home',
  'injury_trapped',
  'fire_gas',
  'generator_fumes',
  'downed_line',
  'medical_device',
  'power_outage',
  'street_hazard',
  'need_shelter',
  'need_supplies',
  'other',
];

export type Vulnerable = 'elderly' | 'child' | 'disability' | 'medical_device';

export const URGENCY_RANK: Record<Urgency, number> = {
  non_emergency: 0,
  urgent_safety: 1,
  emergency: 2,
};

/** What a model (online Gemma 4, on-device Gemma, or the keyword fallback) returns. Classification only. */
export type Triage = {
  urgency: Urgency;
  /** Most important first. Up to two, e.g. a tree down plus a power outage. */
  situations: Situation[];
  location_text: string;
  people_count: number | null;
  vulnerable: Vulnerable[];
  photo_findings: string;
  /** The same photo finding in the resident's display language, so they see what the model saw. */
  photo_findings_local: string;
  english_summary: string;
  language: Lang;
  /** Which path produced this, for the result screen and debugging. */
  source: 'gemma_online' | 'gemma_device' | 'keywords' | 'button' | 'fallback';
};

export type Profile = {
  language: Lang;
  fullName: string;
  contactName: string;
  contactPhone: string;
  /** Empty when the resident chose "Skip, use my location". */
  address: string;
  /** Coordinates of the saved address, geocoded when online. */
  addressCoords?: { lat: number; lon: number };
  photoUri?: string;
  dateOfBirth?: string; // YYYY-MM-DD
  bloodType?: string;
  medicalNotes?: string;
  mobilityNeeds?: string;
  /** Resident allows mobility / device needs in the 911 message. */
  shareMobilityIn911?: boolean;
  householdSize?: number;
  pets?: string;
};

export type Coords = { lat: number; lon: number };
