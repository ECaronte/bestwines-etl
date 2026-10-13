import { readFile, writeFile } from "node:fs/promises";

const comparisonPath = process.argv[2] || "out/public-comparison.json";
const outPath = process.argv[3] || "out/publication-proposal.json";
const maxBatch = Number(process.env.BW_PROPOSAL_MAX_BATCH || "25");

const comparison = JSON.parse(await readFile(comparisonPath, "utf8"));
const ready = Array.isArray(comparison.readyForReview) ? comparison.readyForReview : [];
const held = Array.isArray(comparison.heldForQuality) ? comparison.heldForQuality : [];

function priority(row) {
  let score = 0;
  if (row.hasCoords) score += 3;
  if (row.region && row.region !== "unknown") score += 2;
  if (row.slug) score += 2;
  if (row.countryCode && row.countryCode !== "ZZ") score += 2;
  if (row.name) score += 1;
  return score;
}

const sorted = [...ready].sort((a, b) => {
  const d = priority(b) - priority(a);
  if (d) return d;
  return String(a.countryCode).localeCompare(String(b.countryCode)) ||
    String(a.name).localeCompare(String(b.name));
});

const proposed = sorted.slice(0, Math.max(0, maxBatch)).map((row) => ({
  wineryId: row.id,
  name: row.name,
  canonicalSlug: row.slug,
  countryCode: row.countryCode,
  region: row.region,
  hasCoords: row.hasCoords,
  proposedStatus: "active",
  proposedIndexable: true,
  action: "CREATE_PUBLIC_WINERY",
  approvalRequired: true,
}));

const report = {
  generatedAt: new Date().toISOString(),
  sourceCheckedAt: comparison.checkedAt || null,
  candidateTotal: comparison.candidateTotal ?? null,
  publicTotal: comparison.publicTotal ?? null,
  readyForReviewCount: ready.length,
  heldForQualityCount: held.length,
  maxBatch,
  proposedCount: proposed.length,
  remainingReadyCount: Math.max(0, ready.length - proposed.length),
  proposed,
  heldForQuality: held,
  productionWritePerformed: false,
  approvalRequired: true,
  approvalInstruction:
    "Approve winery IDs explicitly in a separate publication step. This proposal must never write production by itself.",
};

await writeFile(outPath, JSON.stringify(report, null, 2));

const header = [
  "wineryId","name","canonicalSlug","countryCode","region",
  "proposedStatus","proposedIndexable","approvalRequired"
];
const q = (v) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
const csv = [header.join(","), ...proposed.map((r) => [
  r.wineryId,r.name,r.canonicalSlug,r.countryCode,r.region,
  r.proposedStatus,r.proposedIndexable,r.approvalRequired
].map(q).join(","))].join("\n") + "\n";
await writeFile(outPath.replace(/\.json$/i, ".csv"), csv);

console.log(JSON.stringify({
  proposedCount: report.proposedCount,
  remainingReadyCount: report.remainingReadyCount,
  heldForQualityCount: report.heldForQualityCount,
  productionWritePerformed: report.productionWritePerformed,
  approvalRequired: report.approvalRequired,
}, null, 2));
