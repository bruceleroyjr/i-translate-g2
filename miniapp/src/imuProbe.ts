
export interface ProbeStep { label: string; show: string; ms: number }

const STEP_MS = 3000; 
const step = (label: string, show: string): ProbeStep => ({ label, show, ms: STEP_MS });
const turn = (dir: string, show: string): ProbeStep[] => [
  step('still', 'HOLD STILL'), step(dir, show), step(`hold_${dir}`, 'HOLD'), step('return', 'RETURN'),
];

export const PROBE_STEPS: ProbeStep[] = [
  ...turn('left', 'TURN LEFT 90°'),
  ...turn('right', 'TURN RIGHT 90°'),
  ...turn('up', 'NOD UP'),
  ...turn('down', 'NOD DOWN'),
  step('still', 'HOLD STILL'),
];

export interface ProbeSample { step: string; t: number; x: number; y: number; z: number }

export class ImuProbe {
  private startedAt = -1;
  private rows: ProbeSample[] = [];

  get active(): boolean {
    return this.startedAt >= 0;
  }

  start(now: number): void {
    this.startedAt = now;
    this.rows = [];
  }

  stop(): void {
    this.startedAt = -1;
  }

  step(now: number): { label: string; show: string; left: number } | null {
    if (!this.active) return null;
    let t = now - this.startedAt;
    for (const s of PROBE_STEPS) {
      if (t < s.ms) return { label: s.label, show: s.show, left: Math.ceil((s.ms - t) / 1000) };
      t -= s.ms;
    }
    this.stop();
    return null;
  }

  add(x: number, y: number, z: number, now: number): void {
    const s = this.step(now);
    if (!s) return;
    this.rows.push({ step: s.label, t: now - this.startedAt, x, y, z });
  }

  drain(): ProbeSample[] {
    const out = this.rows;
    this.rows = [];
    return out;
  }
}

export function probeCard(s: { show: string; left: number } | null, saved = true): string {
  if (s) return `IMU PROBE\n${s.show}\n${s.left}s`;
  return saved ? 'IMU PROBE\nPROBE SAVED' : 'IMU PROBE\nNOT SAVED\nPC not reachable';
}
