import fs from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node tools/audit_enriched.mjs out/dataset.enriched.json");
  process.exit(1);
}

const ds = JSON.parse(fs.readFileSync(file, "utf8"));
const w = ds.wineries || [];

const filled = (v) => {
  if (v == null) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "number") return Number.isFinite(v);
  if (typeof v === "boolean") return true;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return false;
};

const fields = [
  "website",
  "phone",
  "email",
  "osmId",
  "osmType",
  "osmUrl",
  "v2.content.i18n.en.addressText",
  "v2.content.i18n.es.addressText",
];

function get(obj, path) {
  return path.split(".").reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : undefined), obj);
}

const out = fields.map((f) => {
  let c = 0;
  for (const x of w) if (filled(get(x, f))) c++;
  return { field: f, filled: c, pct: (c / (w.length || 1) * 100).toFixed(1) };
}).sort((a,b)=>Number(b.pct)-Number(a.pct));

console.log(JSON.stringify({ wineries: w.length, metrics: out }, null, 2));
