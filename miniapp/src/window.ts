
import { wrappedLines } from './center.ts';
import { getTextWidth } from '@evenrealities/pretext';

export const WINDOW_MS = 15_000;
export const IDLE_SLEEP_MS = 15_000;

export const timing = { windowMs: WINDOW_MS, idleSleepMs: IDLE_SLEEP_MS, kindMs: {} as Record<string, number> };
export function setTiming(t: { messageS?: number; screenOffS?: number; kinds?: Record<string, number> }): void {
  timing.kindMs = Object.fromEntries(Object.entries(t.kinds ?? {}).filter(([, s]) => s > 0).map(([k, s]) => [k, s * 1000]));
  timing.windowMs = t.messageS && t.messageS > 0 ? t.messageS * 1000 : WINDOW_MS;
  timing.idleSleepMs = t.screenOffS === undefined ? IDLE_SLEEP_MS : t.screenOffS > 0 ? t.screenOffS * 1000 : Infinity;
}
export function msgKindFor(it: { kind: string } | null): string | null {
  return it?.kind === 'translation' ? 'translations' : null;
}
export function windowMsFor(it: { kind: string } | null): number {
  const k = msgKindFor(it);
  return (k && timing.kindMs[k]) || timing.windowMs;
}

export type Kind = 'translation' | 'status' | 'wake';

export function countdownText(secondsLeft: number): string {
  return secondsLeft > 0 ? `${Math.ceil(secondsLeft)}s` : ' ';
}

export const ANIM_MS = 200;

const SCAN = ['■□□', '□■□', '□□■', '□■□'];
export function scanBar(ms: number): string {
  return SCAN[Math.floor(ms / 1000) % SCAN.length];
}

export interface Item {
  seq: number;
  kind: Kind;
  title: string;
  text: string;
  at?: number; 
  source?: string; 
  time?: string; 
  idea?: boolean; 
  mine?: boolean; 
  speak_in?: string; 
  original?: string; 
  pushed?: boolean; 
}

export interface View {
  item: Item | null;
  secondsLeft: number; 
  pinned: boolean;
}

export type Effect = { type: 'render' } | { type: 'clear' };

export function staleModeItem(it: { kind: string; mine?: boolean }, mode: { translating?: string }): boolean {
  return it.kind === 'translation' && !it.mine && !mode.translating;
}

const POPUPS: Kind[] = ['translation'];

const TIMED: Kind[] = ['translation', 'status'];

export class WindowState {
  item: Item | null = null;
  shownAt = 0;
  pausedLeft = 0;
  pinned = false;
  queue: Item[] = [];
  busy: { label: 'translating'; since: number } | null = null;
  holdPopups = false;

  view(now: number): View {
    const timed = !!this.item && TIMED.includes(this.item.kind);
    return { item: this.item, secondsLeft: timed ? Math.max(1, Math.ceil(this.left(now) / 1000)) : 0, pinned: this.pinned };
  }

  left(now: number): number {
    if (!this.item || !TIMED.includes(this.item.kind)) return windowMsFor(this.item);
    return this.pinned ? this.pausedLeft : windowMsFor(this.item) - (now - this.shownAt);
  }

  dueIn(now: number): number | null {
    if (!this.item || this.pinned || !TIMED.includes(this.item.kind)) return null;
    return Math.max(0, windowMsFor(this.item) - (now - this.shownAt));
  }

  title(now: number): string {
    if (this.busy) return `Translating ${scanBar(now - this.busy.since)}`;
    return this.item?.kind === 'translation' ? this.item.title : ''; 
  }

  offer(item: Item, now: number): Effect[] {
    if (item.kind === 'status' && item.title === 'TRANSLATING') {
      this.busy = { label: 'translating', since: now };
      return [{ type: 'render' }];
    }
    if (item.kind === 'translation') this.busy = null;
    if (item.kind === 'status' && item.title === 'IDLE') {
      this.busy = null; 
      return [{ type: 'render' }];
    }
    if (item.kind === 'status' && !item.text) {
      if (this.item?.kind === 'wake') return this.close(); 
      return [];
    }
    if (this.holdPopups && POPUPS.includes(item.kind)) {
      this.queue.push(item);
      return [];
    }
    this.item = item;
    this.shownAt = now;
    this.pinned = false;
    return [{ type: 'render' }];
  }

