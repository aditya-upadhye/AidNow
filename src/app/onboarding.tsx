import { Ionicons } from '@expo/vector-icons';
import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { ModelRow } from '../components/ModelDownloads';
import { colors, font, radius, shadow } from '../components/theme';
import { Button, Card, Disclaimer, Field, IconCircle, Screen, type IconName } from '../components/ui';
import type { Lang, Profile } from '../core/types';
import i18n from '../i18n';
import { geocode } from '../services/location';
import { useApp } from '../state/AppContext';

/** Each language's own name and tagline, so the picker reads correctly before a language is chosen. */
const LANGS: { code: Lang; label: string; tagline: string }[] = [
  { code: 'ht', label: 'Kreyòl ayisyen', tagline: 'Èd nan lang ou, menm san entènèt' },
  { code: 'es', label: 'Español', tagline: 'Ayuda en su idioma, incluso sin internet' },
  { code: 'en', label: 'English', tagline: 'Help in your language, even offline' },
];

type Step = 'language' | 'about' | 'ready';
const STEPS: Step[] = ['language', 'about', 'ready'];

export default function Onboarding() {
  const { t } = useTranslation();
  const { setProfile, online } = useApp();
  const [step, setStep] = useState<Step>('language');
  const [lang, setLang] = useState<Lang>('en');
  const [form, setForm] = useState({ fullName: '', contactName: '', contactPhone: '', address: '' });
  const [skipAddress, setSkipAddress] = useState(false);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [perms, setPerms] = useState({ mic: false, location: false });

  useEffect(() => {
    Promise.all([getRecordingPermissionsAsync(), Location.getForegroundPermissionsAsync()]).then(([m, l]) =>
      setPerms({ mic: m.granted, location: l.granted }),
    );
  }, []);

  const pick = async (code: Lang) => {
    setLang(code);
    await i18n.changeLanguage(code);
    setStep('about');
  };

  const missing = {
    fullName: !form.fullName.trim(),
    contactName: !form.contactName.trim(),
    contactPhone: form.contactPhone.length !== 10,
    address: !skipAddress && !form.address.trim(),
  };

  const next = () => {
    if (Object.values(missing).some(Boolean)) return setShowErrors(true);
    setStep('ready');
  };

  const finish = async () => {
    setSaving(true);
    const address = skipAddress ? '' : form.address.trim();
    const profile: Profile = {
      language: lang,
      fullName: form.fullName.trim(),
      contactName: form.contactName.trim(),
      contactPhone: form.contactPhone,
      address,
      addressCoords: address && online ? (await geocode(address)) ?? undefined : undefined,
    };
    await setProfile(profile);
    setSaving(false);
    router.replace('/home');
  };

  const progress = (
    <View style={s.progress}>
      {STEPS.map((st, i) => (
        <View key={st} style={[s.dot, STEPS.indexOf(step) >= i && s.dotOn]} />
      ))}
      <Text style={s.progressText}>{t('onboarding.stepOf', { n: STEPS.indexOf(step) + 1 })}</Text>
    </View>
  );

  // ── 1. Language
  if (step === 'language') {
    return (
      <Screen>
        <View style={s.welcome}>
          <Image source={require('../../assets/logo.png')} style={s.bigLogo} />
          <Text style={s.appName}>AidNow</Text>
          <Text style={s.miami}>Miami-Dade</Text>
        </View>
        {LANGS.map((l) => (
          <Pressable key={l.code} onPress={() => pick(l.code)} style={({ pressed }) => [s.lang, pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.langText}>{l.label}</Text>
              <Text style={s.langTag}>{l.tagline}</Text>
            </View>
            <Ionicons name="arrow-forward-circle" size={34} color="#fff" />
          </Pressable>
        ))}
        <Disclaimer />
      </Screen>
    );
  }

  // ── 2. About you
  if (step === 'about') {
    const err = (k: keyof typeof missing) =>
      showErrors && missing[k] ? t(k === 'contactPhone' && form.contactPhone ? 'onboarding.phoneInvalid' : 'common.required') : undefined;
    return (
      <Screen back={() => setStep('language')}>
        {progress}
        <Text style={s.h1}>{t('onboarding.aboutYou')}</Text>
        <View style={s.privacy}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.green} />
          <Text style={s.privacyText}>{t('onboarding.privacy')}</Text>
        </View>
        <Card>
          <Field label={t('onboarding.fullName')} value={form.fullName} onChangeText={(v) => setForm({ ...form, fullName: v })} error={err('fullName')} autoComplete="name" />
          <Field label={t('onboarding.contactName')} value={form.contactName} onChangeText={(v) => setForm({ ...form, contactName: v })} error={err('contactName')} />
          <Field
            label={t('onboarding.contactPhone')}
            value={form.contactPhone}
            onChangeText={(v) => setForm({ ...form, contactPhone: v.replace(/\D/g, '').slice(0, 10) })}
            error={err('contactPhone')}
            keyboardType="phone-pad"
            maxLength={10}
          />
        </Card>
        <Card>
          {!skipAddress ? (
            <Field
              label={t('onboarding.address')}
              help={t('onboarding.addressHelp')}
              value={form.address}
              onChangeText={(v) => setForm({ ...form, address: v })}
              error={err('address')}
              autoComplete="street-address"
            />
          ) : (
            <Text style={s.skipped}>{t('onboarding.skipped')}</Text>
          )}
          <View style={s.switchRow}>
            <Ionicons name="locate-outline" size={20} color={colors.navy} />
            <Text style={s.switchLabel}>{t('onboarding.skipAddress')}</Text>
            <Switch value={skipAddress} onValueChange={setSkipAddress} />
          </View>
        </Card>
        <Button big icon="arrow-forward" label={t('common.next')} onPress={next} />
      </Screen>
    );
  }

  // ── 3. Get ready for no internet: permissions with a reason, and the offline models
  const permRow = (icon: IconName, title: string, why: string, granted: boolean, request: () => Promise<void>) => (
    <View style={s.permRow}>
      <IconCircle name={icon} tone={granted ? 'green' : 'navy'} size={40} />
      <View style={{ flex: 1 }}>
        <Text style={s.permTitle}>{title}</Text>
        <Text style={s.permWhy}>{why}</Text>
      </View>
      {granted ? <Ionicons name="checkmark-circle" size={26} color={colors.green} /> : <Button variant="outline" label={t('onboarding.allow')} onPress={request} />}
    </View>
  );

  return (
    <Screen back={() => setStep('about')}>
      {progress}
      <Text style={s.h1}>{t('onboarding.getReady')}</Text>
      <Text style={s.body}>{t('onboarding.getReadyBody')}</Text>
      <Card>
        {permRow('mic-outline', t('onboarding.mic'), t('onboarding.micWhy'), perms.mic, async () => {
          const r = await requestRecordingPermissionsAsync();
          setPerms((p) => ({ ...p, mic: r.granted }));
        })}
        <View style={s.divider} />
        {permRow('location-outline', t('onboarding.location'), t('onboarding.locationWhy'), perms.location, async () => {
          const r = await Location.requestForegroundPermissionsAsync();
          setPerms((p) => ({ ...p, location: r.granted }));
        })}
      </Card>
      <Card>
        <Text style={s.cardTitle}>{t('profile.models')}</Text>
        <Text style={s.permWhy}>{t('profile.modelsNote')}</Text>
        <ModelRow id="whisper" label={t('profile.whisper')} allowRemove={false} />
        <ModelRow id="gemma" label={t('profile.gemma')} allowRemove={false} />
      </Card>
      <Button big icon="checkmark" label={t('onboarding.done')} onPress={finish} loading={saving} />
      <Text style={s.later}>{t('onboarding.later')}</Text>
    </Screen>
  );
}

