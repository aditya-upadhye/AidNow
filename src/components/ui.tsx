import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, type ComponentProps, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Animated,
  Image,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AGENCIES } from '../data/directory';
import { call } from '../services/actions';
import { config } from '../services/config';
import { useApp } from '../state/AppContext';
import { colors, font, radius, shadow, tones, type Tone } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

const LOGO = require('../../assets/logo.png');

/**
 * Top bar on every screen: back or logo on the left, the red 911 button on the right. Escalate, never block.
 */
export function TopBar({ back, title }: { back?: boolean | (() => void); title?: string }) {
  const { t } = useTranslation();
  return (
    <View style={s.bar}>
      {back ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          hitSlop={12}
          onPress={typeof back === 'function' ? back : () => router.back()}
          style={s.backBtn}
        >
          <Ionicons name="chevron-back" size={26} color={colors.navy} />
        </Pressable>
      ) : (
        <View style={s.brand}>
          <Image source={LOGO} style={s.logo} />
          <Text style={s.brandText}>AidNow</Text>
        </View>
      )}
      {title ? (
        <Text style={s.barTitle} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {config.demoMode && (
        <View style={s.demo}>
          <Text style={s.demoText}>{t('common.demo')}</Text>
        </View>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('result.call911')}
        onPress={() => call(AGENCIES['911'].dial)}
        style={({ pressed }) => [s.bar911, pressed && { opacity: 0.85 }]}
      >
        <Ionicons name="call" size={18} color="#fff" />
        <Text style={s.bar911Text}>{t('common.call911')}</Text>
      </Pressable>
    </View>
  );
}

export function OfflineBanner() {
  const { online } = useApp();
  const { t } = useTranslation();
  if (online) return null;
  return (
    <View style={s.offline}>
      <Ionicons name="cloud-offline-outline" size={18} color="#fff" />
      <Text style={s.offlineText}>{t('common.offline')}</Text>
    </View>
  );
}

export function Disclaimer() {
  const { t } = useTranslation();
  return (
    <View style={s.disclaimerRow}>
      <Ionicons name="shield-checkmark-outline" size={16} color={colors.faint} />
      <Text style={s.disclaimer}>{t('common.disclaimer')}</Text>
    </View>
  );
}

/** Text fields point at this bar so the iOS keyboard always has a Done button. */
const KEYBOARD_BAR_ID = 'aidnow-keyboard-done';

function KeyboardDoneBar() {
  const { t } = useTranslation();
  if (Platform.OS !== 'ios') return null;
  return (
    <InputAccessoryView nativeID={KEYBOARD_BAR_ID}>
      <View style={s.kbBar}>
        <Pressable accessibilityRole="button" onPress={Keyboard.dismiss} hitSlop={12}>
          <Text style={s.kbDone}>{t('common.done')}</Text>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

export function Screen({
  children,
  scroll = true,
  bg = colors.bg,
  back,
  title,
  hero,
}: {
  children: ReactNode;
  scroll?: boolean;
  bg?: string;
  back?: boolean | (() => void);
  title?: string;
  /** Full-width block rendered above the padded content (result banners). */
  hero?: ReactNode;
}) {
  return (
    <SafeAreaView style={[s.safe, { backgroundColor: colors.card }]} edges={['top', 'left', 'right']}>
      <TopBar back={back} title={title} />
      <OfflineBanner />
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {scroll ? (
          // Tapping empty space ("handled") or swiping down ("interactive") puts the keyboard away.
          <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ paddingBottom: 48 }}>
            {hero}
            <View style={s.content}>{children}</View>
          </ScrollView>
        ) : (
          <Pressable style={[s.content, { flex: 1 }]} onPress={Keyboard.dismiss} accessible={false}>
            {children}
          </Pressable>
        )}
      </KeyboardAvoidingView>
      <KeyboardDoneBar />
    </SafeAreaView>
  );
}

type Variant = 'navy' | 'red' | 'blue' | 'amber' | 'outline' | 'plain' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'navy',
  disabled,
  style,
  big,
  icon,
  loading,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: ViewStyle;
  big?: boolean;
  icon?: IconName;
  loading?: boolean;
}) {
  const bg = { navy: colors.navy, red: colors.red, blue: colors.blue, amber: colors.amber, outline: colors.card, plain: colors.subtle, ghost: 'transparent' }[variant];
  const fg = { outline: colors.navy, plain: colors.text, ghost: colors.brand }[variant as 'outline'] ?? '#fff';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        s.button,
        big && s.buttonBig,
        { backgroundColor: bg, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        variant === 'outline' && { borderWidth: 1.5, borderColor: colors.border },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} /> : icon ? <Ionicons name={icon} size={big ? 24 : 20} color={fg} /> : null}
      <Text style={[s.buttonText, big && s.buttonTextBig, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, help, error, style, ...props }: TextInputProps & { label: string; help?: string; error?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={s.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.faint}
        inputAccessoryViewID={KEYBOARD_BAR_ID}
        {...props}
        // Caller styles add to the base look (border, fill); they never replace it.
        style={[s.input, error ? { borderColor: colors.red } : null, style]}
      />
      {help ? <Text style={s.help}>{help}</Text> : null}
      {error ? <Text style={[s.help, { color: colors.red }]}>{error}</Text> : null}
    </View>
  );
}

