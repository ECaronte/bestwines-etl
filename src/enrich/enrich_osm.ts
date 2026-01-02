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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function toNumber(x: any): number | undefined {
  return typeof x === "number" && Number.isFinite(x) ? x : undefined;
}

function normalizeWebsite(u: string): string {
  const s = String(u || "").trim();
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  // OSM a veces tiene "www.xxx.com" sin esquema
  if (/^www\./i.test(s)) return `https://${s}`;
  return s;
}

function firstNonEmpty(...vals: any[]) {
  for (const v of vals) {
    const s = v == null ? "" : String(v).trim();
    if (s) return s;
  }
  return "";
}

function getAddrFromTags(t: Record<string, string>) {
  const parts = [
    [t["addr:housenumber"], t["addr:street"]].filter(Boolean).join(" ").trim(),
    t["addr:postcode"],
    t["addr:city"],
    t["addr:state"],
    t["addr:country"],
  ].filter(Boolean);
  return parts.join(" ").trim();
}

function buildOsmUrl(type: "node" | "way" | "relation" | string | undefined, id: number | undefined) {
  if (!type || !id) return "";
  if (type !== "node" && type !== "way" && type !== "relation") return "";
  return `https://www.openstreetmap.org/${type}/${id}`;
}

function extractCandidates(res: OverpassResponse): Candidate[] {
  const els = Array.isArray((res as any)?.elements) ? (res as any).elements : [];
  return els.map((el: any) => {
    const t = (el?.tags || {}) as Record<string, string>;
    const c = el?.center || {};
    const lat = toNumber(el?.lat) ?? toNumber(c?.lat);
    const lon = toNumber(el?.lon) ?? toNumber(c?.lon);
    const name = firstNonEmpty(t.name, "");
    const website = normalizeWebsite(firstNonEmpty(t.website, t["contact:website"], t.url));
    const phone = firstNonEmpty(t.phone, t["contact:phone"], t["contact:mobile"]);
    const email = firstNonEmpty(t.email, t["contact:email"]);
    const address = getAddrFromTags(t);

    return {
      name,
      website,
      phone,
      address,
      lat,
      lon,
      tags: t,
      // extra opcional (lo ignorará match si no lo usa)
      type: el?.type,
      osmId: el?.id,
    } as any;
  });
}

async function safeOverpassJSON(client: OverpassClient, queryFn: () => Promise<OverpassResponse>): Promise<OverpassResponse> {
  const maxRetries = Number(process.env.OSM_MAX_RETRIES || 6);
  const base = Number(process.env.OSM_BACKOFF_BASE_MS || 2500);
  const jitter = Number(process.env.OSM_BACKOFF_JITTER_MS || 600);
  const hardTimeoutS = Number(process.env.OSM_TIMEOUT_S || 90);

  let lastErr: any = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // timeout “duro” a nivel cliente
      const res = await Promise.race([
        queryFn(),
        new Promise<OverpassResponse>((_, rej) =>
          setTimeout(() => rej(new Error(`Overpass hard-timeout ${hardTimeoutS}s`)), hardTimeoutS * 1000)
        ),
      ]);

      // sanity: tiene elements array
      const ok = res && Array.isArray((res as any).elements);
      if (!ok) {
        // a veces devuelve HTML/XML sin status != 200; o JSON inesperado
        throw new Error("Overpass returned non-standard payload (no elements array)");
      }
      return res;
    } catch (e: any) {
      lastErr = e;

      // si es parse error por HTML/XML: reintentar igual, pero con backoff grande
      const msg = String(e?.message || e);
      const isParseLike = /Unexpected token\s*<|not valid JSON|non-standard payload/i.test(msg);
      const is429 = /429/.test(msg);
      const is504 = /504/.test(msg);
      const isTimeout = /timeout/i.test(msg);

      const shouldRetry = attempt < maxRetries && (isParseLike || is429 || is504 || isTimeout || true);
      if (!shouldRetry) break;

      const wait = base * Math.pow(2, attempt) + Math.floor(Math.random() * jitter);
      await sleep(wait);
      continue;
    }
  }

  throw lastErr || new Error("Overpass failed (unknown)");
}

