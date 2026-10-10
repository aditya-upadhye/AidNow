import { findDangerWords } from './dangerWords';
import { stripNegated } from './negations';
import { hasPhrase, normalize } from './normalize';
import type { Lang, Situation, Triage, Vulnerable } from './types';

/**
 * Offline fallback when the on-device model is not loaded (low-memory phones, or still downloading).
 * Picks cards by keywords in English, Spanish and Creole. Spanish and Creole terms: NATIVE REVIEW.
 */
const KEYWORDS: Record<Exclude<Situation, 'other'>, string[]> = {
  water_in_home: [
    'water coming in', 'water entering', 'water in the house', 'water in my house', 'water in my home', 'flooding inside', 'house is flooding', 'water rising', 'water is rising',
    'entra agua', 'entrando agua', 'agua en la casa', 'el agua is coming', 'se mete el agua', 'se inunda la casa', 'el agua está subiendo', 'el agua sube',
    'dlo ap antre', 'dlo lakay', 'dlo nan kay', 'dlo ap monte', 'kay la ap inonde',
  ],
  injury_trapped: [
    'hurt', 'injured', 'injury', 'bleeding', 'trapped', 'not breathing', "can't breathe", 'unconscious', 'fell', 'broken',
    'herido', 'herida', 'lastimado', 'sangrando', 'atrapado', 'atrapada', 'no respira', 'inconsciente',
    'blese', 'senyen', 'kwense', 'bloke', 'pa respire', 'pèdi konesans',
  ],
  fire_gas: [
    'fire', 'smoke', 'gas', 'burning', 'fuego', 'incendio', 'humo', 'huelo a gas', 'huele a gas',
    'dife', 'ensandi', 'lafimen', 'gaz', 'ap boule',
  ],
  generator_fumes: [
    'generator', 'carbon monoxide', 'fumes', 'generador', 'monóxido', 'gases del generador',
    'dèlko', 'delko', 'monoksid',
  ],
  downed_line: [
    'power line', 'line down', 'downed line', 'wire down', 'cable', 'sparking', 'sparks',
    'cable de luz', 'cable eléctrico', 'cables caídos', 'chispas',
    'fil kouran', 'kab elektrisite', 'fil elektrik', 'etensèl',
  ],
  medical_device: [
    'oxygen', 'ventilator', 'dialysis', 'cpap', 'medical device', 'medical equipment', 'wheelchair battery',
    'oxígeno', 'equipo médico', 'diálisis', 'máquina de oxígeno',
    'oksijèn', 'aparèy', 'ekipman medikal', 'machin oksijèn',
  ],
  power_outage: [
    'power out', 'power is out', "power's been out", 'no power', 'no electricity', 'outage', 'blackout', 'lights out',
    'se fue la luz', 'no hay luz', 'sin luz', 'apagón', 'sin electricidad',
    'pa gen kouran', 'kouran an ale', 'blakawout', 'pa gen limyè',
  ],
  street_hazard: [
    'tree', 'debris', 'street flooded', 'flooded street', 'road flooded', 'road blocked', 'street is flooded',
    'árbol', 'arbol', 'escombros', 'calle inundada', 'calle bloqueada',
    'pyebwa', 'debri', 'lari a plen dlo', 'dlo nan lari', 'lari a bloke',
  ],
  need_shelter: [
    'shelter', 'evacuate', 'evacuation', 'where do i go', 'mobile home', 'zone a',
    'refugio', 'evacuar', 'evacuación', 'albergue', 'casa móvil',
    'abri', 'evakye', 'evakyasyon', 'sant evakyasyon', 'refij',
  ],
  need_supplies: [
    'food', 'drinking water', 'no water', 'medicine', 'formula', 'hungry',
    'comida', 'agua potable', 'no tengo agua', 'medicina', 'medicinas', 'hambre',
    'manje', 'dlo potab', 'medikaman', 'grangou', 'pa gen manje',
  ],
};

const VULNERABLE_TERMS: Record<Vulnerable, string[]> = {
  elderly: ['elderly', 'old', 'grandmother', 'grandfather', 'mother is 8', 'anciano', 'anciana', 'mayor', 'abuela', 'abuelo', 'granmoun', 'granmoun aje', 'grann'],
  child: ['baby', 'child', 'children', 'kids', 'bebé', 'bebe', 'niño', 'niña', 'niños', 'hijos', 'timoun', 'ti bebe', 'pitit'],
  disability: ['wheelchair', 'disabled', 'disability', 'silla de ruedas', 'discapacidad', 'chèz woulant', 'enfim'],
  medical_device: ['oxygen', 'ventilator', 'dialysis', 'oxígeno', 'oksijèn'],
};

/** Damage to the home itself: ask about danger first, then 311 (scenario S9). */
const HOME_DAMAGE = [
  'roof', 'through the house', 'on the house', 'on my house', 'collapsed', 'collapse',
  'techo', 'sobre la casa', 'se derrumbó',
  'do kay', 'tèt kay', 'sou kay la', 'kraze',
];

export function classifyByKeywords(texts: string[], language: Lang): Triage {
  // "Nobody is hurt" must not pick the injury card.
  const normalized = texts.filter(Boolean).map((t) => stripNegated(normalize(t)));
  const matches = (terms: string[]) => terms.filter((t) => normalized.some((n) => hasPhrase(n, t))).length;

  const scored = (Object.keys(KEYWORDS) as Exclude<Situation, 'other'>[])
    .map((s) => ({ s, score: matches(KEYWORDS[s]) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  // Generator fumes beat plain "generator" + "power out"; medical devices beat plain outages.
  let situations: Situation[] = scored.slice(0, 2).map((x) => x.s);
  if (situations.includes('generator_fumes') && situations.includes('power_outage')) situations = ['generator_fumes'];
  if (situations.includes('medical_device') && situations.includes('power_outage')) situations = ['medical_device'];
  if (situations.includes('water_in_home') && situations.includes('street_hazard')) situations = ['water_in_home'];
  if (situations.includes('street_hazard') && matches(HOME_DAMAGE) > 0) situations = ['other', 'street_hazard'];

  const vulnerable = (Object.keys(VULNERABLE_TERMS) as Vulnerable[]).filter((v) => matches(VULNERABLE_TERMS[v]) > 0);

  return {
    urgency: findDangerWords(...texts).length ? 'emergency' : 'non_emergency',
    situations: situations.length ? situations : ['other'],
    location_text: '',
    people_count: null,
    vulnerable,
    photo_findings: '',
    photo_findings_local: '',
    english_summary: '',
    language,
    source: 'keywords',
  };
}
