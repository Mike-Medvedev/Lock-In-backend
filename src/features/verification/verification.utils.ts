/**
 * Math and geo utilities for the verification engine.
 */

const EARTH_RADIUS_METERS = 6_371_000;

/** Haversine distance between two lat/lng points, in meters. */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Convert meters to miles. */
export function metersToMiles(m: number): number {
  return m / 1_609.344;
}

/** Convert meters/second to miles/hour. */
export function mpsToMph(mps: number): number {
  return mps * 2.23694;
}

/** Acceleration magnitude from x, y, z components (m/s²). */
export function accelMagnitude(x: number, y: number, z: number): number {
  return Math.sqrt(x * x + y * y + z * z);
}

/** Root mean square of a numeric array. Returns 0 for empty arrays. */
export function rms(values: number[]): number {
  if (values.length === 0) return 0;
  const sumSq = values.reduce((acc, v) => acc + v * v, 0);
  return Math.sqrt(sumSq / values.length);
}

/** Sort any array of objects by a Date field, ascending. */
export function sortByTime<T extends { capturedAt: Date }>(samples: T[]): T[] {
  return [...samples].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
}