export function Card({ children, color = colors.card, style }: { children: ReactNode; color?: string; style?: ViewStyle }) {
  return <View style={[s.card, { backgroundColor: color }, style]}>{children}</View>;
}

export function IconCircle({ name, tone = 'navy', size = 44, mci }: { name: string; tone?: Tone; size?: number; mci?: boolean }) {
  const { fg, bg } = tones[tone];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      {mci ? <MaterialCommunityIcons name={name as ComponentProps<typeof MaterialCommunityIcons>['name']} size={size * 0.55} color={fg} /> : <Ionicons name={name as IconName} size={size * 0.52} color={fg} />}
    </View>
  );
}

/** Small status pill: icon + label, colored by tone. */
export function Chip({ icon, label, tone = 'neutral', onPress }: { icon?: IconName; label: string; tone?: Tone; onPress?: () => void }) {
  const { fg, bg } = tones[tone];
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[s.chip, { backgroundColor: bg }]}>
      {icon ? <Ionicons name={icon} size={14} color={fg} /> : null}
      <Text style={[s.chipText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

export function ListRow({ icon, tone = 'navy', title, subtitle, onPress }: { icon: IconName; tone?: Tone; title: string; subtitle?: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [s.row, pressed && { opacity: 0.8 }]}>
      <IconCircle name={icon} tone={tone} size={40} />
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>{title}</Text>
        {subtitle ? <Text style={s.rowSub}>{subtitle}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.faint} />
    </Pressable>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={s.section}>{children}</Text>;
}

export type StepState = 'done' | 'active' | 'todo';

/** Shows the pipeline working: Listen → Understand → Route. */
export function Steps({ steps, caption }: { steps: { label: string; state: StepState }[]; caption?: string }) {
  return (
    <View style={s.steps}>
      <View style={s.stepsRow}>
        {steps.map((st, i) => (
          <View key={st.label} style={s.step}>
            <View
              style={[
                s.stepDot,
                st.state === 'done' && { backgroundColor: colors.green },
                st.state === 'active' && { backgroundColor: colors.brand },
              ]}
            >
              {st.state === 'done' ? (
                <Ionicons name="checkmark" size={14} color="#fff" />
              ) : st.state === 'active' ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={s.stepNum}>{i + 1}</Text>
              )}
            </View>
            <Text style={[s.stepLabel, st.state === 'todo' && { color: colors.faint }]}>{st.label}</Text>
          </View>
        ))}
      </View>
      {caption ? <Text style={s.stepsCaption}>{caption}</Text> : null}
    </View>
  );
}

/** Soft looping pulse behind the mic while recording. */
export function Pulse({ active, color, size }: { active: boolean; color: string; size: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!active) {
      v.stopAnimation();
      v.setValue(0);
      return;
    }
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1400, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [active, v]);
  if (!active) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.45] }) }],
      }}
    />
  );
}

