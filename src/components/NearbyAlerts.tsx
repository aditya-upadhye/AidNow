import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { minutesAgo, type NearAlert } from '../core/alerts';
import { formatKm } from '../core/community';
import type { Coords, Lang } from '../core/types';
import { DEMO_ORIGIN } from '../data/communitySeed';
import { alertsConfigured, useNearbyAlerts } from '../services/alerts';
import { config } from '../services/config';
import { getCoords } from '../services/location';
import { loadCommunity } from '../services/storage';
import { useApp } from '../state/AppContext';
import { situationTitle } from './NeighborAlertCard';
import { colors, radius, tones } from './theme';
import { Button, Card, Chip } from './ui';

/**
 * Top of "What is happening": alerts from people in trouble nearby, for volunteers who switched alerts on. While this
 * is on screen it asks the server for new ones every 5 seconds (iPhones cannot get remote push without a paid Apple
 * Developer account). Everyone else sees how to switch it on.
 */
export function NearbyAlerts() {
  const { t } = useTranslation();
  const { profile, online } = useApp();
  const [listening, setListening] = useState<boolean | null>(null);
  const [gps, setGps] = useState<Coords | null>(null);
  const lang: Lang = profile?.language ?? 'en';

  useEffect(() => {
    loadCommunity().then((c) => setListening(!!c && c.consented && c.volunteer && c.receiveAlerts));
  }, []);

  // Same origin rule as the rest of Community: saved address, else GPS; demo builds start in Little Haiti.
  const saved = profile?.addressCoords;
  useEffect(() => {
    if (listening && !saved && !config.demoMode) getCoords().then(setGps);
  }, [listening, saved]);
  const origin = saved ?? (config.demoMode ? DEMO_ORIGIN : gps);

  const { alerts, status, updatedAt } = useNearbyAlerts(origin, !!listening && (online || !alertsConfigured));

  if (listening === null) return null;

  if (!listening) {
    return (
      <Card style={{ marginBottom: 12 }}>
        <View style={s.head}>
          <Ionicons name="notifications-outline" size={20} color={colors.navy} />
          <Text style={s.title}>{t('city.alerts.offTitle')}</Text>
        </View>
        <Text style={s.small}>{t('city.alerts.offBody')}</Text>
        <Button variant="outline" icon="options-outline" label={t('city.alerts.offButton')} onPress={() => router.push('/community?tab=me')} />
      </Card>
    );
  }

  return (
    <Card style={{ marginBottom: 12 }}>
      <View style={s.head}>
        <Ionicons name="notifications" size={20} color={colors.red} />
        <Text style={s.title}>{t('city.alerts.title')}</Text>
        {status === 'ok' ? (
          <View style={s.live}>
            <View style={s.dot} />
            <Text style={s.liveText}>{t('city.alerts.liveBadge')}</Text>
          </View>
        ) : null}
      </View>
      <Text style={s.small}>
        {t('city.alerts.live')}. {t('city.alerts.whileOpen')}
      </Text>
      {!alertsConfigured ? <Text style={s.small}>{t('city.alerts.localNote')}</Text> : null}
      {!origin ? <Text style={s.warn}>{t('city.alerts.noLocation')}</Text> : null}
      {status === 'error' ? <Text style={s.warn}>{t('city.alerts.error')}</Text> : null}

      {origin && status !== 'idle' && alerts.length === 0 ? <Text style={s.none}>{t('city.alerts.none')}</Text> : null}
      {alerts.map((a) => (
        <AlertRow key={a.id} a={a} lang={lang} now={updatedAt ?? new Date()} />
      ))}
    </Card>
  );
}

function AlertRow({ a, lang, now }: { a: NearAlert; lang: Lang; now: Date }) {
  const { t } = useTranslation();
  const emergency = a.urgency === 'emergency';
  const tone = tones[emergency ? 'red' : 'amber'];
  const mins = minutesAgo(a.at, now);
  return (
    <View style={[s.row, { backgroundColor: tone.bg }]} accessible accessibilityLabel={`${t(emergency ? 'city.alerts.emergency' : 'city.alerts.urgent')}. ${situationTitle(a.situation, lang, t('city.alerts.someone'))}`}>
      <Ionicons name={emergency ? 'alert-circle' : 'warning'} size={26} color={tone.fg} />
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>{situationTitle(a.situation, lang, t('city.alerts.someone'))}</Text>
        <Text style={s.rowSub}>
          {t(emergency ? 'city.alerts.emergency' : 'city.alerts.urgent')} · {t('city.alerts.away', { km: formatKm(a.km) })} · {mins < 1 ? t('city.alerts.justNow') : t('city.alerts.ago', { count: mins })}
        </Text>
      </View>
      {a.mine ? <Chip icon="person-outline" label={t('city.alerts.yours')} tone="navy" /> : null}
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '800', color: colors.navy, flex: 1 },
  small: { fontSize: 13, color: colors.muted, lineHeight: 18, marginVertical: 6 },
  warn: { fontSize: 14, color: colors.amber, fontWeight: '600', marginVertical: 6 },
  none: { fontSize: 15, color: colors.muted, marginTop: 6 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.greenBg, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green },
  liveText: { fontSize: 11, fontWeight: '800', color: colors.green, letterSpacing: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: radius.md, padding: 12, marginTop: 8 },
  rowTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  rowSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
});
