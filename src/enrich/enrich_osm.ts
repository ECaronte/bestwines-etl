import fs from "node:fs";
import path from "node:path";
import { OverpassClient } from "../sources/osm_overpass.js";
import { pickBestCandidate, type Candidate } from "./match.js";

type Winery = {
  id: string;
  name: string;
  countryCode?: string;
  region?: string;
  lat?: number;
  lng?: number;
  website?: string;
  // cualquier otro campo lo dejamos pasar sin tiparlo
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

  const qaRows: Record<string, any>[] = [];

  for (let i = 0; i < max; i++) {
    const w = wineries[i];
    const lat = w.lat;
    const lon = w.lng;

    // si no hay coords, no hacemos OSM por ahora
    if (typeof lat !== "number" || typeof lon !== "number") {
      noMatch++;
      qaRows.push({
        id: w.id,
        name: w.name,
        status: "no_coords",
      });
      continue;
    }

    const res = await client.searchAround({
  lat,
  lon,
  radiusM,
});

const els = Array.isArray((res as any)?.elements) ? (res as any).elements : [];

const candidates: Candidate[] = els.map((el: any) => {
  const t = el?.tags || {};
  const c = el?.center || {};
  const lat2 = typeof el?.lat === "number" ? el.lat : (typeof c?.lat === "number" ? c.lat : undefined);
  const lon2 = typeof el?.lon === "number" ? el.lon : (typeof c?.lon === "number" ? c.lon : undefined);

  // website en OSM suele estar en website o contact:website
  const website = t.website || t["contact:website"] || t["url"] || "";
  const phone = t.phone || t["contact:phone"] || t["contact:mobile"] || "";
  const name = t.name || "";
  const addr =
    [
      t["addr:housenumber"],
      t["addr:street"],
      t["addr:postcode"],
      t["addr:city"],
      t["addr:state"],
      t["addr:country"],
    ]
      .filter(Boolean)
      .join(" ")
      .trim() || "";

  return {
    name,
    website,
    phone,
    address: addr,
    lat: lat2,
    lon: lon2,
    tags: t,
  };
});

    const best = pickBestCandidate({ wineryName: w.name, candidates });

    if (!best) {
      noMatch++;
      qaRows.push({
        id: w.id,
        name: w.name,
        status: "no_match",
      });
      continue;
    }

    const score = best.score;
    const b = best.c;

    const status =
      score >= minScore ? "matched_strong" : score >= weakScore ? "matched_weak" : "low_confidence";

    if (status === "matched_strong") matchedStrong++;
    else if (status === "matched_weak") matchedWeak++;
    else noMatch++;

    // guardamos SOLO cosas “safe” (web/phone/address) sin tocar slugs ni ids
    const outW = { ...w };

    if (!outW.website && b.website) outW.website = b.website;
    if (!outW.v2) outW.v2 = {};
    if (!outW.v2.location) outW.v2.location = {};
    if (!outW.v2.content) outW.v2.content = {};
    if (!outW.v2.content.i18n) outW.v2.content.i18n = {};
    if (!outW.v2.content.i18n.en) outW.v2.content.i18n.en = {};
    if (!outW.v2.content.i18n.es) outW.v2.content.i18n.es = {};

    // addressText (mínimo)
    const address = b.address || "";
    if (address) {
      if (!outW.v2.content.i18n.en.addressText) outW.v2.content.i18n.en.addressText = address;
      if (!outW.v2.content.i18n.es.addressText) outW.v2.content.i18n.es.addressText = address;
    }

    // phone (mínimo)
    if (b.phone) outW.phone = outW.phone || b.phone;

    wineries[i] = outW;

    qaRows.push({
      id: w.id,
      name: w.name,
      status,
      score: score.toFixed(3),
      osmName: b.name || "",
      website: b.website || "",
      phone: b.phone || "",
      address: b.address || "",
    });
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
        minScore,
        weakScore,
        radiusM,
      },
      null,
      2
    )
  );
}
