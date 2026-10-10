import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ALERT_RADIUS_KM, ALERT_TTL_HOURS, alertCategory, type AlertUrgency } from '../core/alerts';
import type { Coords, Lang, Situation } from '../core/types';
import { alertCoords, alertsConfigured, postAlert, type EmergencyAlertStatus } from '../services/alerts';
import { useApp } from '../state/AppContext';
import { colors, radius } from './theme';
import { Button, Card } from './ui';

/** The situation as neighbors read it: a short category such as "Flooding", in the reader's language. */
export function situationTitle(situation: Situation, lang: Lang, fallback: string): string {
  return alertCategory(situation, lang, fallback);
}

type Outcome = 'posted' | 'limited' | 'error' | 'no_location' | null;

/**
 * On the Emergency and Urgent results: lets the resident tell volunteers nearby. They see exactly what will be shared
 * before they tap, and tapping contacts no one directly: volunteers see it in "What is happening". Never shown for a
 * non-emergency, and never a replacement for calling 911.
 */
export function NeighborAlertCard({ urgency, situation, coords }: { urgency: AlertUrgency; situation: Situation; coords: Coords | null }) {
  const { t } = useTranslation();
  const { profile, online } = useApp();
  const lang: Lang = profile?.language ?? 'en';
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const km = ALERT_RADIUS_KM[urgency];

  const send = async () => {
    if (sending || outcome === 'posted') return;
    setSending(true);
    setOutcome(null);
    const where = await alertCoords(profile?.addressCoords, coords);
    if (!where) {
      setOutcome('no_location');
    } else {
      const r = await postAlert({ urgency, situation, coords: where });
      setOutcome(r === 'posted' ? 'posted' : r === 'rate_limited' ? 'limited' : 'error');
      if (r === 'posted') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setSending(false);
  };

  const done = outcome === 'posted';
  // Same words for the same kind of alert on both ends: what neighbors will read.
  const what = situationTitle(situation, lang, t('city.alerts.someone'));

  return (
    <Card style={{ marginTop: 14 }}>
      <View style={s.head}>
        <Ionicons name="people" size={22} color={colors.navy} />
        <Text style={s.title}>{t('result.alert.title')}</Text>
      </View>
      <Text style={s.body}>{t('result.alert.body', { km })}</Text>
      <Text style={s.shows}>{t('result.alert.shows', { what, level: t(`result.alert.${urgency === 'emergency' ? 'emergency' : 'urgent'}`) })}</Text>
      {done ? (
        <View style={[s.note, s.ok]}>
          <Ionicons name="checkmark-circle" size={20} color={colors.green} />
          <Text style={s.noteText}>{alertsConfigured ? t('result.alert.sent', { km, hours: ALERT_TTL_HOURS }) : t('result.alert.sentLocal')}</Text>
        </View>
      ) : (
        <Button variant="outline" icon="megaphone-outline" label={t('result.alert.button')} onPress={send} loading={sending} disabled={!online && alertsConfigured} style={{ marginTop: 10 }} />
      )}
      {!online && alertsConfigured && !done ? <Text style={s.warn}>{t('result.alert.offline')}</Text> : null}
      {outcome && !done ? <Text style={s.warn}>{t(`result.alert.${outcome === 'limited' ? 'limited' : outcome === 'no_location' ? 'noLocation' : 'error'}`)}</Text> : null}
    </Card>
  );
}

/**
 * On the Emergency result: says what AidNow did on its own, calmly and below the 911 buttons. It asks nothing:
 * the alert was already sent (or is waiting for a connection). The switch to turn it off lives in My role.
 */
export function EmergencyAlertNotice({ status }: { status: EmergencyAlertStatus }) {
  const { t } = useTranslation();
  if (status === 'off' || status === 'idle') return null;
  const sent = status === 'sent';
  const text =
    status === 'waiting'
      ? t('result.alert.autoWaiting', { km: ALERT_RADIUS_KM.emergency })
      : status === 'limited'
        ? t('result.alert.limited')
        : sent
          ? t(alertsConfigured ? 'result.alert.autoSent' : 'result.alert.autoSentLocal', { km: ALERT_RADIUS_KM.emergency })
          : t('result.alert.autoSending', { km: ALERT_RADIUS_KM.emergency });
  return (
    <View style={[s.auto, sent && s.ok]} accessible accessibilityLabel={text}>
      <Ionicons name={sent ? 'checkmark-circle' : 'people-outline'} size={20} color={sent ? colors.green : colors.muted} />
      <View style={{ flex: 1 }}>
        <Text style={s.autoText}>{text}</Text>
        {sent || status === 'sending' || status === 'retrying' ? (
          <Pressable onPress={() => router.push('/community?tab=me')} hitSlop={8}>
            <Text style={s.autoLink}>{t('result.alert.autoChange')}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  auto: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colors.subtle, borderRadius: radius.md, padding: 12, marginTop: 12 },
  autoText: { fontSize: 14, color: colors.text, lineHeight: 19 },
  autoLink: { fontSize: 13, color: colors.brand, fontWeight: '700', marginTop: 4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '800', color: colors.navy, flex: 1 },
  body: { fontSize: 15, color: colors.text, lineHeight: 21, marginTop: 8 },
  shows: { fontSize: 13, color: colors.muted, lineHeight: 18, marginTop: 6 },
  note: { flexDirection: 'row', gap: 8, alignItems: 'center', borderRadius: radius.md, padding: 12, marginTop: 10 },
  ok: { backgroundColor: colors.greenBg },
  noteText: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  warn: { fontSize: 14, color: colors.amber, fontWeight: '600', marginTop: 8 },
});
