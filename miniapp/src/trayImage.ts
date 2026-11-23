
import { TRAY_KINDS, type Slot, type TrayKind } from './tray.ts';
import { ART_MAX, GIRL_MAX, ORB, ORB_MAX, motes, orbRadius, streamAt, type Captures } from './memoryTree.ts';

export const STRIP_W = 280;
export const STRIP_H = 144; 
export const ROW_W = STRIP_W * 2;
export const DIA = 46; 
const PITCH_MAX = 104; 
const Y_TOP = 30; 
const Y_SIDE = 96; 
const Y_CAP = 100; 
const REACH = 34; 

const icons: Partial<Record<TrayKind, HTMLImageElement>> = {};

export async function loadTrayIcons(base = './tray/'): Promise<void> {
  await Promise.all(TRAY_KINDS.map((k) => new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = () => { icons[k] = img; resolve(); };
    img.onerror = () => { console.warn(`tray icon ${k} missing`); resolve(); };
    img.src = `${base}${k}.png`;
  })));
}

export function arcSpot(i: number, n: number): { x: number; y: number } {
  const pitch = Math.min(PITCH_MAX, Math.floor(520 / Math.max(1, n)));
  const dx = (i - (n - 1) / 2) * pitch;
  const ref = 2 * PITCH_MAX; 
  return { x: ROW_W / 2 + dx, y: Math.min(Y_CAP, Y_TOP + (Y_SIDE - Y_TOP) * (dx / ref) ** 2) };
}

export function slotsIn(half: 0 | 1, n = TRAY_KINDS.length): number[] {
  const x0 = half * STRIP_W, x1 = x0 + STRIP_W;
  return Array.from({ length: n }, (_, i) => i).filter((i) => {
    const { x } = arcSpot(i, n);
    return x - REACH < x1 && x + REACH > x0;
  });
}


let girl: HTMLImageElement | null = null;
export async function loadOrbArt(base = './'): Promise<void> {
  const load = (src: string) => new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { console.warn(`orb art ${src} missing`); resolve(null); };
    img.src = `${base}${src}`;
  });
  [girl] = await Promise.all([load('orb/girl.png')]);
}

const grey = (v: number) => `rgb(${v},${v},${v})`;

export function orbitPath(t: number, r: number): { x: number; y: number } {
  const x0 = 566, y0 = 282, x1 = ORB.x + r + 2, y1 = ORB.y + 2;
  const u = 1 - t;
  return { x: u * u * x0 + 2 * u * t * 560 + t * t * x1, y: u * u * y0 + 2 * u * t * (ORB.y + 40) + t * t * y1 };
}
export const ORBIT_FRAMES = 8;

function drawOrbArt(g: CanvasRenderingContext2D, art: HomeArt, frame = 0): void {
  const phase = (frame % ORBIT_FRAMES) / ORBIT_FRAMES; 
  const stage = art.stage; 
  const r = orbRadius(art.growth); 
  if (girl) { 
    g.globalAlpha = GIRL_MAX / 255;
    g.drawImage(girl, 0, 0, 576, 288);
    g.globalAlpha = 1;
  }
  const ms = motes(art.captures, art.growth);
  if (ms.length > 1) { 
    g.strokeStyle = grey(30);
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i <= 60; i++) {
      const p = streamAt(i / 60, r);
      if (i) g.lineTo(p.x, p.y); else g.moveTo(p.x, p.y);
    }
    g.stroke();
  }
  g.lineWidth = 1;
  for (const m of ms) { 
    g.strokeStyle = g.fillStyle = grey(ART_MAX);
    if (m.kind === 'read') { g.fillStyle = grey(45); g.fillRect(m.x, m.y, 2, 2); } 
    else if (m.kind === 'note') g.fillRect(m.x - 1, m.y - 1, 3, 3);
    else if (m.kind === 'meeting') { g.beginPath(); g.arc(m.x, m.y, 4, 0, Math.PI * 2); g.stroke(); }
    else { g.beginPath(); g.moveTo(m.x, m.y - 4); g.lineTo(m.x + 4, m.y); g.lineTo(m.x, m.y + 4); g.lineTo(m.x - 4, m.y); g.closePath(); g.stroke(); }
  }
  for (let i = r; i > 0; i--) { 
    g.fillStyle = grey(Math.round(35 + (ORB_MAX - 35) * (1 - i / r)));
    g.beginPath(); g.arc(ORB.x, ORB.y, i, 0, Math.PI * 2); g.fill();
  }
  g.strokeStyle = grey(ORB_MAX);
  const spin = phase * Math.PI * 2;
  if (stage >= 2) { 
    for (const k of [1, 2]) { g.beginPath(); g.ellipse(ORB.x, ORB.y, r, r * 0.35 * k * (0.78 + 0.22 * Math.cos(spin + k)), 0, 0, Math.PI * 2); g.stroke(); }
    g.beginPath(); g.moveTo(ORB.x - r, ORB.y); g.lineTo(ORB.x + r, ORB.y); g.stroke();
    g.beginPath(); g.ellipse(ORB.x, ORB.y, Math.max(1, r * 0.45 * Math.abs(Math.cos(spin / 2))), r, 0, 0, Math.PI * 2); g.stroke();
  }
  if (stage >= 3) { g.strokeStyle = grey(Math.round(ORB_MAX * 0.85)); g.beginPath(); g.ellipse(ORB.x, ORB.y, r * 2, r * 0.55, -0.12 + phase * Math.PI, 0, Math.PI * 2); g.stroke(); }
  if (stage >= 4) { g.strokeStyle = grey(GIRL_MAX); g.beginPath(); g.ellipse(ORB.x, ORB.y, r * 2.6, r * 0.8, 0.25 - phase * Math.PI * 0.6, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = grey(ORB_MAX);
  for (let k = 0; k < 4; k++) {
    const t = (phase + k / 4) % 1;
    const p = orbitPath(t, r);
    const s = t > 0.8 ? 2 : 3; 
    g.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, s, s);
  }
}


async function png(c: HTMLCanvasElement): Promise<number[]> {
  const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/png'));
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}

export interface HomeArt { stage: number; growth: number; captures: Captures }
export type HomeBox = 'artL' | 'artR';
export const HOME_BOXES: Record<HomeBox, { x: number; y: number; w: number; h: number }> = {
  artL: { x: 372, y: 30, w: 204, h: 129 },
  artR: { x: 372, y: 159, w: 204, h: 129 },
};

export async function homePngs(slots: Slot[], art: HomeArt | null = null, frame = 0): Promise<Record<HomeBox, number[]>> {
  const scr = document.createElement('canvas');
  scr.width = 576;
  scr.height = 288;
  const g = scr.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, 576, 288);
  g.imageSmoothingEnabled = false; 
  if (slots.length && art) drawOrbArt(g, art, frame);
  const out = {} as Record<HomeBox, number[]>;
  for (const [box, b] of Object.entries(HOME_BOXES) as [HomeBox, typeof HOME_BOXES.artL][]) {
    const c = document.createElement('canvas');
    c.width = b.w;
    c.height = b.h;
    c.getContext('2d')!.drawImage(scr, -b.x, -b.y);
    out[box] = await png(c);
  }
  return out;
}
