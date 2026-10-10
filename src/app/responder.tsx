import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Image, StyleSheet, Text, View } from 'react-native';

import { colors, soft, radius, shadow } from '../components/theme';
import { Screen } from '../components/ui';
import { ageFrom } from '../core/composer';
import { contactsOf } from '../core/contacts';
import { useApp } from '../state/AppContext';

/**
 * One screen to hand to a first responder. Labels are in English (for the responder) with the
 * resident's language underneath. Medical details appear only here unless the resident adds them to a message.
 */
export default function Responder() {
  const { t, i18n } = useTranslation();
  const { profile } = useApp();
  if (!profile) return null;
  const en = i18n.getFixedT('en');
  const none = en('responder.none');
  const age = ageFrom(profile.dateOfBirth);

  const row = (k: string, value: string | undefined, big = false) => (
    <View style={s.row} key={k}>
      <Text style={s.label}>
        {en(`responder.${k}`)}
        {i18n.language !== 'en' ? ` · ${t(`responder.${k}`)}` : ''}
      </Text>
      <Text style={[s.value, big && s.valueBig, !value?.trim() && s.none]}>{value?.trim() ? value : none}</Text>
    </View>
  );

  return (
    <Screen back title={t('profile.responderCard')} bg={colors.navy}>
      <View style={s.card}>
        <View style={s.banner}>
          <Ionicons name="id-card" size={22} color={colors.red} />
          <Text style={s.bannerText}>{en('responder.title')}</Text>
        </View>
        <View style={s.top}>
          {profile.photoUri ? (
            <Image source={{ uri: profile.photoUri }} style={s.photo} />
          ) : (
            <View style={[s.photo, s.photoEmpty]}>
              <Ionicons name="person" size={44} color={colors.faint} />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={s.name}>{profile.fullName}</Text>
            {age !== null ? <Text style={s.meta}>{age} y/o</Text> : null}
            <Text style={s.meta}>{en(`languageName.${profile.language}`)}</Text>
          </View>
          <View style={s.blood}>
            <Text style={s.bloodLabel}>BLOOD</Text>
            <Text style={s.bloodValue}>{profile.bloodType?.trim() || '?'}</Text>
          </View>
        </View>
        <View style={s.body}>
          {row('medical', profile.medicalNotes, true)}
          {row('mobility', profile.mobilityNeeds)}
          {row('contact', contactsOf(profile).map((c) => `${c.name} · ${c.phone}`).join('\n'))}
          {profile.address ? row('address', profile.address) : null}
        </View>
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, overflow: 'hidden', ...shadow },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: soft.red.bg, borderBottomWidth: 1, borderBottomColor: soft.red.border, paddingHorizontal: 16, paddingVertical: 12 },
  bannerText: { color: colors.red, fontSize: 18, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  top: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  photo: { width: 84, height: 84, borderRadius: 42 },
  photoEmpty: { backgroundColor: colors.subtle, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 24, fontWeight: '900', color: colors.text },
  meta: { fontSize: 15, color: colors.muted, marginTop: 2 },
  blood: { alignItems: 'center', backgroundColor: colors.redBg, borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8 },
  bloodLabel: { fontSize: 11, fontWeight: '900', color: colors.red, letterSpacing: 1 },
  bloodValue: { fontSize: 26, fontWeight: '900', color: colors.red },
  body: { paddingHorizontal: 16, paddingBottom: 8 },
  row: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border, paddingVertical: 12 },
  label: { fontSize: 12, color: colors.muted, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
  value: { fontSize: 19, fontWeight: '700', color: colors.text, marginTop: 3 },
  valueBig: { fontSize: 21 },
  none: { color: colors.faint, fontWeight: '500' },
});
