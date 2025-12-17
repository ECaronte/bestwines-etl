import ngeohash from "ngeohash";

export function normalizeCountryCode(cc: string): string {
  return (cc || "").trim().toUpperCase();
}

export function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function slugify(input: string): string {
  const s = stripDiacritics(input)
    .toLowerCase()
    .trim()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "item";
}

export function normalizeRegion(region: string): string {
  return slugify(region);
}

export function computeGeo(
  lat?: number,
  lng?: number,
  precision = 3,
): string | undefined {
  if (typeof lat !== "number" || typeof lng !== "number") return undefined;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  // precision corto tipo "ezj"
  return ngeohash.encode(lat, lng, precision);
}
