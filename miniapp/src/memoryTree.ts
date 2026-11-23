
export const TREE_STAGES = 5; 
export const ORB_FULL_DAY = 50;
export const READ_WEIGHT = 0.25;
export const ART_MAX = 85; 
export const ORB = { x: 400, y: 136 }; 
export const ORB_R = [4, 8, 13, 19, 25]; 
export const GIRL_MAX = 119;
export const ORB_MAX = 200;
export const MOTES_MAX = 60; 
export const HOME_HERMES = { x: 264, y: 150, size: 48 };

export interface Captures { notes: number; meetings: number; translations: number; read?: number }
export type MoteKind = 'note' | 'meeting' | 'translation' | 'read';

export function orbGrowth(c: Captures): number {
  return Math.min(1, (c.notes + c.meetings + c.translations + READ_WEIGHT * (c.read ?? 0)) / ORB_FULL_DAY);
}

export function growthStage(g: number, any: boolean): number {
  return any ? 1 + Math.min(3, Math.floor(g * 4)) : 0;
}

export function orbRadius(g: number): number {
  const x = Math.max(0, Math.min(1, g)) * (ORB_R.length - 1);
  const i = Math.min(ORB_R.length - 2, Math.floor(x));
  return ORB_R[i] + (ORB_R[i + 1] - ORB_R[i]) * (x - i);
}

export interface Mote { kind: MoteKind; x: number; y: number }

function rng(seed: number): () => number { 
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function streamAt(t: number, r: number): { x: number; y: number } {
  return { x: 20 + t * (ORB.x - r - 40 - 20), y: ORB.y + Math.sin(t * 7) * (60 * (1 - t) + 6) };
}

export function motes(c: Captures, g: number): Mote[] {
  const r = orbRadius(g);
  const raw = [c.notes, c.meetings, c.translations, c.read ?? 0];
  const sum = raw.reduce((a, b) => a + b, 0);
  const scale = sum > MOTES_MAX ? MOTES_MAX / sum : 1;
  let [n, m, tr, rd] = raw.map((x) => (x > 0 ? Math.max(1, Math.round(x * scale)) : 0));
  const kinds: MoteKind[] = [];
  const total = n + m + tr + rd;
  for (let i = 0; i < total; i++) { 
    const left = n + m + tr + rd;
    const pick = (i * 7919) % Math.max(1, left);
    if (pick < m && m) { kinds.push('meeting'); m--; } else if (pick < m + tr && tr) { kinds.push('translation'); tr--; }
    else if (pick < m + tr + rd && rd) { kinds.push('read'); rd--; } else if (n) { kinds.push('note'); n--; }
    else if (m) { kinds.push('meeting'); m--; } else if (tr) { kinds.push('translation'); tr--; } else { kinds.push('read'); rd--; }
  }
  const rand = rng(424242);
  return kinds.map((kind, j) => {
    const t = (j + 0.5) / Math.max(1, kinds.length);
    const p = streamAt(t, r);
    return { kind, x: Math.round(p.x), y: Math.round(p.y + (rand() - 0.5) * 20) };
  });
}
