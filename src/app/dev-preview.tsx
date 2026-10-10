import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { classifyByKeywords } from '../core/keywordClassifier';
import { buttonTriage } from '../core/triageSchema';
import type { Lang, Triage } from '../core/types';
import { useApp } from '../state/AppContext';

/**
 * Development only: open aidnow://dev-preview?s=marie to load a scenario straight into the result screen,
 * for checking layouts without speaking or typing. Does nothing in release builds.
 */
const SCENARIOS: Record<string, { text: string; lang: Lang; triage?: Partial<Triage> }> = {
  marie: {
    text: 'Dlo ap antre lakay mwen. Manman m ki granmoun aje a anndan kay la avè m. Nou nan 123 Northwest 54th Street, Miami.',
    lang: 'ht',
    triage: { urgency: 'emergency', situations: ['water_in_home'], location_text: '123 Northwest 54th Street, Miami', people_count: 2, vulnerable: ['elderly'] },
  },
  carlos: {
    text: 'Se cayó un árbol en mi calle y se fue la luz desde anoche. Nadie está herido.',
    lang: 'es',
    triage: { urgency: 'non_emergency', situations: ['street_hazard', 'power_outage'], english_summary: 'Tree down on the street and power out since last night.' },
  },
  line: { text: 'A power line fell in front of my house. Nobody was harmed.', lang: 'en', triage: { urgency: 'urgent_safety', situations: ['downed_line'] } },
  gas: { text: 'Huelo a gas en la cocina.', lang: 'es' },
};

export default function DevPreview() {
  const { s } = useLocalSearchParams<{ s?: string }>();
  const { setSession } = useApp();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!__DEV__) return;
    const sc = SCENARIOS[s ?? 'marie'];
    if (!sc) return;
    const base = sc.triage ? { ...buttonTriage([], sc.lang), source: 'gemma_online' as const, ...sc.triage } : classifyByKeywords([sc.text], sc.lang);
    setSession({ text: sc.text, english: '', triage: base as Triage, answers: {} });
    setReady(true);
  }, [s, setSession]);

  if (!__DEV__) return <Redirect href="/" />;
  return ready ? <Redirect href="/result" /> : null;
}
