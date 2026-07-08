// Server-only: resolve a ZIP / Canadian postal code to a real place so the
// contractor search can be anchored to a city, not just a code.
// Uses the free zippopotam.us API; fails soft (returns null) if unavailable.

export async function resolveLocation(code) {
  const c = (code || "").trim();
  if (!c) return null;
  const isPostal = /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/.test(c);
  const url = isPostal
    ? `https://api.zippopotam.us/ca/${encodeURIComponent(c.slice(0, 3).toUpperCase())}`
    : `https://api.zippopotam.us/us/${encodeURIComponent(c)}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const place = data.places?.[0];
    if (!place) return null;
    return {
      city: place["place name"],
      state: place["state"],
      stateAbbr: place["state abbreviation"],
      country: data.country,
      lat: place.latitude,
      lng: place.longitude,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
