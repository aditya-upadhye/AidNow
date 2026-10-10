import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';

import { heat, type AreaStat } from '../core/reports';
import { colors, radius } from './theme';
import { regionFor } from './CommunityMap';
import { ZIP_CENTROIDS } from '../data/zipCentroids';

const CENTER = { lat: 25.78, lon: -80.22 };
const POINT = new Map(ZIP_CENTROIDS.map((z) => [z.zip, { lat: z.lat, lon: z.lon }]));

/** One circle per ZIP area: bigger and redder where more reports came in. Tapping an area selects it. */
export function HeatMap({ areas, selected, onSelect, height = 320 }: { areas: AreaStat[]; selected: string | null; onSelect: (zip: string) => void; height?: number }) {
  const { t } = useTranslation();
  const signature = areas.map((a) => a.zip).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `signature` stands for `areas`
  const region = useMemo(() => regionFor(CENTER, areas.map((a) => POINT.get(a.zip)!).filter(Boolean)), [signature]);

  return (
    <View style={[s.wrap, { height }]}>
      <MapView key={signature} style={StyleSheet.absoluteFill} initialRegion={region} pitchEnabled={false} rotateEnabled={false} toolbarEnabled={false} showsPointsOfInterests={false} accessibilityLabel={t('city.mapLabel')}>
        {areas.map((a) => {
          const p = POINT.get(a.zip);
          if (!p) return null;
          const h = heat(a, areas);
          const on = a.zip === selected;
          const at = { latitude: p.lat, longitude: p.lon };
          const alpha = Math.round(48 + h * 112).toString(16).padStart(2, '0');
          return [
            <Circle key={`c-${a.zip}`} center={at} radius={650 + Math.sqrt(a.total) * 190} fillColor={`${colors.red}${alpha}`} strokeColor={on ? colors.navy : `${colors.red}AA`} strokeWidth={on ? 3 : 1} />,
            <Marker key={`m-${a.zip}`} coordinate={at} onPress={() => onSelect(a.zip)} anchor={{ x: 0.5, y: 0.5 }} zIndex={on ? 2 : 1}>
              <View style={[s.badge, on && s.badgeOn]}>
                <Text style={[s.badgeText, on && { color: '#fff' }]}>{a.total}</Text>
              </View>
            </Marker>,
          ];
        })}
      </MapView>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.subtle, borderWidth: 1, borderColor: colors.border },
  badge: { minWidth: 30, height: 30, paddingHorizontal: 6, borderRadius: 15, backgroundColor: '#fff', borderWidth: 2, borderColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  badgeOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  badgeText: { fontSize: 13, fontWeight: '900', color: colors.red },
});
