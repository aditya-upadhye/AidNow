import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { contactsOf } from '../core/contacts';
import { AGENCIES } from '../data/directory';
import { call, displayTarget } from '../services/actions';
import { config } from '../services/config';
import { notifyStatus } from '../services/notify';
import { useApp } from '../state/AppContext';
import { colors, radius } from './theme';

/**
 * Top-of-Home SOS. One tap opens a full-screen confirmation with a huge "Call 911 now" button, so a
 * pocket press can't dial but a person in a panic only needs two big taps. The resident still taps
 * Call in the phone dialer: AidNow never contacts 911 itself.
 */
export function SosButton() {
  const { t } = useTranslation();
  const { profile } = useApp();
  const [open, setOpen] = useState(false);

  const show = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setOpen(true);
  };
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
      <Pressable
        testID="sos-button"
        accessibilityRole="button"
        accessibilityLabel={`${t('sos.label')}. ${t('sos.cta')}`}
        accessibilityHint={t('sos.hint')}
        onPress={show}
        style={({ pressed }) => [s.button, pressed && { opacity: 0.88, transform: [{ scale: 0.98 }] }]}
      >
        <View style={s.icon}>
          <Ionicons name="call" size={34} color={colors.red} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.sos}>{t('sos.label')}</Text>
          <Text style={s.cta}>{t('sos.cta')}</Text>
        </View>
        <Ionicons name="chevron-forward" size={28} color="#fff" />
      </Pressable>

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

const s = StyleSheet.create({
  wrap: { marginTop: 4, marginBottom: 12 },
  button: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 96, paddingVertical: 14, paddingHorizontal: 16, borderRadius: radius.lg, backgroundColor: colors.red, shadowColor: colors.redDark, shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  icon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  sos: { color: '#fff', fontSize: 34, fontWeight: '900', letterSpacing: 3 },
  cta: { color: '#fff', fontSize: 18, fontWeight: '700' },

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
