/**
 * Every phone number and link the app shows, in one place so they are easy to fix.
 * Source: aidnow-prep/03-routing-directory.csv (each number printed on the listed official pages).
 * Never type a number here from memory.
 */
export const DIRECTORY_LAST_CHECKED = '2026-10-09';

export type AgencyId = '911' | '311' | 'fpl' | '211' | 'gas' | 'poison' | 'wasd';

export type Agency = {
  id: AgencyId;
  name: string;
  /** Number shown on screen. */
  display: string;
  /** Number dialed (digits only, or 911). Demo mode replaces it at call time. */
  dial: string;
  web?: string;
  source: string;
};

export const AGENCIES: Record<AgencyId, Agency> = {
  '911': {
    id: '911',
    name: '911',
    display: '911',
    dial: '911',
    source: 'https://www.miamidade.gov/hurricane/library/guide-to-hurricane-readiness.pdf',
  },
  '311': {
    id: '311',
    name: 'Miami-Dade 311',
    display: '311 · 305-468-5900',
    dial: '3054685900',
    web: 'https://miamidade.gov/global/public-information-guide/311-contact-center/home.page',
    source: 'https://miamidade.gov/global/public-information-guide/311-contact-center/home.page',
  },
  fpl: {
    id: 'fpl',
    name: 'FPL (Florida Power & Light)',
    display: '1-800-4-OUTAGE (1-800-468-8243)',
    dial: '18004688243',
    web: 'https://www.fpl.com/support/report-concerns.html',
    source: 'https://www.fpl.com/support/report-concerns.html',
  },
  '211': {
    id: '211',
    name: '211 Miami',
    display: '211',
    dial: '211',
    web: 'https://jcsfl.org/rp811',
    source: 'https://jcsfl.org/rp811',
  },
  gas: {
    id: 'gas',
    name: 'Florida City Gas (emergencies)',
    display: '800-993-7546',
    dial: '8009937546',
    web: 'https://www.floridacitygas.com',
    source: 'https://www.floridacitygas.com/new-form/',
  },
  poison: {
    id: 'poison',
    name: 'Poison Control',
    display: '1-800-222-1222',
    dial: '18002221222',
    source: 'https://www.miamidade.gov/hurricane/library/guide-to-hurricane-readiness.pdf',
  },
  wasd: {
    id: 'wasd',
    name: 'Miami-Dade Water and Sewer',
    display: '305-274-9272',
    dial: '3052749272',
    source: 'https://www.miamidade.gov/hurricane/library/guide-to-hurricane-readiness.pdf',
  },
};

export const LINKS = {
  countyEmergency: 'https://www.miamidade.gov/emergency',
  safeApp: 'https://www.miamidade.gov/fire/storm-aides-for-everyone.asp',
  fplPowerTracker: 'https://www.fpl.com/powertracker',
};
