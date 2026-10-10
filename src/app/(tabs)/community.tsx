import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { CityView } from '../../components/CityView';
import { CommunityMap, MapLegend } from '../../components/CommunityMap';
import { colors, soft, radius, tones } from '../../components/theme';
import { Button, Card, Chip, Disclaimer, Field, Screen, SectionTitle } from '../../components/ui';
import {
  BLOOD_TYPES,
  DEFAULT_SETTINGS,
  NEED_FLAGS,
  SKILLS,
  checkInMessage,
  donorRequestMessage,
  findDonors,
  findHelpers,
  findNeighborsToCheck,
  formatKm,
  normalizeBloodType,
  type BloodType,
  type CommunitySettings,
  type Member,
  type NeedFlag,
  type Ranked,
  type Skill,
} from '../../core/community';
import { dialable, findHospitals, fullAddress, type NearHospital } from '../../core/hospitals';
import type { Coords, Lang } from '../../core/types';
import { DEMO_ORIGIN } from '../../data/communitySeed';
import { HOSPITALS } from '../../data/hospitals';
import { call, directions, text as sendText } from '../../services/actions';
import { directory, myRecord } from '../../services/community';
import { config } from '../../services/config';
import { getCoords } from '../../services/location';
import { loadClaimed, loadCommunity, loadShareEmergencies, saveClaimed, saveCommunity, saveShareEmergencies } from '../../services/storage';
import { useApp } from '../../state/AppContext';

type Tab = 'blood' | 'neighbors' | 'city' | 'me';
const TABS: Tab[] = ['blood', 'neighbors', 'city', 'me'];
const isTab = (v: unknown): v is Tab => TABS.includes(v as Tab);

const DONOR_RADIUS_KM = 25;

