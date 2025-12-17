import type { Dataset } from "../schema.js";

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  if (/[,"\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function datasetToCsv(ds: Dataset): string {
  const lines: string[] = [];

  // header “universal”
  const header = [
    "type",
    "id",
    "name",
    "countryCode",
    "region",
    "score",
    "slug",
    "lat",
    "lng",
    "geo",
    "featuredLangs",
    "wineryId",
    "typeKey",
    "title",
    "targetType",
    "targetId",
  ];
  lines.push(header.join(","));

  for (const w of ds.wineries) {
    lines.push(
      [
        "WINERY",
        w.id,
        w.name,
        w.countryCode,
        w.region,
        w.score ?? "",
        w.slug ?? "",
        w.lat ?? "",
        w.lng ?? "",
        w.geo ?? "",
        (w.featuredLangs ?? []).join("|"),
        "",
        "",
        "",
        "",
        "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  for (const p of ds.packs) {
    lines.push(
      [
        "PACK",
        p.id,
        "",
        p.countryCode,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        p.wineryId,
        p.typeKey,
        p.title,
        "",
        "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  for (const s of ds.slugs) {
    lines.push(
      [
        "SLUG",
        "",
        "",
        "",
        "",
        "",
        s.slug,
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        s.targetType,
        s.targetId,
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  return lines.join("\n") + "\n";
}
