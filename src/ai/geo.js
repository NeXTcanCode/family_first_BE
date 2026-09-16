const EARTH_RADIUS_METERS = 6371000;

export function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
}

// Checks a user's lastLocation against their own homeAddress/officeAddress
// and returns whichever saved place is nearest. Geofence math stays here as
// plain deterministic code — never delegated to the LLM.
export function matchNearestPlace(
  lastLocation,
  { homeAddress, officeAddress } = {},
  { arrivedRadiusM = 200 } = {}
) {
  if (!lastLocation || lastLocation.lat == null || lastLocation.lng == null) {
    return { place: null, distanceM: null, arrived: false };
  }

  const candidates = [];
  if (homeAddress?.lat != null && homeAddress?.lng != null) {
    candidates.push({
      place: "Home",
      distanceM: haversineDistanceMeters(
        lastLocation.lat,
        lastLocation.lng,
        homeAddress.lat,
        homeAddress.lng
      ),
    });
  }
  if (officeAddress?.lat != null && officeAddress?.lng != null) {
    candidates.push({
      place: "Office",
      distanceM: haversineDistanceMeters(
        lastLocation.lat,
        lastLocation.lng,
        officeAddress.lat,
        officeAddress.lng
      ),
    });
  }

  if (candidates.length === 0) {
    return { place: null, distanceM: null, arrived: false };
  }

  const nearest = candidates.reduce((a, b) => (a.distanceM <= b.distanceM ? a : b));
  return {
    place: nearest.place,
    distanceM: nearest.distanceM,
    arrived: nearest.distanceM <= arrivedRadiusM,
  };
}
