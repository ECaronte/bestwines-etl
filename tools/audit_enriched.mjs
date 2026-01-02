// tools/audit_enriched.mjs
// Uso:
//   node tools/audit_enriched.mjs out/dataset.enriched.json | jq '.'
//   node tools/audit_enriched.mjs out/dataset.enriched.json | jq '.metrics'

import fs from "node:fs";

const inputPath = process.argv[2] || "out/dataset.enriched.json";
const raw = fs.readFileSync(inputPath, "utf8");
const ds = JSON.parse(raw);
const w = Array.isArray(ds?.wineries) ? ds.wineries : [];

const filled = (v) => {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v === "boolean") return true;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return false;
};

const get = (obj, path) => {
  const parts = String(path).split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
};

const fields = [
  "website",
  "phone",
  "email",

  "v2.content.i18n.en.addressText",
  "v2.content.i18n.es.addressText",

  // OSM meta (si lo guardas en el enrich robusto)
  "v2.osm.id",
  "v2.osm.type",
  "v2.osm.url",
  "v2.osm.score",
  "v2.osm.match",
];

const metrics = fields
  .map((f) => {
    let c = 0;
    for (const x of w) if (filled(get(x, f))) c++;
    return {
      field: f,
      filled: c,
      pct: w.length ? (c / w.length * 100).toFixed(1) : "0.0",
    };
  })
  .sort((a, b) => Number(b.pct) - Number(a.pct));

process.stdout.write(
  JSON.stringify(
    {
      wineries: w.length,
      metrics,
    },
    null,
    2
  ) + "\n"
);
