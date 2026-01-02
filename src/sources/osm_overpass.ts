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

function clip(s: string, n = 500) {
  return (s || "").slice(0, n);
}

function isLikelyJson(contentType: string | null, bodyText: string) {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("application/json")) return true;
  // Overpass a veces viene sin CT correcto, pero el body empieza con "{"
  return bodyText.trim().startsWith("{");
}

export class OverpassClient {
  private url: string;
  private rateMs: number;
  private timeoutMs: number;
  private maxRetries: number;
  private backoffBaseMs: number;

  constructor(opts?: { url?: string; rateMs?: number }) {
    this.url = opts?.url || process.env.OVERPASS_URL || "https://overpass-api.de/api/interpreter";
    this.rateMs = opts?.rateMs ?? Number(process.env.OSM_RATE_MS || 1200);

    // nuevos knobs
    const timeoutS = Number(process.env.OSM_TIMEOUT_S || 60);
    this.timeoutMs = Math.max(5000, timeoutS * 1000);
    this.maxRetries = Math.max(0, Number(process.env.OSM_MAX_RETRIES || 6));
    this.backoffBaseMs = Math.max(250, Number(process.env.OSM_BACKOFF_BASE_MS || 2000));
  }

  private async postOnce(query: string): Promise<OverpassResponse> {
    // rate limit
    await sleep(this.rateMs);

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), this.timeoutMs);

    try {
      const res = await fetch(this.url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded; charset=UTF-8" },
        body: `data=${encodeURIComponent(query)}`,
        signal: ac.signal,
      });

      const contentType = res.headers.get("content-type");
      const text = await res.text().catch(() => "");

      // No OK -> error siempre
      if (!res.ok) {
        throw new Error(`Overpass HTTP ${res.status}: ${clip(text, 400)}`);
      }

      // OK pero NO JSON -> también error (típico XML/HTML)
      if (!isLikelyJson(contentType, text)) {
        throw new Error(`Overpass NON-JSON OK: ct=${contentType || "?"} body=${clip(text, 400)}`);
      }

      // Parse JSON seguro
      try {
        return JSON.parse(text) as OverpassResponse;
      } catch (e: any) {
        throw new Error(`Overpass JSON parse error: ${e?.message || e} body=${clip(text, 400)}`);
      }
    } finally {
      clearTimeout(t);
    }
  }

  private async post(query: string): Promise<OverpassResponse> {
    let lastErr: any = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.postOnce(query);
      } catch (e: any) {
        lastErr = e;

        // backoff con jitter
        const wait =
          this.backoffBaseMs * Math.pow(1.6, attempt) +
          Math.floor(Math.random() * 400);

        // si es el último intento, rompe
        if (attempt === this.maxRetries) break;

        await sleep(wait);
      }
    }

    throw lastErr;
  }

  async searchAround(params: { lat: number; lon: number; radiusM: number }): Promise<OverpassResponse> {
    const { lat, lon, radiusM } = params;
    const timeout = Math.max(25, Number(process.env.OVERPASS_QUERY_TIMEOUT_S || 60)); // timeout interno de Overpass
    const q = `
[out:json][timeout:${timeout}];
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
    const timeout = Math.max(25, Number(process.env.OVERPASS_QUERY_TIMEOUT_S || 60));
    const name = params.name.replace(/"/g, '\\"');
    const q = `
[out:json][timeout:${timeout}];
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
