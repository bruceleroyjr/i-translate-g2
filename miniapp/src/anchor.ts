
export interface AxisMap { axis: 'x' | 'y' | 'z'; degPerUnit: number; sign: 1 | -1 }
export interface Cone { full: number; dim: number }
export interface AngleMap { kind?: 'angles'; yaw: AxisMap | null; pitch: AxisMap | null; sampleMs: number; spikeDeg: number; cone?: Cone }
export interface GravityMap {
  kind: 'gravity';
  pitch: { axis: 'x' | 'y' | 'z'; sign: 1 | -1 }; 
  roll: { axis: 'x' | 'y' | 'z'; sign: 1 | -1 }; 
  g?: number; 
  sampleMs: number;
  spikeDeg: number;
  cone?: Cone;
}
export type ImuMap = AngleMap | GravityMap;

export const IMU_MAP: ImuMap | null = {
  kind: 'gravity', pitch: { axis: 'x', sign: 1 }, roll: { axis: 'y', sign: 1 }, g: 0.994, sampleMs: 91, spikeDeg: 60,
  cone: { full: 10, dim: 22 },
};

export const FULL_DEG = 20; 
export const DIM_DEG = 35; 
export const SMOOTH_MS = 500; 
export const SUSTAIN_MS = 1000; 
export const GLITCH_MAX = 2; 
export const OFF_AFTER_MS = 700; 
export const STALE_MS = 3000; 

export type Vec3 = [number, number, number];
export type Level = 0 | 1 | 2 | 3 | 4;
export type AnchorState = 'FACING' | 'TURNED';

const RAD = Math.PI / 180;
const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));
const vec = (pitch: number, turn: number): Vec3 => [Math.cos(pitch * RAD) * Math.sin(turn * RAD), Math.sin(pitch * RAD), Math.cos(pitch * RAD) * Math.cos(turn * RAD)];
const pitchOf = (v: Vec3) => Math.asin(clamp1(v[1])) / RAD;
const turnOf = (v: Vec3) => Math.atan2(v[0], v[2]) / RAD;

export function direction(s: { x: number; y: number; z: number }, map: ImuMap): Vec3 {
  if (map.kind === 'gravity') {
    const len = Math.hypot(s.x, s.y, s.z) || 1;
    const pitch = Math.asin(clamp1((s[map.pitch.axis] * map.pitch.sign) / len)) / RAD;
    const roll = Math.asin(clamp1((s[map.roll.axis] * map.roll.sign) / len)) / RAD;
    return vec(pitch, roll);
  }
  const yaw = map.yaw ? s[map.yaw.axis] * map.yaw.degPerUnit * map.yaw.sign : 0;
  const pitch = map.pitch ? s[map.pitch.axis] * map.pitch.degPerUnit * map.pitch.sign : 0;
  return vec(pitch, yaw);
}

