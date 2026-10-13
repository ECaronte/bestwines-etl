import { readFile, writeFile } from "node:fs/promises";

const candidatePath = process.argv[2] || "out/dataset.json";
const apiBase = (process.env.BW_PUBLIC_API || "https://8y5sqsud79.execute-api.eu-west-1.amazonaws.com").replace(/\/+$/, "");
const raw = JSON.parse(await readFile(candidatePath, "utf8"));
const candidates = Array.isArray(raw.wineries) ? raw.wineries : [];
const internalScanPath = process.env.BW_INTERNAL_SCAN || "";
const internalById = new Map();
const internalBySlug = new Map();

if (internalScanPath) {
  const scan = JSON.parse(await readFile(internalScanPath, "utf8"));
  for (const it of scan.Items || []) {
    const pk = it?.PK?.S || "";
    const sk = it?.SK?.S || "";
    const type = it?.type?.S || "";
    if (sk !== "META" || type !== "WINERY" || !pk.startsWith("W#")) continue;
    const id = pk.slice(2);
    const slug = it?.canonicalSlug?.S || it?.slug?.S || "";
    const meta = {
      id,
      slug,
      status: it?.status?.S || null,
      indexable: it?.indexable?.BOOL ?? null,
    };
    internalById.set(id, meta);
    if (slug) internalBySlug.set(slug, meta);
  }
}