  tick(now: number): Effect[] {
    if (!this.item) return this.next(now);
    if (this.pinned || !TIMED.includes(this.item.kind)) return [];
    if (now - this.shownAt >= windowMsFor(this.item)) return this.close(now);
    return [{ type: 'render' }];
  }

  press(now: number): Effect[] {
    if (!this.item) return [];
    return this.close(now);
  }

  keepOpen(now: number): Effect[] {
    if (!this.item || !TIMED.includes(this.item.kind)) return [];
    this.pausedLeft = Math.max(1000, windowMsFor(this.item) - (now - this.shownAt));
    this.pinned = true;
    return [{ type: 'render' }];
  }

  endMode(mode: { translating?: string }): Effect[] {
    this.queue = this.queue.filter((q) => !(q.pushed && staleModeItem(q, mode)));
    if (this.item?.pushed && staleModeItem(this.item, mode)) return this.close();
    return [];
  }

  close(now = 0): Effect[] {
    this.item = null;
    this.pinned = false;
    const fx: Effect[] = [{ type: 'clear' }];
    return now ? [...fx, ...this.next(now)] : fx;
  }

  next(now: number): Effect[] {
    if (this.holdPopups && this.queue.length && POPUPS.includes(this.queue[0].kind)) return []; 
    const queued = this.queue.shift();
    return queued ? this.offer(queued, now) : [];
  }
}

export const HOLD_MAX_MS = 90_000;

export function pickedIndex(ev: { currentSelectItemIndex?: number; currentSelectItemName?: string }, names: string[]): number {
  if (typeof ev.currentSelectItemIndex === 'number') return ev.currentSelectItemIndex;
  const byName = names.indexOf(String(ev.currentSelectItemName ?? ''));
  return byName >= 0 ? byName : 0;
}

export function pickerOrder(all: string[], first: string): string[] {
  return all.includes(first) ? [first, ...all.filter((l) => l !== first)] : [...all];
}

export const MENU_TAP_GUARD_MS = 1500;
export class TapGuard {
  until = 0;
  ignored = 0;

  menuActivity(now: number): void {
    this.until = Math.max(this.until, now + MENU_TAP_GUARD_MS);
  }

  allows(type: number | null | undefined, now: number): boolean {
    if ((type === 0 || type === 3) && now < this.until) {
      this.ignored++;
      return false;
    }
    return true;
  }
}

export const ROW_PX = 536;

export function fitRow(text: string, maxPx = ROW_PX, maxBytes = 60): string {
  const enc = new TextEncoder();
  const fits = (t: string) => getTextWidth(t) <= maxPx && enc.encode(t).length <= maxBytes;
  if (fits(text)) return text;
  const chars = [...text];
  let lo = 0, hi = chars.length; 
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (fits(`${chars.slice(0, mid).join('').trimEnd()}…`)) lo = mid;
    else hi = mid - 1;
  }
  return `${chars.slice(0, lo).join('').trimEnd()}…`;
}

export interface Turn {
  q: string;
  a: string;
}

export const CHAT_WRAP_PX = 552;

export function fitTail(text: string, lines: number, widthPx = CHAT_WRAP_PX): string {
  const t = text.trim();
  if (!t || wrappedLines(t, widthPx) <= lines) return t;
  const chars = [...t];
  let lo = 1, hi = chars.length; 
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (wrappedLines(`…${chars.slice(mid).join('').trimStart()}`, widthPx) <= lines) hi = mid;
    else lo = mid + 1;
  }
  return `…${chars.slice(lo).join('').trimStart()}`;
}

export function fitHead(text: string, lines: number, widthPx = CHAT_WRAP_PX): string {
  const t = text.trim();
  if (!t || wrappedLines(t, widthPx) <= lines) return t;
  const chars = [...t];
  let lo = 0, hi = chars.length - 1; 
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (wrappedLines(`${chars.slice(0, mid).join('').trimEnd()}…`, widthPx) <= lines) lo = mid;
    else hi = mid - 1;
  }
  return `${chars.slice(0, lo).join('').trimEnd()}…`;
}

