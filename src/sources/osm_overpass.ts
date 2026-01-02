import fs from "node:fs";
import path from "node:path";

export type OverpassElement = {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

export type OverpassResponse = {
  elements: OverpassElement[];
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class OverpassClient {
  private url: string;
  private rateMs: number;

  constructor(opts?: { url?: string; rateMs?: number }) {
    this.url = opts?.url || process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";
    this.rateMs = opts?.rateMs ?? Number(process.env.OSM_RATE_MS || 1200);
  }

  private async post(query: string): Promise<OverpassResponse> {
    // rate limit
    await sleep(this.rateMs);

    const res = await fetch(this.url, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Overpass HTTP ${res.status}: ${text.slice(0, 400)}`);
    }
    return (await res.json()) as OverpassResponse;
  }

  async searchAround(params: {
    lat: number;
    lon: number;
    radiusM: number;
  }): Promise<OverpassResponse> {
    const { lat, lon, radiusM } = params;
    const q = `
[out:json][timeout:25];
(
  node(around:${radiusM},${lat},${lon})["craft"="winery"];
  way(around:${radiusM},${lat},${lon})["craft"="winery"];
  relation(around:${radiusM},${lat},${lon})["craft"="winery"];

  node(around:${radiusM},${lat},${lon})["amenity"="winery"];
  way(around:${radiusM},${lat},${lon})["amenity"="winery"];
  relation(around:${radiusM},${lat},${lon})["amenity"="winery"];

  node(around:${radiusM},${lat},${lon})["industrial"="winery"];
  way(around:${radiusM},${lat},${lon})["industrial"="winery"];
  relation(around:${radiusM},${lat},${lon})["industrial"="winery"];

  node(around:${radiusM},${lat},${lon})["shop"="wine"];
  way(around:${radiusM},${lat},${lon})["shop"="wine"];
  relation(around:${radiusM},${lat},${lon})["shop"="wine"];
);
out center tags;
`.trim();

    return await this.post(q);
  }

  async searchByName(params: { name: string }): Promise<OverpassResponse> {
    const name = params.name.replace(/"/g, '\\"');
    const q = `
[out:json][timeout:25];
(
  node["name"~"(?i)${name}"];
  way["name"~"(?i)${name}"];
  relation["name"~"(?i)${name}"];
);
out center tags;
`.trim();

    return await this.post(q);
  }
}

// cache helpers (raw Overpass responses per wineryId)
export function cachePathFor(wineryId: string) {
  return path.join(process.cwd(), "data", "osm-cache", `${wineryId}.json`);
}

export function readCache(wineryId: string, ttlDays = 30): OverpassResponse | null {
  const p = cachePathFor(wineryId);
  if (!fs.existsSync(p)) return null;

  try {
    const st = fs.statSync(p);
    const ageMs = Date.now() - st.mtimeMs;
    const ttlMs = ttlDays * 24 * 3600 * 1000;
    if (ageMs > ttlMs) return null;

    const raw = fs.readFileSync(p, "utf8");
    return JSON.parse(raw) as OverpassResponse;
  } catch {
    return null;
  }
}

export function writeCache(wineryId: string, payload: OverpassResponse) {
  const p = cachePathFor(wineryId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(payload, null, 2), "utf8");
}
