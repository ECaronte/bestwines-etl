import fs from "node:fs";
import path from "node:path";
import { OverpassClient, readCache, writeCache, type OverpassResponse } from "../sources/osm_overpass.js";
import { pickBestCandidate, type Candidate } from "./match.js";

type Winery = {
  id: string;
  name: string;
  countryCode?: string;
  region?: string;
  lat?: number;
  lng?: number;
  website?: string;
  phone?: string;
  email?: string;
  v2?: any;
  [k: string]: any;
};

type Dataset = {
  wineries: Winery[];
  packs?: any[];
  slugs?: any[];
  meta?: any;
  [k: string]: any;
};

function nowIso() {
  return new Date().toISOString();
}

function readJson(p: string) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p: string, obj: any) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

function writeCsv(p: string, rows: Record<string, any>[]) {
  const headers = Array.from(
    rows.reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set<string>())
  );

  const esc = (v: any) => {
    const s = v == null ? "" : String(v);
    if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const out = [
    headers.join(","),
    ...rows.map((r) => headers.map((h) => esc(r[h])).join(",")),
  ].join("\n");

  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, out + "\n", "utf8");
}

function msToHms(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${h}h ${m}m ${ss}s`;
}

function safeUrl(u: any) {
  const s = (u == null ? "" : String(u)).trim();
  if (!s) return "";
  // normaliza urls sin esquema
  if (/^www\./i.test(s)) return `https://${s}`;
  return s;
}

function extractEmail(tags: Record<string, string>) {
  return (
    tags["email"] ||
    tags["contact:email"] ||
    tags["addr:email"] ||
    ""
  ).trim();
}

function extractWebsite(tags: Record<string, string>) {
  return (
    tags["website"] ||
    tags["contact:website"] ||
    tags["url"] ||
    ""
  ).trim();
}

function extractPhone(tags: Record<string, string>) {
  return (
    tags["phone"] ||
    tags["contact:phone"] ||
    tags["contact:mobile"] ||
    tags["mobile"] ||
    ""
  ).trim();
}

function buildAddress(tags: Record<string, string>) {
  const parts = [
    tags["addr:housenumber"],
    tags["addr:street"],
    tags["addr:postcode"],
    tags["addr:city"],
    tags["addr:state"],
    tags["addr:country"],
  ].filter(Boolean);
  return parts.join(" ").trim();
}

function osmElementToCandidate(el: any): Candidate {
  const t: Record<string, string> = el?.tags || {};
  const c = el?.center || {};
  const lat2 =
    typeof el?.lat === "number" ? el.lat : (typeof c?.lat === "number" ? c.lat : undefined);
  const lon2 =
    typeof el?.lon === "number" ? el.lon : (typeof c?.lon === "number" ? c.lon : undefined);

  const name = (t.name || "").trim();
  const website = extractWebsite(t);
  const phone = extractPhone(t);
  const email = extractEmail(t);
  const address = buildAddress(t);

  return {
    name,
    website,
    phone,
    address,
    lat: lat2,
    lon: lon2,
    tags: t,
    // pasamos email en tags; el match no lo necesita pero lo usamos luego
    extra: { email },
  } as any;
}

function elementOsmUrl(el: any) {
  const type = el?.type;
  const id = el?.id;
  if (!type || !id) return "";
  return `https://www.openstreetmap.org/${type}/${id}`;
}

async function fetchOverpassWithFallback(params: {
  client: OverpassClient;
  wineryId: string;
  lat: number;
  lon: number;
  radiusM: number;
  wineryName: string;
  cacheTtlDays: number;
  fallbackByName: boolean;
  cacheOnly: boolean;
}): Promise<{
  res: OverpassResponse | null;
  cache: "hit" | "miss" | "stale";
  usedFallbackName: boolean;
  error?: string;
}> {
  const {
    client, wineryId, lat, lon, radiusM, wineryName,
    cacheTtlDays, fallbackByName, cacheOnly,
  } = params;

  // 1) cache first
  const cached = readCache(wineryId, cacheTtlDays);
  if (cached) return { res: cached, cache: "hit", usedFallbackName: false };

  if (cacheOnly) {
    return { res: null, cache: "miss", usedFallbackName: false, error: "cache_only" };
  }

  // 2) try around
  try {
    const fresh = await client.searchAround({ lat, lon, radiusM });
    writeCache(wineryId, fresh);
    return { res: fresh, cache: "miss", usedFallbackName: false };
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : "unknown_error";
    // 3) optional fallback by name
    if (fallbackByName) {
      try {
        const byName = await client.searchByName({ name: wineryName });
        writeCache(wineryId, byName);
        return { res: byName, cache: "miss", usedFallbackName: true };
      } catch (e2: any) {
        const msg2 = e2?.message ? String(e2.message) : "unknown_error";
        return { res: null, cache: "miss", usedFallbackName: true, error: `${msg} | fallback_name_failed: ${msg2}` };
      }
    }
    return { res: null, cache: "miss", usedFallbackName: false, error: msg };
  }
}

