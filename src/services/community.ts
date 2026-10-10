import { toMember, type BloodType, type CommunitySettings, type Member } from '../core/community';
import type { Coords, Profile } from '../core/types';
import { SAMPLE_MEMBERS } from '../data/communitySeed';

/**
 * Where the community directory comes from. Today: bundled sample members, so the feature works
 * offline and in the demo. In production, implement this against a server that stores only what a
 * resident opted in to publish (first name, ~1 km location, roles) and relays contact so phone
 * numbers are shared only on a match. The screens and the matching rules do not change.
 */
export interface CommunityDirectory {
  members(): Promise<Member[]>;
  /** Publish (or withdraw, when `me` is null) the resident's own opt-in record. */
  publish(me: Member | null): Promise<void>;
}

export const sampleDirectory: CommunityDirectory = {
  members: async () => SAMPLE_MEMBERS,
  publish: async () => {},
};

export const directory: CommunityDirectory = sampleDirectory;

/** The record this resident would publish, or null when nothing is switched on. */
export function myRecord(profile: Profile, settings: CommunitySettings, coords: Coords | null, bloodType: BloodType | null): Member | null {
  if (!coords) return null;
  return toMember({
    id: 'me',
    firstName: profile.fullName.trim().split(/\s+/)[0] || '—',
    coords,
    language: profile.language,
    bloodType,
    settings,
  });
}
