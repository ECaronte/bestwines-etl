export type Candidate = {
  name?: string;
  website?: string;
  phone?: string;
  address?: string;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
};

function norm(s: string) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenScore(a: string, b: string) {
  const A = new Set(norm(a).split(" ").filter(Boolean));
  const B = new Set(norm(b).split(" ").filter(Boolean));
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / Math.max(A.size, B.size);
}

export function pickBestCandidate(opts: {
  wineryName: string;
  candidates: Candidate[];
}) {
  const { wineryName, candidates } = opts;

  let best: { c: Candidate; score: number } | null = null;

  for (const c of candidates) {
    const name = c.name || c.tags?.name || "";
    const s = tokenScore(wineryName, name);
    if (!best || s > best.score) best = { c, score: s };
  }

  return best; // {c, score} | null
}
