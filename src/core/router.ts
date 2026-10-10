import type { AgencyId } from '../data/directory';
import { findDangerWords } from './dangerWords';
import { URGENCY_RANK, type Situation, type Triage, type Urgency } from './types';

/** Yes/no questions the result screen can ask. "Yes" always escalates to 911. */
export type Question =
  /** Vague input or `other`: is there immediate danger to life? */
  | 'danger_now'
  /** Downed line: sparking, on fire, anyone hurt, touching a vehicle or blocking a road? */
  | 'line_hazard'
  /** Medical device without power: is someone's life at risk right now? */
  | 'life_at_risk'
  /** Non-emergency with a vulnerable person: is anyone sick, hurt or struggling to breathe? */
  | 'anyone_struggling';

export type Answers = Partial<Record<Question, boolean>>;

type Row = {
  urgency: Urgency;
  /** Where a non-emergency (or a "no" answer) goes. */
  agency: AgencyId;
  question?: Question;
  /** Step before calling 911. */
  first?: 'leave' | 'fresh_air';
  /** Extra line shown on the emergency screen after 911. */
  alsoCall?: AgencyId;
};

/** The routing table from the build spec. The model only classifies; this decides. */
export const ROUTING: Record<Situation, Row> = {
  water_in_home: { urgency: 'emergency', agency: '911' },
  injury_trapped: { urgency: 'emergency', agency: '911' },
  fire_gas: { urgency: 'emergency', agency: '911', first: 'leave', alsoCall: 'gas' },
  generator_fumes: { urgency: 'emergency', agency: '911', first: 'fresh_air', alsoCall: 'poison' },
  downed_line: { urgency: 'urgent_safety', agency: 'fpl', question: 'line_hazard', alsoCall: 'fpl' },
  medical_device: { urgency: 'urgent_safety', agency: '311', question: 'life_at_risk', alsoCall: '311' },
  power_outage: { urgency: 'non_emergency', agency: 'fpl' },
  street_hazard: { urgency: 'non_emergency', agency: '311' },
  need_shelter: { urgency: 'non_emergency', agency: '311' },
  need_supplies: { urgency: 'non_emergency', agency: '211' },
  other: { urgency: 'emergency', agency: '911', question: 'danger_now' },
};

export type Decision =
  | {
      screen: 'emergency';
      situation: Situation;
      situations: Situation[];
      first?: 'leave' | 'fresh_air';
      alsoCall?: AgencyId;
      /** Still asked on the red screen when the route came from a vague input. Never blocks 911. */
      question?: Question;
      dangerWords: string[];
    }
  | {
      /** Amber: urgent safety, waiting on one yes/no answer. Both buttons visible. */
      screen: 'urgent';
      situation: Situation;
      situations: Situation[];
      question: Question;
      agency: AgencyId;
      dangerWords: string[];
    }
  | {
      screen: 'agency';
      situation: Situation;
      situations: Situation[];
      /** One report per agency, e.g. a tree to 311 and the outage to FPL. */
      agencies: { agency: AgencyId; situation: Situation }[];
      question?: Question;
      dangerWords: string[];
    }
  | {
      /** The resident said there is no danger to life but we still don't know what happened. */
      screen: 'clarify';
      dangerWords: string[];
    };

const maxUrgency = (a: Urgency, b: Urgency): Urgency => (URGENCY_RANK[a] >= URGENCY_RANK[b] ? a : b);

/**
 * Decide the outcome. Escalate, never block:
 * - any danger word forces Emergency;
 * - the model's urgency can raise the table's urgency but never lower it;
 * - unknown or empty situations become Emergency with a yes/no question.
 */
export function route(triage: Triage, texts: string[], answers: Answers = {}): Decision {
  const dangerWords = findDangerWords(...texts, triage.english_summary);
  const situations: Situation[] = triage.situations.length ? dedupe(triage.situations) : ['other'];

  let urgency = maxUrgency(tableUrgencyOf(situations), triage.urgency);
  if (dangerWords.length) urgency = 'emergency';

  // Most serious situation first.
  let ordered = [...situations].sort((a, b) => URGENCY_RANK[ROUTING[b].urgency] - URGENCY_RANK[ROUTING[a].urgency]);

  // "No danger to life" removes the unknown part; anything else we know about still routes.
  if (answers.danger_now === false && !dangerWords.length && ordered.length > 1) {
    ordered = ordered.filter((s) => s !== 'other');
    // The resident's answer replaces the model's "unsure, so emergency"; the table still applies.
    urgency = maxUrgency(tableUrgencyOf(ordered), triage.urgency === 'emergency' ? 'non_emergency' : triage.urgency);
  }

  // A "yes" to any question escalates.
  if (Object.values(answers).some((a) => a === true)) urgency = 'emergency';

  const primary = ordered[0];
  const row = ROUTING[primary];

  if (primary === 'other' && !dangerWords.length) {
    if (answers.danger_now === false) return { screen: 'clarify', dangerWords };
    return {
      screen: 'emergency',
      situation: 'other',
      situations: ordered,
      question: answers.danger_now === undefined ? 'danger_now' : undefined,
      dangerWords,
    };
  }

  if (urgency === 'emergency') {
    return { screen: 'emergency', situation: primary, situations: ordered, first: row.first, alsoCall: row.alsoCall, dangerWords };
  }

  if (urgency === 'urgent_safety' && row.question && answers[row.question] === undefined) {
    return { screen: 'urgent', situation: primary, situations: ordered, question: row.question, agency: row.agency, dangerWords };
  }

  // Non-emergency, or urgent safety answered "no".
  const agencies: { agency: AgencyId; situation: Situation }[] = [];
  for (const s of ordered) {
    const agency = ROUTING[s].agency;
    if (agency !== '911' && !agencies.some((a) => a.agency === agency)) agencies.push({ agency, situation: s });
  }
  if (!agencies.length) {
    // Should not happen (911-only situations are emergencies), but never dead-end.
    return { screen: 'emergency', situation: primary, situations: ordered, dangerWords };
  }

  const needsCheck = triage.vulnerable.length > 0 && answers.anyone_struggling === undefined;
  return {
    screen: 'agency',
    situation: primary,
    situations: ordered,
    agencies,
    question: needsCheck ? 'anyone_struggling' : undefined,
    dangerWords,
  };
}

function tableUrgencyOf(situations: Situation[]): Urgency {
  return situations.map((s) => ROUTING[s].urgency).reduce(maxUrgency, 'non_emergency');
}

function dedupe<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}
