import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { setAudioModeAsync } from 'expo-audio';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { Redirect, router } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { colors, font, radius, shadow, tones, type Tone } from '../components/theme';
import { Button, Card, Chip, Disclaimer, IconCircle, P, Screen, SectionTitle, type IconName } from '../components/ui';
import { buildFields, compose911, composeConfirmation, composeContactMessage, composeReport, SMS_LIMIT } from '../core/composer';
import { route, type Question } from '../core/router';
import type { Coords, Lang, Situation, Triage } from '../core/types';
import { CARDS } from '../data/cards';
import { AGENCIES, type AgencyId } from '../data/directory';
import { call, displayTarget, text as sendText } from '../services/actions';
import { config } from '../services/config';
import { getCoords } from '../services/location';
import { enqueueReport } from '../services/storage';
import { useApp } from '../state/AppContext';

const INTERPRETER: Record<Lang, string> = {
  en: '',
  es: 'I speak Spanish. I need an interpreter.',
  ht: 'I speak Haitian Creole. I need an interpreter.',
};
const VOICE_LANG: Record<Lang, string> = { en: 'en-US', es: 'es-US', ht: 'ht' };

type MciName = ComponentProps<typeof MaterialCommunityIcons>['name'];
const SITUATION_ICON: Record<Situation, MciName> = {
  water_in_home: 'home-flood',
  injury_trapped: 'ambulance',
  fire_gas: 'fire',
  generator_fumes: 'smoke',
  downed_line: 'transmission-tower',
  medical_device: 'medical-bag',
  power_outage: 'power-plug-off',
  street_hazard: 'tree',
  need_shelter: 'home-heart',
  need_supplies: 'food-apple',
  other: 'alert-circle-outline',
};
const AGENCY_ICON: Partial<Record<AgencyId, IconName>> = { '311': 'business-outline', fpl: 'flash-outline', '211': 'people-outline' };
const SOURCE_ICON: Record<Triage['source'], IconName> = {
  gemma_online: 'cloud-done-outline',
  gemma_device: 'hardware-chip-outline',
  keywords: 'key-outline',
  button: 'hand-left-outline',
  fallback: 'shield-outline',
};