export const H1 = ({ children, color = colors.text }: { children: ReactNode; color?: string }) => (
  <Text style={[s.h1, { color }]}>{children}</Text>
);
export const H2 = ({ children }: { children: ReactNode }) => <Text style={s.h2}>{children}</Text>;
export const P = ({ children, muted }: { children: ReactNode; muted?: boolean }) => (
  <Text style={[s.p, muted && { color: colors.muted, fontSize: 15, lineHeight: 21 }]}>{children}</Text>
);

const s = StyleSheet.create({
  safe: { flex: 1 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 32, height: 32, borderRadius: 8 },
  brandText: { fontSize: 20, fontWeight: '800', color: colors.navy, letterSpacing: -0.3 },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.subtle },
  barTitle: { flex: 1, fontSize: font.body, fontWeight: '700', color: colors.text },
  bar911: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.red, borderRadius: radius.pill, paddingVertical: 10, paddingHorizontal: 18 },
  bar911Text: { color: '#fff', fontSize: 18, fontWeight: '900', letterSpacing: 0.5 },
  demo: { backgroundColor: '#FFE066', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  demoText: { fontWeight: '900', color: '#3D3200', fontSize: 12, letterSpacing: 0.5 },
  offline: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#334155', paddingHorizontal: 16, paddingVertical: 9 },
  offlineText: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
  kbBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    backgroundColor: '#F1F1F1',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  kbDone: { fontSize: font.body, fontWeight: '700', color: colors.blue },
  disclaimerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 18, paddingHorizontal: 8 },
  disclaimer: { fontSize: 13, color: colors.faint, textAlign: 'center', flexShrink: 1 },
  content: { padding: 16 },
  button: {
    flexDirection: 'row',
    gap: 8,
    borderRadius: radius.md,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 5,
  },
  buttonBig: { paddingVertical: 19, borderRadius: radius.lg },
  buttonText: { fontSize: font.body, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  buttonTextBig: { fontSize: font.large, fontWeight: '800' },
  label: { fontSize: 15, fontWeight: '700', marginBottom: 6, color: colors.text },
  input: {
    borderWidth: 1.5,
    borderColor: colors.inputBorder,
    borderRadius: radius.md,
    padding: 13,
    fontSize: font.body,
    color: colors.text,
    backgroundColor: colors.inputBg,
  },
  help: { fontSize: 13, color: colors.muted, marginTop: 5, lineHeight: 18 },
  card: { borderRadius: radius.lg, padding: 16, marginVertical: 7, ...shadow },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontSize: 13, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, marginVertical: 5, ...shadow },
  rowTitle: { fontSize: font.body, fontWeight: '700', color: colors.text },
  rowSub: { fontSize: 13, color: colors.muted, marginTop: 2 },
  section: { fontSize: 13, fontWeight: '800', color: colors.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 20, marginBottom: 6 },
  steps: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, marginVertical: 8, ...shadow },
  stepsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  step: { flex: 1, alignItems: 'center', gap: 6 },
  stepDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.subtle, alignItems: 'center', justifyContent: 'center' },
  stepNum: { fontSize: 13, fontWeight: '800', color: colors.faint },
  stepLabel: { fontSize: 13, fontWeight: '700', color: colors.text, textAlign: 'center' },
  stepsCaption: { fontSize: 13, color: colors.muted, textAlign: 'center', marginTop: 10 },
  h1: { fontSize: font.title, fontWeight: '800', marginVertical: 6, letterSpacing: -0.4 },
  h2: { fontSize: 19, fontWeight: '800', marginTop: 4, marginBottom: 8, color: colors.text },
  p: { fontSize: font.body, color: colors.text, lineHeight: 25 },
});
