import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { AGENCIES, type AgencyId } from '../data/directory';
import { call } from '../services/actions';
import { loadQueue, removeQueued, type QueuedReport } from '../services/storage';
import { useApp } from '../state/AppContext';
import { colors } from './theme';
import { Button, Card, H2 } from './ui';

/** Back online: offer the reports saved while offline. The resident still makes every call. */
export function QueuedReports() {
  const { t } = useTranslation();
  const { online } = useApp();
  const [queue, setQueue] = useState<QueuedReport[]>([]);

  useFocusEffect(
    useCallback(() => {
      loadQueue().then(setQueue);
    }, [online]),
  );

  if (!online || !queue.length) return null;
  return (
    <Card color={colors.blueBg}>
      <H2>{t('queue.title', { count: queue.length })}</H2>
      {queue.map((r) => {
        const agency = AGENCIES[r.agency as AgencyId];
        return (
          <View key={r.id} style={{ marginVertical: 6 }}>
            <Text style={{ fontWeight: '700', fontSize: 16 }}>
              {agency?.name ?? r.agency} · {new Date(r.createdAt).toLocaleString()}
            </Text>
            <Text style={{ fontSize: 15, color: colors.muted }} numberOfLines={3}>
              {r.englishReport}
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {agency ? <Button label={`☎ ${agency.name}`} onPress={() => call(agency.dial)} style={{ flex: 1 }} /> : null}
              <Button variant="outline" label={t('result.copyReport')} onPress={() => Clipboard.setStringAsync(r.englishReport)} style={{ flex: 1 }} />
              <Button
                variant="plain"
                label={t('queue.done')}
                onPress={async () => {
                  await removeQueued(r.id);
                  setQueue(await loadQueue());
                }}
              />
            </View>
          </View>
        );
      })}
    </Card>
  );
}