export default function Result() {
  const { t } = useTranslation();
  const { session, setSession, profile, online } = useApp();
  const [gps, setGps] = useState<Coords | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);
  const [canSpeak, setCanSpeak] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const lang: Lang = profile?.language ?? 'en';

  useEffect(() => {
    if (!profile?.address) getCoords().then(setGps);
    // Read-aloud only where the phone has a voice for the language (Creole voices are rare).
    Speech.getAvailableVoicesAsync()
      .then((voices) => setCanSpeak(voices.some((v) => v.language.toLowerCase().startsWith(VOICE_LANG[lang].slice(0, 2)))))
      .catch(() => setCanSpeak(false));
    return () => {
      Speech.stop();
    };
  }, [profile?.address, lang]);

  const texts = useMemo(() => (session ? [session.text, session.english] : []), [session]);
  // For a photo-only request the summary just repeats the photo line.
  const summary = session?.text.trim() ? session.triage.english_summary : undefined;
  const decision = useMemo(() => (session ? route(session.triage, texts, session.answers) : null), [session, texts]);

  useEffect(() => {
    if (decision?.screen === 'emergency') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }, [decision?.screen]);

  // Offline, non-emergency reports wait in a queue on the phone. Emergency messages are never queued.
  useEffect(() => {
    if (!session || !decision || decision.screen !== 'agency' || online || queued) return;
    for (const a of decision.agencies) {
      const f = buildFields(session.triage, a.situation, profile, texts, gps);
      enqueueReport({ agency: a.agency, englishReport: composeReport(f, a.situation, 'en', { englishSummary: summary, photoFindings: session.triage.photo_findings }) });
    }
    setQueued(true);
  }, [decision, online, queued, session, profile, texts, gps, summary]);

  if (!session || !decision) return <Redirect href="/home" />;

  const answer = (q: Question, yes: boolean) => {
    Haptics.selectionAsync();
    setSession({ ...session, answers: { ...session.answers, [q]: yes } });
  };
  const startOver = () => {
    setSession(null);
    router.replace('/home');
  };
  const copy = async (key: string, value: string) => {
    await Clipboard.setStringAsync(value);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(key);
  };
  const speak = async (s: string) => {
    if (speaking) {
      await Speech.stop();
      return setSpeaking(false);
    }
    // Without this, iOS mutes speech when the ring/silent switch is on silent.
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    setSpeaking(true);
    Speech.speak(s, {
      language: VOICE_LANG[lang],
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };
  // On iOS the photo goes with the shared report; Android shares the text only.
  const shareReport = (message: string) =>
    Share.share(Platform.OS === 'ios' && session.photoUri ? { message, url: session.photoUri } : { message });

  // ── Building blocks (plain render functions, so nothing remounts between renders)

  const hero = (tone: Tone, title: string, subtitle: string | null, icon: MciName, extra?: ReactNode) => {
    const bg = { red: colors.red, amber: colors.amber, blue: colors.blue }[tone as 'red'] ?? colors.navy;
    return (
      <View style={[s.hero, { backgroundColor: bg }]}>
        <View style={s.heroRow}>
          <View style={s.heroIcon}>
            <MaterialCommunityIcons name={icon} size={34} color={bg} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroTitle}>{title}</Text>
            {subtitle ? <Text style={s.heroSub}>{subtitle}</Text> : null}
          </View>
        </View>
        {extra}
      </View>
    );
  };

  const questionBox = (q: Question, tone: Tone) => (
    <Card style={{ borderWidth: 2, borderColor: tones[tone].fg }}>
      <View style={s.qHead}>
        <Ionicons name="help-circle" size={26} color={tones[tone].fg} />
        <Text style={s.question}>{t(`result.questions.${q}`)}</Text>
      </View>
      <View style={s.rowGap}>
        <Button variant="red" icon="alert-circle-outline" label={t('common.yes')} onPress={() => answer(q, true)} style={{ flex: 1 }} big />
        <Button variant="outline" label={t('common.no')} onPress={() => answer(q, false)} style={{ flex: 1 }} big />
      </View>
    </Card>
  );

  const safetyCard = (situation: Situation, title?: string) => {
    if (situation === 'other') return null;
    const card = CARDS[situation];
    return (
      <Card>
        <View style={s.cardHead}>
          <IconCircle name="shield-checkmark" tone="green" size={34} />
          <Text style={s.cardTitle}>{title ?? card.title[lang]}</Text>
        </View>
        {card.steps[lang].map((step, i) => (
          <View key={i} style={s.stepRow}>
            <View style={s.stepNum}>
              <Text style={s.stepNumText}>{i + 1}</Text>
            </View>
            <Text style={s.stepText}>{step}</Text>
          </View>
        ))}
      </Card>
    );
  };

  // What the model saw in the photo, in the resident's language (falls back to the English line).
  const seen = session.triage.photo_findings_local || session.triage.photo_findings;
  const photoCard = () =>
    session.photoUri ? (
      <Card>
        <Image source={{ uri: session.photoUri }} style={s.photo} />
        <View style={s.cardHead}>
          <IconCircle name="eye-outline" tone="navy" size={34} />
          <Text style={s.cardTitle}>{t('result.photoSaw')}</Text>
        </View>
        <P>{seen || t('result.photoNotChecked')}</P>
        {/* Model-written Spanish and Creole can be wrong; the English line lets a bilingual helper check it. */}
        {lang !== 'en' && session.triage.photo_findings && seen !== session.triage.photo_findings ? (
          <Text style={s.englishCheck}>English: {session.triage.photo_findings}</Text>
        ) : null}
      </Card>
    ) : null;

  const footer = (speakText: string) => (
    <View style={{ marginTop: 10 }}>
      <View style={s.footerChips}>
        <Chip icon={SOURCE_ICON[session.triage.source]} label={t('result.howDecided', { source: t(`result.sources.${session.triage.source}`) })} tone="neutral" />
        {config.demoMode ? <Chip icon="flask-outline" label={t('common.demoTarget', { number: displayTarget('911') })} tone="amber" /> : null}
      </View>
      {canSpeak ? (
        <Button
          variant="outline"
          icon={speaking ? 'stop-circle-outline' : 'volume-high-outline'}
          label={speaking ? t('result.stopReading') : t('result.readAloud')}
          onPress={() => speak(speakText)}
        />
      ) : null}
      <Button variant="ghost" icon="refresh" label={t('common.startOver')} onPress={startOver} />
      <Disclaimer />
    </View>
  );

  // ── Clarify: no danger to life, but we don't know what happened yet. Never a dead end.
  if (decision.screen === 'clarify') {
    return (
      <Screen back={startOver} hero={hero('navy', t('result.clarifyTitle'), null, 'chat-question-outline')}>
        <Card>
          <P>{t('result.clarifyBody')}</P>
        </Card>
        <Button big icon="create-outline" label={t('result.tellMore')} onPress={() => router.back()} />
        <Disclaimer />
      </Screen>
    );
  }

  // ── Emergency (red)
  if (decision.screen === 'emergency') {
    const f = buildFields(session.triage, decision.situation, profile, texts, gps);
    const msg = compose911(f);
    const confirmation = composeConfirmation(f, lang);
    const first = decision.first === 'leave' ? t('result.leaveFirst') : decision.first === 'fresh_air' ? t('result.freshAirFirst') : null;
    const also = decision.alsoCall ? AGENCIES[decision.alsoCall] : null;
    const subtitle = decision.situation === 'other' ? null : CARDS[decision.situation].title[lang];
    const pct = Math.min(1, msg.length / SMS_LIMIT);

    return (
      <Screen
        back={startOver}
        bg={colors.bg}
        hero={hero(
          'red',
          t('result.emergencyTitle'),
          subtitle,
          SITUATION_ICON[decision.situation],
          first ? (
            <View style={s.firstBox}>
              <Ionicons name="walk-outline" size={22} color={colors.redDark} />
              <Text style={s.firstText}>{first}</Text>
            </View>
          ) : null,
        )}
      >
        {decision.question ? questionBox(decision.question, 'red') : null}

        <Button big variant="red" icon="call" label={t('result.call911')} onPress={() => call(AGENCIES['911'].dial)} style={{ marginTop: 4 }} />
        <View style={s.rowGap}>
          <Button variant="outline" icon="chatbubble-ellipses-outline" label={t('result.text911')} onPress={() => sendText(AGENCIES['911'].dial, msg)} style={{ flex: 1 }} />
          {profile?.contactPhone ? (
            <Button
              variant="outline"
              icon="people-outline"
              label={t('result.notifyContact', { name: profile.contactName.split(' ')[0] })}
              onPress={() => sendText(profile.contactPhone, composeContactMessage(f, lang, profile.fullName, true))}
              style={{ flex: 1 }}
            />
          ) : null}
        </View>
        <Text style={s.hint}>{t('result.textOnlyIf')}</Text>

        {/* The 911 text, shown the way Messages will show it */}
        <SectionTitle>{t('result.smsTitle')}</SectionTitle>
        <Card>
          <View style={s.smsTo}>
            <Text style={s.smsToLabel}>{t('result.to')}</Text>
            <Text style={s.smsToValue}>911</Text>
            {config.demoMode ? <Text style={s.smsDemo}>→ {displayTarget('911')}</Text> : null}
          </View>
          <View style={s.bubbleWrap}>
            <View style={s.bubble}>
              <Text style={s.bubbleText}>{msg}</Text>
            </View>
          </View>
          <View style={s.meter}>
            <View style={[s.meterFill, { width: `${pct * 100}%`, backgroundColor: pct > 0.9 ? colors.amber : colors.green }]} />
          </View>
          <Text style={s.count}>
            {msg.length}/{SMS_LIMIT} · {t('result.englishOnly')}
          </Text>

          {lang !== 'en' ? (
            <View style={s.confirmBox}>
              <Text style={s.confirmTitle}>{t('result.messageSays')}</Text>
              {confirmation.map((line, i) => (
                <View key={i} style={s.confirmRow}>
                  <Ionicons name="checkmark-circle" size={18} color={colors.green} />
                  <Text style={s.confirmText}>{line}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>

        <SectionTitle>{t('result.sayThis')}</SectionTitle>
        <Card>
          <View style={s.quote}>
            <Text style={s.sayThis}>{msg}</Text>
            {INTERPRETER[f.language] ? <Text style={[s.sayThis, { fontWeight: '800', marginTop: 6 }]}>{INTERPRETER[f.language]}</Text> : null}
          </View>
        </Card>

        <SectionTitle>{t('result.doThisNow')}</SectionTitle>
        {safetyCard(decision.situation)}
        {also ? (
          <Pressable onPress={() => call(also.dial)} style={({ pressed }) => [s.alsoRow, pressed && { opacity: 0.85 }]}>
            <Ionicons name="call-outline" size={20} color={colors.navy} />
            <Text style={s.alsoText}>{t('result.alsoCall', { name: also.name, number: also.display })}</Text>
          </Pressable>
        ) : null}
        {photoCard()}
        {footer([first ?? t('result.emergencyTitle'), ...confirmation].join('. '))}
      </Screen>
    );
  }

  // ── Urgent safety (amber): one question, both lines visible
  if (decision.screen === 'urgent') {
    const agency = AGENCIES[decision.agency];
    return (
      <Screen back={startOver} hero={hero('amber', t('result.urgentTitle'), CARDS[decision.situation as Exclude<Situation, 'other'>]?.title[lang] ?? null, SITUATION_ICON[decision.situation])}>
        {questionBox(decision.question, 'amber')}
        {safetyCard(decision.situation)}
        <Button big variant="red" icon="call" label={t('result.call911')} onPress={() => call(AGENCIES['911'].dial)} />
        <Button variant="amber" icon="call-outline" label={t('result.callAgency', { name: agency.name })} onPress={() => call(agency.dial)} />
        <Text style={s.hint}>{agency.display}</Text>
        {photoCard()}
        {footer([t('result.urgentTitle'), t(`result.questions.${decision.question}`)].join(' '))}
      </Screen>
    );
  }

  // ── Not an emergency (blue): which agency, why, and the report already written
  const names = decision.agencies.map((a) => AGENCIES[a.agency].name.split(' (')[0]).join(' · ');
  return (
    <Screen back={startOver} hero={hero('blue', t('result.agencyTitle'), t('result.reportTo', { names }), SITUATION_ICON[decision.situation])}>
      {decision.question ? questionBox(decision.question, 'blue') : null}
      {queued ? (
        <View style={s.queued}>
          <Ionicons name="time-outline" size={20} color={colors.amber} />
          <Text style={s.queuedText}>{t('result.queued')}</Text>
        </View>
      ) : null}
      {photoCard()}

      {decision.agencies.map(({ agency: id, situation }) => {
        const agency = AGENCIES[id];
        const f = buildFields(session.triage, situation, profile, texts, gps);
        const english = composeReport(f, situation, 'en', { englishSummary: summary, photoFindings: session.triage.photo_findings });
        const yours = composeReport(f, situation, lang, { originalText: session.text });
        return (
          <View key={id}>
            <Card>
              <View style={s.cardHead}>
                <IconCircle name={AGENCY_ICON[id] ?? 'business-outline'} tone="blue" size={44} />
                <View style={{ flex: 1 }}>
                  <Text style={s.agencyName}>{agency.name}</Text>
                  <Text style={s.agencyNumber}>{agency.display}</Text>
                </View>
              </View>
              <Text style={s.why}>
                {t(situation === 'medical_device' ? 'result.why_eeap' : `result.why_${id as Exclude<AgencyId, '911' | 'gas' | 'poison' | 'wasd'>}`)}
              </Text>
              {id === '311' ? <Text style={s.cardNote}>{t('result.hours_311')}</Text> : null}

              {lang !== 'en' ? (
                <>
                  <Text style={s.reportLabel}>{t('result.reportYours')}</Text>
                  <Text style={s.report}>{yours}</Text>
                </>
              ) : null}
              <Text style={s.reportLabel}>{t('result.reportEnglish')}</Text>
              <Text style={[s.report, s.reportEn]}>{english}</Text>

              <Button variant="blue" icon="call" label={t('result.callAgency', { name: agency.name.split(' (')[0] })} onPress={() => call(agency.dial)} />
              <View style={s.rowGap}>
                <Button variant="outline" icon={copied === id ? 'checkmark' : 'copy-outline'} label={copied === id ? t('result.copied') : t('result.copyReport')} onPress={() => copy(id, english)} style={{ flex: 1 }} />
                <Button variant="outline" icon="share-outline" label={t('result.shareReport')} onPress={() => shareReport(english)} style={{ flex: 1 }} />
              </View>
            </Card>
            {safetyCard(situation)}
          </View>
        );
      })}
      {decision.situations.includes('need_shelter') ? (
        <Button variant="outline" icon="shield-checkmark-outline" label={t('home.prepare')} onPress={() => router.push('/prepare')} />
      ) : null}
      {footer([t('result.agencyTitle'), ...decision.agencies.map((a) => AGENCIES[a.agency].name)].join('. '))}
    </Screen>
  );
}

const s = StyleSheet.create({
  hero: { paddingHorizontal: 18, paddingTop: 20, paddingBottom: 22, borderBottomLeftRadius: 26, borderBottomRightRadius: 26 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#fff', fontSize: font.title, fontWeight: '900', letterSpacing: -0.5 },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: font.body, fontWeight: '600', marginTop: 2 },
  firstBox: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: '#fff', borderRadius: radius.md, padding: 12, marginTop: 16 },
  firstText: { flex: 1, fontSize: font.body, fontWeight: '800', color: colors.redDark, lineHeight: 23 },
  rowGap: { flexDirection: 'row', gap: 10 },
  qHead: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginBottom: 8 },
  question: { flex: 1, fontSize: 19, fontWeight: '800', color: colors.text, lineHeight: 25 },
  hint: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 2, marginBottom: 4 },
  cardNote: { fontSize: 13, color: colors.muted, lineHeight: 18, marginTop: 6 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  cardTitle: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.text },
  stepRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginVertical: 5 },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.greenBg, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumText: { fontSize: 13, fontWeight: '800', color: colors.green },
  stepText: { flex: 1, fontSize: font.body, color: colors.text, lineHeight: 24 },
  smsTo: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  smsToLabel: { fontSize: 14, color: colors.muted },
  smsToValue: { fontSize: 15, fontWeight: '800', color: colors.text },
  smsDemo: { fontSize: 13, color: colors.amber, fontWeight: '700' },
  bubbleWrap: { alignItems: 'flex-end', marginTop: 12 },
  bubble: { maxWidth: '88%', backgroundColor: colors.sms, borderRadius: 20, borderBottomRightRadius: 6, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleText: { color: '#fff', fontSize: 16, lineHeight: 22 },
  meter: { height: 4, borderRadius: 2, backgroundColor: colors.subtle, marginTop: 12, overflow: 'hidden' },
  meterFill: { height: 4, borderRadius: 2 },
  count: { fontSize: 12, color: colors.muted, textAlign: 'right', marginTop: 4 },
  confirmBox: { backgroundColor: colors.greenBg, borderRadius: radius.md, padding: 12, marginTop: 12 },
  confirmTitle: { fontSize: 15, fontWeight: '800', color: colors.green, marginBottom: 6 },
  confirmRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginVertical: 3 },
  confirmText: { flex: 1, fontSize: font.body, color: colors.text, lineHeight: 23 },
  quote: { borderLeftWidth: 4, borderLeftColor: colors.red, paddingLeft: 12 },
  sayThis: { fontSize: 19, lineHeight: 27, color: colors.text },
  alsoRow: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.md, padding: 14, marginVertical: 6, ...shadow },
  alsoText: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  photo: { width: '100%', height: 190, borderRadius: radius.md, marginBottom: 12 },
  englishCheck: { fontSize: 13, color: colors.muted, marginTop: 6, fontStyle: 'italic' },
  footerChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  queued: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: colors.amberBg, borderRadius: radius.md, padding: 12, marginVertical: 6 },
  queuedText: { flex: 1, fontSize: 15, color: colors.text, lineHeight: 21 },
  agencyName: { fontSize: 19, fontWeight: '800', color: colors.text },
  agencyNumber: { fontSize: 15, fontWeight: '700', color: colors.blue, marginTop: 2 },
  why: { fontSize: 16, color: colors.text, lineHeight: 23 },
  reportLabel: { fontSize: 12, fontWeight: '800', color: colors.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: 14, marginBottom: 6 },
  report: { fontSize: 15, lineHeight: 22, backgroundColor: colors.subtle, padding: 12, borderRadius: radius.md, color: colors.text },
  reportEn: { backgroundColor: colors.blueBg },
});
