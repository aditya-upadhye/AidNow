import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { addContact, contactProblem, removeContact, updateContact, type ContactDraft } from '../core/contacts';
import type { Contact, Lang } from '../core/types';
import { colors, radius, shadow } from './theme';
import { ContactPicker } from './ContactPicker';
import { Button, Card, Field } from './ui';

const LANG_LABEL: Record<Lang, string> = { en: 'English', es: 'Español', ht: 'Kreyòl' };

type Props = {
  contacts: Contact[];
  onChange: (contacts: Contact[]) => void | Promise<void>;
  /** Language preselected for a new contact: the resident's own. */
  defaultLanguage: Lang;
  /** Adds an on/off switch per contact, for choosing who to message right now. */
  selection?: { off: Record<string, boolean>; onToggle: (id: string, on: boolean) => void };
  /** Open the contacts picker on mount (deep link: aidnow://contacts?pick=1). */
  startPicking?: boolean;
};

/**
 * Add, edit and remove any number of emergency contacts. Used wherever contacts matter: onboarding, the
 * Emergency contacts screen and the family check-in. Changes go straight to `onChange`.
 */
export function ContactsManager({ contacts, onChange, defaultLanguage, selection, startPicking }: Props) {
  const { t } = useTranslation();
  const blank: ContactDraft = { name: '', phone: '', language: defaultLanguage };
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<ContactDraft>(blank);
  const [tried, setTried] = useState(false);
  const [picking, setPicking] = useState(!!startPicking);

  const addOpen = adding;
  const form = editingId !== null || addOpen;
  const problem = contactProblem(draft, contacts, editingId ?? undefined);
  const errorFor = (field: 'name' | 'phone') => {
    if (!tried || !problem) return undefined;
    if (field === 'name' && problem === 'name') return t('common.required');
    if (field === 'phone' && problem === 'phone') return t('contacts.phoneInvalid');
    if (field === 'phone' && problem === 'duplicate') return t('contacts.duplicate');
    return undefined;
  };

  const close = () => {
    setEditingId(null);
    setAdding(false);
    setTried(false);
    setDraft({ ...blank });
  };

  const openManual = () => {
    setEditingId(null);
    setTried(false);
    setDraft({ ...blank });
    setAdding(true);
  };

  const startEdit = (c: Contact) => {
    setAdding(false);
    setTried(false);
    setEditingId(c.id);
    setDraft({ name: c.name, phone: c.phone, language: c.language });
  };

  const submit = async () => {
    setTried(true);
    if (problem) return;
    await onChange(editingId ? updateContact(contacts, editingId, draft) : addContact(contacts, draft));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    // Keep adding in the same language: families usually share one.
    setEditingId(null);
    setAdding(false);
    setTried(false);
    setDraft({ ...blank, language: draft.language });
  };

  const confirmRemove = (c: Contact) =>
    Alert.alert(t('contacts.removeTitle', { name: c.name }), t('contacts.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('contacts.remove'),
        style: 'destructive',
        onPress: async () => {
          await onChange(removeContact(contacts, c.id));
          if (editingId === c.id) close();
        },
      },
    ]);

  const pills = (
    <View style={s.pills}>
      {(['en', 'es', 'ht'] as Lang[]).map((l) => (
        <Pressable key={l} accessibilityRole="button" accessibilityState={{ selected: draft.language === l }} onPress={() => setDraft({ ...draft, language: l })} style={[s.pill, draft.language === l && s.pillOn]}>
          <Text style={[s.pillText, draft.language === l && s.pillTextOn]}>{LANG_LABEL[l]}</Text>
        </Pressable>
      ))}
    </View>
  );

  const editor = (
    <Card style={{ marginBottom: 10 }}>
      <Text style={s.formTitle}>{editingId ? t('contacts.editTitle') : t('contacts.addTitle')}</Text>
      <Field label={t('contacts.name')} value={draft.name} onChangeText={(v) => setDraft({ ...draft, name: v })} error={errorFor('name')} autoComplete="name" />
      <Field label={t('contacts.phone')} value={draft.phone} onChangeText={(v) => setDraft({ ...draft, phone: v })} error={errorFor('phone')} keyboardType="phone-pad" autoComplete="tel" />
      <Text style={s.label}>{t('contacts.language')}</Text>
      <Text style={s.help}>{t('contacts.languageHelp')}</Text>
      {pills}
      <View style={s.btns}>
        <Button icon={editingId ? 'checkmark' : 'person-add-outline'} label={editingId ? t('common.save') : t('contacts.add')} onPress={submit} style={{ flex: 1 }} />
        <Button variant="outline" label={t('common.cancel')} onPress={close} />
      </View>
      {editingId ? (
        <Pressable accessibilityRole="button" onPress={() => confirmRemove(contacts.find((c) => c.id === editingId)!)} hitSlop={8} style={s.removeRow}>
          <Ionicons name="trash-outline" size={18} color={colors.red} />
          <Text style={s.removeText}>{t('contacts.remove')}</Text>
        </Pressable>
      ) : null}
    </Card>
  );

  return (
    <View>
      {contacts.map((c) =>
        editingId === c.id ? (
          <View key={c.id}>{editor}</View>
        ) : (
          <Pressable key={c.id} accessibilityRole="button" accessibilityLabel={`${t('contacts.edit')} ${c.name}`} onPress={() => startEdit(c)} style={({ pressed }) => [s.row, pressed && { opacity: 0.85 }]}>
            <View style={s.avatar}>
              <Ionicons name="person" size={18} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.name} numberOfLines={1}>
                {c.name}
              </Text>
              <Text style={s.meta} numberOfLines={1}>
                {c.phone} · {LANG_LABEL[c.language]}
              </Text>
            </View>
            {selection ? (
              <Switch value={!selection.off[c.id]} onValueChange={(v) => selection.onToggle(c.id, v)} accessibilityLabel={c.name} />
            ) : (
              <Ionicons name="chevron-forward" size={20} color={colors.faint} />
            )}
          </Pressable>
        ),
      )}

      {addOpen && editingId === null ? editor : null}
      {!form ? (
        <View style={s.addRow}>
          {contacts.length === 0 ? <Text style={s.empty}>{t('contacts.none')}</Text> : null}
          <View style={s.addButtons}>
            <Button icon="people-outline" label={t('contacts.fromContacts')} onPress={() => setPicking(true)} style={{ flex: 1 }} />
            <Button variant="outline" icon="keypad-outline" label={t('contacts.typeNumber')} onPress={openManual} style={{ flex: 1 }} />
          </View>
        </View>
      ) : null}

      {picking ? (
        <ContactPicker
          existing={contacts}
          language={defaultLanguage}
          onClose={() => setPicking(false)}
          onManual={openManual}
          onAdd={async (drafts) => {
            if (drafts.length === 0) return;
            await onChange(drafts.reduce((list, d) => addContact(list, d), contacts));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }}
        />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: radius.lg, paddingHorizontal: 14, paddingVertical: 10, minHeight: 64, marginBottom: 8, ...shadow },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.blueBg, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 17, fontWeight: '800', color: colors.text },
  meta: { fontSize: 14, color: colors.muted, marginTop: 1 },
  formTitle: { fontSize: 17, fontWeight: '800', color: colors.text, marginBottom: 12 },
  label: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 2 },
  help: { fontSize: 13, color: colors.muted, lineHeight: 18, marginBottom: 8 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  pill: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  pillOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  pillText: { fontSize: 15, fontWeight: '700', color: colors.text },
  pillTextOn: { color: '#fff' },
  empty: { fontSize: 15, color: colors.muted, textAlign: 'center', marginVertical: 4 },
  removeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 14, paddingVertical: 4 },
  removeText: { fontSize: 15, fontWeight: '700', color: colors.red },
  addRow: { gap: 8 },
  addButtons: { flexDirection: 'row', gap: 10 },
  btns: { flexDirection: 'row', gap: 10, alignItems: 'center' },
});