export default function Community() {
  const { t, i18n } = useTranslation();
  const { profile } = useApp();
  // Deep links for demos and screenshots: aidnow://community?tab=blood&type=O%2B
  const params = useLocalSearchParams<{ tab?: string; type?: string }>();
  const [tab, setTab] = useState<Tab>(isTab(params.tab) ? params.tab : 'blood');
  const [seenTab, setSeenTab] = useState(params.tab);
  if (params.tab !== seenTab) {
    setSeenTab(params.tab);
    if (isTab(params.tab)) setTab(params.tab);
  }
  const [settings, setSettings] = useState<CommunitySettings>(DEFAULT_SETTINGS);
  const [members, setMembers] = useState<Member[]>([]);
  const [gps, setGps] = useState<Coords | null>(null);
  const [claimed, setClaimed] = useState<Record<string, string>>({});

  useEffect(() => {
    loadCommunity().then((c) => c && setSettings({ ...DEFAULT_SETTINGS, ...c }));
    loadClaimed().then(setClaimed);
    directory.members().then(setMembers);
  }, []);

  // Search from the saved address, else GPS (works without data). The sample community lives in Miami, so demo
  // builds without a saved address start in Little Haiti at once, with no GPS wait or permission prompt.
  const saved = profile?.addressCoords;
  useEffect(() => {
    if (!saved && !config.demoMode) getCoords().then(setGps);
  }, [saved]);
  const origin = saved ?? (config.demoMode ? DEMO_ORIGIN : gps);

  if (!profile) return null;
  const lang = profile.language;
  const firstName = profile.fullName.trim().split(/\s+/)[0] || '—';
  const hasSample = members.some((m) => m.sample);

  /** A template in someone else's language: a donor gets the request in their own. */
  const tIn = (l: Lang) => {
    const ft = i18n.getFixedT(l);
    return (k: string, o?: Record<string, unknown>) => ft(k, o) as string;
  };
  const pickLang = (m: Member): Lang => (m.languages.includes(lang) ? lang : m.languages[0]);

  return (
    <Screen title={t('community.title')}>
      {tab === 'blood' || tab === 'neighbors' ? (
        <View style={s.alert}>
          <Ionicons name="warning" size={20} color={colors.red} />
          <Text style={s.alertText}>{t('community.emergencyFirst')}</Text>
        </View>
      ) : null}
      {hasSample ? <Text style={s.sample}>{t('community.sampleNote')}</Text> : null}

      <View style={s.segment}>
        {TABS.map((k) => (
          <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} onPress={() => setTab(k)} style={[s.segItem, tab === k && s.segOn]}>
            <Text style={[s.segText, tab === k && s.segTextOn]} numberOfLines={1}>
              {t(`community.tabs.${k}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'blood' && (
        <BloodTab
          key={params.type ?? ''}
          members={members}
          origin={origin}
          lang={lang}
          initialType={normalizeBloodType(params.type)}
          onAsk={(m, type, hospital) => sendText(m.phone, donorRequestMessage(tIn(pickLang(m)), { requester: firstName, type, hospital }))}
          previewFor={(m, type, hospital) => donorRequestMessage(tIn(pickLang(m)), { requester: firstName, type, hospital })}
        />
      )}
      {tab === 'neighbors' && (
        <NeighborsTab
          members={members}
          origin={origin}
          lang={lang}
          volunteerOn={settings.volunteer && settings.consented}
          claimed={claimed}
          onClaim={async (id) => {
            const next = { ...claimed };
            if (next[id]) delete next[id];
            else next[id] = new Date().toISOString();
            setClaimed(next);
            await saveClaimed(next);
            Haptics.selectionAsync();
          }}
          onText={(m) => sendText(m.phone, checkInMessage(tIn(pickLang(m)), { volunteer: firstName, neighbor: m.name }))}
          onBecomeVolunteer={() => setTab('me')}
        />
      )}
      {tab === 'city' && <CityView />}
      {tab === 'me' && <MyRoleTab settings={settings} setSettings={setSettings} origin={origin} />}
      <Disclaimer />
    </Screen>
  );
}

/* ----------------------------------------------------------------------------------------- */

function BloodTab({
  members,
  origin,
  lang,
  initialType,
  onAsk,
  previewFor,
}: {
  members: Member[];
  origin: Coords | null;
  lang: Lang;
  initialType: BloodType | null;
  onAsk: (m: Member, type: BloodType, hospital: string) => void;
  previewFor: (m: Member, type: BloodType, hospital: string) => string;
}) {
  const { t } = useTranslation();
  const [type, setType] = useState<BloodType | null>(initialType);
  const [hospital, setHospital] = useState('');
  const [searched, setSearched] = useState<BloodType | null>(initialType);

  const results = useMemo(() => (origin && searched ? findDonors(members, searched, origin, DONOR_RADIUS_KM) : []), [members, origin, searched]);
  const view = useViewMode();
  const [sel, setSel] = useState<string | null>(null);
  const hospitals = useMemo(() => (origin ? findHospitals(HOSPITALS, origin) : []), [origin]);
  const selectedHospital = hospitals.find((h) => h.id === sel);
  const selected = selectedHospital ? undefined : (results.find((m) => m.id === sel) ?? results[0]);

  const renderHospital = (h: NearHospital) => (
    <Card key={h.id} style={{ marginBottom: 10 }}>
      <View style={s.cardTop}>
        <View style={[s.avatar, { backgroundColor: tones.green.bg }]}>
          <Ionicons name="medkit" size={22} color={tones.green.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{h.name}</Text>
          <Text style={s.meta}>
            {t('community.away', { km: formatKm(h.km) })} · {h.address}, {h.city}
          </Text>
        </View>
      </View>
      <View style={s.chipRow}>
        <Chip icon={h.emergency ? 'medical' : 'remove-circle-outline'} label={h.emergency ? t('community.hospitals.er') : t('community.hospitals.noEr')} tone={h.emergency ? 'green' : 'neutral'} />
      </View>
      <View style={s.twoBtn}>
        <Button icon="call" label={t('community.hospitals.call', { phone: h.phone })} onPress={() => call(dialable(h.phone))} style={{ flex: 1 }} />
        <Button variant="outline" icon="navigate-outline" label={t('community.hospitals.directions')} onPress={() => directions(fullAddress(h))} />
      </View>
    </Card>
  );

  const renderDonor = (m: Ranked<Member>, needed: BloodType) => (
    <MemberCard key={m.id} m={m} lang={lang}>
      <View style={s.chipRow}>
        <Chip icon="water" label={m.donor!.bloodType} tone="red" />
        <Chip label={m.donor!.bloodType === needed ? t('community.blood.exact') : t('community.blood.compatible')} tone={m.donor!.bloodType === needed ? 'green' : 'blue'} />
      </View>
      <Text style={s.preview}>“{previewFor(m, needed, hospital.trim())}”</Text>
      <Button icon="chatbubble-ellipses-outline" label={t('community.blood.ask')} onPress={() => onAsk(m, needed, hospital.trim())} />
    </MemberCard>
  );

  return (
    <>
      <SectionTitle>{t('community.blood.title')}</SectionTitle>
      <Card>
        <Text style={s.body}>{t('community.blood.intro')}</Text>
        <Text style={s.label}>{t('community.blood.typeNeeded')}</Text>
        <View style={s.pills}>
          {BLOOD_TYPES.map((b) => (
            <Pill key={b} label={b} on={type === b} onPress={() => setType(b)} />
          ))}
        </View>
        <Field label={t('community.blood.hospital')} value={hospital} onChangeText={setHospital} placeholder={t('community.blood.hospitalPlaceholder')} />
        {!origin ? <Text style={s.warn}>{t('community.noLocation')}</Text> : null}
        <Button big icon="search" label={t('community.blood.search')} disabled={!type || !origin} onPress={() => setSearched(type)} />
      </Card>

      {searched ? (
        <>
          <SectionTitle>{t('community.blood.results', { count: results.length, km: DONOR_RADIUS_KM })}</SectionTitle>
          {results.length === 0 ? <Text style={s.body}>{t('community.blood.none')}</Text> : null}
          {results.length > 0 ? <ViewToggle view={view} /> : null}
          {view.mode === 'map' && origin && (selected || selectedHospital) ? (
            <>
              <CommunityMap
                origin={origin}
                points={[
                  ...results.map((m) => ({ id: m.id, coords: m.coords, tone: m.donor!.bloodType === searched ? ('red' as const) : ('blue' as const), icon: 'water' as const })),
                  ...hospitals.map((h) => ({ id: h.id, coords: h.coords, tone: 'green' as const, icon: 'medkit' as const, area: false })),
                ]}
                selectedId={selectedHospital?.id ?? selected?.id ?? null}
                onSelect={setSel}
              />
              <MapLegend items={[{ tone: 'red', label: t('community.blood.exact') }, { tone: 'blue', label: t('community.blood.compatible') }, { tone: 'green', label: t('community.hospitals.legend') }]} />
              {selectedHospital ? renderHospital(selectedHospital) : selected ? renderDonor(selected, searched) : null}
            </>
          ) : (
            results.map((m) => renderDonor(m, searched))
          )}
          <View style={s.safety}>
            <Ionicons name="medkit-outline" size={18} color={colors.green} />
            <Text style={s.safetyText}>
              {t('community.blood.safety')} {t('community.blood.gap')}
            </Text>
          </View>
        </>
      ) : null}

      {hospitals.length > 0 ? (
        <>
          <SectionTitle>{t('community.hospitals.title')}</SectionTitle>
          <Text style={s.body}>{t('community.hospitals.intro')}</Text>
          {hospitals.map(renderHospital)}
          <Text style={s.help}>{t('community.hospitals.source')}</Text>
        </>
      ) : null}
    </>
  );
}

/* ----------------------------------------------------------------------------------------- */

function NeighborsTab({
  members,
  origin,
  lang,
  volunteerOn,
  claimed,
  onClaim,
  onText,
  onBecomeVolunteer,
}: {
  members: Member[];
  origin: Coords | null;
  lang: Lang;
  volunteerOn: boolean;
  claimed: Record<string, string>;
  onClaim: (id: string) => void;
  onText: (m: Member) => void;
  onBecomeVolunteer: () => void;
}) {
  const { t } = useTranslation();
  const [skill, setSkill] = useState<Skill | null>(null);

  const toCheck = useMemo(() => (origin && volunteerOn ? findNeighborsToCheck(members, origin) : []), [members, origin, volunteerOn]);
  const helpers = useMemo(() => (origin ? findHelpers(members, origin, skill) : []), [members, origin, skill]);

  const view = useViewMode();
  const [sel, setSel] = useState<string | null>(null);

  if (!origin) return <Text style={s.warn}>{t('community.noLocation')}</Text>;

  const renderCheck = (m: Ranked<Member>) => (
    <MemberCard key={m.id} m={m} lang={lang}>
      <View style={s.chipRow}>
        {m.needsCheckIn!.flags.map((f) => (
          <Chip key={f} label={t(`community.needs.${f}`)} tone={f === 'oxygen' || f === 'mobility' ? 'red' : 'amber'} />
        ))}
      </View>
      <View style={s.twoBtn}>
        <Button
          variant={claimed[m.id] ? 'plain' : 'navy'}
          icon={claimed[m.id] ? 'checkmark-circle' : 'hand-left-outline'}
          label={claimed[m.id] ? t('community.neighbors.claimed') : t('community.neighbors.claim')}
          onPress={() => onClaim(m.id)}
          style={{ flex: 1 }}
        />
        <Button variant="outline" icon="chatbubble-ellipses-outline" label={t('community.text')} onPress={() => onText(m)} />
      </View>
    </MemberCard>
  );

  const renderHelper = (m: Ranked<Member>) => (
    <MemberCard key={m.id} m={m} lang={lang}>
      <View style={s.chipRow}>
        <Chip icon={m.kind === 'org' ? 'business-outline' : 'person-outline'} label={m.kind === 'org' ? t('community.neighbors.group') : t('community.neighbors.volunteer')} tone="purple" />
        {m.volunteer!.skills.map((k) => (
          <Chip key={k} label={t(`community.skills.${k}`)} tone="blue" />
        ))}
      </View>
    </MemberCard>
  );

  const safety = (
    <View style={s.safety}>
      <Ionicons name="shield-checkmark-outline" size={18} color={colors.green} />
      <Text style={s.safetyText}>{t('community.neighbors.safetyNote')}</Text>
    </View>
  );

  const mapPoints = [
    ...toCheck.map((m) => ({ id: m.id, coords: m.coords, tone: 'red' as const, icon: 'heart' as const })),
    ...helpers
      .filter((h) => !toCheck.some((c) => c.id === h.id))
      .map((m) => ({ id: m.id, coords: m.coords, tone: 'purple' as const, icon: m.kind === 'org' ? ('business' as const) : ('hand-left' as const) })),
  ];
  const selectedPoint = (toCheck.find((m) => m.id === sel) ?? helpers.find((m) => m.id === sel) ?? toCheck[0] ?? helpers[0]) as Ranked<Member> | undefined;
  const showMap = view.mode === 'map' && mapPoints.length > 0 && !!selectedPoint;

  return (
    <>
      <SectionTitle>{t('community.neighbors.title')}</SectionTitle>
      <Text style={s.body}>{t('community.neighbors.intro')}</Text>
      {!volunteerOn ? (
        <Card>
          <Text style={s.body}>{t('community.me.volunteerSub')}</Text>
          <Button icon="hand-left-outline" label={t('community.me.volunteer')} onPress={onBecomeVolunteer} />
        </Card>
      ) : null}

      <View style={s.pills}>
        <Pill label={t('community.neighbors.anySkill')} on={skill === null} onPress={() => setSkill(null)} />
        {SKILLS.map((k) => (
          <Pill key={k} label={t(`community.skills.${k}`)} on={skill === k} onPress={() => setSkill(k)} />
        ))}
      </View>

      <ViewToggle view={view} />

      {showMap ? (
        <>
          <CommunityMap origin={origin} points={mapPoints} selectedId={selectedPoint!.id} onSelect={setSel} />
          <MapLegend items={[...(volunteerOn ? [{ tone: 'red' as const, label: t('community.view.checkIn') }] : []), { tone: 'purple', label: t('community.view.helper') }]} />
          {selectedPoint!.needsCheckIn && volunteerOn ? renderCheck(selectedPoint!) : renderHelper(selectedPoint!)}
          {volunteerOn ? safety : null}
        </>
      ) : (
        <>
          {volunteerOn ? (
            <>
              {toCheck.length === 0 ? <Text style={s.body}>{t('community.neighbors.none')}</Text> : null}
              {toCheck.map(renderCheck)}
              {safety}
            </>
          ) : null}
          <SectionTitle>{t('community.neighbors.helpers')}</SectionTitle>
          {helpers.length === 0 ? <Text style={s.body}>{t('community.neighbors.helpersNone')}</Text> : null}
          {helpers.map(renderHelper)}
        </>
      )}
    </>
  );
}

/* ----------------------------------------------------------------------------------------- */

function MyRoleTab({ settings, setSettings, origin }: { settings: CommunitySettings; setSettings: (s: CommunitySettings) => void; origin: Coords | null }) {
  const { t } = useTranslation();
  const { profile } = useApp();
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [shareEmergencies, setShareEmergencies] = useState(true);
  useEffect(() => {
    loadShareEmergencies().then(setShareEmergencies);
  }, []);
  if (!profile) return null;

  const bloodType = normalizeBloodType(profile.bloodType);
  const set = (patch: Partial<CommunitySettings>) => {
    setSaved(false);
    setSettings({ ...settings, ...patch });
  };
  const toggle = <K extends Skill | NeedFlag>(list: K[], k: K) => (list.includes(k) ? list.filter((x) => x !== k) : [...list, k]);
  const record = myRecord(profile, settings, origin, bloodType);
  const anyRole = settings.donor || settings.volunteer || settings.needsCheckIn;

  const save = async (next: CommunitySettings) => {
    setSaving(true);
    await saveCommunity(next);
    await directory.publish(myRecord(profile, next, origin, bloodType));
    setSettings(next);
    setSaving(false);
    setSaved(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  return (
    <>
      <Text style={s.body}>{t('community.me.intro')}</Text>

      <Card color={colors.greenBg}>
        <View style={s.row}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.green} />
          <Text style={s.privacyTitle}>{t('community.me.privacyTitle')}</Text>
        </View>
        <Text style={s.body}>{t('community.me.privacyBody')}</Text>
        <ToggleRow label={t('community.me.consent')} value={settings.consented} onChange={(v) => set({ consented: v })} />
      </Card>

      <Card>
        <ToggleRow
          label={t('community.me.shareEmergency')}
          sub={t('community.me.shareEmergencySub')}
          value={shareEmergencies}
          onChange={(v) => {
            setShareEmergencies(v);
            saveShareEmergencies(v);
          }}
        />
      </Card>

      <Card>
        <Field label={t('community.me.phone')} help={t('community.me.phoneHelp')} value={settings.phone} onChangeText={(v) => set({ phone: v })} keyboardType="phone-pad" />

        <ToggleRow label={t('community.me.donor')} sub={t('community.me.donorSub')} value={settings.donor} disabled={!bloodType} onChange={(v) => set({ donor: v })} />
        {!bloodType ? (
          <Pressable onPress={() => router.push('/profile')}>
            <Text style={s.link}>{t('community.me.needType')}</Text>
          </Pressable>
        ) : settings.donor ? (
          <View style={s.indent}>
            <Text style={s.help}>{t('community.me.yourType', { type: bloodType })}</Text>
            <ToggleRow label={t('community.me.available')} value={settings.donorAvailable} onChange={(v) => set({ donorAvailable: v })} />
            <Field label={t('community.me.lastDonation')} value={settings.lastDonation ?? ''} onChangeText={(v) => set({ lastDonation: v || undefined })} placeholder="2026-05-02" />
          </View>
        ) : null}

        <ToggleRow label={t('community.me.volunteer')} sub={t('community.me.volunteerSub')} value={settings.volunteer} onChange={(v) => set({ volunteer: v })} />
        {settings.volunteer ? (
          <View style={s.indent}>
            <Text style={s.label}>{t('community.me.skills')}</Text>
            <View style={s.pills}>
              {SKILLS.map((k) => (
                <Pill key={k} label={t(`community.skills.${k}`)} on={settings.skills.includes(k)} onPress={() => set({ skills: toggle(settings.skills, k) })} />
              ))}
            </View>
            <ToggleRow label={t('community.me.alerts')} sub={t('community.me.alertsSub')} value={settings.receiveAlerts} onChange={(v) => set({ receiveAlerts: v })} />
          </View>
        ) : null}

        <ToggleRow label={t('community.me.checkIn')} sub={t('community.me.checkInSub')} value={settings.needsCheckIn} onChange={(v) => set({ needsCheckIn: v })} />
        {settings.needsCheckIn ? (
          <View style={s.indent}>
            <Text style={s.label}>{t('community.me.needs')}</Text>
            <View style={s.pills}>
              {NEED_FLAGS.map((k) => (
                <Pill key={k} label={t(`community.needs.${k}`)} on={settings.needFlags.includes(k)} onPress={() => set({ needFlags: toggle(settings.needFlags, k) })} />
              ))}
            </View>
          </View>
        ) : null}
      </Card>

      {record ? (
        <Text style={s.help}>{t('community.me.visible', { name: record.name })}</Text>
      ) : (
        <Text style={s.help}>{anyRole && !origin ? t('community.me.needLocation') : t('community.me.hidden')}</Text>
      )}

      <Button big icon={saved ? 'checkmark' : 'save-outline'} label={saved ? t('community.me.saved') : t('community.me.save')} onPress={() => save(settings)} loading={saving} />
      {settings.consented || anyRole ? (
        <Button variant="ghost" icon="eye-off-outline" label={t('community.me.withdraw')} onPress={() => save({ ...DEFAULT_SETTINGS, phone: settings.phone })} />
      ) : null}
    </>
  );
}

/* ----------------------------------------------------------------------------------------- */

function MemberCard({ m, lang, children }: { m: Ranked<Member>; lang: Lang; children?: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <Card style={{ marginBottom: 10 }}>
      <View style={s.cardTop}>
        <View style={[s.avatar, { backgroundColor: m.kind === 'org' ? tones.purple.bg : tones.blue.bg }]}>
          <Ionicons name={m.kind === 'org' ? 'business' : 'person'} size={22} color={m.kind === 'org' ? tones.purple.fg : tones.blue.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.name}>{m.name}</Text>
          <Text style={s.meta}>
            {t('community.away', { km: formatKm(m.km) })}
            {m.languages.includes(lang) && lang !== 'en' ? ` · ${t('community.speaksYours')}` : ''}
          </Text>
        </View>
      </View>
      {children}
    </Card>
  );
}

type ViewMode = { mode: 'map' | 'list'; pref: 'map' | 'list'; setPref: (v: 'map' | 'list') => void; online: boolean };

/** The map needs internet for its tiles; offline, it falls back to the list, which always works. */
function useViewMode(): ViewMode {
  const { online } = useApp();
  const [pref, setPref] = useState<'map' | 'list'>('map');
  return { mode: online ? pref : 'list', pref, setPref, online };
}

function ViewToggle({ view }: { view: ViewMode }) {
  const { t } = useTranslation();
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={s.segment}>
        {(['map', 'list'] as const).map((k) => (
          <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: view.mode === k, disabled: k === 'map' && !view.online }} disabled={k === 'map' && !view.online} onPress={() => view.setPref(k)} style={[s.segItem, view.mode === k && s.segOn, k === 'map' && !view.online && { opacity: 0.4 }]}>
            <Text style={[s.segText, view.mode === k && s.segTextOn]}>{t(`community.view.${k}`)}</Text>
          </Pressable>
        ))}
      </View>
      {!view.online ? <Text style={s.help}>{t('community.view.offline')}</Text> : null}
    </View>
  );
}

function Pill({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={[s.pill, on && s.pillOn]}>
      <Text style={[s.pillText, on && s.pillTextOn]}>{label}</Text>
    </Pressable>
  );
}

function ToggleRow({ label, sub, value, onChange, disabled }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={[s.toggle, disabled && { opacity: 0.5 }]}>
      <View style={{ flex: 1 }}>
        <Text style={s.toggleLabel}>{label}</Text>
        {sub ? <Text style={s.help}>{sub}</Text> : null}
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} accessibilityLabel={label} />
    </View>
  );
}

const s = StyleSheet.create({
  alert: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colors.redBg, borderRadius: radius.md, padding: 12, marginTop: 4 },
  alertText: { flex: 1, fontSize: 15, fontWeight: '700', color: colors.redDark, lineHeight: 20 },
  sample: { fontSize: 13, fontWeight: '700', color: colors.amber, backgroundColor: colors.amberBg, borderRadius: radius.sm, padding: 8, marginTop: 8 },
  segment: { flexDirection: 'row', backgroundColor: '#E4E9F0', borderRadius: radius.md, padding: 4, marginTop: 12, marginBottom: 2 },
  segItem: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  segOn: { backgroundColor: colors.card },
  segText: { fontSize: 14, fontWeight: '700', color: colors.muted },
  segTextOn: { color: colors.navy },
  body: { fontSize: 15, color: colors.text, lineHeight: 21, marginBottom: 10 },
  label: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 8, marginTop: 4 },
  help: { fontSize: 13, color: colors.muted, lineHeight: 18, marginVertical: 4 },
  warn: { fontSize: 14, color: colors.amber, fontWeight: '600', marginBottom: 10 },
  link: { fontSize: 14, color: colors.brand, fontWeight: '700', marginBottom: 12 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  pill: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.card },
  pillOn: { backgroundColor: soft.blue.bg, borderColor: soft.blue.border },
  pillText: { fontSize: 15, fontWeight: '700', color: colors.text },
  pillTextOn: { color: colors.brand },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 18, fontWeight: '800', color: colors.text },
  meta: { fontSize: 13, color: colors.muted, marginTop: 1 },
  preview: { fontSize: 13, color: colors.muted, fontStyle: 'italic', lineHeight: 18, marginVertical: 8 },
  twoBtn: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  safety: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colors.greenBg, borderRadius: radius.md, padding: 12, marginTop: 4 },
  safetyText: { flex: 1, fontSize: 13, color: colors.text, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  privacyTitle: { fontSize: 16, fontWeight: '800', color: colors.green },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  toggleLabel: { fontSize: 16, fontWeight: '700', color: colors.text },
  indent: { marginLeft: 8, paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: colors.border, marginBottom: 6 },
});
