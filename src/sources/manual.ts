import fs from "node:fs/promises";
import path from "node:path";
import { DatasetSchema, type Dataset } from "../schema.js";

export async function loadManualDataset(limit = 0): Promise<Dataset> {
  const filePath = path.resolve(process.cwd(), "data", "manual.json");
  const raw = await fs.readFile(filePath, "utf-8");
  const parsed = JSON.parse(raw);

  const ds = DatasetSchema.parse(parsed);

  if (limit > 0) {
    return {
      ...ds,
      wineries: ds.wineries.slice(0, limit),
      packs: ds.packs.filter((p) =>
        ds.wineries.slice(0, limit).some((w) => w.id === p.wineryId),
      ),
      slugs: ds.slugs.filter((s) =>
        ds.wineries.slice(0, limit).some((w) => w.id === s.targetId),
      ),
    };
  }
  return ds;
}
