import { chatComplete } from "./openrouterClient.js";

const SYSTEM_PROMPT = `You are a location-digest writer for a family safety app. You receive a JSON list of
per-member location facts — distances and geofence matches are already computed exactly,
never estimate them yourself. Turn them into a short, warm paragraph, one short sentence
per member. Rules:
- Use only the given facts; never invent places, times, or distances.
- Refer to the member marked isViewer as "you"; others by first name.
- If arrived is true, phrase it as "at <place>" (e.g. "home", "at the office").
- If not arrived but a place/distance are given, mention the distance naturally
  (e.g. "2.3 km from Office").
- If no saved place is nearby, just note when their location last updated.
- Never mention coordinates, JSON, or that you were given structured data.
- Keep the whole output under 80 words.`;

function formatDistance(distanceM) {
  if (distanceM == null) return null;
  if (distanceM < 1000) return `${Math.round(distanceM)} m`;
  return `${(distanceM / 1000).toFixed(1)} km`;
}

// Deterministic fallback used whenever the LLM call fails — the digest
// endpoint must never 500 just because the LLM/provider is unavailable,
// since it sits on top of critical location data.
export function templateDigest(facts) {
  return facts
    .map((f) => {
      const who = f.isViewer ? "You are" : `${f.firstName} is`;
      if (f.arrived && f.place) {
        return `${who} at ${f.place === "Home" ? "home" : f.place.toLowerCase()}.`;
      }
      if (f.place && f.distanceMeters != null) {
        return `${who} ${formatDistance(f.distanceMeters)} from ${f.place}.`;
      }
      if (f.minutesAgo == null) {
        return `${f.isViewer ? "You haven't" : `${f.firstName} hasn't`} shared a location yet.`;
      }
      return `${f.isViewer ? "Your" : `${f.firstName}'s`} location last updated ${f.minutesAgo} min ago.`;
    })
    .join(" ");
}

// facts: Array<{ firstName, place: string|null, arrived: boolean, distanceMeters: number|null, minutesAgo: number, isViewer: boolean }>
export async function generateDigest(facts) {
  try {
    const content = await chatComplete([
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify(facts) },
    ]);
    return content.trim();
  } catch (err) {
    return templateDigest(facts);
  }
}