function ensureV2(outW: any) {
  if (!outW.v2) outW.v2 = {};
  if (!outW.v2.content) outW.v2.content = {};
  if (!outW.v2.content.i18n) outW.v2.content.i18n = {};
  if (!outW.v2.content.i18n.en) outW.v2.content.i18n.en = {};
  if (!outW.v2.content.i18n.es) outW.v2.content.i18n.es = {};
  if (!outW.v2.osm) outW.v2.osm = {};
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

  const fallbackByName = String(process.env.OSM_FALLBACK_NAME || "0") === "1";
  const cacheTtlDays = Number(process.env.OSM_CACHE_TTL_DAYS || 30);
  const cacheOnly = String(process.env.OSM_CACHE_ONLY || "0") === "1";

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
  let errors = 0;

  const qaRows: Record<string, any>[] = [];

  for (let i = 0; i < max; i++) {
    const w = wineries[i];

    // preferimos enriquecer solo si tiene id+name
    if (!w?.id || !w?.name) {
      noMatch++;
      qaRows.push({
        id: w?.id || "",
        name: w?.name || "",
        status: "invalid_row",
      });
      continue;
    }

    const lat = typeof w.lat === "number" ? w.lat : undefined;
    const lon = typeof w.lng === "number" ? w.lng : undefined;

    let usedFallbackName = 0;
    let cacheHit = 0;

    try {
      // 1) cache
      let res: OverpassResponse | null = readCache(w.id, cacheTtlDays);
      if (res) cacheHit = 1;

      // 2) query coords
      if (!res && !cacheOnly) {
        if (typeof lat === "number" && typeof lon === "number") {
          res = await safeOverpassJSON(client, () =>
            client.searchAround({ lat, lon, radiusM })
          );
        }
      }

      // 3) fallback: query por name (si permitido)
      if (!res && fallbackByName && !cacheOnly) {
        usedFallbackName = 1;
        res = await safeOverpassJSON(client, () => client.searchByName({ name: w.name }));
      }

      if (!res) {
        noMatch++;
        qaRows.push({
          id: w.id,
          name: w.name,
          status: typeof lat === "number" && typeof lon === "number" ? "no_match" : "no_coords",
          cache: cacheHit ? "hit" : "miss",
          fallbackName: usedFallbackName,
        });
        continue;
      }

      // persist cache (aunque sea fallback name)
      if (!cacheHit) writeCache(w.id, res);

      const candidates: Candidate[] = extractCandidates(res);

      const best = pickBestCandidate({ wineryName: w.name, candidates });

      if (!best) {
        noMatch++;
        qaRows.push({
          id: w.id,
          name: w.name,
          status: "no_match",
          cache: cacheHit ? "hit" : "miss",
          fallbackName: usedFallbackName,
        });
        continue;
      }

      const score = best.score;
      const b: any = best.c || {};

      const status =
        score >= minScore
          ? "matched_strong"
          : score >= weakScore
            ? "matched_weak"
            : "low_confidence";

      if (status === "matched_strong") matchedStrong++;
      else if (status === "matched_weak") matchedWeak++;
      else noMatch++;

      // Guardamos “safe fields” + metadatos OSM
      const outW: any = { ...w };
      ensureV2(outW);

      // website/phone/email solo si vacío
      const website = normalizeWebsite(firstNonEmpty(b.website, ""));
      if (!outW.website && website) outW.website = website;

      const phone = firstNonEmpty(b.phone, "");
      if (!outW.phone && phone) outW.phone = phone;

      const email = firstNonEmpty(b.email, "");
      if (!outW.email && email) outW.email = email;

      // addressText: solo si vacío
      const address = firstNonEmpty(b.address, "");
      if (address) {
        if (!outW.v2.content.i18n.en.addressText) outW.v2.content.i18n.en.addressText = address;
        if (!outW.v2.content.i18n.es.addressText) outW.v2.content.i18n.es.addressText = address;
      }

      // osm meta siempre (aunque low_confidence)
      const osmType = b.type || (b.tags ? "" : "");
      const osmId = typeof b.osmId === "number" ? b.osmId : undefined;
      const osmUrl = buildOsmUrl(osmType, osmId);

      outW.v2.osm = {
        id: osmId ?? outW.v2.osm?.id,
        type: osmType || outW.v2.osm?.type,
        url: osmUrl || outW.v2.osm?.url,
        score: Number.isFinite(score) ? Number(score.toFixed(3)) : outW.v2.osm?.score,
        match: status,
        source: "overpass",
      };

      wineries[i] = outW;

      qaRows.push({
        id: w.id,
        name: w.name,
        status,
        score: Number.isFinite(score) ? score.toFixed(3) : "",
        osmName: firstNonEmpty(b.name, ""),
        website: website || "",
        phone: phone || "",
        email: email || "",
        address: address || "",
        osmType: osmType || "",
        osmId: osmId ?? "",
        osmUrl: osmUrl || "",
        cache: cacheHit ? "hit" : "miss",
        fallbackName: usedFallbackName,
      });
    } catch (e: any) {
      errors++;
      qaRows.push({
        id: w?.id || "",
        name: w?.name || "",
        status: "error",
        error: String(e?.message || e).slice(0, 240),
      });
      // no rompemos el loop
      continue;
    }
  }

  const out: Dataset = { ...ds, wineries };

  writeJson(outputPath, out);
  writeCsv(outputCsvPath, qaRows);

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
        errors,
        minScore,
        weakScore,
        radiusM,
        cacheTtlDays,
        fallbackByName,
        cacheOnly,
      },
      null,
      2
    )
  );
}
