import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { aggregate, MIN_COUNT, MIN_FOR_BREAKDOWN, REPORT_SITUATIONS, type AreaStat, type ReportEvent, type ReportSituation } from '../core/reports';
import { quickCoords } from '../services/notify';
import { areaFor, feed, submitReport, type ReportResult } from '../services/reports';
import { useApp } from '../state/AppContext';
import { HeatMap } from './HeatMap';
import { colors, radius, shadow } from './theme';
import { Button, Card, Chip, SectionTitle } from './ui';

const WINDOWS = [6, 24, 48];
type IonName = ComponentProps<typeof Ionicons>['name'];
const ICON: Record<ReportSituation, IonName> = {
  street_hazard: 'water-outline',
  power_outage: 'flash-off-outline',
  downed_line: 'warning-outline',
  need_shelter: 'home-outline',
  need_supplies: 'basket-outline',
  medical_device: 'medkit-outline',
};

/**
 * What residents are reporting to 311, FPL and 211, by ZIP code, and a way to report a problem. Nothing to filter:
 * the view works out what is going on and where. Areas with fewer than 3 reports are hidden, and the breakdown by
 * problem needs 10. Tapping Report counts the problem anonymously and contacts no one.
 */
export function CityView() {
  const { t } = useTranslation();
  const { profile, online } = useApp();
  const [events, setEvents] = useState<ReportEvent[]>([]);
  const [now, setNow] = useState(() => new Date());
  const [hours, setHours] = useState(24);
  const [mode, setMode] = useState<'map' | 'list'>('map');
  const [picked, setPicked] = useState<string | null>(null);
  const [issue, setIssue] = useState<ReportSituation | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<{ result: ReportResult; zip: string | null } | null>(null);

  useEffect(() => {
    feed.events(now).then(setEvents);
  }, [now]);

  const summary = useMemo(() => aggregate(events, { hours, now }), [events, hours, now]);
  const myZip = profile ? areaFor(profile.addressCoords, profile.address) : null;
  const mine = summary.areas.find((a) => a.zip === myZip);
  const view = online ? mode : 'list';
  const selected = summary.areas.find((a) => a.zip === picked) ?? summary.areas[0];
  const lead = summary.problems[0];
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  // Counts the problem for the resident's ZIP code. Tapping Report is their choice to be counted, and it contacts no one.
  const report = async () => {
    if (!issue || sending) return;
    setSending(true);
    setOutcome(null);
    const address = profile?.address ?? '';
    // A saved address or location is enough. Without one, ask for a quick GPS fix now, because they asked to report.
    const coords = profile?.addressCoords ?? (areaFor(null, address) ? null : await quickCoords());
    const result = await submitReport({ situation: issue, coords, address });
    setOutcome({ result, zip: areaFor(coords, address) });
    if (result === 'counted') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setIssue(null);
      setNow(new Date()); // reload, so the new report shows in the totals below
    }
    setSending(false);
  };

  const areaCard = (a: AreaStat) => (
    <Card key={a.zip} style={{ marginBottom: 10 }}>
      <View style={s.areaTop}>
        <Text style={s.zip}>{a.zip}</Text>
        <Text style={s.count}>{t('city.reports', { count: a.total })}</Text>
      </View>
      {myZip === a.zip ? (
        <View style={s.chipRow}>
          <Chip icon="navigate-outline" label={t('city.yourArea')} tone="blue" />
        </View>
      ) : null}
      {a.problems ? (
        <View style={s.chipRow}>
          {a.problems.slice(0, 3).map((p) => (
            <Chip key={p.situation} icon={ICON[p.situation]} label={`${t(`city.situations.${p.situation}`)} · ${p.count}`} tone="red" />
          ))}
        </View>
      ) : (
        <Text style={s.small}>{t('city.breakdownHidden', { count: MIN_FOR_BREAKDOWN })}</Text>
      )}
    </Card>
  );

  return (
    <>
      <Card>
        <Text style={s.cardTitle}>{t('city.report.title')}</Text>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: menuOpen }} accessibilityLabel={t('city.report.choose')} onPress={() => setMenuOpen(!menuOpen)} style={s.dropdown}>
          {issue ? <Ionicons name={ICON[issue]} size={20} color={colors.red} /> : null}
          <Text style={[s.dropdownText, !issue && { color: colors.faint }]}>{issue ? t(`city.situations.${issue}`) : t('city.report.choose')}</Text>
          <Ionicons name={menuOpen ? 'chevron-up' : 'chevron-down'} size={20} color={colors.muted} />
        </Pressable>
        {menuOpen ? (
          <View style={s.menu}>
            {REPORT_SITUATIONS.map((k) => (
              <Pressable
                key={k}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: issue === k }}
                onPress={() => {
                  setIssue(k);
                  setMenuOpen(false);
                }}
                style={({ pressed }) => [s.menuItem, issue === k && s.menuItemOn, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name={ICON[k]} size={20} color={colors.red} />
                <Text style={s.menuText}>{t(`city.situations.${k}`)}</Text>
                {issue === k ? <Ionicons name="checkmark" size={20} color={colors.navy} /> : null}
              </Pressable>
            ))}
          </View>
        ) : null}
        <Button icon="paper-plane-outline" label={t('city.report.go')} onPress={report} disabled={!issue} loading={sending} style={{ marginTop: 12 }} />
        <Text style={s.small}>{t('city.report.privacy')}</Text>
        {outcome ? (
          <View style={[s.outcome, outcome.result === 'counted' ? s.outcomeOk : s.outcomeWarn]}>
            <Ionicons name={outcome.result === 'counted' ? 'checkmark-circle' : 'information-circle-outline'} size={20} color={outcome.result === 'counted' ? colors.green : colors.amber} />
            <Text style={[s.outcomeText, outcome.result !== 'counted' && { color: colors.amber }]}>
              {outcome.result === 'counted' ? t('city.report.sent', { zip: outcome.zip }) : outcome.result === 'already' ? t('city.report.already') : t('city.report.noArea')}
            </Text>
          </View>
        ) : null}
      </Card>

      <SectionTitle>{t('city.happening')}</SectionTitle>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.pills}>
        {WINDOWS.map((h) => (
          <Pressable key={h} accessibilityRole="button" accessibilityState={{ selected: hours === h }} onPress={() => setHours(h)} style={[s.pill, hours === h && s.pillOn]}>
            <Text style={[s.pillText, hours === h && s.pillTextOn]}>{t('city.hours', { count: h })}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={s.tiles}>
        <View style={s.tile}>
          <Text style={s.tileNum}>{summary.total}</Text>
          <Text style={s.tileLabel}>{t('city.total')}</Text>
        </View>
        <View style={s.tile}>
          <Text style={[s.tileNum, { color: colors.navy }]}>{summary.areas.length}</Text>
          <Text style={s.tileLabel}>{t('city.areasTile')}</Text>
        </View>
      </View>

      {mine ? (
        <View style={s.near}>
          <Ionicons name="navigate" size={20} color={colors.blue} />
          <Text style={s.nearText}>{t('city.near', { zip: mine.zip, count: mine.total, hours })}</Text>
        </View>
      ) : null}

      {lead ? (
        <>
          <Text style={s.lead}>{t('city.mostReported', { problem: t(`city.situations.${lead.situation}`), percent: pct(lead.share) })}</Text>
          {summary.problems.slice(0, 4).map((p) => (
            <View key={p.situation} style={s.problem}>
              <View style={s.problemIcon}>
                <Ionicons name={ICON[p.situation]} size={22} color={colors.red} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={s.problemTop}>
                  <Text style={s.problemName}>{t(`city.situations.${p.situation}`)}</Text>
                  <Text style={s.problemCount}>{p.count}</Text>
                </View>
                <View style={s.track}>
                  <View style={[s.fill, { width: `${Math.max(4, Math.round((p.count / lead.count) * 100))}%` }]} />
                </View>
              </View>
            </View>
          ))}
        </>
      ) : (
        <Text style={s.small}>{t('city.none')}</Text>
      )}

      {summary.areas.length > 0 ? (
        <>
          <SectionTitle>{t('city.areas')}</SectionTitle>
          <View style={s.segment}>
            {(['map', 'list'] as const).map((k) => (
              <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: view === k, disabled: k === 'map' && !online }} disabled={k === 'map' && !online} onPress={() => setMode(k)} style={[s.segItem, view === k && s.segOn, k === 'map' && !online && { opacity: 0.4 }]}>
                <Text style={[s.segText, view === k && s.segTextOn]}>{t(`community.view.${k}`)}</Text>
              </Pressable>
            ))}
          </View>
          {!online ? <Text style={s.small}>{t('community.view.offline')}</Text> : null}

          {view === 'map' && selected ? (
            <>
              <HeatMap areas={summary.areas} selected={selected.zip} onSelect={setPicked} />
              <Text style={s.small}>{t('city.mapNote')}</Text>
              {areaCard(selected)}
            </>
          ) : (
            summary.areas.slice(0, 12).map(areaCard)
          )}
        </>
      ) : null}

      {summary.hiddenAreas > 0 ? <Text style={s.small}>{t('city.hiddenAreas', { count: summary.hiddenAreas, min: MIN_COUNT })}</Text> : null}
    </>
  );
}

