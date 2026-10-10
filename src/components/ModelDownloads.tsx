import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { deleteModel, downloadModel, hasModel, MODELS, type ModelId } from '../services/models';
import { colors, radius } from './theme';
import { Button, IconCircle, type IconName } from './ui';

const ICON: Record<ModelId, IconName> = { whisper: 'mic-outline', gemma: 'hardware-chip-outline' };

/** One row per on-device model: download with progress, or "Ready" with a remove option. */
export function ModelRow({ id, label, allowRemove = true }: { id: ModelId; label: string; allowRemove?: boolean }) {
  const { t } = useTranslation();
  const [ready, setReady] = useState(hasModel(id));
  const [pct, setPct] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  const start = async () => {
    setFailed(false);
    setPct(0);
    try {
      await downloadModel(id, (f) => setPct(Math.min(99, Math.round(f * 100))));
      setReady(hasModel(id));
    } catch {
      setFailed(true);
    }
    setPct(null);
  };

  return (
    <View style={s.row}>
      <View style={s.head}>
        <IconCircle name={ICON[id]} tone={ready ? 'green' : 'navy'} size={40} />
        <View style={{ flex: 1 }}>
          <Text style={s.title}>{label}</Text>
          {ready ? (
            <View style={s.readyRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.green} />
              <Text style={s.ready}>{t('profile.ready')}</Text>
            </View>
          ) : failed ? (
            <Text style={s.failed}>{t('profile.failed')}</Text>
          ) : null}
        </View>
        {ready && allowRemove ? <Button variant="ghost" label={t('profile.remove')} onPress={() => (deleteModel(id), setReady(false))} /> : null}
      </View>
      {pct !== null ? (
        <View>
          <View style={s.bar}>
            <View style={[s.fill, { width: `${pct}%` }]} />
          </View>
          <Text style={s.pct}>{t('profile.downloading', { pct })}</Text>
        </View>
      ) : !ready ? (
        <Button variant="outline" icon="download-outline" label={`${t('profile.download')} · ${Math.round(MODELS[id].bytes / 1e6)} MB`} onPress={start} />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  row: { paddingVertical: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  readyRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  ready: { color: colors.green, fontWeight: '700', fontSize: 14 },
  failed: { color: colors.red, fontSize: 14, marginTop: 2 },
  bar: { height: 8, borderRadius: radius.pill, backgroundColor: colors.subtle, overflow: 'hidden', marginTop: 4 },
  fill: { height: 8, borderRadius: radius.pill, backgroundColor: colors.brand },
  pct: { fontSize: 13, color: colors.muted, marginTop: 4 },
});
