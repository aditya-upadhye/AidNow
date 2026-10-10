import { Ionicons } from '@expo/vector-icons';
import * as Contacts from 'expo-contacts/legacy';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Linking, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { ContactDraft } from '../core/contacts';
import { draftsFromRows, filterRows, isAdded, phoneRows, type PhoneRow } from '../core/phonebook';
import type { Contact, Lang } from '../core/types';
import { colors, radius } from './theme';
import { Button } from './ui';

type Stage = 'loading' | 'ask' | 'denied' | 'list' | 'error';

/**
 * Pick any number of people from the phone's contacts. The address book is not touched, and iOS is not
 * asked for access, until the resident opens this screen and taps Continue: permission is requested at the
 * moment it is needed, with the reason shown first. Mount it only while open.
 */
export function ContactPicker({
  existing,
  language,
  onAdd,
  onClose,
  onManual,
}: {
  existing: Contact[];
  language: Lang;
  onAdd: (drafts: ContactDraft[]) => void | Promise<void>;
  onClose: () => void;
  /** Fall back to typing a number (permission denied, or the resident prefers it). */
  onManual: () => void;
}) {
  const { t } = useTranslation();
  const [stage, setStage] = useState<Stage>('loading');
  const [rows, setRows] = useState<PhoneRow[]>([]);
  const [limited, setLimited] = useState(false);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const load = async (privileges?: string) => {
    try {
      const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers], sort: Contacts.SortTypes.FirstName });
      setRows(phoneRows(data));
      setLimited(privileges === 'limited');
      setStage('list');
    } catch {
      setStage('error');
    }
  };

  // Already allowed: go straight to the list. Not yet: explain first. Asked and refused: say how to fix it.
  useEffect(() => {
    let alive = true;
    Contacts.getPermissionsAsync()
      .then((p) => {
        if (!alive) return;
        if (p.granted) load(p.accessPrivileges);
        else setStage(p.canAskAgain ? 'ask' : 'denied');
      })
      .catch(() => alive && setStage('error'));
    return () => {
      alive = false;
    };
  }, []);

  const allow = async () => {
    setStage('loading');
    try {
      const p = await Contacts.requestPermissionsAsync();
      if (p.granted) await load(p.accessPrivileges);
      else setStage('denied');
    } catch {
      setStage('error');
    }
  };

  const chooseMore = async () => {
    try {
      await Contacts.presentAccessPickerAsync();
    } catch {}
    await load('limited');
  };

  const shown = useMemo(() => filterRows(rows, query), [rows, query]);
  const drafts = useMemo(() => draftsFromRows(rows, picked, existing, language), [rows, picked, existing, language]);

  const toggle = (key: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const done = async () => {
    await onAdd(drafts);
    onClose();
  };

  const message = (title: string, body: string, actions: React.ReactNode) => (
    <View style={s.center}>
      <Ionicons name="people-circle-outline" size={64} color={colors.brand} />
      <Text style={s.centerTitle}>{title}</Text>
      <Text style={s.centerBody}>{body}</Text>
      <View style={{ alignSelf: 'stretch', gap: 8 }}>{actions}</View>
    </View>
  );

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <Text style={s.title}>{t('contacts.pickerTitle')}</Text>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
            <Text style={s.cancel}>{t('common.cancel')}</Text>
          </Pressable>
        </View>

        {stage === 'loading' ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={colors.brand} />
          </View>
        ) : null}

        {stage === 'ask'
          ? message(
              t('contacts.allowTitle'),
              t('contacts.allowBody'),
              <>
                <Button big icon="checkmark" label={t('contacts.allow')} onPress={allow} />
                <Button variant="ghost" label={t('contacts.typeInstead')} onPress={() => { onClose(); onManual(); }} />
              </>,
            )
          : null}

        {stage === 'denied'
          ? message(
              t('contacts.deniedTitle'),
              t('contacts.deniedBody'),
              <>
                <Button big icon="settings-outline" label={t('contacts.openSettings')} onPress={() => Linking.openSettings()} />
                <Button variant="ghost" label={t('contacts.typeInstead')} onPress={() => { onClose(); onManual(); }} />
              </>,
            )
          : null}

        {stage === 'error'
          ? message(t('contacts.errorTitle'), t('contacts.loadFailed'), <Button variant="ghost" label={t('contacts.typeInstead')} onPress={() => { onClose(); onManual(); }} />)
          : null}

        {stage === 'list' ? (
          <>
            <View style={s.search}>
              <Ionicons name="search" size={18} color={colors.faint} />
              <TextInput value={query} onChangeText={setQuery} placeholder={t('contacts.search')} placeholderTextColor={colors.faint} style={s.searchInput} autoCorrect={false} clearButtonMode="while-editing" accessibilityLabel={t('contacts.search')} />
            </View>
            {limited ? (
              <View style={s.limited}>
                <Text style={s.limitedText}>{t('contacts.limitedNote')}</Text>
                <Pressable onPress={chooseMore} hitSlop={8}>
                  <Text style={s.link}>{t('contacts.chooseMore')}</Text>
                </Pressable>
              </View>
            ) : null}
            <FlatList
              data={shown}
              keyExtractor={(r) => r.key}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 16 }}
              ListEmptyComponent={<Text style={s.empty}>{rows.length === 0 ? t('contacts.noPhones') : t('contacts.noResults')}</Text>}
              renderItem={({ item }) => {
                const added = isAdded(item, existing);
                const on = picked.has(item.key) && !added;
                return (
                  <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on || added, disabled: added }} accessibilityLabel={`${item.name} ${item.number}`} disabled={added} onPress={() => toggle(item.key)} style={({ pressed }) => [s.row, added && { opacity: 0.5 }, pressed && { backgroundColor: colors.subtle }]}>
                    <Ionicons name={on || added ? 'checkbox' : 'square-outline'} size={26} color={on || added ? colors.brand : colors.faint} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.name}>{item.name}</Text>
                      <Text style={s.number}>
                        {item.number}
                        {item.label ? ` · ${item.label}` : ''}
                      </Text>
                    </View>
                    {added ? <Text style={s.addedTag}>{t('contacts.added')}</Text> : null}
                  </Pressable>
                );
              }}
            />
            <View style={s.footer}>
              <Button big icon="person-add-outline" label={drafts.length ? t('contacts.addSelected', { count: drafts.length }) : t('contacts.pickSome')} onPress={done} disabled={drafts.length === 0} />
              <Text style={s.hint}>{t('contacts.languageAfter')}</Text>
            </View>
          </>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.card },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  cancel: { fontSize: 17, fontWeight: '700', color: colors.brand },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 10 },
  centerTitle: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' },
  centerBody: { fontSize: 16, color: colors.muted, textAlign: 'center', lineHeight: 23, marginBottom: 8 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 12, paddingHorizontal: 12, borderRadius: radius.md, backgroundColor: colors.subtle },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 17, color: colors.text },
  limited: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 12, marginBottom: 6, padding: 10, borderRadius: radius.md, backgroundColor: colors.amberBg },
  limitedText: { flex: 1, fontSize: 13, color: colors.text },
  link: { fontSize: 14, fontWeight: '800', color: colors.brand },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 12, minHeight: 60 },
  name: { fontSize: 17, fontWeight: '700', color: colors.text },
  number: { fontSize: 14, color: colors.muted, marginTop: 1 },
  addedTag: { fontSize: 12, fontWeight: '800', color: colors.green },
  empty: { textAlign: 'center', color: colors.muted, fontSize: 16, padding: 32 },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, backgroundColor: colors.card },
  hint: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 6 },
});