const s = StyleSheet.create({
  cardTitle: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 10 },
  dropdown: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.inputBorder, backgroundColor: colors.inputBg },
  dropdownText: { flex: 1, fontSize: 17, fontWeight: '600', color: colors.text },
  menu: { marginTop: 6, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, overflow: 'hidden', backgroundColor: colors.card },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  menuItemOn: { backgroundColor: colors.blueBg },
  menuText: { flex: 1, fontSize: 16, color: colors.text },
  outcome: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: radius.md, padding: 12, marginTop: 10 },
  outcomeOk: { backgroundColor: colors.greenBg },
  outcomeWarn: { backgroundColor: colors.amberBg },
  outcomeText: { flex: 1, fontSize: 14, fontWeight: '700', color: colors.green, lineHeight: 19 },
  pills: { flexDirection: 'row', gap: 8, paddingRight: 16 },
  pill: { paddingVertical: 8, paddingHorizontal: 13, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  pillOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  pillText: { fontSize: 14, fontWeight: '700', color: colors.text },
  pillTextOn: { color: '#fff' },
  tiles: { flexDirection: 'row', gap: 10, marginTop: 12 },
  tile: { flex: 1, backgroundColor: colors.card, borderRadius: radius.lg, padding: 14, ...shadow },
  tileNum: { fontSize: 30, fontWeight: '900', color: colors.red, letterSpacing: -1 },
  tileLabel: { fontSize: 13, fontWeight: '700', color: colors.muted, marginTop: 2 },
  near: { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: colors.blueBg, borderRadius: radius.md, padding: 12, marginTop: 12 },
  nearText: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.text },
  lead: { fontSize: 18, fontWeight: '800', color: colors.text, lineHeight: 25, marginTop: 16, marginBottom: 12 },
  problem: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  problemIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.redBg, alignItems: 'center', justifyContent: 'center' },
  problemTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  problemName: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  problemCount: { fontSize: 18, fontWeight: '900', color: colors.red },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.subtle, marginTop: 6, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.red },
  segment: { flexDirection: 'row', backgroundColor: '#E4E9F0', borderRadius: radius.md, padding: 4, marginBottom: 10 },
  segItem: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  segOn: { backgroundColor: colors.card },
  segText: { fontSize: 16, fontWeight: '700', color: colors.muted },
  segTextOn: { color: colors.navy },
  areaTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  zip: { fontSize: 24, fontWeight: '900', color: colors.text },
  count: { fontSize: 16, fontWeight: '800', color: colors.red },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  small: { fontSize: 13, color: colors.muted, lineHeight: 18, marginVertical: 8 },
});
