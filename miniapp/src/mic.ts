
const NO_FRAMES_MS = 3000; 

export function pcmPeak(pcm: Uint8Array): number {
  const view = new DataView(pcm.buffer, pcm.byteOffset, pcm.byteLength);
  let peak = 0;
  for (let i = 0; i + 1 < pcm.byteLength; i += 16) {
    const v = Math.abs(view.getInt16(i, true));
    if (v > peak) peak = v;
  }
  return Math.min(1, peak / 32768);
}

export class MicStats {
  frames = 0;
  kept = 0;
  bytes = 0;
  roles: Record<string, number> = {};
  source = '';
  level = 0;
  lastFrame = 0;
  armedAt = 0;
  armOk: boolean | null = null;

  lastRearm = 0;

  needsRearm(now: number, micOn: boolean): boolean {
    if (!micOn || now - this.lastRearm < 10_000) return false;
    const since = Math.max(this.lastFrame, this.armedAt);
    if (!since || now - since < 5_000) return false;
    this.lastRearm = now;
    return true;
  }

  armed(now: number, ok: boolean): void {
    this.armedAt = now;
    this.armOk = ok;
  }

  add(pcm: Uint8Array, source: string | undefined, role: string | undefined, kept: boolean, now: number): void {
    this.frames++;
    this.bytes += pcm.byteLength;
    if (kept) this.kept++;
    const r = role || 'unknown';
    this.roles[r] = (this.roles[r] || 0) + 1;
    if (source) this.source = String(source);
    this.level = pcmPeak(pcm);
    this.lastFrame = now;
  }

  headerLevel(now: number): number {
    const since = this.lastFrame || this.armedAt;
    return since && now - since > NO_FRAMES_MS ? -1 : this.level;
  }

  phoneLine(now: number, on: boolean): string {
    if (!on) return this.armOk === false ? 'Mic: the glasses refused to open the mic (audioControl returned false).' : 'Mic: off';
    if (!this.frames) return `Mic: on, waiting for the first frame from the glasses (${Math.round((now - this.armedAt) / 1000)} s)`;
    const roles = Object.entries(this.roles).map(([k, v]) => `${k} ${v}`).join(' / ');
    const age = ((now - this.lastFrame) / 1000).toFixed(1);
    return `Mic: ${this.frames} frames (${roles}), ${this.kept} sent, source ${this.source || '?'}, last ${age} s ago, level ${Math.round(this.level * 100)}%`;
  }
}
