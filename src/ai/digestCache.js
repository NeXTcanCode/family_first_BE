const TTL_MS = 5 * 60 * 1000;

// In-memory cache, keyed by `${familyId}:${viewerId}`. Fine for a single
// backend instance; a multi-instance deployment would need Redis or a
// DB-backed cache instead — not needed at this app's current scale.
const cache = new Map();

function hashFacts(facts) {
  return JSON.stringify(facts);
}

export function getCached(familyId, viewerId, facts) {
  const key = `${familyId}:${viewerId}`;
  const entry = cache.get(key);
  if (!entry) return null;
  const fresh = Date.now() - entry.computedAt.getTime() < TTL_MS;
  if (fresh && entry.factsHash === hashFacts(facts)) {
    return entry;
  }
  return null;
}

export function setCached(familyId, viewerId, facts, digestText) {
  const key = `${familyId}:${viewerId}`;
  const entry = { factsHash: hashFacts(facts), digestText, computedAt: new Date() };
  cache.set(key, entry);
  return entry;
}

// Clears every cached digest for a family (called after a member's location
// changes) so the next request recomputes instead of serving stale text.
export function invalidate(familyId) {
  for (const key of cache.keys()) {
    if (key.startsWith(`${familyId}:`)) cache.delete(key);
  }
}
