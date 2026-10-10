import type { Member } from '../core/community';

/**
 * SAMPLE DATA for the demo. These are invented people and groups at rounded Miami locations, with
 * phone numbers from the 305-555-01XX block reserved for fiction. Nothing here is a real person or
 * organization. A production build replaces this with a consented, server-side directory
 * (see services/community.ts, `CommunityDirectory`).
 */
export const SAMPLE_MEMBERS: Member[] = [
  // Blood donors
  { id: 's-d1', kind: 'person', name: 'Jean', coords: { lat: 25.83, lon: -80.19 }, languages: ['ht', 'en'], phone: '+13055550101', donor: { bloodType: 'O+', available: true, lastDonation: '2026-05-02' }, sample: true },
  { id: 's-d2', kind: 'person', name: 'Marisol', coords: { lat: 25.86, lon: -80.28 }, languages: ['es', 'en'], phone: '+13055550102', donor: { bloodType: 'O-', available: true }, volunteer: { skills: ['translation', 'transport'] }, sample: true },
  { id: 's-d3', kind: 'person', name: 'Daniel', coords: { lat: 25.79, lon: -80.2 }, languages: ['en'], phone: '+13055550103', donor: { bloodType: 'A+', available: true, lastDonation: '2026-09-20' }, sample: true },
  { id: 's-d4', kind: 'person', name: 'Widline', coords: { lat: 25.89, lon: -80.19 }, languages: ['ht', 'en'], phone: '+13055550104', donor: { bloodType: 'B+', available: true, lastDonation: '2026-03-11' }, volunteer: { skills: ['translation', 'checkin'] }, sample: true },
  { id: 's-d5', kind: 'person', name: 'Carmen', coords: { lat: 25.72, lon: -80.27 }, languages: ['es'], phone: '+13055550105', donor: { bloodType: 'AB+', available: true }, sample: true },
  { id: 's-d6', kind: 'person', name: 'Andre', coords: { lat: 25.94, lon: -80.25 }, languages: ['en', 'ht'], phone: '+13055550106', donor: { bloodType: 'O+', available: false }, sample: true },
  { id: 's-d7', kind: 'person', name: 'Luis', coords: { lat: 25.68, lon: -80.32 }, languages: ['es', 'en'], phone: '+13055550107', donor: { bloodType: 'A-', available: true, lastDonation: '2026-01-15' }, volunteer: { skills: ['first_aid'] }, sample: true },

  // Volunteers
  { id: 's-v1', kind: 'person', name: 'Rosa', coords: { lat: 25.84, lon: -80.2 }, languages: ['es', 'en'], phone: '+13055550111', volunteer: { skills: ['checkin', 'supplies'] }, sample: true },
  { id: 's-v2', kind: 'person', name: 'Mackenson', coords: { lat: 25.83, lon: -80.18 }, languages: ['ht', 'en'], phone: '+13055550112', volunteer: { skills: ['transport', 'charging'] }, sample: true },
  { id: 's-v3', kind: 'person', name: 'Tasha', coords: { lat: 25.81, lon: -80.22 }, languages: ['en'], phone: '+13055550113', volunteer: { skills: ['first_aid', 'checkin'] }, sample: true },

  // Organizations
  { id: 's-o1', kind: 'org', name: 'Sample Little Haiti Neighbors', coords: { lat: 25.83, lon: -80.19 }, languages: ['ht', 'en', 'es'], phone: '+13055550121', volunteer: { skills: ['supplies', 'translation', 'checkin'] }, sample: true },
  { id: 's-o2', kind: 'org', name: 'Sample Hialeah Church Network', coords: { lat: 25.86, lon: -80.28 }, languages: ['es', 'en'], phone: '+13055550122', volunteer: { skills: ['supplies', 'transport', 'charging'] }, sample: true },
  { id: 's-o3', kind: 'org', name: 'Sample Allapattah Mutual Aid', coords: { lat: 25.81, lon: -80.23 }, languages: ['es', 'en', 'ht'], phone: '+13055550123', volunteer: { skills: ['first_aid', 'supplies', 'checkin'] }, sample: true },

  // People who asked to be checked on
  { id: 's-n1', kind: 'person', name: 'Marie', coords: { lat: 25.83, lon: -80.19 }, languages: ['ht'], phone: '+13055550131', needsCheckIn: { flags: ['elderly', 'alone', 'mobility'] }, sample: true },
  { id: 's-n2', kind: 'person', name: 'Eduardo', coords: { lat: 25.85, lon: -80.27 }, languages: ['es'], phone: '+13055550132', needsCheckIn: { flags: ['oxygen', 'elderly'] }, sample: true },
  { id: 's-n3', kind: 'person', name: 'Gloria', coords: { lat: 25.82, lon: -80.21 }, languages: ['es', 'en'], phone: '+13055550133', needsCheckIn: { flags: ['medication', 'alone'] }, sample: true },
  { id: 's-n4', kind: 'person', name: 'Fabienne', coords: { lat: 25.88, lon: -80.18 }, languages: ['ht', 'en'], phone: '+13055550134', needsCheckIn: { flags: ['infant'] }, sample: true },
];

/** Where the demo searches from when a phone has no saved address and no GPS fix (simulator). Little Haiti. */
export const DEMO_ORIGIN = { lat: 25.83, lon: -80.19 };