async function loadCountry(countryCode) {
  const rows = [];
  let cursor = null;
  const seen = new Set();
  for (let page = 0; page < 20; page++) {
    const qs = new URLSearchParams({ lang: "en", limit: "50" });
    if (cursor) qs.set("cursor", cursor);
    const res = await fetch(apiBase + "/country/" + encodeURIComponent(countryCode) + "/wineries?" + qs, {
      headers: { accept: "application/json", "user-agent": "BestWinesETLCompare/1.0" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error("country " + countryCode + " returned " + res.status);
    const body = await res.json();
    if (!Array.isArray(body.items)) throw new Error("country " + countryCode + " has no items array");
    for (const item of body.items) {
      if (!item?.id || seen.has(item.id)) continue;
      if (item.status !== "active" || item.indexable !== true) throw new Error("country endpoint leaked non-public winery " + item.id);
      seen.add(item.id);
      rows.push(item);
    }
    if (!body.nextCursor) break;
    if (body.nextCursor === cursor) throw new Error("country cursor cycle for " + countryCode);
    cursor = body.nextCursor;
  }
  return rows;
}

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

const sitemapRes = await fetch(apiBase + "/sitemap.xml", {
  headers: { accept: "application/xml", "user-agent": "BestWinesETLCompare/1.0" },
  signal: AbortSignal.timeout(15000),
});
if (!sitemapRes.ok) throw new Error("public sitemap returned " + sitemapRes.status);
const sitemapText = await sitemapRes.text();
const sitemapWinerySlugs = [...sitemapText.matchAll(/<loc>https:\/\/best-wines\.eu\/bodega\/([^<]+)<\/loc>/g)]
  .map((m) => decodeURIComponent(m[1]));
const sitemapCountryCodes = [...sitemapText.matchAll(/<loc>https:\/\/best-wines\.eu\/pais\/([A-Z]{2})<\/loc>/g)]
  .map((m) => m[1]);
const countryRows = [];
for (const cc of sitemapCountryCodes) countryRows.push(...await loadCountry(cc));
const countrySlugs = new Set(countryRows.map((w) => w.slug || w.canonicalSlug).filter(Boolean));
const sitemapMissingFromCountryLists = sitemapWinerySlugs.filter((slug) => !countrySlugs.has(slug));
const countryListsMissingFromSitemap = [...countrySlugs].filter((slug) => !sitemapWinerySlugs.includes(slug));
const publicSlugs = new Set(publicRows.map((w) => w.slug || w.canonicalSlug).filter(Boolean));
const sitemapMissingFromPublicList = sitemapWinerySlugs.filter((slug) => !publicSlugs.has(slug));
const publicListMissingFromSitemap = [...publicSlugs].filter((slug) => !sitemapWinerySlugs.includes(slug));
const candidateById = new Map(candidates.map((w) => [w.id, w]));
const publicById = new Map(publicRows.map((w) => [w.id, w]));

const alreadyPublic = [];
const alreadyKnownInternal = [];
const candidateNotPublic = [];
const publicMissingFromFreshSource = [];

for (const w of candidates) {
  const pub = publicById.get(w.id);
  if (pub) {
    alreadyPublic.push({ id: w.id, candidateSlug: w.slug || null, publicSlug: pub.slug || pub.canonicalSlug || null, countryCode: w.countryCode });
    continue;
  }

  const internal = internalById.get(w.id) || (w.slug ? internalBySlug.get(w.slug) : null);
  if (internal) {
    alreadyKnownInternal.push({
      id: w.id,
      name: w.name,
      candidateSlug: w.slug || null,
      internalId: internal.id,
      internalSlug: internal.slug || null,
      internalStatus: internal.status,
      internalIndexable: internal.indexable,
      countryCode: w.countryCode,
    });
    continue;
  }

  candidateNotPublic.push({ id: w.id, name: w.name, slug: w.slug || null, countryCode: w.countryCode, region: w.region || null, hasCoords: Number.isFinite(w.lat) && Number.isFinite(w.lng) });
}
for (const w of publicRows) {
  if (!candidateById.has(w.id)) publicMissingFromFreshSource.push({ id: w.id, name: w.name, slug: w.slug || w.canonicalSlug || null, countryCode: w.countryCode });
}

const byCountry = {};
const readyForReview = [];
const heldForQuality = [];
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const europeCountryCodes = new Set([
  "AL","AD","AT","BY","BE","BA","BG","HR","CY","CZ","DK","EE","FI","FR",
  "DE","GR","HU","IS","IE","IT","LV","LI","LT","LU","MT","MD","MC","ME",
  "NL","MK","NO","PL","PT","RO","SM","RS","SK","SI","ES","SE","CH","UA",
  "GB","VA","XK"
]);

for (const w of candidateNotPublic) {
  byCountry[w.countryCode] = (byCountry[w.countryCode] || 0) + 1;
  const reasons = [];
  if (!/^[A-Z]{2}$/.test(String(w.countryCode || "")) || w.countryCode === "ZZ") reasons.push("country");
  if (!w.hasCoords) reasons.push("coordinates");
  if (!w.region || w.region === "unknown") reasons.push("region");
  if (!slugPattern.test(String(w.slug || ""))) reasons.push("slug");
  const cleanName = String(w.name || "").trim();
  if (!cleanName) reasons.push("name");
  else if (/^Q\d+$/i.test(cleanName)) reasons.push("name-placeholder");
  if (!europeCountryCodes.has(String(w.countryCode || "").toUpperCase())) reasons.push("outside-europe");
  const item = { ...w, qualityHoldReasons: reasons };
  if (reasons.length) heldForQuality.push(item);
  else readyForReview.push(item);
}

const report = {
  checkedAt: new Date().toISOString(),
  apiBase,
  candidateTotal: candidates.length,
  publicTotal: publicRows.length,
  sitemapWineryTotal: sitemapWinerySlugs.length,
  sitemapCountryTotal: sitemapCountryCodes.length,
  countryListTotal: countrySlugs.size,
  sitemapMissingFromCountryListsCount: sitemapMissingFromCountryLists.length,
  countryListsMissingFromSitemapCount: countryListsMissingFromSitemap.length,
  sitemapMissingFromPublicListCount: sitemapMissingFromPublicList.length,
  publicListMissingFromSitemapCount: publicListMissingFromSitemap.length,
  alreadyPublic: alreadyPublic.length,
  alreadyKnownInternal: alreadyKnownInternal.length,
  candidateNotPublic: candidateNotPublic.length,
  publicMissingFromFreshSource: publicMissingFromFreshSource.length,
  newCandidateCountryCounts: Object.fromEntries(Object.entries(byCountry).sort()),
  readyForReviewCount: readyForReview.length,
  heldForQualityCount: heldForQuality.length,
  readyForReview,
  heldForQuality,
  alreadyKnownInternalRows: alreadyKnownInternal,
  candidates: candidateNotPublic,
  missingPublic: publicMissingFromFreshSource,
  sitemapMissingFromPublicList,
  publicListMissingFromSitemap,
  sitemapMissingFromCountryLists,
  countryListsMissingFromSitemap,
  publishApproved: false,
};

await writeFile("out/public-comparison.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify({
  candidateTotal: report.candidateTotal,
  publicTotal: report.publicTotal,
  sitemapWineryTotal: report.sitemapWineryTotal,
  sitemapCountryTotal: report.sitemapCountryTotal,
  countryListTotal: report.countryListTotal,
  sitemapMissingFromCountryListsCount: report.sitemapMissingFromCountryListsCount,
  countryListsMissingFromSitemapCount: report.countryListsMissingFromSitemapCount,
  sitemapMissingFromPublicListCount: report.sitemapMissingFromPublicListCount,
  publicListMissingFromSitemapCount: report.publicListMissingFromSitemapCount,
  alreadyPublic: report.alreadyPublic,
  alreadyKnownInternal: report.alreadyKnownInternal,
  candidateNotPublic: report.candidateNotPublic,
  publicMissingFromFreshSource: report.publicMissingFromFreshSource,
  newCandidateCountryCounts: report.newCandidateCountryCounts,
  readyForReviewCount: report.readyForReviewCount,
  heldForQualityCount: report.heldForQualityCount,
}, null, 2));

// Post-pagination production recheck 2026-10-13
