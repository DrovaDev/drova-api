const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculates the great-circle distance between two points using the Haversine formula.
 * @param from [longitude, latitude]
 * @param to   [longitude, latitude]
 * @returns distance in kilometers
 */
export function haversineDistanceKm(
  from: [number, number],
  to: [number, number],
): number {
  const [lon1, lat1] = from;
  const [lon2, lat2] = to;

  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Same as haversineDistanceKm but returns meters.
 */
export function haversineDistanceM(
  from: [number, number],
  to: [number, number],
): number {
  return haversineDistanceKm(from, to) * 1000;
}
