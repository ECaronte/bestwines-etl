import type { Dataset } from "./schema.js";

/**
 * Futuro: merge/dedupe por:
 * - match por slug, por (name+country+region), o IDs externos
 * - reglas: preferir lat/lng más precisas, score máximo, featuredLangs union, etc.
 */
export function mergeDatasets(datasets: Dataset[]): Dataset {
  if (datasets.length === 0) throw new Error("mergeDatasets: empty input");
  if (datasets.length === 1) return datasets[0];

  // MVP: concat simple (NO USAR en producción sin dedupe)
  const base = datasets[0];
  return datasets.slice(1).reduce((acc, ds) => {
    acc.wineries.push(...ds.wineries);
    acc.packs.push(...ds.packs);
    acc.slugs.push(...ds.slugs);
    return acc;
  }, structuredClone(base));
}
