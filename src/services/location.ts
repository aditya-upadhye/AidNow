import * as Location from 'expo-location';

import type { Coords } from '../core/types';

/** GPS works without mobile data. Returns null if permission is denied or no fix arrives in time. */
export async function getCoords(timeoutMs = 8000): Promise<Coords | null> {
  try {
    const { granted } = await Location.requestForegroundPermissionsAsync();
    if (!granted) return null;
    const last = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000 });
    if (last) return { lat: last.coords.latitude, lon: last.coords.longitude };
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((r) => setTimeout(() => r(null), timeoutMs)),
    ]);
    return pos ? { lat: pos.coords.latitude, lon: pos.coords.longitude } : null;
  } catch {
    return null;
  }
}

/** Address to coordinates, for the zone lookup. Needs a connection; done once when the profile is saved. */
export async function geocode(address: string): Promise<Coords | null> {
  try {
    const results = await Location.geocodeAsync(address);
    return results[0] ? { lat: results[0].latitude, lon: results[0].longitude } : null;
  } catch {
    return null;
  }
}
