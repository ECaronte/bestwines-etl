import { DatasetSchema, type Dataset } from "../schema.js";
import { slugify } from "../normalize.js";

const DEFAULT_ENDPOINT =
  process.env.WIKIDATA_ENDPOINT || "https://query.wikidata.org/sparql";

function qidFromUri(uri: string): string | null {
  const m = uri.match(/\/entity\/(Q\d+)$/);
  return m?.[1] ?? null;
}

function toNum(x: unknown): number | undefined {
  const n = typeof x === "string" ? Number(x) : typeof x === "number" ? x : NaN;
  return Number.isFinite(n) ? n : undefined;
}

function qualityScore(x: any) {
  return (
    (x.lat != null && x.lng != null ? 10 : 0) +
    (x.countryCode && x.countryCode !== "ZZ" ? 4 : 0) +
    (x.region && x.region !== "unknown" ? 2 : 0) +
    (x.name && !/^Q\d+$/i.test(x.name) ? 1 : 0)
  );
}

function pickBetter(a: any, b: any) {
  return qualityScore(b) > qualityScore(a) ? b : a;
}

export async function loadWikidata(limit = 0): Promise<Dataset> {
  const LIM = limit > 0 ? limit : 200;

  /**
   * Mejoras:
   * - countryCode: primero intenta P17->P297; si no, intenta derivar país desde P131->P17->P297
   * - regionLabel: usa P131 label si existe
   * - labels: wikibase:label con "[AUTO_LANGUAGE],en" para evitar "Qxxxx"
   */
  const sparql = `
SELECT ?winery ?wineryLabel ?countryCode ?regionLabel ?lat ?lon WHERE {
  ?winery wdt:P31/wdt:P279* wd:Q156362 .

  OPTIONAL { ?winery wdt:P131 ?region . }

  # country fallback:
  # 1) direct: winery P17 country -> P297 ISO2
  OPTIONAL {
    ?winery wdt:P17 ?countryDirect .
    OPTIONAL { ?countryDirect wdt:P297 ?ccDirect . }
  }

  # 2) derived: winery P131 region -> P17 country -> P297 ISO2
  OPTIONAL {
    ?winery wdt:P131 ?admin .
    ?admin wdt:P17 ?countryDerived .
    OPTIONAL { ?countryDerived wdt:P297 ?ccDerived . }
  }

  BIND(COALESCE(?ccDirect, ?ccDerived) AS ?countryCode)

  OPTIONAL {
    ?winery p:P625 ?coordStatement .
    ?coordStatement ps:P625 ?coord .
    BIND(geof:latitude(?coord) AS ?lat)
    BIND(geof:longitude(?coord) AS ?lon)
  }

  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en" .
    ?winery rdfs:label ?wineryLabel .
    ?region rdfs:label ?regionLabel .
  }
}
LIMIT ${LIM}
`.trim();

  const url = new URL(DEFAULT_ENDPOINT);
  url.searchParams.set("format", "json");
  url.searchParams.set("query", sparql);

  const res = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Accept: "application/sparql-results+json",
      "User-Agent": "bestwines-etl/0.1 (contact: you@yourdomain.com)",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Wikidata query failed (${res.status}): ${text.slice(0, 300)}`,
    );
  }

  const json = (await res.json()) as any;
  const bindings: any[] = json?.results?.bindings ?? [];

  // 1) filas -> candidatos
  const candidates = bindings.map((b) => {
    const wineryUri = b?.winery?.value as string | undefined;
    const qid = wineryUri ? qidFromUri(wineryUri) : null;
    const id = qid
      ? `wd_${qid.replace("Q", "")}`
      : `wd_unknown_${Math.random().toString(16).slice(2)}`;

    const nameRaw = (b?.wineryLabel?.value as string | undefined)?.trim();
    const name = nameRaw && nameRaw.length ? nameRaw : (qid ?? id);

    const countryCodeRaw = (
      b?.countryCode?.value as string | undefined
    )?.trim();
    const countryCode = countryCodeRaw ? countryCodeRaw.toUpperCase() : "ZZ";

    const regionLabel = (b?.regionLabel?.value as string | undefined)?.trim();
    const region = regionLabel ? slugify(regionLabel) : "unknown";

    const lat = toNum(b?.lat?.value);
    const lng = toNum(b?.lon?.value);

    const slug = slugify(`${name}-${countryCode}-${region}`);

    return {
      id,
      name,
      countryCode,
      region,
      lat,
      lng,
      featuredLangs: [] as string[],
      slug,
    };
  });

  // 2) dedupe por id (merge)
  const byId = new Map<string, any>();

  for (const c of candidates) {
    const prev = byId.get(c.id);
    if (!prev) {
      byId.set(c.id, c);
      continue;
    }

    const chosen = pickBetter(prev, c);
    const other = chosen === prev ? c : prev;

    const merged = {
      ...chosen,
      name: chosen.name || other.name,
      countryCode:
        chosen.countryCode !== "ZZ" ? chosen.countryCode : other.countryCode,
      region: chosen.region !== "unknown" ? chosen.region : other.region,
      lat: chosen.lat ?? other.lat,
      lng: chosen.lng ?? other.lng,
      featuredLangs: Array.from(
        new Set([
          ...(chosen.featuredLangs || []),
          ...(other.featuredLangs || []),
        ]),
      ),
    };

    merged.slug = slugify(
      `${merged.name}-${merged.countryCode}-${merged.region}`,
    );
    byId.set(c.id, merged);
  }

  // 3) dedupe por slug (por si hay QIDs distintos para el mismo sitio)
  const bySlug = new Map<string, any>();
  for (const w of byId.values()) {
    const prev = bySlug.get(w.slug);
    if (!prev) {
      bySlug.set(w.slug, w);
      continue;
    }
    // quedarse con el mejor
    bySlug.set(w.slug, pickBetter(prev, w));
  }

  const wineries = Array.from(bySlug.values());

  const ds: Dataset = {
    meta: {
      version: "1.0",
      generatedAt: new Date().toISOString(),
      source: "wikidata",
      notes: `wikidata wineries (limit=${LIM}) dedup_by_id_and_slug`,
    },
    wineries,
    packs: [],
    slugs: [],
  };

  return DatasetSchema.parse(ds);
}
