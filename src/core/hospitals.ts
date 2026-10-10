import { distanceKm } from './geo';
import type { Coords } from './types';

/** A hospital from the CMS registry. A real place, so unlike residents its location is exact. */
export type Hospital = {
  id: string;
  name: string;
  address: string;
  city: string;
  zip: string;
  /** Main switchboard, as CMS lists it. Callers ask for the blood bank or transfusion service. */
  phone: string;
  /** CMS "emergency services" flag. */
  emergency: boolean;
  coords: Coords;
};

export type NearHospital = Hospital & { km: number };

/** Nearest first. Hospitals with an emergency department come ahead of those without at similar range. */
export function findHospitals(list: Hospital[], origin: Coords, limit = 5, radiusKm = 40): NearHospital[] {
  return list
    .map((h) => ({ ...h, km: distanceKm(origin, h.coords) }))
    .filter((h) => h.km <= radiusKm)
    .sort((a, b) => a.km - b.km)
    .slice(0, limit);
}

/** "(305) 585-1111" -> "3055851111", for dialing. */
export function dialable(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Address on one line, for a maps search. */
export function fullAddress(h: Hospital): string {
  return `${h.name}, ${h.address}, ${h.city}, FL ${h.zip}`;
}
