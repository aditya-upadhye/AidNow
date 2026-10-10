import type { Lang, Situation, Vulnerable } from './types';

/**
 * Fixed phrases for the 911 message (English) and its confirmation (resident's language).
 * The same fields fill both, so no model ever re-translates the 911 text.
 * Spanish and Creole are drafts using County guide vocabulary (aidnow-prep/06): NATIVE REVIEW.
 */
type L = Record<Lang, string>;

export const SITUATION_PHRASE: Record<Situation, L> = {
  water_in_home: { en: 'Flooding: water entering the home', es: 'Inundación: entra agua en la casa', ht: 'Inondasyon: dlo ap antre lakay la' },
  injury_trapped: { en: 'Person hurt or trapped', es: 'Persona herida o atrapada', ht: 'Yon moun blese oswa bloke' },
  fire_gas: { en: 'Fire or gas smell', es: 'Incendio u olor a gas', ht: 'Dife oswa odè gaz' },
  generator_fumes: {
    en: 'Possible carbon monoxide poisoning from generator fumes',
    es: 'Posible intoxicación por monóxido de carbono del generador',
    ht: 'Petèt pwazon monoksid kabòn ki soti nan dèlko',
  },
  downed_line: { en: 'Downed power line, dangerous', es: 'Cable eléctrico caído, peligroso', ht: 'Kab elektrisite ki tonbe, danjere' },
  medical_device: {
    en: 'Life-sustaining medical device has no power',
    es: 'Equipo médico de soporte vital sin electricidad',
    ht: 'Ekipman medikal pou kontinye viv pa gen kouran',
  },
  power_outage: { en: 'Power outage', es: 'Apagón, sin electricidad', ht: 'Blakawout, pa gen kouran' },
  street_hazard: {
    en: 'Tree, debris or flooding on the street',
    es: 'Árbol, escombros o inundación en la calle',
    ht: 'Pyebwa, debri oswa dlo nan lari',
  },
  need_shelter: { en: 'Needs shelter or evacuation help', es: 'Necesita refugio o ayuda para evacuar', ht: 'Bezwen abri oswa èd pou evakye' },
  need_supplies: { en: 'Needs food, water or medicine', es: 'Necesita comida, agua o medicinas', ht: 'Bezwen manje, dlo oswa medikaman' },
  other: { en: 'Emergency, need help', es: 'Emergencia, necesito ayuda', ht: 'Ijans, mwen bezwen èd' },
};

/**
 * More specific phrases picked when the resident's words match, in any language.
 * Checked in order; the first match wins.
 */
export const REFINEMENTS: { applies: Situation[]; terms: string[]; phrase: L }[] = [
  {
    applies: ['injury_trapped', 'other'],
    terms: ['not breathing', 'stopped breathing', 'no pulse', 'no respira', 'dejó de respirar', 'sin pulso', 'pa respire', 'li pa respire'],
    phrase: { en: 'Person not breathing', es: 'Persona que no respira', ht: 'Yon moun pa respire' },
  },
  {
    applies: ['injury_trapped', 'other'],
    terms: ["can't breathe", 'cant breathe', 'cannot breathe', 'hard to breathe', 'no puedo respirar', 'no puede respirar', 'mwen pa ka respire', 'pa kapab respire', 'toufe'],
    phrase: { en: 'Person cannot breathe', es: 'Persona que no puede respirar', ht: 'Yon moun pa ka respire' },
  },
  {
    applies: ['injury_trapped', 'other'],
    terms: ['unconscious', 'unresponsive', 'passed out', 'inconsciente', 'desmayado', 'desmayó', 'pèdi konesans'],
    phrase: { en: 'Person unconscious', es: 'Persona inconsciente', ht: 'Yon moun pèdi konesans' },
  },
  {
    applies: ['injury_trapped', 'other'],
    terms: ['trapped', 'atrapado', 'atrapada', 'kwense', 'bloke'],
    phrase: { en: 'Person trapped', es: 'Persona atrapada', ht: 'Yon moun bloke' },
  },
  {
    applies: ['fire_gas', 'other'],
    terms: ['fire', 'on fire', 'smoke', 'burning', 'fuego', 'incendio', 'humo', 'ensandi', 'dife', 'lafimen', 'ap boule'],
    phrase: { en: 'Fire', es: 'Incendio', ht: 'Dife (ensandi)' },
  },
  {
    applies: ['fire_gas'],
    terms: ['gas', 'gaz'],
    phrase: { en: 'Gas smell, we are leaving the home', es: 'Olor a gas, estamos saliendo de la casa', ht: 'Odè gaz, n ap soti nan kay la' },
  },
  {
    applies: ['downed_line', 'other'],
    terms: ['sparking', 'sparks', 'chispas', 'etensèl'],
    phrase: { en: 'Power line down and sparking', es: 'Cable eléctrico caído echando chispas', ht: 'Kab elektrisite tonbe epi l ap fè etensèl' },
  },
];

export const VULNERABLE_PHRASE: Record<Vulnerable, L> = {
  elderly: { en: 'an elderly person', es: 'una persona mayor', ht: 'yon granmoun aje' },
  child: { en: 'a child', es: 'un niño', ht: 'yon timoun' },
  disability: { en: 'a person with a disability', es: 'una persona con discapacidad', ht: 'yon moun enfim' },
  medical_device: { en: 'a person on a medical device', es: 'una persona con equipo médico', ht: 'yon moun ki sou aparèy medikal' },
};

export const PEOPLE = {
  one: { en: '1 person', es: '1 persona', ht: '1 moun' } as L,
  many: { en: '{n} people', es: '{n} personas', ht: '{n} moun' } as L,
  including: { en: ' including ', es: ', incluye ', ht: ', gen ladan ' } as L,
  and: { en: ' and ', es: ' y ', ht: ' ak ' } as L,
};

export const LOCATION_UNKNOWN: L = { en: 'Location unknown', es: 'Ubicación desconocida', ht: 'Nou pa konnen ki kote' };

/** Language cue at the end of the English 911 message, long and short forms. */
export const SPEAKER_EN: Record<Lang, { long: string; short: string }> = {
  en: { long: '', short: '' },
  es: { long: 'Spanish speaker, needs interpreter.', short: 'Spanish speaker.' },
  ht: { long: 'Haitian Creole speaker, needs interpreter.', short: 'Creole speaker.' },
};

/** How the confirmation describes the language cue, in the resident's language. */
export const SPEAKER_CONFIRM: Record<Lang, string> = {
  en: '',
  es: 'Habla español y necesita intérprete',
  ht: 'Ou pale kreyòl epi ou bezwen yon entèprèt',
};

export const MOBILITY_EN = 'Mobility needs: ';