const s = StyleSheet.create({
  welcome: { alignItems: 'center', marginTop: 16, marginBottom: 22 },
  bigLogo: { width: 96, height: 96, borderRadius: 24 },
  appName: { fontSize: font.huge, fontWeight: '900', color: colors.navy, marginTop: 12, letterSpacing: -0.8 },
  miami: { fontSize: 15, fontWeight: '700', color: colors.muted, marginTop: 2, letterSpacing: 1, textTransform: 'uppercase' },
  lang: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.navy, borderRadius: radius.lg, paddingVertical: 20, paddingHorizontal: 20, marginVertical: 7, ...shadow },
  langText: { color: '#fff', fontSize: 24, fontWeight: '800' },
  langTag: { color: '#C7D4EA', fontSize: 15, marginTop: 3 },
  progress: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  dot: { width: 28, height: 6, borderRadius: 3, backgroundColor: colors.border },
  dotOn: { backgroundColor: colors.brand },
  progressText: { fontSize: 13, color: colors.muted, fontWeight: '700', marginLeft: 6 },
  h1: { fontSize: font.title, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginBottom: 6 },
  body: { fontSize: font.body, color: colors.muted, lineHeight: 24, marginBottom: 6 },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  privacyText: { fontSize: 14, color: colors.green, fontWeight: '600' },
  skipped: { fontSize: font.body, color: colors.text, marginBottom: 10 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  switchLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: colors.text },
  permRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 6 },
  permTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  permWhy: { fontSize: 14, color: colors.muted, lineHeight: 19, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 8 },
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  later: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 4 },
});
