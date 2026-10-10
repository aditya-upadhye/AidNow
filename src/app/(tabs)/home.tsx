import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingOptions,
} from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Image, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { NearbyAlerts } from '../../components/NearbyAlerts';
import { QueuedReports } from '../../components/QueuedReports';
import { SosButton } from '../../components/SosButton';
import { colors, font, radius, shadow, soft, tones, type Tone } from '../../components/theme';
import { Button, Chip, Disclaimer, Screen, SectionTitle, Steps, type StepState } from '../../components/ui';
import { buttonTriage } from '../../core/triageSchema';
import type { Situation } from '../../core/types';
import { config } from '../../services/config';
import { cachedAdvisories, type Storm } from '../../services/county';
import { gemmaDeviceReady } from '../../services/gemmaDevice';
import { runTriage } from '../../services/triage';
import { transcribe, warmUpWhisper, whisperReady } from '../../services/whisper';
import { useApp } from '../../state/AppContext';

/** 16 kHz mono 16-bit WAV: what whisper.cpp reads directly. */
const WAV_16K: RecordingOptions = {
  extension: '.wav',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  android: { outputFormat: 'default', audioEncoder: 'default' },
  ios: {
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.MAX,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
};

/** A voice note stops on its own after this long, so a tap is never required to finish. */
const MAX_RECORDING_MS = 60_000;

type MciName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Six one-tap situations. They skip every model and work in any language, online or offline. */
const BIG_BUTTONS: { key: string; icon: MciName; tone: Tone; situations: Situation[] }[] = [
  { key: 'water', icon: 'home-flood', tone: 'blue', situations: ['water_in_home'] },
  { key: 'hurt', icon: 'ambulance', tone: 'red', situations: ['injury_trapped'] },
  { key: 'fire', icon: 'fire', tone: 'orange', situations: ['fire_gas'] },
  { key: 'power', icon: 'power-plug-off', tone: 'amber', situations: ['power_outage'] },
  { key: 'street', icon: 'tree', tone: 'green', situations: ['street_hazard'] },
  { key: 'shelter', icon: 'home-heart', tone: 'purple', situations: ['need_shelter', 'need_supplies'] },
];

/** Demo-mode shortcuts for the two personas in the pitch. Prep scenarios S1 and S2. */
const DEMO_SCENARIOS = [
  { name: 'Marie · Kreyòl', text: 'Dlo ap antre lakay mwen. Manman m ki granmoun aje a anndan kay la avè m. Nou nan 123 Northwest 54th Street, Miami.' },
  { name: 'Carlos · Español', text: 'Se cayó un árbol en mi calle y se fue la luz desde anoche. Nadie está herido.' },
];

type Phase = 'idle' | 'recording' | 'transcribing' | 'thinking';

export default function Home() {
  const { t } = useTranslation();
  const { profile, online, setSession } = useApp();
  const lang = profile?.language ?? 'en';
  const recorder = useAudioRecorder(WAV_16K);
  const recorderState = useAudioRecorderState(recorder, 250);

  const [text, setText] = useState('');
  const [english, setEnglish] = useState('');
  const [photo, setPhoto] = useState<{ uri: string; base64?: string } | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [notice, setNotice] = useState('');
  const [storm, setStorm] = useState<Storm | null>(null);
  const [models, setModels] = useState({ voice: whisperReady(), ai: gemmaDeviceReady() });
  const [showDemo, setShowDemo] = useState(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    warmUpWhisper();
  }, []);

  // Refresh the readiness prompt whenever Home comes back into view (e.g. after downloading models).
  useFocusEffect(
    useCallback(() => {
      setModels({ voice: whisperReady(), ai: gemmaDeviceReady() });
      cachedAdvisories().then((c) => setStorm(c?.data[0] ?? null));
    }, [online]),
  );

  const startRecording = async () => {
    setNotice('');
    if (!whisperReady()) return setNotice(t('home.speechModelMissing'));
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) return setNotice(t('home.micDenied'));
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPhase('recording');
  };

  const stopRecording = async () => {
    if (phaseRef.current !== 'recording') return;
    setPhase('transcribing');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    const uri = recorder.uri;
    if (!uri) return setPhase('idle');
    try {
      const r = await transcribe(uri, lang);
      setText((prev) => (prev ? prev + ' ' : '') + r.text);
      setEnglish((prev) => (prev ? prev + ' ' : '') + r.english);
      setNotice(t('home.checkTranscript'));
    } catch {
      setNotice(t('home.speechFailed'));
    }
    setPhase('idle');
  };

  // Tap to start, tap to stop; long messages stop by themselves.
  const toggleRecording = () => (phase === 'recording' ? stopRecording() : startRecording());
  useEffect(() => {
    if (phase === 'recording' && recorderState.durationMillis >= MAX_RECORDING_MS) stopRecording();
  }, [phase, recorderState.durationMillis]);

  const seconds = Math.floor(recorderState.durationMillis / 1000);
  const elapsed = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

  const pickPhoto = async () => {
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], base64: true, quality: 0.4 };
    let res: ImagePicker.ImagePickerResult;
    const cam = await ImagePicker.requestCameraPermissionsAsync();
    try {
      res = cam.granted ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    } catch {
      // No camera (simulator): use the library.
      res = await ImagePicker.launchImageLibraryAsync(opts);
    }
    if (!res.canceled && res.assets[0]) setPhoto({ uri: res.assets[0].uri, base64: res.assets[0].base64 ?? undefined });
  };

  const getHelp = async () => {
    if (!text.trim() && !photo) return;
    Keyboard.dismiss();
    if (!text.trim() && !online) return setNotice(t('home.photoOnlyOffline'));
    setNotice('');
    setPhase('thinking');
    const triage = await runTriage({ text, english, photoBase64: online ? photo?.base64 : undefined, lang, online });
    setSession({ text, english, photoBase64: photo?.base64, photoUri: photo?.uri, triage, answers: {} });
    // Start the next request clean, so an old message or photo can never leak into a new one.
    setText('');
    setEnglish('');
    setPhoto(null);
    setPhase('idle');
    router.push('/result');
  };

  const tapButton = (situations: Situation[]) => {
    Haptics.selectionAsync();
    setSession({ text: '', english: '', triage: buttonTriage(situations, lang), answers: {} });
    router.push('/result');
  };

  const busy = phase === 'transcribing' || phase === 'thinking';
  const recording = phase === 'recording';

  // Which engine will read the message: shown while it works, so the offline pipeline is visible.
  const engine = online && config.geminiApiKey ? t('home.engineOnline') : models.ai ? t('home.engineDevice') : t('home.engineKeywords');
  const stepState = (i: number): StepState => {
    const at = phase === 'thinking' ? 1 : phase === 'idle' ? -1 : 0;
    return i < at ? 'done' : i === at ? 'active' : 'todo';
  };

  return (
    <Screen hide911>
      <SosButton />
      <QueuedReports />

      {profile?.fullName ? <Text style={s.greeting}>{t('home.greeting', { name: profile.fullName.split(' ')[0] })}</Text> : null}
      <Text style={s.title}>{t('home.title')}</Text>

      {/* One prompt, only when something needs doing: the app works without internet once these are downloaded. */}
      {!models.voice || !models.ai ? (
        <View style={s.chips}>
          <Chip icon="download-outline" label={t('home.getReady')} tone="amber" onPress={() => router.push('/profile')} />
        </View>
      ) : null}

      {storm ? (
        <Pressable onPress={() => router.push('/prepare')} style={({ pressed }) => [s.storm, pressed && { opacity: 0.9 }]}>
          <MaterialCommunityIcons name="weather-hurricane" size={28} color={colors.brand} />
          <View style={{ flex: 1 }}>
            <Text style={s.stormTitle}>
              {t(`storm.${storm.classification}`, { defaultValue: t('storm.other') })} {storm.name}
            </Text>
            <Text style={s.stormSub}>{t('home.stormSub', { kt: storm.intensityKt })}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.brand} />
        </Pressable>
      ) : null}

      {/* Live alerts from people in trouble nearby, for volunteers who switched them on. Nothing for everyone else. */}
      <NearbyAlerts quiet />

      {phase !== 'idle' ? (
        <Steps
          steps={[
            { label: t('home.stepListen'), state: stepState(0) },
            { label: t('home.stepUnderstand'), state: stepState(1) },
            { label: t('home.stepRoute'), state: stepState(2) },
          ]}
          caption={phase === 'thinking' ? engine : phase === 'transcribing' ? t('home.engineWhisper') : undefined}
        />
      ) : null}

      {notice ? (
        <View style={s.notice}>
          <Ionicons name="information-circle-outline" size={18} color={colors.brand} />
          <Text style={s.noticeText}>{notice}</Text>
        </View>
      ) : null}

      {/* Type or photo */}
      <View style={s.inputCard}>
        <Text style={s.inputLabel}>{t('home.typeHere')}</Text>
        <TextInput
          value={text}
          onChangeText={(v) => {
            setText(v);
            // The English translation belongs to the transcript as spoken; once the text is edited it is stale.
            setEnglish('');
          }}
          placeholder={t('home.typePlaceholder')}
          placeholderTextColor={colors.faint}
          multiline
          inputAccessoryViewID="aidnow-keyboard-done"
          style={s.input}
        />
        {photo ? (
          <View style={s.photoRow}>
            <Image source={{ uri: photo.uri }} style={s.photo} />
            <View style={{ flex: 1 }}>
              <Text style={s.photoText}>{online ? t('home.photoAttached') : t('home.photoOffline')}</Text>
              <Pressable onPress={() => setPhoto(null)} hitSlop={8}>
                <Text style={s.photoRemove}>{t('home.removePhoto')}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        {recording || phase === 'transcribing' ? (
          <View style={s.voiceStatus}>
            <View style={s.recDot} />
            <Text style={s.voiceStatusText}>{recording ? `${t('home.listening')} ${elapsed}` : t('home.transcribing')}</Text>
          </View>
        ) : null}
        <View style={s.inputActions}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={recording ? t('home.listening') : t('home.tapToTalk')}
            onPress={toggleRecording}
            disabled={busy}
            style={({ pressed }) => [s.iconBtn, s.micBtn, recording && s.micActive, (busy || pressed) && { opacity: 0.8 }]}
          >
            <Ionicons name={recording ? 'stop' : 'mic'} size={24} color={recording ? colors.red : colors.brand} />
          </Pressable>
          <Pressable
            onPress={pickPhoto}
            disabled={busy || recording}
            style={({ pressed }) => [s.iconBtn, s.camBtn, (busy || recording) && { opacity: 0.5 }, pressed && { opacity: 0.8 }]}
            accessibilityRole="button"
            accessibilityLabel={t('home.addPhoto')}
          >
            <Ionicons name="camera" size={24} color={colors.brand} />
          </Pressable>
          <Button
            label={phase === 'thinking' ? t('home.thinking') : t('home.getHelp')}
            icon="arrow-forward"
            onPress={getHelp}
            loading={phase === 'thinking'}
            disabled={busy || recording || (!text.trim() && !photo)}
            style={{ flex: 1, marginVertical: 0 }}
          />
        </View>
      </View>

      {config.demoMode ? (
        <View>
          <Pressable onPress={() => setShowDemo(!showDemo)} style={s.demoToggle}>
            <Ionicons name={showDemo ? 'chevron-down' : 'chevron-forward'} size={16} color={colors.muted} />
            <Text style={s.demoToggleText}>{t('home.demoScenarios')}</Text>
          </Pressable>
          {showDemo ? (
            <View style={s.chips}>
              {DEMO_SCENARIOS.map((d) => (
                <Chip
                  key={d.name}
                  icon="play-circle-outline"
                  label={d.name}
                  tone="navy"
                  onPress={() => {
                    setText(d.text);
                    setEnglish('');
                    setShowDemo(false);
                  }}
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* One-tap situations */}
      <SectionTitle>{t('home.orTap')}</SectionTitle>
      <View style={s.grid}>
        {BIG_BUTTONS.map((b) => (
          <Pressable key={b.key} onPress={() => tapButton(b.situations)} style={({ pressed }) => [s.tile, pressed && { transform: [{ scale: 0.98 }], opacity: 0.9 }]}>
            <View style={[s.tileIcon, { backgroundColor: tones[b.tone].bg }]}>
              <MaterialCommunityIcons name={b.icon} size={30} color={tones[b.tone].fg} />
            </View>
            <Text style={s.tileText}>{t(`home.buttons.${b.key}`)}</Text>
          </Pressable>
        ))}
      </View>

      <Disclaimer />
    </Screen>
  );
}

const s = StyleSheet.create({
  greeting: { fontSize: 15, fontWeight: '600', color: colors.muted, marginTop: 4 },
  title: { fontSize: font.title, fontWeight: '800', color: colors.text, letterSpacing: -0.5, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  storm: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: soft.blue.bg, borderWidth: 1, borderColor: soft.blue.border, borderRadius: radius.lg, padding: 14, marginTop: 8 },
  stormTitle: { color: colors.navy, fontSize: font.body, fontWeight: '800' },
  stormSub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  micActive: { backgroundColor: soft.red.bg, borderColor: soft.red.border },
  notice: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colors.blueBg, borderRadius: radius.md, padding: 12, marginVertical: 6 },
  noticeText: { flex: 1, fontSize: 15, color: colors.text, lineHeight: 21 },
  inputCard: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, marginTop: 10, ...shadow },
  inputLabel: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 8 },
  input: {
    minHeight: 96,
    textAlignVertical: 'top',
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    backgroundColor: colors.inputBg,
    padding: 12,
    fontSize: font.body,
    color: colors.text,
  },
  photoRow: { flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 10 },
  photo: { width: 72, height: 72, borderRadius: radius.sm },
  photoText: { fontSize: 14, color: colors.muted },
  photoRemove: { fontSize: 14, color: colors.red, fontWeight: '700', marginTop: 4 },
  inputActions: { flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 12 },
  iconBtn: { width: 52, height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  micBtn: { backgroundColor: soft.blue.bg, borderWidth: 1, borderColor: soft.blue.border },
  camBtn: { borderWidth: 1, borderColor: soft.blue.border, backgroundColor: soft.blue.bg },
  voiceStatus: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.red },
  voiceStatusText: { fontSize: 15, fontWeight: '700', color: colors.red, fontVariant: ['tabular-nums'] },
  demoToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 12, marginBottom: 6 },
  demoToggleText: { fontSize: 14, fontWeight: '700', color: colors.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: 14,
    minHeight: 118,
    justifyContent: 'space-between',
    ...shadow,
  },
  tileIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  tileText: { fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 10, lineHeight: 21 },
});
