import { distanceKm, zoneAt, type ZoneCollection } from '../core/geo';
import { summarizeAirNow, type AirQuality } from '../core/airQuality';
import type { Coords } from '../core/types';

export type { AirQuality };
import zones from '../data/zones.json';
import { config } from './config';
import { readCache, writeCache, type Cached } from './storage';

/**
 * Miami data layer. Zones are bundled with the app; shelters, tides and advisories are fetched
 * when online and cached on the phone for offline use. Sources are listed in the README.
 */

/** Miami-Dade Storm Surge Planning Zones (Open Data Hub, MD_Apps "StormSurgePlanningZone_Multipart"), simplified. */
export function zoneFor(c: Coords): string | null {
  return zoneAt(c, zones as unknown as ZoneCollection);
}

export type Shelter = {
  name: string;
  address: string;
  city: string;
  status: string;
  type: string;
  petFriendly: boolean;
  lat: number;
  lon: number;
  km?: number;
};

const ARCGIS = 'https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services';
/** The County's live list of open evacuation centers. Empty outside activations. */
const OPEN_SHELTERS = `${ARCGIS}/EvacuationCenterShelters_Open/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson`;

type OpenShelterFeature = {
  geometry: { coordinates: [number, number] } | null;
  properties: Record<string, string | number | null>;
};

export async function refreshShelters(): Promise<void> {
  const res = await fetch(OPEN_SHELTERS);
  if (!res.ok) throw new Error(`shelters ${res.status}`);
  const json = (await res.json()) as { features: OpenShelterFeature[] };
  const list: Shelter[] = json.features
    .filter((f) => f.geometry && String(f.properties.delete_shelter ?? '').toLowerCase() !== 'yes')
    .map((f) => ({
      name: String(f.properties.shelter_name ?? ''),
      address: String(f.properties.address ?? ''),
      city: String(f.properties.city ?? ''),
      status: String(f.properties.shelter_status ?? ''),
      type: String(f.properties.shelter_type ?? ''),
      petFriendly: /^(y|yes|true)$/i.test(String(f.properties.petfriendly ?? '')),
      lon: f.geometry!.coordinates[0],
      lat: f.geometry!.coordinates[1],
    }));
  await writeCache('shelters', list);
}

export async function nearestShelters(from: Coords | null, n = 3): Promise<Cached<Shelter[]> | null> {
  const cached = await readCache<Shelter[]>('shelters');
  if (!cached) return null;
  const data = from
    ? cached.data.map((s) => ({ ...s, km: distanceKm(from, s) })).sort((a, b) => a.km! - b.km!).slice(0, n)
    : cached.data.slice(0, n);
  return { ...cached, data };
}

export type Tide = { time: string; feet: string };

/** NOAA CO-OPS high/low predictions, Virginia Key (8723214). Astronomical only, not a flood forecast. */
export async function refreshTides(): Promise<void> {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const url =
    'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?product=predictions&station=8723214&datum=MLLW' +
    `&time_zone=lst_ldt&units=english&interval=hilo&format=json&begin_date=${ymd}&range=72&application=AidNow`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`tides ${res.status}`);
  const json = (await res.json()) as { predictions?: { t: string; v: string; type: string }[] };
  const highs = (json.predictions ?? []).filter((p) => p.type === 'H').map((p) => ({ time: p.t, feet: p.v }));
  await writeCache('tides', highs);
}

export async function nextHighTide(): Promise<Cached<Tide | null> | null> {
  const cached = await readCache<Tide[]>('tides');
  if (!cached) return null;
  // NOAA times are local station time ("YYYY-MM-DD HH:mm"), same as the phone's in Miami.
  const now = Date.now();
  const next = cached.data.find((t) => new Date(t.time.replace(' ', 'T')).getTime() > now) ?? null;
  return { ...cached, data: next };
}

export type Storm = { name: string; classification: string; intensityKt: string; advisoryUrl: string };

/** National Hurricane Center active storms. */
export async function refreshAdvisories(): Promise<void> {
  const res = await fetch('https://www.nhc.noaa.gov/CurrentStorms.json');
  if (!res.ok) throw new Error(`nhc ${res.status}`);
  const json = (await res.json()) as {
    activeStorms?: { name: string; classification: string; intensity: string; id: string; publicAdvisory?: { url: string } }[];
  };
  const atlantic = (json.activeStorms ?? [])
    .filter((s) => s.id.startsWith('al'))
    .map((s) => ({ name: s.name, classification: s.classification, intensityKt: s.intensity, advisoryUrl: s.publicAdvisory?.url ?? '' }));
  await writeCache('advisories', atlantic);
}

export const cachedAdvisories = () => readCache<Storm[]>('advisories');

/** Miami center, used when we have no location. */
const MIAMI: Coords = { lat: 25.7743, lon: -80.1904 };

/**
 * EPA AirNow current observations near the resident. Uses /aq/observation/current/ziplatlong/; the old
 * /aq/observation/latLong/current/ path answers HTTP 410 "retired as of October 1, 2026".
 */
export async function refreshAirQuality(at: Coords | null): Promise<void> {
  if (!config.airNowApiKey) return;
  const c = at ?? MIAMI;
  const url =
    'https://www.airnowapi.org/aq/observation/current/ziplatlong/?format=application/json' +
    `&latitude=${c.lat.toFixed(4)}&longitude=${c.lon.toFixed(4)}&distance=50&API_KEY=${encodeURIComponent(config.airNowApiKey)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`airnow ${res.status}`);
  const summary = summarizeAirNow(await res.json());
  if (summary) await writeCache<AirQuality>('air', summary);
}

export const cachedAirQuality = () => readCache<AirQuality>('air');

/** Refresh everything we can while online. Failures keep the last saved copy. */
export async function refreshCountyData(at: Coords | null = null): Promise<void> {
  await Promise.allSettled([refreshShelters(), refreshTides(), refreshAdvisories(), refreshAirQuality(at)]);
}
