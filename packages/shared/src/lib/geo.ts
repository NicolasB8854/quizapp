/**
 * Geo-Helfer für „Wo liegt das?": Kartenprojektion, Entfernung, Punkte.
 *
 * Die Weltkarte (`public/img/geo/world.svg`, gebaut von scripts/build-world-map.py)
 * ist plattkartisch: x = (lon + 180) · S, y = (LAT_TOP − lat) · S.
 */

export const MAP_SCALE = 4
export const MAP_LAT_TOP = 85
export const MAP_LAT_BOTTOM = -60
export const MAP_WIDTH = 360 * MAP_SCALE
export const MAP_HEIGHT = (MAP_LAT_TOP - MAP_LAT_BOTTOM) * MAP_SCALE

export interface LatLon {
  lat: number
  lon: number
}

export function toMap({ lat, lon }: LatLon): { x: number; y: number } {
  return { x: (lon + 180) * MAP_SCALE, y: (MAP_LAT_TOP - lat) * MAP_SCALE }
}

export function fromMap(x: number, y: number): LatLon {
  return clampLatLon({ lon: x / MAP_SCALE - 180, lat: MAP_LAT_TOP - y / MAP_SCALE })
}

export function clampLatLon(p: LatLon): LatLon {
  const lat = Math.min(90, Math.max(-90, p.lat))
  let lon = ((((p.lon + 180) % 360) + 360) % 360) - 180
  if (lon === -180 && p.lon > 0) lon = 180
  return { lat: Math.round(lat * 1000) / 1000, lon: Math.round(lon * 1000) / 1000 }
}

export function isValidLatLon(p: unknown): p is LatLon {
  if (!p || typeof p !== 'object') return false
  const { lat, lon } = p as Record<string, unknown>
  return (
    typeof lat === 'number' && typeof lon === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
  )
}

/** Großkreis-Entfernung in km (Haversine, Erdradius 6371 km). */
export function distanceKm(a: LatLon, b: LatLon): number {
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLon = (b.lon - a.lon) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)))
}

/** Punkte nach Entfernung: < 100 km 300, < 500 km 200, < 1500 km 100, sonst 0. */
export function geoPoints(km: number): number {
  if (km < 100) return 300
  if (km < 500) return 200
  if (km < 1500) return 100
  return 0
}

/** Bonus für das Team, das am nächsten dran ist (Rundensieg). */
export const GEO_CLOSEST_BONUS = 100

export function formatKm(km: number): string {
  if (km < 10) return `${km.toFixed(1).replace('.', ',')} km`
  return `${Math.round(km).toLocaleString('de-DE')} km`
}