export class ModeQuiet {
  private at = 0;
  activity(now: number): void {
    this.at = Math.max(this.at, now);
  }
  heard(heardS: number | null | undefined, now: number): void {
    if (typeof heardS === 'number' && heardS >= 0) this.activity(now - heardS * 1000);
  }
  quiet(now: number, offMs: number): boolean {
    return offMs > 0 && Number.isFinite(offMs) && now - this.at >= offMs;
  }
}

export const TR_SPOKEN_LINES = 2; 
export const TR_ENGLISH_LINES = 4; 
export const TR_PAIR_LINES = 6;
export const TR_BIG = { spoken: 3, english: 9, pair: 9 };

export function spokenPair(original: string, english: string,
  lim = { spoken: TR_SPOKEN_LINES, english: TR_ENGLISH_LINES, pair: TR_PAIR_LINES }): { origin: string; question: string } {
  const o = fitHead(original || '', lim.spoken);
  const rows = o ? wrappedLines(o, CHAT_WRAP_PX) : 0;
  const e = fitHead(english || '', Math.min(lim.english, lim.pair - rows)) || ' ';
  return { origin: o || ' ', question: '\n'.repeat(rows) + e };
}

export function middlePair(original: string, english: string): { origin: string; question: string } {
  const p = spokenPair(original, english, TR_BIG);
  const rows = (t: string) => t.split('\n').reduce((n, s) => n + (s.trim() ? wrappedLines(s, CHAT_WRAP_PX) : 1), 0);
  const top = Math.max(0, Math.floor((TR_BIG.pair - rows(p.question)) / 2));
  const pad = '\n'.repeat(top);
  return { origin: p.origin.trim() ? pad + p.origin : ' ', question: pad + p.question };
}

export const CURRENT_LINES = 3;
export function turnView(turns: Turn[], o: { draft?: string; live?: string; held?: boolean; nothingHeard?: boolean; sinceHold?: number }): string {
  const last = turns[turns.length - 1];
  const done = !last || !!last.a; 
  const asking = !!(o.draft || (o.live && done) || (o.held && done) || o.nothingHeard);
  const said = (words: string) => fitTail(`You: “${words}”`, CURRENT_LINES);
  if (o.draft) return said(o.draft + (o.live && !o.draft.endsWith(o.live) ? ` ${o.live}` : ''));
  if (o.live && asking) return said(o.live);
  if (o.nothingHeard) return 'No speech detected';
  if (o.held) return listeningDots(o.sinceHold ?? 0);
  if (last && !last.a) return '…';
  if (last) return last.a;
  return 'Tap to talk.';
}

export const LISTEN_DOTS_MS = 400;
const DOTS = ['', '.', '..', '...', '..', '.'];
export function listeningDots(sinceMs: number): string {
  return `Listening${DOTS[Math.floor(Math.max(0, sinceMs) / LISTEN_DOTS_MS) % DOTS.length]}`;
}

export function capFirst(s: string): string {
  const i = s.search(/[a-z]/i); 
  return i < 0 ? s : s.slice(0, i) + s[i].toUpperCase() + s.slice(i + 1);
}

export const QUIET_GRACE_MS = 8_000;
export class ScreenSleep {
  private state: 'on' | 'off' = 'on';
  private gestureAt = 0; 

  get off(): boolean {
    return this.state === 'off';
  }

  showForCard(): void {
    this.state = 'on';
  }

  activity(now: number): void {
    this.gestureAt = now;
  }

  update(now: number, s: { quiet: boolean; busy: boolean; popup: boolean }): 'sleep' | 'wake' | null {
    if (s.quiet) {
      if (this.state === 'off') return null; 
      if (s.busy || (!s.popup && now - this.gestureAt < QUIET_GRACE_MS)) return null;
      this.state = 'off';
      return 'sleep';
    }
    if (this.state === 'on') return null;
    this.state = 'on';
    return 'wake';
  }

  wake(now: number): boolean {
    this.gestureAt = now;
    const was = this.state === 'off';
    this.state = 'on';
    return was;
  }
}
