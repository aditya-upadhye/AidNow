import { stripNegated } from './negations';
import { hasPhrase, normalize } from './normalize';
import {
  LOCATION_UNKNOWN,
  MOBILITY_EN,
  PEOPLE,
  REFINEMENTS,
  SITUATION_PHRASE,
  SPEAKER_CONFIRM,
  SPEAKER_EN,
  VULNERABLE_PHRASE,
} from './phrases';
import type { Coords, Lang, Profile, Situation, Triage, Vulnerable } from './types';

export const SMS_LIMIT = 160;

const ABBREVIATIONS: [RegExp, string][] = [
  [/\bNW\b\.?/gi, 'Northwest'],
  [/\bNE\b\.?/gi, 'Northeast'],
  [/\bSW\b\.?/gi, 'Southwest'],
  [/\bSE\b\.?/gi, 'Southeast'],
  [/\bN\b\.?(?=\s+\d)/g, 'North'],
  [/\bS\b\.?(?=\s+\d)/g, 'South'],
  [/\bE\b\.?(?=\s+\d)/g, 'East'],
  [/\bW\b\.?(?=\s+\d)/g, 'West'],
  [/\bSt\b\.?/gi, 'Street'],
  [/\bAve?\b\.?/gi, 'Avenue'],
  [/\bRd\b\.?/gi, 'Road'],
  [/\bBlvd\b\.?/gi, 'Boulevard'],
  [/\bDr\b\.?/gi, 'Drive'],
  [/\bCt\b\.?/gi, 'Court'],
  [/\bPl\b\.?/gi, 'Place'],
  [/\bTer\b\.?/gi, 'Terrace'],
  [/\bLn\b\.?/gi, 'Lane'],
  [/\bHwy\b\.?/gi, 'Highway'],
  [/\bPkwy\b\.?/gi, 'Parkway'],
  [/\bCir\b\.?/gi, 'Circle'],
  [/\bApt\b\.?/gi, 'Apartment'],
];

/** Miami-Dade asks for no abbreviations in texts to 911, so write street words out. */
export function expandAddress(address: string): string {
  let out = address.trim().replace(/\s+/g, ' ');
  for (const [re, word] of ABBREVIATIONS) out = out.replace(re, word);
  return out.replace(/\.$/, '');
}

export function ageFrom(dateOfBirth: string | undefined, now = new Date()): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return null;
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

/** "In front of my house", "devan kay mwen", "aquí": not an address 911 can use. */
const RELATIVE_PLACE = [
  'my house', 'my home', 'the house', 'here', 'outside', 'in front of', 'behind', 'next door', 'my street',
  'mi casa', 'la casa', 'aquí', 'aqui', 'afuera', 'frente a', 'mi calle',
  'kay mwen', 'lakay', 'isit', 'devan kay', 'deyò', 'lari mwen',
];

/** A stated location is usable if it has a number (address, intersection) or isn't just a relative phrase. */
export function isUsableLocation(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/\d/.test(t)) return true;
  const n = normalize(t);
  return !RELATIVE_PLACE.some((p) => hasPhrase(n, p));
}

export type MessageFields = {
  situation: Situation;
  /** Phrase chosen for the situation, in all three languages. */
  phrase: Record<Lang, string>;
  /** Written-out address, GPS text, or null when unknown. */
  location: string | null;
  peopleCount: number | null;
  vulnerable: Vulnerable[];
  mobility: string | null;
  language: Lang;
};

/** Gather the fields for the 911 message from the triage, the profile and GPS. */
export function buildFields(
  triage: Triage,
  situation: Situation,
  profile: Profile | null,
  texts: string[],
  gps: Coords | null,
): MessageFields {
  const normalized = texts.filter(Boolean).map((t) => stripNegated(normalize(t)));
  const refinement = REFINEMENTS.find(
    (r) => r.applies.includes(situation) && r.terms.some((t) => normalized.some((n) => hasPhrase(n, t))),
  );

  let location: string | null = null;
  if (isUsableLocation(triage.location_text)) location = expandAddress(triage.location_text);
  else if (profile?.address.trim()) location = expandAddress(profile.address);
  else if (gps) location = `GPS ${gps.lat.toFixed(5)}, ${gps.lon.toFixed(5)}`;

  const vulnerable = new Set<Vulnerable>(triage.vulnerable);
  const age = ageFrom(profile?.dateOfBirth);
  if (age !== null && age >= 65) vulnerable.add('elderly');

  return {
    situation,
    phrase: refinement?.phrase ?? SITUATION_PHRASE[situation],
    location,
    peopleCount: triage.people_count ?? profile?.householdSize ?? null,
    vulnerable: [...vulnerable],
    mobility: profile?.shareMobilityIn911 && profile.mobilityNeeds?.trim() ? profile.mobilityNeeds.trim() : null,
    language: triage.language,
  };
}

function peopleText(f: MessageFields, lang: Lang, withVulnerable: boolean): string {
  const n = f.peopleCount;
  const vul = withVulnerable ? f.vulnerable.map((v) => VULNERABLE_PHRASE[v][lang]) : [];
  if (!n && !vul.length) return '';
  let base = '';
  if (n) base = n === 1 ? PEOPLE.one[lang] : PEOPLE.many[lang].replace('{n}', String(n));
  if (!vul.length) return base;
  const list = vul.length === 1 ? vul[0] : vul.slice(0, -1).join(', ') + PEOPLE.and[lang] + vul[vul.length - 1];
  return base ? base + PEOPLE.including[lang] + list : list.charAt(0).toUpperCase() + list.slice(1);
}

