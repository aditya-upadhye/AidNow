import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ContactsManager } from '../../components/ContactsManager';
import { colors, soft, radius, shadow, tones, type Tone } from '../../components/theme';
import { Button, Disclaimer, Screen, SectionTitle } from '../../components/ui';
import {
  CHECKIN_STATUSES,
  ago,
  composeCheckIn,
  mapLink,
  placeText,
  type CheckInStatus,
} from '../../core/checkin';
import { contactsOf } from '../../core/contacts';
import type { Lang } from '../../core/types';
import { quickCoords, textGroups } from '../../services/notify';
import { loadLastCheckIn, saveLastCheckIn, type LastCheckIn } from '../../services/storage';
import { useApp } from '../../state/AppContext';

type MciName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const STATUS_STYLE: Record<CheckInStatus, { icon: MciName; tone: Tone }> = {
  safe: { icon: 'check-circle-outline', tone: 'green' },
  need_help: { icon: 'alert-circle-outline', tone: 'red' },
  evacuating: { icon: 'run-fast', tone: 'blue' },
  no_power: { icon: 'power-plug-off-outline', tone: 'amber' },
};

/**
 * The Family tab: tell the people you trust how you are, and manage who they are. One list of people serves the
 * status text here, the SOS screen and the emergency result, so there is nowhere else to maintain it.
 */
export default function Family() {
  const { t } = useTranslation();
  const { profile, setProfile } = useApp();
  const [status, setStatus] = useState<CheckInStatus>('safe');
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [last, setLast] = useState<LastCheckIn | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadLastCheckIn().then(setLast);
  }, []);

  if (!profile) return null;
  const people = contactsOf(profile);
  const selected = people.filter((p) => !off[p.id]);

  const place = (coords: Parameters<typeof placeText>[1], lang: Lang) => placeText(profile.address, coords, lang);
  const time = () => new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  const message = (lang: Lang, coords: Parameters<typeof placeText>[1]) =>
    composeCheckIn({ status, lang, name: profile.fullName, place: place(coords, lang), time: time(), mapUrl: coords ? mapLink(coords) : undefined });

  const send = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const coords = await quickCoords();
    // One composer per language, so each person reads the text in their own.
    await textGroups(selected, (lang) => message(lang, coords));
    const rec = { at: new Date().toISOString(), status, count: selected.length };
    await saveLastCheckIn(rec);
    setLast(rec);
    setBusy(false);
  };

  const whenText = (iso: string) => {
    const a = ago(iso);
    return t(`checkin.${a.unit}`, { count: a.count });
  };
  const previewLang: Lang = selected[0]?.language ?? profile.language;

  return (
    <Screen title={t('nav.family')}>
      <Text style={s.intro}>{t('checkin.intro')}</Text>

      <SectionTitle>{t('checkin.pick')}</SectionTitle>
      <View style={s.grid}>
        {CHECKIN_STATUSES.map((k) => {
          const on = status === k;
          const st = STATUS_STYLE[k];
          return (
            <Pressable key={k} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setStatus(k)} style={[s.tile, on && { borderColor: tones[st.tone].fg, backgroundColor: tones[st.tone].bg }]}>
              <MaterialCommunityIcons name={st.icon} size={26} color={tones[st.tone].fg} />
              <Text style={s.tileText}>{t(`checkin.status.${k}`)}</Text>
            </Pressable>
          );
        })}
      </View>
      {status === 'need_help' ? (
        <View style={s.alert}>
          <Ionicons name="warning" size={20} color={colors.red} />
          <Text style={s.alertText}>{t('checkin.emergencyFirst')}</Text>
        </View>
      ) : null}

      <SectionTitle>{t('checkin.who')}</SectionTitle>
      <ContactsManager
        contacts={people}
        defaultLanguage={profile.language}
        onChange={(next) => setProfile({ ...profile, contacts: next })}
        selection={{ off, onToggle: (id, on) => setOff({ ...off, [id]: !on }) }}
      />

      {people.length > 0 ? (
        <>
          <SectionTitle>{t('checkin.preview')}</SectionTitle>
          <View style={s.sms}>
            <Text style={s.smsText}>{message(previewLang, null)}</Text>
          </View>
          <Text style={s.help}>{t('checkin.previewNote')}</Text>

          <Button
            big
            icon="paper-plane-outline"
            label={selected.length ? t('checkin.send', { count: selected.length }) : t('checkin.none')}
            onPress={send}
            disabled={selected.length === 0}
            loading={busy}
            variant={status === 'need_help' ? 'red' : 'navy'}
          />
          <Text style={s.last}>{last ? t('checkin.last', { status: t(`checkin.status.${last.status}`, { defaultValue: last.status }), when: whenText(last.at) }) : t('checkin.never')}</Text>
        </>
      ) : null}
      <Disclaimer />
    </Screen>
  );
}

const s = StyleSheet.create({
  intro: { fontSize: 16, color: colors.text, lineHeight: 23, marginTop: 4 },
  alert: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colors.redBg, borderRadius: radius.md, padding: 12, marginTop: 10 },
  alertText: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.redDark, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { width: '48%', flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 64, backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 12, borderWidth: 2, borderColor: 'transparent', ...shadow },
  tileText: { flex: 1, fontSize: 16, fontWeight: '800', color: colors.text, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 18, fontWeight: '800', color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 1 },
  label: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 10, marginBottom: 8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  pill: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  pillOn: { backgroundColor: soft.blue.bg, borderColor: soft.blue.border },
  pillText: { fontSize: 15, fontWeight: '700', color: colors.text },
  pillTextOn: { color: colors.brand },
  remove: { fontSize: 14, color: colors.red, fontWeight: '700', marginTop: 6 },
  help: { fontSize: 13, color: colors.muted, lineHeight: 18, marginVertical: 8 },
  sms: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, borderWidth: 1, borderColor: colors.border },
  smsText: { fontSize: 16, color: colors.text, lineHeight: 22 },
  last: { fontSize: 14, fontWeight: '700', color: colors.green, textAlign: 'center', marginTop: 4 },
});