export function angleDeg(a: Vec3, b: Vec3): number {
  return Math.acos(clamp1(a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) / RAD;
}

export function levelFor(deg: number, full = FULL_DEG, dim = DIM_DEG): Level {
  if (deg <= full) return 4;
  if (deg > dim) return 0;
  return (3 - Math.min(2, Math.floor((deg - full - 1e-9) / ((dim - full) / 3)))) as Level;
}

interface Sample { t: number; v: Vec3 }

export class Anchor {
  state: AnchorState = 'FACING';
  suspended = false;
  private map: ImuMap | null;
  private enabled = true;
  fadeOff = false;
  private buf: Sample[] = []; 
  private odd: Sample[] = []; 
  private forward: { p: number; r: number } | null = null;
  private cone: Cone;
  private lvl: Level = 4;
  private overSince = -1; 
  private inside = 0; 

  constructor(map: ImuMap | null = IMU_MAP) {
    this.map = map;
    this.cone = map?.cone ?? { full: FULL_DEG, dim: DIM_DEG };
  }

  get on(): boolean {
    return this.enabled && !!this.map;
  }

  setEnabled(on: boolean, _now: number): void {
    if (on === this.enabled) return;
    this.enabled = on;
    this.forget();
  }

  private forget(): void {
    this.state = 'FACING';
    this.forward = null; 
    this.lvl = 4;
    this.overSince = -1;
    this.inside = 0;
    this.buf = [];
    this.odd = [];
  }

  private last(): number {
    return this.buf.length ? this.buf[this.buf.length - 1].t : -Infinity;
  }

  private smoothed(): Vec3 | null {
    const end = this.last();
    let x = 0, y = 0, z = 0, n = 0;
    for (let i = this.buf.length - 1; i >= 0 && end - this.buf[i].t < SMOOTH_MS; i--) {
      x += this.buf[i].v[0]; y += this.buf[i].v[1]; z += this.buf[i].v[2]; n++;
    }
    const len = Math.hypot(x, y, z);
    return n && len > 1e-9 ? [x / len, y / len, z / len] : null;
  }

  private away(v: Vec3): number {
    if (!this.forward) return 0;
    return angleDeg(vec(this.forward.p, this.forward.r), vec(pitchOf(v), turnOf(v)));
  }

  feed(x: number, y: number, z: number, now: number): void {
    if (!this.on || !this.map) return;
    if (![x, y, z].every(Number.isFinite)) return; 
    if (this.map.kind === 'gravity' && this.map.g) { 
      const len = Math.hypot(x, y, z);
      if (len < 0.75 * this.map.g || len > 1.25 * this.map.g) return;
    }
    if (now - this.last() > STALE_MS) this.forget(); 
    const s: Sample = { t: now, v: direction({ x, y, z }, this.map) };
    const cur = this.smoothed();
    if (cur && angleDeg(cur, s.v) > this.map.spikeDeg) {
      if (this.odd.length && angleDeg(this.odd[this.odd.length - 1].v, s.v) > this.map.spikeDeg) this.odd = [];
      this.odd.push(s);
      if (this.odd.length < 3) return;
      this.buf = this.odd;
      this.odd = [];
    } else {
      this.odd = [];
      this.buf.push(s);
      while (this.buf.length && now - this.buf[0].t > 2000) this.buf.shift();
    }
    const smooth = this.smoothed();
    if (!smooth) return;
    if (!this.forward) this.setForward(smooth);
    if (this.suspended || !this.forward) return;
    const deg = this.away(smooth);
    if (this.state === 'TURNED') {
      if (deg <= this.cone.full) this.restore(now);
      else this.lvl = this.fadeOff ? 0 : this.step(deg);
      return;
    }
    if (this.fadeOff) { 
      this.lvl = 4;
      if (this.away(s.v) > this.cone.full && deg > this.cone.full) {
        if (this.overSince < 0) this.overSince = now;
        this.inside = 0;
        if (now - this.overSince >= OFF_AFTER_MS) {
          this.state = 'TURNED';
          this.lvl = 0;
          this.overSince = -1;
        }
      } else if (this.overSince >= 0 && ++this.inside > GLITCH_MAX) {
        this.overSince = -1;
        this.inside = 0;
      }
      return;
    }
    this.lvl = this.step(deg);
    if (this.away(s.v) > this.cone.dim) {
      if (this.overSince < 0) this.overSince = now;
      this.inside = 0;
      if (now - this.overSince >= SUSTAIN_MS && deg > this.cone.dim) {
        this.state = 'TURNED';
        this.lvl = 0;
        this.overSince = -1;
      }
    } else if (this.overSince >= 0 && ++this.inside > GLITCH_MAX) {
      this.overSince = -1;
      this.inside = 0;
    }
  }

  private step(deg: number): Level {
    const { full, dim } = this.cone;
    const dimmer = levelFor(deg, full, dim);
    if (dimmer < this.lvl) return dimmer;
    const brighter = levelFor(deg + 0.3 * ((dim - full) / 3), full, dim);
    return brighter > this.lvl ? brighter : this.lvl;
  }

  private setForward(v: Vec3): void {
    this.forward = { p: pitchOf(v), r: turnOf(v) };
  }

  private fresh(now: number): Vec3 | null {
    return now - this.last() <= STALE_MS ? this.smoothed() : null;
  }

  capture(now: number): boolean {
    if (!this.on || this.state === 'TURNED') return false;
    return this.recenter(now);
  }

  recenter(now: number): boolean {
    if (!this.on) return false;
    const cur = this.fresh(now);
    if (cur) this.setForward(cur);
    else this.forward = null;
    this.state = 'FACING';
    this.lvl = 4;
    this.overSince = -1;
    this.inside = 0;
    return !!cur;
  }

  restore(now: number): void {
    this.state = 'FACING';
    this.overSince = -1;
    this.inside = 0;
    this.capture(now);
  }

  reset(now: number): void {
    this.recenter(now);
  }

  press(now: number): boolean {
    if (!this.on || this.suspended || this.state !== 'TURNED') return false;
    if (now - this.last() > STALE_MS) { 
      this.forget();
      return true;
    }
    this.recenter(now);
    return true;
  }

  level(now: number): Level {
    if (!this.on || this.suspended) return 4;
    if (now - this.last() > STALE_MS) {
      if (this.state === 'TURNED' || this.lvl !== 4) this.forget();
      return 4;
    }
    return this.lvl;
  }

  angle(now: number): number | null {
    if (!this.on || !this.forward || now - this.last() > STALE_MS) return null;
    const cur = this.smoothed();
    return cur ? this.away(cur) : null;
  }

  pitch(now: number): number | null {
    if (!this.on || !this.forward || now - this.last() > STALE_MS) return null;
    const cur = this.smoothed();
    return cur ? pitchOf(cur) - this.forward.p : null;
  }

  hz(now: number): number {
    return this.buf.filter((s) => now - s.t < 2000).length / 2;
  }
}
