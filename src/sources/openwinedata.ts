import type { Dataset } from "../schema.js";

export async function loadOpenWineData(_limit = 0): Promise<Dataset> {
  throw new Error("OpenWineData source not implemented yet (stub).");
}
