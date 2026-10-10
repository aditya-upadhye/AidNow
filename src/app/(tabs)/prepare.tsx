import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius } from '../../components/theme';
import { Button, Card, Disclaimer, IconCircle, Screen } from '../../components/ui';
import type { Coords } from '../../core/types';
import { LINKS } from '../../data/directory';
import { cachedAdvisories, cachedAirQuality, nearestShelters, nextHighTide, zoneFor, type AirQuality, type Shelter, type Storm, type Tide } from '../../services/county';
import { getCoords } from '../../services/location';
import { useApp } from '../../state/AppContext';

type Loaded<T> = { data: T; savedAt: string } | null;

/** Zone colors follow the County's A (most exposed) to E (least) ordering. */
/** EPA's standard AQI category colors, 1 (Good) to 6 (Hazardous). */
const AQI_COLOR = ['', '#00A651', '#E6B800', '#FF7E00', '#E3170A', '#8F3F97', '#7E0023'];

const ZONE_COLOR: Record<string, string> = { A: '#B71C1C', B: '#E65100', C: '#F9A825', D: '#2E7D32', E: '#1565C0' };

export default function Prepare() {
  const { t, i18n } = useTranslation();
  const { profile, online } = useApp();
  const [coords, setCoords] = useState<Coords | null>(profile?.addressCoords ?? null);
  const [shelters, setShelters] = useState<Loaded<Shelter[]>>(null);
  const [tide, setTide] = useState<Loaded<Tide | null>>(null);
  const [storms, setStorms] = useState<Loaded<Storm[]>>(null);
  const [air, setAir] = useState<Loaded<AirQuality>>(null);

  useEffect(() => {
    if (!profile?.addressCoords) getCoords().then((c) => c && setCoords(c));
  }, [profile?.addressCoords]);

  useEffect(() => {
    nearestShelters(coords).then(setShelters);
    nextHighTide().then(setTide);
    cachedAdvisories().then(setStorms);
    cachedAirQuality().then(setAir);
  }, [coords, online]);

  const zone = coords ? zoneFor(coords) : undefined;
  const locale = i18n.language === 'ht' ? 'fr-HT' : i18n.language;
  const when = (iso: string) => new Date(iso).toLocaleString(locale, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
  const saved = (iso: string) => t('prepare.saved', { time: new Date(iso).toLocaleString(locale, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) });
  const inZone = zone && zone !== 'N';

  return (
    <Screen title={t('prepare.title')}>
      {/* Zone */}
      <Card>
        <View style={s.zoneRow}>
          <View style={[s.zoneBadge, { backgroundColor: inZone ? ZONE_COLOR[zone!] ?? colors.navy : colors.subtle }]}>
            {inZone ? <Text style={s.zoneLetter}>{zone}</Text> : <Ionicons name={zone === undefined ? 'help' : 'checkmark'} size={34} color={colors.muted} />}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.label}>{t('prepare.zone')}</Text>
            <Text style={s.zoneValue}>
              {zone === undefined ? t('prepare.zoneUnknown') : inZone ? t('prepare.zoneValue', { zone }) : t('prepare.zoneNone')}
            </Text>
          </View>
        </View>
        <Text style={s.note}>{t('prepare.zoneNote')}</Text>
      </Card>

      {/* Storms */}
      <Card>
        <View style={s.head}>
          <IconCircle name="weather-hurricane" mci tone="navy" size={40} />
          <Text style={s.title}>{t('prepare.advisory')}</Text>
        </View>
        {!storms ? (
          <Text style={s.body}>{t('prepare.unavailable')}</Text>
        ) : storms.data.length === 0 ? (
          <Text style={s.body}>{t('prepare.advisoryNone')}</Text>
        ) : (
          storms.data.map((st) => (
            <Pressable key={st.name} style={s.storm} onPress={() => st.advisoryUrl && Linking.openURL(st.advisoryUrl)}>
              <MaterialCommunityIcons name="weather-hurricane" size={26} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={s.stormName}>
                  {t(`storm.${st.classification}`, { defaultValue: t('storm.other') })} {st.name}
                </Text>
                <Text style={s.stormSub}>{st.intensityKt} kt · National Hurricane Center</Text>
              </View>
              <Ionicons name="open-outline" size={18} color="#fff" />
            </Pressable>
          ))
        )}
        {storms ? <Text style={s.saved}>{saved(storms.savedAt)}</Text> : null}
      </Card>

      {/* Shelters */}
      <Card>
        <View style={s.head}>
          <IconCircle name="home-heart" mci tone="purple" size={40} />
          <Text style={s.title}>{t('prepare.shelters')}</Text>
        </View>
        {!shelters ? (
          <Text style={s.body}>{t('prepare.sheltersUnknown')}</Text>
        ) : shelters.data.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="information-circle-outline" size={20} color={colors.purple} />
            <Text style={[s.body, { flex: 1 }]}>{t('prepare.sheltersNoneOpen')}</Text>
          </View>
        ) : (
          <>
            <Text style={s.label}>{t('prepare.sheltersOpen')}</Text>
            {shelters.data.map((sh) => (
              <View key={sh.name + sh.address} style={s.shelter}>
                <Ionicons name="location" size={18} color={colors.purple} />
                <View style={{ flex: 1 }}>
                  <Text style={s.shelterName}>
                    {sh.name}
                    {sh.petFriendly ? ' 🐾' : ''}
                  </Text>
                  <Text style={s.note}>
                    {sh.address}, {sh.city}
                    {sh.km !== undefined ? ` · ${t('prepare.kmAway', { km: sh.km.toFixed(1) })}` : ''}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}
        <Text style={s.note}>{t('prepare.sheltersNote')}</Text>
        {shelters ? <Text style={s.saved}>{saved(shelters.savedAt)} · Miami-Dade Open Data</Text> : null}
        <Button variant="outline" icon="open-outline" label="miamidade.gov/emergency" onPress={() => Linking.openURL(LINKS.countyEmergency)} />
      </Card>

      {/* Air */}
      <Card>
        <View style={s.head}>
          <IconCircle name="leaf-outline" tone="green" size={40} />
          <Text style={s.title}>{t('prepare.air')}</Text>
        </View>
        {air ? (
          <>
            <View style={s.aqiRow}>
              <View style={[s.aqiBadge, { backgroundColor: AQI_COLOR[air.data.category] ?? colors.navy }]}>
                <Text style={s.aqiNum}>{air.data.aqi}</Text>
                <Text style={s.aqiLabel}>AQI</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.zoneValue}>{t(`aqi.${air.data.category}`, { defaultValue: air.data.categoryName })}</Text>
                <Text style={s.note}>
                  {air.data.area} · {air.data.pollutant}
                </Text>
              </View>
            </View>
            {air.data.category >= 3 ? (
              <View style={[s.empty, { backgroundColor: colors.orangeBg, marginTop: 10 }]}>
                <Ionicons name="warning-outline" size={20} color={colors.orange} />
                <Text style={[s.body, { flex: 1 }]}>{t('prepare.airSensitive')}</Text>
              </View>
            ) : null}
            <Text style={s.saved}>{saved(air.savedAt)} · EPA AirNow</Text>
            <Button variant="ghost" icon="open-outline" label="airnow.gov" onPress={() => Linking.openURL('https://www.airnow.gov')} />
          </>
        ) : (
          <Text style={s.body}>{t('prepare.unavailable')}</Text>
        )}
      </Card>

      {/* Tide */}
      <Card>
        <View style={s.head}>
          <IconCircle name="waves" mci tone="blue" size={40} />
          <Text style={s.title}>{t('prepare.tide')}</Text>
        </View>
        {tide?.data ? (
          <Text style={s.tideValue}>
            {when(tide.data.time.replace(' ', 'T'))} · {tide.data.feet} ft
          </Text>
        ) : (
          <Text style={s.body}>{t('prepare.unavailable')}</Text>
        )}
        <Text style={s.note}>{t('prepare.tideNote')} NOAA Tides & Currents.</Text>
      </Card>

      <Disclaimer />
    </Screen>
  );
}

const s = StyleSheet.create({
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 10 },
  zoneBadge: { width: 72, height: 72, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  zoneLetter: { fontSize: 40, fontWeight: '900', color: '#fff' },
  zoneValue: { fontSize: 22, fontWeight: '800', color: colors.text, marginTop: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  title: { flex: 1, fontSize: 18, fontWeight: '800', color: colors.text },
  label: { fontSize: 12, fontWeight: '800', color: colors.muted, letterSpacing: 0.6, textTransform: 'uppercase' },
  body: { fontSize: 16, color: colors.text, lineHeight: 23 },
  note: { fontSize: 13, color: colors.muted, lineHeight: 18, marginTop: 6 },
  saved: { fontSize: 12, color: colors.faint, marginTop: 6 },
  storm: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.navy2, borderRadius: radius.md, padding: 12, marginVertical: 4 },
  stormName: { color: '#fff', fontSize: 16, fontWeight: '800' },
  stormSub: { color: '#C7D4EA', fontSize: 13, marginTop: 2 },
  empty: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colors.purpleBg, borderRadius: radius.md, padding: 12 },
  shelter: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginVertical: 5 },
  shelterName: { fontSize: 16, fontWeight: '700', color: colors.text },
  aqiRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  aqiBadge: { width: 72, height: 72, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  aqiNum: { fontSize: 28, fontWeight: '900', color: '#fff' },
  aqiLabel: { fontSize: 11, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  tideValue: { fontSize: 22, fontWeight: '800', color: colors.blue },
});
