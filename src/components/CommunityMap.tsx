import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, type Region } from 'react-native-maps';

import type { Coords } from '../core/types';
import { colors, radius, tones, type Tone } from './theme';
import type { IconName } from './ui';

export type MapPoint = {
  id: string;
  coords: Coords;
  tone: Tone;
  icon: IconName;
  /** Draw the ~1 km privacy circle. On for residents; off for hospitals, which are exact places. */
  area?: boolean;
};

/** Everyone is rounded to a ~1 km grid, so each person is drawn as an area of about that size, never a home. */
const AREA_RADIUS_M = 550;

/** Frame the resident and every result, with a floor so a single nearby result isn't zoomed to street level. */
export function regionFor(origin: Coords, points: Coords[]): Region {
  const all = [origin, ...points];
  const lats = all.map((p) => p.lat);
  const lons = all.map((p) => p.lon);
  const span = (v: number[]) => Math.max(...v) - Math.min(...v);
  return {
    latitude: (Math.max(...lats) + Math.min(...lats)) / 2,
    longitude: (Math.max(...lons) + Math.min(...lons)) / 2,
    latitudeDelta: Math.max(span(lats) * 1.5, 0.04),
    longitudeDelta: Math.max(span(lons) * 1.5, 0.04),
  };
}

export function CommunityMap({
  origin,
  points,
  selectedId,
  onSelect,
  height = 300,
}: {
  origin: Coords;
  points: MapPoint[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  height?: number;
}) {
  const { t } = useTranslation();
  // Re-frame when the result set changes, not on every selection.
  const signature = points.map((p) => p.id).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `signature` stands for `points`
  const region = useMemo(() => regionFor(origin, points.map((p) => p.coords)), [signature, origin.lat, origin.lon]);

  return (
    <View style={[s.wrap, { height }]}>
      <MapView
        key={signature}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        pitchEnabled={false}
        rotateEnabled={false}
        toolbarEnabled={false}
        showsPointsOfInterests={false}
        accessibilityLabel={t('community.view.mapLabel')}
      >
        <Circle center={{ latitude: origin.lat, longitude: origin.lon }} radius={120} fillColor="#0B254533" strokeColor={colors.navy} strokeWidth={2} />
        <Marker coordinate={{ latitude: origin.lat, longitude: origin.lon }} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
          <View style={s.you} />
        </Marker>

        {points.map(({ id, coords, tone, icon, area = true }) => {
          const fg = tones[tone].fg;
          const on = id === selectedId;
          const at = { latitude: coords.lat, longitude: coords.lon };
          return [
            area ? <Circle key={`c-${id}`} center={at} radius={AREA_RADIUS_M} fillColor={`${fg}${on ? '40' : '24'}`} strokeColor={`${fg}${on ? 'FF' : '88'}`} strokeWidth={on ? 3 : 1.5} /> : null,
            <Marker key={`m-${id}`} coordinate={at} onPress={() => onSelect(id)} anchor={{ x: 0.5, y: 0.5 }} zIndex={on ? 2 : 1}>
              <View style={[s.pin, { backgroundColor: fg }, on && s.pinOn]}>
                <Ionicons name={icon} size={on ? 20 : 16} color="#fff" />
              </View>
            </Marker>,
          ];
        })}
      </MapView>
    </View>
  );
}

/** What the colors mean, and that circles are areas. */
export function MapLegend({ items }: { items: { tone: Tone; label: string }[] }) {
  const { t } = useTranslation();
  return (
    <View style={s.legend}>
      <View style={s.legendRow}>
        <View style={[s.dot, { backgroundColor: colors.navy }]} />
        <Text style={s.legendText}>{t('community.view.you')}</Text>
        {items.map((i) => (
          <View key={i.label} style={s.legendRow}>
            <View style={[s.dot, { backgroundColor: tones[i.tone].fg }]} />
            <Text style={s.legendText}>{i.label}</Text>
          </View>
        ))}
      </View>
      <Text style={s.legendNote}>{t('community.view.areaNote')}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.subtle, borderWidth: 1, borderColor: colors.border },
  you: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.navy, borderWidth: 3, borderColor: '#fff' },
  pin: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' },
  pinOn: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, borderColor: colors.navy },
  legend: { marginTop: 8, marginBottom: 4 },
  legendRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, columnGap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 13, fontWeight: '700', color: colors.text, marginRight: 8 },
  legendNote: { fontSize: 12, color: colors.muted, marginTop: 4, lineHeight: 16 },
});
