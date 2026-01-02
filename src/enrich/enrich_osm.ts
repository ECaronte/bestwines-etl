import fs from "node:fs";
import path from "node:path";
import { OverpassClient, readCache, writeCache, type OverpassElement } from "../sources/osm_overpass";
import { scoreCandidate, pickBest, elementCenter } from "./match";

type Winery = Record<string, any>;

type Dataset = {
  meta?: Record<string, any>;
  wineries: Winery[];
  packs?: any[];
  slugs?: any[];
};

function readJson(p: string) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p: string, obj: any) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(obj, null, 2), "utf8");
}

function toCsvValue(v: any) {
  const s = (v ?? "").toString();
  if (s.includes('"') || s.includes(",") || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(p: string, rows: Record<string, any>[]) {
  if (!rows.length) {
    fs.writeFileSync(p, "", "utf8");
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(headers.map((h) => toCsvValue(r[h])).join(","));
  }
  fs.writeFileSync(p, lines.join("\n"), "utf8");
}

function getWikidataQFromId(id: string) {
  // id sample: wd_2556121  -> we don't have Q number here
  // If you store Q elsewhere, wire it here later.
  // For now we can't do direct Q match unless dataset includes it.
  return "";
}

function ensureV2(win: Winery) {
  win.v2 = win.v2 || {};
  win.v2.sources = win.v2.sources || {};
  win.v2.content = win.v2.content || {};
  win.v2.content.i18n = win.v2.content.i18n || {};
  win.v2.content.i18n.es = win.v2.content.i18n.es || {};
  return win;
}

function shouldImproveRegionCode(current: string | undefined) {
  if (!current) return true;
  if (current === "unknown") return true;
  if (/^gh-/.test(current)) return true; // your geo buckets
  return false;
}

function pickRegionCodeFromTags(tags?: Record<string, string>) {
  if (!tags) return "";
  // Very light heuristic: prefer addr:city/town/village as regionCode fallback
  const raw =
    tags["addr:city"] ||
    tags["addr:town"] ||
    tags["addr:village"] ||
    tags["addr:municipality"] ||
    "";
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, "-")
    .trim()
    .slice(0, 60);
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

  const radiusM = Number(process.env.OSM_RADIUS_M || 8000);
  const radiusMaxM = Number(process.env.OSM_RADIUS_MAX_M || 20000);
  const minScore = Number(process.env.OSM_MIN_SCORE || 0.75);
  const weakScore = Number(process.env.OSM_WEAK_SCORE || 0.65);

  const client = new OverpassClient();

  const ds = readJson(inputPath) as Dataset;
  const wineries = ds.wineries || [];

  const max = typeof opts.limit === "number" && opts.limit > 0 ? opts.limit : wineries.length;

  const qaRows: Record<string, any>[] = [];
  let matchedStrong = 0;
  let matchedWeak = 0;
  let noMatch = 0;

  for (let i = 0; i < wineries.length && i < max; i++) {
    const w = wineries[i];
    const id = w.id || w.wineryId || `row_${i}`;
    const name = w.name || "";
    const countryCode = w.countryCode || "";
    const lat = typeof w.lat === "number" ? w.lat : (typeof w.latitude === "number" ? w.latitude : undefined);
    const lon = typeof w.lng === "number" ? w.lng : (typeof w.lon === "number" ? w.lon : undefined);

    const origin = (typeof lat === "number" && typeof lon === "number") ? { lat, lon } : undefined;
    const wikidataQ = getWikidataQFromId(id);

    // cache
    let resp = readCache(id, 30);
    let usedRadius = radiusM;
    let mode: "around" | "name" = "around";

    try {
      if (!resp) {
        if (origin) {
          resp = await client.searchAround({ lat: origin.lat, lon: origin.lon, radiusM: usedRadius });
          // widen once if empty
          if ((resp.elements || []).length === 0 && radiusMaxM > usedRadius) {
            usedRadius = radiusMaxM;
            resp = await client.searchAround({ lat: origin.lat, lon: origin.lon, radiusM: usedRadius });
          }
          mode = "around";
        } else {
          resp = await client.searchByName({ name });
          mode = "name";
        }
        writeCache(id, resp);
      }
    } catch (e: any) {
      resp = { elements: [] };
      // keep going
    }

    const els: OverpassElement[] = (resp?.elements || []).filter((x) => x.tags && (x.tags.name || x.tags.brand || x.tags.operator));

    // score candidates
    const scored = els.map((el) => scoreCandidate({ wineryName: name, wikidataQ, origin, el }));
    const { best, ambiguous } = pickBest(scored);

    // enrich only if non-ambiguous and above thresholds
    let matchStatus: "none" | "weak" | "strong" = "none";
    let confidence = 0;
    let osmType = "";
    let osmId: number | "" = "";
    let website = "";
    let addressText = "";
    let newLat: number | "" = "";
    let newLon: number | "" = "";
    let regionCodeNew = "";

    if (best && !ambiguous && best.score >= weakScore) {
      confidence = best.score;
      osmType = best.el.type;
      osmId = best.el.id;
      website = (best.website || "").trim();
      addressText = (best.addressText || "").trim();

      const c = elementCenter(best.el);
      if ((!origin || typeof w.lat !== "number" || typeof w.lng !== "number") && c) {
        newLat = c.lat;
        newLon = c.lon;
      }

      regionCodeNew = pickRegionCodeFromTags(best.el.tags);
      if (best.score >= minScore) matchStatus = "strong";
      else matchStatus = "weak";

      // apply changes (fill only, do not alter slug/canonical)
      ensureV2(w);

      if (website && !w.website) w.website = website;

      if (addressText && !w.v2.content.i18n.es.addressText) w.v2.content.i18n.es.addressText = addressText;

      if (newLat !== "" && typeof w.lat !== "number") w.lat = newLat;
      if (newLon !== "" && typeof w.lng !== "number") w.lng = newLon;

      // regionCode: only if current is poor
      if (regionCodeNew && shouldImproveRegionCode(w.regionCode)) {
        w.regionCode = regionCodeNew;
      }

      w.v2.sources.osm = {
        matched: true,
        strength: matchStatus,
        osmType,
        osmId,
        confidence: Number(confidence.toFixed(3)),
        mode,
        radiusM: mode === "around" ? usedRadius : undefined,
      };

      if (matchStatus === "strong") matchedStrong++;
      else matchedWeak++;
    } else {
      ensureV2(w);
      w.v2.sources.osm = {
        matched: false,
        strength: "none",
        mode,
        radiusM: mode === "around" ? usedRadius : undefined,
      };
      noMatch++;
    }

    qaRows.push({
      id,
      name,
      countryCode,
      regionCode: w.regionCode || "",
      lat: typeof w.lat === "number" ? w.lat : "",
      lon: typeof w.lng === "number" ? w.lng : "",
      website: w.website || "",
      addressText: w?.v2?.content?.i18n?.es?.addressText || "",
      osmType,
      osmId,
      osmConfidence: confidence ? confidence.toFixed(3) : "",
      matchStatus,
      ambiguous: ambiguous ? "yes" : "no",
    });
  }

  // write outputs
  const out: Dataset = {
    ...ds,
    meta: {
      ...(ds.meta || {}),
      enrichedAt: new Date().toISOString(),
      enrichment: {
        osm: {
          strong: matchedStrong,
          weak: matchedWeak,
          none: noMatch,
        },
      },
    },
    wineries,
  };

  writeJson(outputPath, out);
  writeCsv(outputCsvPath, qaRows);

  console.log(
    JSON.stringify(
      {
        inputPath,
        outputPath,
        outputCsvPath,
        wineriesProcessed: Math.min(max, wineries.length),
        matchedStrong,
        matchedWeak,
        noMatch,
      },
      null,
      2
    )
  );
}
