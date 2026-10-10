import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Modal, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { contactsOf } from '../core/contacts';
import { AGENCIES } from '../data/directory';
import { call, displayTarget } from '../services/actions';
import { config } from '../services/config';
import { notifyStatus } from '../services/notify';
import { useApp } from '../state/AppContext';
import { colors, radius } from './theme';

/**
 * Top-of-Home SOS. Sliding the handle all the way across opens a full-screen confirmation with a huge "Call 911 now" button, so a
 * pocket press can't dial (a slide is deliberate) but a person in a panic only needs two big taps. The resident still taps
 * Call in the phone dialer: AidNow never contacts 911 itself.
 */
export function SosButton() {
  const { t } = useTranslation();
  const { profile } = useApp();
  const [open, setOpen] = useState(false);
  const [trackW, setTrackW] = useState(0);
  const [x] = useState(() => new Animated.Value(0));
  const maxX = Math.max(0, trackW - HANDLE - PAD * 2);
  const maxRef = useRef(maxX);
  useEffect(() => {
    maxRef.current = maxX;
  }, [maxX]);

  const show = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setOpen(true);
  };
  const reset = () => Animated.spring(x, { toValue: 0, useNativeDriver: false }).start();

  // The whole bar is the drag surface (not just the small handle), it claims a mostly-sideways drag before the
  // page's ScrollView can take it, and a long drag or a quick flick both count. maxRef is only read inside
  // gesture callbacks, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: (_, g) => Math.abs(g.dx) > 4 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, g) => x.setValue(Math.min(Math.max(0, g.dx), maxRef.current)),
      onPanResponderRelease: (_, g) => {
        const max = maxRef.current;
        if (max > 0 && (g.dx >= max * 0.55 || (g.vx > 0.8 && g.dx > max * 0.25))) {
          Animated.timing(x, { toValue: max, duration: 120, useNativeDriver: false }).start(() => {
            show();
            setTimeout(reset, 300);
          });
        } else if (g.dx < 6 && Math.abs(g.dy) < 6) {
          // A plain tap: nudge the handle to show it needs sliding.
          Animated.sequence([
            Animated.timing(x, { toValue: Math.min(40, max), duration: 140, useNativeDriver: false }),
            Animated.spring(x, { toValue: 0, useNativeDriver: false }),
          ]).start();
        } else reset();
      },
      onPanResponderTerminate: reset,
    }),
  );

  const contacts = contactsOf(profile);
  const [telling, setTelling] = useState(false);
  // 911 comes first and is never delayed: this only opens Messages, and the call button stays above it.
  const tellContacts = async () => {
    if (!profile || telling) return;
    setTelling(true);
    try {
      await notifyStatus(profile, contacts, 'need_help');
    } finally {
      setTelling(false);
    }
  };
  const addContacts = () => {
    setOpen(false);
    router.push('/family');
  };
  const dial = () => {
    setOpen(false);
    call(AGENCIES['911'].dial);
  };

  return (
    <View style={s.wrap}>
      <View
        testID="sos-button"
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${t('sos.label')}. ${t('sos.cta')}`}
        accessibilityHint={t('sos.hint')}
        accessibilityActions={[{ name: 'activate' }]}
        onAccessibilityAction={show}
        onLayout={(e) => setTrackW(e.nativeEvent.layout.width)}
        style={s.button}
        {...pan.panHandlers}
      >
        <Animated.View style={[s.fill, { width: Animated.add(x, HANDLE + PAD * 2), opacity: x.interpolate({ inputRange: [0, 12], outputRange: [0, 1], extrapolate: 'clamp' }) }]} />
        <View style={s.labels} pointerEvents="none">
          <Text style={s.sos}>{t('sos.label')}</Text>
          <Text style={s.cta}>{t('sos.cta')}</Text>
        </View>
        <Animated.View style={[s.icon, { transform: [{ translateX: x }] }]} pointerEvents="none">
          <Ionicons name="call" size={34} color={colors.red} />
        </Animated.View>
        <Ionicons name="chevron-forward" size={26} color={colors.red} style={s.chevron} pointerEvents="none" />
      </View>

      <Modal visible={open} animationType="fade" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <SafeAreaView style={s.modal}>
          <View style={s.modalTop}>
            <Ionicons name="warning" size={64} color="#fff" />
            <Text style={s.modalTitle} accessibilityRole="header">
              {t('sos.confirmTitle')}
            </Text>
            <Text style={s.modalBody}>{t('sos.confirmBody')}</Text>
            {profile?.address ? (
              <View style={s.addr}>
                <Text style={s.addrLabel}>{t('sos.yourAddress')}</Text>
                <Text style={s.addrText}>{profile.address}</Text>
              </View>
            ) : null}
          </View>

          <View style={s.modalBottom}>
            {config.demoMode && <Text style={s.demo}>{t('sos.demoNote', { number: displayTarget('911') })}</Text>}
            <Pressable testID="sos-call" accessibilityRole="button" onPress={dial} style={({ pressed }) => [s.callBtn, pressed && { opacity: 0.85 }]}>
              <Ionicons name="call" size={32} color={colors.red} />
              <Text style={s.callText}>{t('sos.confirmCall')}</Text>
            </Pressable>
            {contacts.length > 0 ? (
              <Pressable testID="sos-notify" accessibilityRole="button" disabled={telling} onPress={tellContacts} style={({ pressed }) => [s.notifyBtn, (pressed || telling) && { opacity: 0.8 }]}>
                <Ionicons name="people" size={26} color="#fff" />
                <Text style={s.notifyText}>{t('sos.notify', { count: contacts.length })}</Text>
              </Pressable>
            ) : (
              <Pressable testID="sos-add-contacts" accessibilityRole="button" onPress={addContacts} style={({ pressed }) => [s.notifyBtn, pressed && { opacity: 0.8 }]}>
                <Ionicons name="person-add" size={26} color="#fff" />
                <Text style={s.notifyText}>{t('sos.addContacts')}</Text>
              </Pressable>
            )}
            <Pressable testID="sos-cancel" accessibilityRole="button" onPress={() => setOpen(false)} style={({ pressed }) => [s.cancelBtn, pressed && { opacity: 0.8 }]}>
              <Text style={s.cancelText}>{t('sos.cancel')}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const HANDLE = 64;
const PAD = 14;

const s = StyleSheet.create({
  wrap: { marginTop: 4, marginBottom: 12 },
  button: { flexDirection: 'row', alignItems: 'center', minHeight: 88, padding: PAD, borderRadius: radius.lg, backgroundColor: 'rgba(220, 38, 38, 0.10)', borderWidth: 1, borderColor: 'rgba(220, 38, 38, 0.28)', overflow: 'hidden', shadowColor: colors.red, shadowOpacity: 0.12, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: 'rgba(220, 38, 38, 0.22)' },
  labels: { flex: 1, alignItems: 'center', paddingLeft: HANDLE },
  icon: { position: 'absolute', left: PAD, width: HANDLE, height: HANDLE, borderRadius: HANDLE / 2, backgroundColor: 'rgba(255, 255, 255, 0.85)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.9)', alignItems: 'center', justifyContent: 'center', shadowColor: colors.red, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  chevron: { position: 'absolute', right: PAD },
  sos: { color: colors.red, fontSize: 28, fontWeight: '800', letterSpacing: 3 },
  cta: { color: colors.red, fontSize: 15, fontWeight: '600', opacity: 0.85 },

  modal: { flex: 1, backgroundColor: colors.red, justifyContent: 'space-between' },
  modalTop: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, gap: 12 },
  modalTitle: { color: '#fff', fontSize: 44, fontWeight: '900', textAlign: 'center' },
  modalBody: { color: '#fff', fontSize: 20, textAlign: 'center' },
  addr: { marginTop: 12, alignSelf: 'stretch', backgroundColor: colors.redDark, borderRadius: radius.md, padding: 14, gap: 2 },
  addrLabel: { color: '#fff', fontSize: 14, fontWeight: '700', opacity: 0.9 },
  addrText: { color: '#fff', fontSize: 22, fontWeight: '800' },
  modalBottom: { paddingHorizontal: 20, paddingBottom: 20, gap: 14 },
  demo: { color: '#fff', textAlign: 'center', fontSize: 14, fontWeight: '700' },
  callBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, minHeight: 100, borderRadius: radius.lg, backgroundColor: '#fff' },
  callText: { color: colors.red, fontSize: 28, fontWeight: '900' },
  notifyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 64, borderRadius: radius.lg, backgroundColor: colors.redDark },
  notifyText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  cancelBtn: { alignItems: 'center', justifyContent: 'center', minHeight: 64, borderRadius: radius.lg, borderWidth: 2, borderColor: '#fff' },
  cancelText: { color: '#fff', fontSize: 22, fontWeight: '800' },
});
