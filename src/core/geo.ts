import type { Coords } from './types';

type Ring = number[][]; // [lon, lat]
type Geometry = { type: 'Polygon'; coordinates: Ring[] } | { type: 'MultiPolygon'; coordinates: Ring[][] };
export type ZoneCollection = { features: { properties: { ZONEID: string }; geometry: Geometry }[] };

function inRing([x, y]: [number, number], ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inPolygon(p: [number, number], rings: Ring[]): boolean {
  return inRing(p, rings[0]) && !rings.slice(1).some((hole) => inRing(p, hole));
}

/**
 * Storm Surge Planning Zone (A–E) for a point, from the County's polygons cached on the phone.
 * Returns null outside every zone polygon, and "N" where the County marks no zone.
 */
export function zoneAt(c: Coords, zones: ZoneCollection): string | null {
  const p: [number, number] = [c.lon, c.lat];
  for (const f of zones.features) {
    const g = f.geometry;
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    if (polys.some((rings) => inPolygon(p, rings))) return f.properties.ZONEID;
  }
  return null;
}

/** Straight-line distance in km. Offline there is no road routing. */
export function distanceKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lon - a.lon) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
