
export class MicWatchdog {
  lastFrame = 0;
  armedAt = 0;
  lastRearm = 0;

  needsRearm(now: number, micOn: boolean): boolean {
    if (!micOn || now - this.lastRearm < 10_000) return false;
    const since = Math.max(this.lastFrame, this.armedAt);
    if (!since || now - since < 5_000) return false;
    this.lastRearm = now;
    return true;
  }

  armed(now: number): void {
    this.armedAt = now;
  }

  frame(now: number): void {
    this.lastFrame = now;
  }
}
