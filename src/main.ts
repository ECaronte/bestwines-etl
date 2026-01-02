import fs from "node:fs/promises";
import path from "node:path";
import { config, log } from "./config.js";
import { loadManualDataset } from "./sources/manual.js";
import { loadWikidata } from "./sources/wikidata.js";
import { buildCanonicalDataset } from "./export/toDatasetJson.js";
import { datasetToCsv } from "./export/toCsv.js";
import { putTextToS3 } from "./publish/s3.js";

// ✅ NUEVO
import { enrichOsm } from "./enrich/enrich_osm.js";

async function ensureOutDir() {
  const outDir = path.resolve(process.cwd(), "out");
  await fs.mkdir(outDir, { recursive: true });
  return outDir;
}

async function runETL() {
  log("info", "ETL start", { SOURCE: config.source, LIMIT: config.limit });

  let input;

  if (config.source === "manual") {
    input = await loadManualDataset(config.limit);
  } else if (config.source === "wikidata") {
    input = await loadWikidata(config.limit);
  } else {
    throw new Error(
      `SOURCE not implemented. Use SOURCE=manual|wikidata. Got SOURCE=${config.source}`,
    );
  }

  const canonical = buildCanonicalDataset(input);

  // write out/
  const outDir = await ensureOutDir();
  const jsonPath = path.join(outDir, "dataset.json");
  const csvPath = path.join(outDir, "dataset.csv");

  await fs.writeFile(
    jsonPath,
    JSON.stringify(canonical, null, 2) + "\n",
    "utf-8",
  );
  await fs.writeFile(csvPath, datasetToCsv(canonical), "utf-8");

  log("info", "ETL done", {
    wineries: canonical.wineries.length,
    packs: canonical.packs.length,
    slugs: canonical.slugs.length,
    outJson: "out/dataset.json",
    outCsv: "out/dataset.csv",
  });

  return { canonical, jsonPath, csvPath };
}

async function runPublish() {
  const outDir = path.resolve(process.cwd(), "out");
  const jsonPath = path.join(outDir, "dataset.json");
  const csvPath = path.join(outDir, "dataset.csv");

  const datasetJson = await fs.readFile(jsonPath, "utf-8");
  const datasetCsv = await fs.readFile(csvPath, "utf-8");

  await putTextToS3({
    bucket: config.bucket,
    key: config.datasetKey,
    text: datasetJson,
    contentType: "application/json",
  });

  await putTextToS3({
    bucket: config.bucket,
    key: config.csvKey,
    text: datasetCsv,
    contentType: "text/csv",
  });

  log("info", "Publish done", {
    datasetKey: config.datasetKey,
    csvKey: config.csvKey,
  });
}

async function runPublishStaging() {
  const outDir = path.resolve(process.cwd(), "out");
  const jsonPath = path.join(outDir, "dataset.json");
  const csvPath = path.join(outDir, "dataset.csv");

  const datasetJson = await fs.readFile(jsonPath, "utf-8");
  const datasetCsv = await fs.readFile(csvPath, "utf-8");

  await putTextToS3({
    bucket: config.bucket,
    key: config.stagingDatasetKey,
    text: datasetJson,
    contentType: "application/json",
  });

  await putTextToS3({
    bucket: config.bucket,
    key: config.stagingCsvKey,
    text: datasetCsv,
    contentType: "text/csv",
  });

  log("info", "Publish STAGING done", {
    datasetKey: config.stagingDatasetKey,
    csvKey: config.stagingCsvKey,
  });
}

// ✅ NUEVO: Enrich OSM
async function runEnrichOsm() {
  // se asume que ya existe out/dataset.json
  await ensureOutDir();

  const limit = process.env.ENRICH_LIMIT ? Number(process.env.ENRICH_LIMIT) : undefined;

  await enrichOsm({
    inputPath: process.env.ENRICH_INPUT || "out/dataset.json",
    outputPath: process.env.ENRICH_OUTPUT || "out/dataset.enriched.json",
    outputCsvPath: process.env.ENRICH_CSV || "out/dataset.enriched.csv",
    limit,
  });
}

async function main() {
  const cmd = process.argv[2] || "etl";

  const allowed = [
    "etl",
    "publish",
    "publish:staging",
    "etl:publish",
    // ✅ NUEVOS
    "enrich:osm",
    "etl:enrich",
  ];

  if (!allowed.includes(cmd)) {
    throw new Error(
      `Unknown command: ${cmd}. Use ${allowed.join(" | ")}`,
    );
  }

  if (cmd === "etl") {
    await runETL();
    return;
  }

  if (cmd === "publish:staging") {
    await runPublishStaging();
    return;
  }

  if (cmd === "publish") {
    await runPublish();
    return;
  }

  if (cmd === "enrich:osm") {
    await runEnrichOsm();
    return;
  }

  if (cmd === "etl:enrich") {
    await runETL();
    await runEnrichOsm();
    return;
  }

  // etl:publish
  await runETL();
  await runPublish();
}

main().catch((err) => {
  log("error", err?.message || "Unknown error", { stack: err?.stack });
  process.exit(1);
});