export async function enrichOsm(opts: {
  inputPath?: string;
  outputPath?: string;
  outputCsvPath?: string;
  limit?: number;
}) {
  const inputPath = opts.inputPath || "out/dataset.json";
  const outputPath = opts.outputPath || "out/dataset.enriched.json";
  const outputCsvPath = opts.outputCsvPath || "out/dataset.enriched.csv";

  const minScore = Number(process.env.OSM_MIN_SCORE || 0.75);
  const weakScore = Number(process.env.OSM_WEAK_SCORE || 0.65);
  const radiusM = Number(process.env.OSM_RADIUS_M || 8000);

  const cacheTtlDays = Number(process.env.OSM_CACHE_TTL_DAYS || 30);
  const fallbackByName = String(process.env.OSM_FALLBACK_NAME || "0") === "1";
  const cacheOnly = String(process.env.OSM_CACHE_ONLY || "0") === "1";

  const progressEvery = Math.max(1, Number(process.env.OSM_PROGRESS_EVERY || 10));
  const checkpointEvery = Math.max(0, Number(process.env.OSM_CHECKPOINT_EVERY || 25)); // 0 = off
  const checkpointPath = process.env.OSM_CHECKPOINT_PATH || "out/dataset.enriched.partial.json";

  const client = new OverpassClient();

  const ds = readJson(inputPath) as Dataset;
  const wineries = ds.wineries || [];

  const max =
    typeof opts.limit === "number" && opts.limit > 0
      ? Math.min(opts.limit, wineries.length)
      : wineries.length;

  let matchedStrong = 0;
  let matchedWeak = 0;
  let noMatch = 0;
  let noCoords = 0;
  let errors = 0;

  const qaRows: Record<string, any>[] = [];
  const startedAt = Date.now();
  let processed = 0;

  // helper: checkpoint
  const writeCheckpoint = () => {
    if (!checkpointEvery) return;
    const out: Dataset = {
      ...ds,
      wineries,
      meta: {
        ...(ds.meta || {}),
        enriched: {
          source: "osm",
          generatedAt: nowIso(),
          progress: { processed, max },
        },
      },
    };
    writeJson(checkpointPath, out);
  };

  for (let i = 0; i < max; i++) {
    const w = wineries[i];
    processed = i + 1;

    const lat = w.lat;
    const lon = w.lng;

    if (typeof lat !== "number" || typeof lon !== "number") {
      noCoords++;
      qaRows.push({ id: w.id, name: w.name, status: "no_coords" });
      continue;
    }

    const { res, cache, usedFallbackName, error } = await fetchOverpassWithFallback({
      client,
      wineryId: w.id,
      lat,
      lon,
      radiusM,
      wineryName: w.name,
      cacheTtlDays,
      fallbackByName,
      cacheOnly,
    });

    if (!res || !Array.isArray((res as any).elements)) {
      errors++;
      qaRows.push({
        id: w.id,
        name: w.name,
        status: "error",
        error: error || "no_response",
        cache,
        fallbackName: usedFallbackName ? 1 : 0,
      });
      continue;
    }

    const els = (res as any).elements as any[];
    const candidates: Candidate[] = els.map(osmElementToCandidate);

    const best = pickBestCandidate({ wineryName: w.name, candidates });

    if (!best) {
      noMatch++;
      qaRows.push({
        id: w.id,
        name: w.name,
        status: "no_match",
        cache,
        fallbackName: usedFallbackName ? 1 : 0,
      });
      continue;
    }

    const score = best.score;
    const b: any = best.c;
    const status =
      score >= minScore ? "matched_strong" : score >= weakScore ? "matched_weak" : "low_confidence";

    if (status === "matched_strong") matchedStrong++;
    else if (status === "matched_weak") matchedWeak++;
    else noMatch++;

    // intentamos localizar el elemento original para extraer osm id/type/url
    // (pickBestCandidate devuelve Candidate; Candidate no guarda id/type, así que lo inferimos buscando match exacto por name+website si posible)
    let osmType = "";
    let osmId: number | "" = "";
    let osmUrl = "";
    if (els.length) {
      const targetName = (b?.name || "").trim();
      const targetWeb = safeUrl(b?.website || "");
      const found = els.find((el) => {
        const t = el?.tags || {};
        const nm = (t.name || "").trim();
        const wb = safeUrl(extractWebsite(t));
        if (targetName && nm && nm.toLowerCase() === targetName.toLowerCase()) {
          if (!targetWeb) return true;
          if (wb && wb.toLowerCase() === targetWeb.toLowerCase()) return true;
          // si coincide nombre, aceptamos igualmente
          return true;
        }
        return false;
      });
      if (found) {
        osmType = found.type || "";
        osmId = found.id || "";
        osmUrl = elementOsmUrl(found);
      }
    }

    // aplicamos enriquecimiento “safe”
    const outW: Winery = { ...w };

    const website = safeUrl(b.website || "");
    const phone = (b.phone || "").trim();
    const email = (b?.extra?.email || "").trim();
    const address = (b.address || "").trim();

    if (!outW.website && website) outW.website = website;
    if (!outW.phone && phone) outW.phone = phone;
    if (!outW.email && email) outW.email = email;

    if (!outW.v2) outW.v2 = {};
    if (!outW.v2.content) outW.v2.content = {};
    if (!outW.v2.content.i18n) outW.v2.content.i18n = {};
    if (!outW.v2.content.i18n.en) outW.v2.content.i18n.en = {};
    if (!outW.v2.content.i18n.es) outW.v2.content.i18n.es = {};

    if (address) {
      if (!outW.v2.content.i18n.en.addressText) outW.v2.content.i18n.en.addressText = address;
      if (!outW.v2.content.i18n.es.addressText) outW.v2.content.i18n.es.addressText = address;
    }

    // metadata OSM
    if (!outW.v2.osm) outW.v2.osm = {};
    outW.v2.osm.id = osmId || outW.v2.osm.id || "";
    outW.v2.osm.type = osmType || outW.v2.osm.type || "";
    outW.v2.osm.url = osmUrl || outW.v2.osm.url || "";
    outW.v2.osm.score = score;
    outW.v2.osm.match = status;

    wineries[i] = outW;

    qaRows.push({
      id: w.id,
      name: w.name,
      status,
      score: score.toFixed(3),
      osmName: b.name || "",
      website: website || "",
      phone: phone || "",
      email: email || "",
      address: address || "",
      osmType: osmType || "",
      osmId: osmId || "",
      osmUrl: osmUrl || "",
      cache,
      fallbackName: usedFallbackName ? 1 : 0,
    });

    // progreso
    if (processed % progressEvery === 0 || processed === max) {
      const elapsed = Date.now() - startedAt;
      const perItem = elapsed / processed;
      const eta = perItem * (max - processed);
      process.stdout.write(
        `[OSM] ${processed}/${max} | strong=${matchedStrong} weak=${matchedWeak} noMatch=${noMatch} noCoords=${noCoords} errors=${errors} | elapsed=${msToHms(elapsed)} | eta=${msToHms(eta)}\n`
      );
    }

    // checkpoint
    if (checkpointEvery && processed % checkpointEvery === 0) {
      writeCheckpoint();
    }
  }

  const out: Dataset = {
    ...ds,
    wineries,
    meta: {
      ...(ds.meta || {}),
      enriched: {
        source: "osm",
        generatedAt: nowIso(),
        config: { minScore, weakScore, radiusM, cacheTtlDays, fallbackByName, cacheOnly },
        results: { processed: max, matchedStrong, matchedWeak, noMatch, noCoords, errors },
      },
    },
  };

  writeJson(outputPath, out);
  writeCsv(outputCsvPath, qaRows);

  const elapsed = Date.now() - startedAt;
  console.log(
    JSON.stringify(
      {
        inputPath,
        outputPath,
        outputCsvPath,
        wineriesProcessed: max,
        matchedStrong,
        matchedWeak,
        noMatch,
        noCoords,
        errors,
        minScore,
        weakScore,
        radiusM,
        cacheTtlDays,
        fallbackByName,
        cacheOnly,
        elapsedSec: Math.round(elapsed / 1000),
      },
      null,
      2
    )
  );
}
