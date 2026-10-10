import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { ModelRow } from '../components/ModelDownloads';
import { colors, radius } from '../components/theme';
import { Button, Card, Disclaimer, Field, ListRow, Screen, SectionTitle } from '../components/ui';
import type { Lang, Profile } from '../core/types';
import { geocode } from '../services/location';
import { useApp } from '../state/AppContext';

const LANG_LABEL: Record<Lang, string> = { ht: 'Kreyòl', es: 'Español', en: 'English' };

export default function ProfileScreen() {
  const { t } = useTranslation();
  const { profile, setProfile, online } = useApp();
  const [p, setP] = useState<Profile | null>(profile);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => setP(profile), [profile]);
  if (!p) return null;

  const set = (patch: Partial<Profile>) => {
    setSaved(false);
    setP({ ...p, ...patch });
  };

  const save = async () => {
    setSaving(true);
    let next = p;
    if (p.address !== profile?.address) {
      next = { ...p, addressCoords: p.address && online ? (await geocode(p.address)) ?? undefined : undefined };
    }
    await setProfile(next);
    setSaving(false);
    setSaved(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const pickPhoto = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.5 });
    if (!res.canceled && res.assets[0]) set({ photoUri: res.assets[0].uri });
  };

  return (
    <Screen back title={t('profile.title')}>
      <View style={s.header}>
        <Pressable onPress={pickPhoto} style={s.avatarWrap}>
          {p.photoUri ? (
            <Image source={{ uri: p.photoUri }} style={s.avatar} />
          ) : (
            <View style={[s.avatar, s.avatarEmpty]}>
              <Ionicons name="person" size={40} color={colors.faint} />
            </View>
          )}
          <View style={s.camBadge}>
            <Ionicons name="camera" size={14} color="#fff" />
          </View>
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{p.fullName || '—'}</Text>
          <Text style={s.sub}>{p.address || t('onboarding.skipped')}</Text>
        </View>
      </View>

      <ListRow icon="id-card-outline" tone="red" title={t('profile.responderCard')} subtitle={t('profile.responderSub')} onPress={() => router.push('/responder')} />

      <SectionTitle>{t('profile.language')}</SectionTitle>
      <View style={s.segment}>
        {(['ht', 'es', 'en'] as Lang[]).map((l) => (
          <Pressable key={l} onPress={() => set({ language: l })} style={[s.segItem, p.language === l && s.segOn]}>
            <Text style={[s.segText, p.language === l && s.segTextOn]}>{LANG_LABEL[l]}</Text>
          </Pressable>
        ))}
      </View>

      <SectionTitle>{t('onboarding.aboutYou')}</SectionTitle>
      <Card>
        <Field label={t('onboarding.fullName')} value={p.fullName} onChangeText={(v) => set({ fullName: v })} />
        <Field label={t('onboarding.contactName')} value={p.contactName} onChangeText={(v) => set({ contactName: v })} />
        <Field label={t('onboarding.contactPhone')} value={p.contactPhone} onChangeText={(v) => set({ contactPhone: v.replace(/\D/g, '').slice(0, 10) })} keyboardType="phone-pad" maxLength={10} />
        <Field label={t('onboarding.address')} help={t('onboarding.addressHelp')} value={p.address} onChangeText={(v) => set({ address: v })} />
      </Card>

      <SectionTitle>{t('profile.medicalSection')}</SectionTitle>
      <Card>
        <Field label={t('profile.dob')} value={p.dateOfBirth ?? ''} onChangeText={(v) => set({ dateOfBirth: v })} placeholder="1958-04-12" />
        <Field label={t('profile.bloodType')} value={p.bloodType ?? ''} onChangeText={(v) => set({ bloodType: v })} placeholder="O+" />
        <Field label={t('profile.medicalNotes')} value={p.medicalNotes ?? ''} onChangeText={(v) => set({ medicalNotes: v })} multiline />
        <Field label={t('profile.mobility')} value={p.mobilityNeeds ?? ''} onChangeText={(v) => set({ mobilityNeeds: v })} />
        <View style={s.switchRow}>
          <Text style={s.switchLabel}>{t('profile.shareMobility')}</Text>
          <Switch value={!!p.shareMobilityIn911} onValueChange={(v) => set({ shareMobilityIn911: v })} />
        </View>
        <View style={s.twoCol}>
          <View style={{ flex: 1 }}>
            <Field
              label={t('profile.household')}
              value={p.householdSize ? String(p.householdSize) : ''}
              onChangeText={(v) => set({ householdSize: parseInt(v, 10) || undefined })}
              keyboardType="number-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={t('profile.pets')} value={p.pets ?? ''} onChangeText={(v) => set({ pets: v })} />
          </View>
        </View>
        <View style={s.lock}>
          <Ionicons name="lock-closed-outline" size={14} color={colors.green} />
          <Text style={s.lockText}>{t('onboarding.privacy')}</Text>
        </View>
      </Card>

      <Button big icon={saved ? 'checkmark' : 'save-outline'} label={saved ? t('profile.saved') : t('common.save')} onPress={save} loading={saving} />

      <SectionTitle>{t('profile.models')}</SectionTitle>
      <Card>
        <Text style={s.note}>{t('profile.modelsNote')}</Text>
        <ModelRow id="whisper" label={t('profile.whisper')} />
        <ModelRow id="gemma" label={t('profile.gemma')} />
      </Card>
      <Disclaimer />
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 8 },
  avatarWrap: { width: 76, height: 76 },
  avatar: { width: 76, height: 76, borderRadius: 38 },
  avatarEmpty: { backgroundColor: colors.subtle, alignItems: 'center', justifyContent: 'center' },
  camBadge: { position: 'absolute', right: 0, bottom: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  name: { fontSize: 22, fontWeight: '800', color: colors.text },
  sub: { fontSize: 14, color: colors.muted, marginTop: 2 },
  segment: { flexDirection: 'row', backgroundColor: '#E4E9F0', borderRadius: radius.md, padding: 4 },
  segItem: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  segOn: { backgroundColor: colors.card },
  segText: { fontSize: 16, fontWeight: '700', color: colors.muted },
  segTextOn: { color: colors.navy },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  switchLabel: { flex: 1, fontSize: 15, color: colors.text },
  twoCol: { flexDirection: 'row', gap: 10 },
  lock: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lockText: { fontSize: 13, color: colors.green, fontWeight: '600' },
  note: { fontSize: 14, color: colors.muted, lineHeight: 19, marginBottom: 4 },
});
