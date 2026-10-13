import { readFile, writeFile } from "node:fs/promises";

const candidatePath = process.argv[2] || "out/dataset.json";
const apiBase = (process.env.BW_PUBLIC_API || "https://8y5sqsud79.execute-api.eu-west-1.amazonaws.com").replace(/\/+$/, "");
const raw = JSON.parse(await readFile(candidatePath, "utf8"));
const candidates = Array.isArray(raw.wineries) ? raw.wineries : [];

async function loadPublic() {
  const rows = [];
  let cursor = null;
  const seen = new Set();
  for (let page = 0; page < 20; page++) {
    const qs = new URLSearchParams({ lang: "en", limit: "200" });
    if (cursor) qs.set("cursor", cursor);
    const res = await fetch(apiBase + "/wineries?" + qs, {
      headers: { accept: "application/json", "user-agent": "BestWinesETLCompare/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error("public /wineries returned " + res.status);
    const body = await res.json();
    if (!Array.isArray(body.items)) throw new Error("public /wineries response has no items array");
    for (const item of body.items) {
      if (!item?.id || seen.has(item.id)) continue;
      if (item.status !== "active" || item.indexable !== true) throw new Error("public API leaked non-public winery " + item.id);
      seen.add(item.id);
      rows.push(item);
    }
    if (!body.nextCursor) break;
    if (body.nextCursor === cursor) throw new Error("public cursor cycle");
    cursor = body.nextCursor;
  }
  return rows;
}

const publicRows = await loadPublic();
const candidateById = new Map(candidates.map((w) => [w.id, w]));
const publicById = new Map(publicRows.map((w) => [w.id, w]));

const alreadyPublic = [];
const candidateNotPublic = [];
const publicMissingFromFreshSource = [];

for (const w of candidates) {
  const pub = publicById.get(w.id);
  if (pub) alreadyPublic.push({ id: w.id, candidateSlug: w.slug || null, publicSlug: pub.slug || pub.canonicalSlug || null, countryCode: w.countryCode });
  else candidateNotPublic.push({ id: w.id, name: w.name, slug: w.slug || null, countryCode: w.countryCode, region: w.region || null, hasCoords: Number.isFinite(w.lat) && Number.isFinite(w.lng) });
}
for (const w of publicRows) {
  if (!candidateById.has(w.id)) publicMissingFromFreshSource.push({ id: w.id, name: w.name, slug: w.slug || w.canonicalSlug || null, countryCode: w.countryCode });
}

const byCountry = {};
for (const w of candidateNotPublic) byCountry[w.countryCode] = (byCountry[w.countryCode] || 0) + 1;

const report = {
  checkedAt: new Date().toISOString(),
  apiBase,
  candidateTotal: candidates.length,
  publicTotal: publicRows.length,
  alreadyPublic: alreadyPublic.length,
  candidateNotPublic: candidateNotPublic.length,
  publicMissingFromFreshSource: publicMissingFromFreshSource.length,
  newCandidateCountryCounts: Object.fromEntries(Object.entries(byCountry).sort()),
  candidates: candidateNotPublic,
  missingPublic: publicMissingFromFreshSource,
  publishApproved: false,
};

await writeFile("out/public-comparison.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  candidateTotal: report.candidateTotal,
  publicTotal: report.publicTotal,
  alreadyPublic: report.alreadyPublic,
  candidateNotPublic: report.candidateNotPublic,
  publicMissingFromFreshSource: report.publicMissingFromFreshSource,
  newCandidateCountryCounts: report.newCandidateCountryCounts,
}, null, 2));
