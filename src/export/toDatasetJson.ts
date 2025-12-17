import {
  DatasetSchema,
  type Dataset,
  type Winery,
  type Pack,
  type SlugRow,
} from "../schema.js";
import {
  computeGeo,
  normalizeCountryCode,
  normalizeRegion,
  slugify,
} from "../normalize.js";

function ensureUnique<T>(items: T[], keyFn: (x: T) => string, label: string) {
  const seen = new Set<string>();
  const dups: string[] = [];
  for (const it of items) {
    const k = keyFn(it);
    if (seen.has(k)) dups.push(k);
    else seen.add(k);
  }
  if (dups.length) {
    throw new Error(
      `Integrity error: duplicate ${label}: ${dups.slice(0, 10).join(", ")}${dups.length > 10 ? "…" : ""}`,
    );
  }
}

export function buildCanonicalDataset(input: Dataset): Dataset {
  const now = new Date().toISOString();

  const wineries: Winery[] = input.wineries.map((w) => {
    const countryCode = normalizeCountryCode(w.countryCode);
    const region = normalizeRegion(w.region);
    const slug = w.slug
      ? slugify(w.slug)
      : slugify(`${w.name}-${countryCode}-${region}`);
    const geo = w.geo ?? computeGeo(w.lat, w.lng, 3);

    return {
      ...w,
      countryCode,
      region,
      slug,
      geo,
    };
  });

  const packs: Pack[] = input.packs.map((p) => ({
    ...p,
    countryCode: normalizeCountryCode(p.countryCode),
    typeKey: slugify(p.typeKey), // por si llega "Week End"
  }));

  const slugs: SlugRow[] = input.slugs.map((s) => ({
    ...s,
    slug: slugify(s.slug),
  }));

  // Autogenerar slugs faltantes para wineries (si no están en slugs[])
  const slugRowsBySlug = new Map(slugs.map((s) => [s.slug, s]));
  for (const w of wineries) {
    const slug = w.slug!;
    if (!slugRowsBySlug.has(slug)) {
      slugRowsBySlug.set(slug, { slug, targetType: "WINERY", targetId: w.id });
    }
  }
  const finalSlugs = Array.from(slugRowsBySlug.values());

  // Integridad
  ensureUnique(wineries, (w) => w.id, "wineries.id");
  ensureUnique(packs, (p) => p.id, "packs.id");
  ensureUnique(finalSlugs, (s) => s.slug, "slugs.slug");

  const wineryIds = new Set(wineries.map((w) => w.id));
  for (const p of packs) {
    if (!wineryIds.has(p.wineryId))
      throw new Error(
        `Integrity error: packs.wineryId missing winery: ${p.id} -> ${p.wineryId}`,
      );
  }
  for (const s of finalSlugs) {
    if (!wineryIds.has(s.targetId))
      throw new Error(
        `Integrity error: slugs.targetId missing winery: ${s.slug} -> ${s.targetId}`,
      );
  }

  const canonical: Dataset = {
    meta: {
      version: input.meta.version ?? "1.0",
      generatedAt: now,
      source: input.meta.source ?? "bestwines-etl",
      notes: input.meta.notes,
    },
    wineries,
    packs,
    slugs: finalSlugs,
  };

  return DatasetSchema.parse(canonical);
}
