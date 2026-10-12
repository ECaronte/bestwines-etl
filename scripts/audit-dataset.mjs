import { readFile, writeFile } from "node:fs/promises";

const path = process.argv[2] || "out/dataset.json";
const raw = JSON.parse(await readFile(path, "utf8"));
const wineries = Array.isArray(raw.wineries) ? raw.wineries : [];
const ids = new Set();
const slugs = new Set();
const duplicateIds = [];
const duplicateSlugs = [];
let zz = 0;
let missingCoords = 0;
let unknownRegion = 0;

for (const w of wineries) {
  if (!w || typeof w !== "object") throw new Error("Invalid winery row");
  if (typeof w.id !== "string" || !w.id) throw new Error("Winery missing id");
  if (ids.has(w.id)) duplicateIds.push(w.id);
  ids.add(w.id);
  if (w.slug) {
    if (slugs.has(w.slug)) duplicateSlugs.push(w.slug);
    slugs.add(w.slug);
  }
  if (!/^[A-Z]{2}$/.test(String(w.countryCode || ""))) throw new Error("Invalid countryCode for " + w.id + ": " + w.countryCode);
  if (w.countryCode === "ZZ") zz++;
  if (w.lat == null || w.lng == null) missingCoords++;
  if (!w.region || w.region === "unknown") unknownRegion++;
}

if (!wineries.length) throw new Error("Dataset has no wineries");
if (duplicateIds.length) throw new Error("Duplicate winery ids: " + duplicateIds.slice(0, 20).join(", "));
if (duplicateSlugs.length) throw new Error("Duplicate winery slugs: " + duplicateSlugs.slice(0, 20).join(", "));

const report = { checkedAt: new Date().toISOString(), source: raw.meta?.source || null, wineries: wineries.length, uniqueIds: ids.size, slugs: slugs.size, countryZZ: zz, missingCoords, unknownRegion, publishApproved: false };
await writeFile("out/audit.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