const sentence = (s: string) => (!s ? '' : /[.!?]$/.test(s) ? s : s + '.');

/**
 * The English text for 911: situation, location, people and vulnerability, language.
 * Always under 160 characters: optional parts are dropped, longest-lived first, before the location is cut.
 */
export function compose911(f: MessageFields): string {
  const situation = sentence(f.phrase.en);
  const location = sentence(f.location ?? LOCATION_UNKNOWN.en);
  const attempts: string[][] = [
    [situation, location, sentence(peopleText(f, 'en', true)), sentence(f.mobility ? MOBILITY_EN + f.mobility : ''), SPEAKER_EN[f.language].long],
    [situation, location, sentence(peopleText(f, 'en', true)), SPEAKER_EN[f.language].long],
    [situation, location, sentence(peopleText(f, 'en', true)), SPEAKER_EN[f.language].short],
    [situation, location, sentence(peopleText(f, 'en', false)), SPEAKER_EN[f.language].short],
    [situation, location, SPEAKER_EN[f.language].short],
  ];
  for (const parts of attempts) {
    const text = parts.filter(Boolean).join(' ');
    if (text.length < SMS_LIMIT) return text;
  }
  // Last resort: keep the start (situation and location come first) and cut.
  const text = attempts[attempts.length - 1].filter(Boolean).join(' ');
  return text.slice(0, SMS_LIMIT - 1);
}

/** What the 911 message says, in the resident's language, built from the same fields. */
export function composeConfirmation(f: MessageFields, lang: Lang): string[] {
  const lines = [f.phrase[lang], f.location ?? LOCATION_UNKNOWN[lang]];
  const people = peopleText(f, lang, true);
  if (people) lines.push(people);
  if (f.mobility) lines.push(f.mobility);
  if (SPEAKER_CONFIRM[f.language] && lang !== 'en') lines.push(SPEAKER_CONFIRM[f.language]);
  return lines;
}

const CONTACT: Record<Lang, (name: string, what: string, where: string, called911: boolean) => string> = {
  en: (name, what, where, e) => `${name} used AidNow: ${what}. Location: ${where}.${e ? ' They were told to call 911.' : ''}`,
  es: (name, what, where, e) => `${name} usó AidNow: ${what}. Ubicación: ${where}.${e ? ' Se le indicó llamar al 911.' : ''}`,
  ht: (name, what, where, e) => `${name} itilize AidNow: ${what}. Kote: ${where}.${e ? ' Yo di l rele 911.' : ''}`,
};

/** Text to the emergency contact, in the resident's language. */
export function composeContactMessage(f: MessageFields, lang: Lang, fullName: string, emergency: boolean): string {
  return CONTACT[lang](fullName || 'AidNow', f.phrase[lang], f.location ?? LOCATION_UNKNOWN[lang], emergency);
}

const REPORT_INTRO: Record<Lang, string> = { en: 'Report', es: 'Reporte', ht: 'Rapò' };
const REPORT_LABELS: Record<Lang, { where: string; people: string; details: string; speaks: string }> = {
  en: { where: 'Location', people: 'People', details: 'Details', speaks: 'Resident speaks' },
  es: { where: 'Ubicación', people: 'Personas', details: 'Detalles', speaks: 'El residente habla' },
  ht: { where: 'Kote', people: 'Moun', details: 'Detay', speaks: 'Rezidan an pale' },
};
const LANGUAGE_NAME: Record<Lang, Record<Lang, string>> = {
  en: { en: 'English', es: 'Spanish', ht: 'Haitian Creole' },
  es: { en: 'inglés', es: 'español', ht: 'criollo haitiano' },
  ht: { en: 'angle', es: 'panyòl', ht: 'kreyòl ayisyen' },
};

/**
 * Non-emergency report for an agency (English) and the version shown to the resident.
 * Unlike 911 texts, the English report may include the model's plain-facts summary.
 */
export function composeReport(
  f: MessageFields,
  situation: Situation,
  lang: Lang,
  extras: { englishSummary?: string; photoFindings?: string; originalText?: string },
): string {
  const L = REPORT_LABELS[lang];
  const phrase = SITUATION_PHRASE[situation][lang];
  const lines = [`${REPORT_INTRO[lang]}: ${phrase}.`, `${L.where}: ${f.location ?? LOCATION_UNKNOWN[lang]}.`];
  const people = peopleText(f, lang, true);
  if (people) lines.push(`${L.people}: ${people}.`);
  if (lang === 'en') {
    const details = [extras.englishSummary, extras.photoFindings].filter((s) => s && s.trim()).join(' ');
    if (details) lines.push(`${L.details}: ${details}`);
  } else if (extras.originalText?.trim()) {
    lines.push(`${L.details}: "${extras.originalText.trim()}"`);
  }
  if (f.language !== 'en') lines.push(`${L.speaks} ${LANGUAGE_NAME[lang][f.language]}.`);
  return lines.join('\n');
}
