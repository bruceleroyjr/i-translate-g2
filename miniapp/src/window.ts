
import { wrappedLines } from './center.ts';
import { getTextWidth } from '@evenrealities/pretext';

export const WINDOW_MS = 15_000;

export const timing = { windowMs: WINDOW_MS, idleSleepMs: 15_000, idleFadeMs: 10_000, pausedFadeMs: 10_000, kindMs: {} as Record<string, number> };
export function setTiming(t: { messageS?: number; screenOffS?: number; kinds?: Record<string, number> }): void {
  timing.kindMs = Object.fromEntries(Object.entries(t.kinds ?? {}).filter(([, s]) => s > 0).map(([k, s]) => [k, s * 1000]));
  const ms = (s: number | undefined, dflt: number) => (s === undefined ? dflt : s > 0 ? s * 1000 : Infinity);
  timing.windowMs = t.messageS && t.messageS > 0 ? t.messageS * 1000 : WINDOW_MS;
  timing.idleSleepMs = ms(t.screenOffS, IDLE_SLEEP_MS);
  timing.idleFadeMs = 0;
  timing.pausedFadeMs = ms(t.screenOffS, PAUSED_FADE_MS);
}
export function msgKindFor(it: { kind: string; lifelog?: boolean } | null): string | null {
  if (!it) return null;
  if (it.lifelog || it.kind === 'note') return 'lifelogs';
  if (it.kind === 'news') return 'news';
  if (it.kind === 'mail' || it.kind === 'calendar') return 'mail'; 
  if (it.kind === 'cue' || it.kind === 'meeting') return 'meetings';
  if (it.kind === 'translation') return 'translations';
  return null;
}
export function windowMsFor(it: { kind: string; lifelog?: boolean; extraMs?: number } | null): number {
  const k = msgKindFor(it);
  return ((k && timing.kindMs[k]) || timing.windowMs) + Math.max(0, it?.extraMs || 0);
}
export const SPEAK_MS = 2_000; 
export const COMPLETED_MS = 2_500; 

export type Kind = 'reply' | 'news' | 'cue' | 'wake' | 'status' | 'mail' | 'done' | 'translation' | 'approval' | 'meeting' | 'note' | 'calendar';

export type Frame =
  | 'idle' | 'thinking' | 'speaking' | 'listening' | 'mail' | 'news' | 'cue' | 'meeting' | 'translation' | 'approval' | 'completed' | 'blank'
  | 'lifelog' | 'lifelog2' | 'calendar' | 'calendar2' | 'sleep1' | 'sleep2' | 'boot1' | 'boot2' | 'thinking2' | 'listening2' | 'fade1' | 'fade2' | 'fade3' | 'nap1' | 'nap2' | 'napfade1' | 'napfade2' | 'napfade3';

export const FRAMES: Frame[] = ['idle', 'thinking', 'speaking', 'listening', 'mail', 'news', 'cue', 'meeting', 'translation', 'approval', 'completed'];
export const SLEEP_FRAMES: Frame[] = ['sleep1', 'sleep2'];
export function sleepFrame(now: number, periodMs = 1000): Frame {
  return Math.floor(now / periodMs) % 2 ? 'sleep2' : 'sleep1';
}

export const IDLE_SLEEP_MS = 15_000;
export const NAP_FRAMES: Frame[] = ['nap1', 'nap2'];
export function napFrame(now: number, periodMs = IDLE_SLEEP_STEP_MS): Frame {
  return Math.floor(now / periodMs) % 2 ? 'nap2' : 'nap1';
}
export const IDLE_SLEEP_STEP_MS = 2_000;
export const IDLE_FADE_MS = 10_000; 
export const NAPFADE_FRAMES: Frame[] = ['napfade1', 'napfade2', 'napfade3', 'blank'];
export function asleepFrame(sinceAsleepMs: number): Frame {
  if (sinceAsleepMs < timing.idleFadeMs) return napFrame(sinceAsleepMs);
  const i = Math.floor((sinceAsleepMs - timing.idleFadeMs) / FADE_STEP_MS);
  return NAPFADE_FRAMES[Math.min(NAPFADE_FRAMES.length - 1, i)];
}
export class IdleSleep {
  private since = 0; 
  asleep = false;

  activity(now: number): void {
    this.since = now;
    this.asleep = false;
  }

  get asleepAt(): number {
    return this.since + timing.idleSleepMs;
  }

  update(now: number, idle: boolean): boolean {
    if (!idle) {
      this.since = now;
      this.asleep = false;
      return false;
    }
    if (!this.since) this.since = now;
    this.asleep = now - this.since >= timing.idleSleepMs;
    return this.asleep;
  }
}

export const FADE_FRAMES: Frame[] = ['fade1', 'fade2', 'fade3', 'blank'];
export const FADE_STEP_MS = 1_000;


export const ANIM_FRAMES: Frame[] = ['boot1', 'boot2', 'thinking2', 'listening2', 'lifelog', 'lifelog2', 'calendar', 'calendar2'];

export function calendarFrame(now: number, since = 0): Frame {
  return Math.floor((now - since) / 1000) % 2 ? 'calendar2' : 'calendar';
}

export function lifelogFrame(now: number, since = 0): Frame {
  return Math.floor((now - since) / 1000) % 2 ? 'lifelog2' : 'lifelog';
}

export function thinkingFrame(now: number, since = 0): Frame {
  return Math.floor((now - since) / 1000) % 2 ? 'thinking2' : 'thinking';
}

export function listeningFrame(now: number, since = 0): Frame {
  return Math.floor((now - since) / 1000) % 2 ? 'listening2' : 'listening';
}

const SCAN = ['■□□', '□■□', '□□■', '□■□'];
export function scanBar(ms: number): string {
  return SCAN[Math.floor(ms / 1000) % SCAN.length];
}

export function countdownText(secondsLeft: number): string {
  return secondsLeft > 0 ? `${Math.ceil(secondsLeft)}s` : ' ';
}

export const BOOT_MS = 2400;
export const ANIM_MS = 200;
const BOOT_LINES: [number, string][] = [
  [0, '▶ HERMES LINK □□□□'],
  [450, '▶ HERMES LINK ■□□□'],
  [900, '▶ HERMES LINK ■■□□'],
  [1350, '▶ HERMES LINK ■■■□'],
  [1800, '▶ HERMES LINK ■■■■ SYNCED'],
];
export class Boot {
  at = 0; 

  start(now: number): void {
    this.at = now;
  }

  active(now: number): boolean {
    return this.at > 0 && now - this.at < BOOT_MS;
  }

  line(now: number): string | null {
    if (!this.active(now)) return null;
    const t = now - this.at;
    let out = BOOT_LINES[0][1];
    for (const [ms, l] of BOOT_LINES) if (t >= ms) out = l;
    return out;
  }

  frame(now: number): Frame | null {
    if (!this.active(now)) return null;
    return now - this.at < BOOT_MS / 2 ? 'boot1' : 'boot2';
  }
}

export const DECODE_MS = 800;
const NOISE = 'アカサタナハマヤラワ■□※≡∴';
export const DECODE_TAIL = 3;
export const DECODE_SPAN = 140;
export function decodeText(text: string, p: number, seed = 0): string {
  if (p >= 1 || !text.trim()) return text;
  const chars = [...text];
  const lead = chars.findIndex((c) => c !== '\n' && c !== ' ');
  const start = Math.max(0, lead);
  const span = Math.min(DECODE_SPAN, chars.length - start);
  const upto = start + Math.floor(span * Math.max(0, p));
  let tail = '';
  for (let i = 0; i < DECODE_TAIL && upto + i < chars.length; i++) {
    const c = chars[upto + i];
    tail += c === '\n' || c === ' ' ? c : NOISE[(seed + upto * 7 + i * 3) % NOISE.length];
  }
  return chars.slice(0, upto).join('') + tail || ' ';
}

export interface Item {
  seq: number;
  kind: Kind;
  title: string;
  text: string;
  at?: number; 
  topic?: string;
  id?: string; 
  place?: string; 
  source?: string; 
  time?: string; 
  greeting?: boolean; 
  lifelog?: boolean; 
  idea?: boolean; 
  mine?: boolean; 
  speak_in?: string; 
  original?: string; 
  tray?: boolean; 
  trayStatus?: string; 
  pushed?: boolean; 
  extraMs?: number; 
}

export interface View {
  item: Item | null;
  secondsLeft: number; 
  pinned: boolean;
  expanded: boolean; 
}

export type Effect =
  | { type: 'render' }
  | { type: 'clear' }
  | { type: 'talk' } 
  | { type: 'expandNews'; topic: string }
  | { type: 'approvalOpen' } 
  | { type: 'approvalClose' } 
  | { type: 'decide'; id: string; decision: 'approve' | 'deny' | 'dismissed' };

export function mutedWhileLit(it: { kind: string; lifelog?: boolean }): boolean {
  return it.kind === 'mail' || it.kind === 'news' || it.kind === 'note' || !!it.lifelog;
}

export function staleModeItem(it: { kind: string; mine?: boolean }, mode: { meeting?: boolean; translating?: string }): boolean {
  return (it.kind === 'translation' && !it.mine && !mode.translating) || (it.kind === 'cue' && !mode.meeting);
}

const POPUPS: Kind[] = ['mail', 'news', 'cue', 'translation', 'meeting', 'note', 'calendar'];

const TIMED: Kind[] = ['reply', 'news', 'mail', 'cue', 'done', 'translation', 'status', 'meeting', 'note', 'calendar'];

export class WindowState {
  item: Item | null = null;
  shownAt = 0;
  pausedLeft = 0;
  pinned = false;
  expanded = false;
  queue: Item[] = [];
  busy: { label: 'thinking' | 'translating'; since: number } | null = null;
  completedUntil = 0;
  holdPopups = false;

  view(now: number): View {
    const timed = !!this.item && TIMED.includes(this.item.kind);
    return { item: this.item, secondsLeft: timed ? Math.max(1, Math.ceil(this.left(now) / 1000)) : 0, pinned: this.pinned, expanded: this.expanded };
  }

  left(now: number): number {
    if (!this.item || !TIMED.includes(this.item.kind)) return windowMsFor(this.item);
    return this.pinned ? this.pausedLeft : windowMsFor(this.item) - (now - this.shownAt);
  }

  dueIn(now: number): number | null {
    if (!this.item || this.pinned || !TIMED.includes(this.item.kind)) return null;
    return Math.max(0, windowMsFor(this.item) - (now - this.shownAt));
  }

  frame(now: number): Frame {
    const it = this.item;
    if (it?.kind === 'approval') return 'approval';
    if (now < this.completedUntil) return 'completed';
    if (this.busy) return this.busy.label === 'translating' ? 'translation' : thinkingFrame(now, this.busy.since);
    if (!it) return 'idle';
    if (it.lifelog) return lifelogFrame(now, this.shownAt);
    switch (it.kind) {
      case 'reply':
        return now - this.shownAt < SPEAK_MS ? 'speaking' : 'idle';
      case 'wake':
        return 'listening';
      case 'note':
        return lifelogFrame(now, this.shownAt);
      case 'calendar':
        return calendarFrame(now, this.shownAt);
      case 'mail':
      case 'news':
      case 'cue':
      case 'meeting':
      case 'translation':
        return it.kind;
      case 'done':
        return 'completed';
      default:
        return 'idle';
    }
  }

  title(now: number): string {
    if (this.busy && this.item?.kind !== 'approval') {
      const bar = scanBar(now - this.busy.since); 
      return this.busy.label === 'translating' ? `Translating ${bar}` : `Thinking ${bar}`;
    }
    const it = this.item;
    if (!it) return '';
    if (it.trayStatus) return it.trayStatus;
    switch (it.kind) {
      case 'news':
        return `NEWS — ${it.place || it.topic || ''}`.trim();
      case 'mail':
        return it.title.startsWith('MAIL') ? it.title : `MAIL — ${it.title}`;
      case 'calendar':
        return `CALENDAR — ${it.title}`;
      case 'cue':
        return 'CUE';
      case 'meeting':
        return 'MEETING';
      case 'done':
        return 'DONE';
      case 'approval':
        return 'APPROVAL NEEDED';
      case 'translation':
        return it.title; 
      default:
        return '';
    }
  }

  offer(item: Item, now: number): Effect[] {
    if (item.kind === 'status' && (item.title === 'THINKING' || item.title === 'TRANSLATING')) {
      this.busy = { label: item.title === 'THINKING' ? 'thinking' : 'translating', since: now };
      if (this.item?.kind === 'wake' && item.title === 'THINKING') this.item = { ...this.item, text: `"${item.text}"` };
      return [{ type: 'render' }];
    }
    if (item.kind === 'reply' || item.kind === 'translation' || item.kind === 'approval') this.busy = null;
    if (item.kind === 'reply' && !item.text?.trim() && !item.title?.trim()) {
      return this.item && this.item.kind !== 'wake' && this.item.kind !== 'approval' ? this.close() : [{ type: 'render' }];
    }
    if (item.kind === 'status' && item.title === 'IDLE') {
      this.busy = null; 
      return [{ type: 'render' }];
    }
    if (item.kind === 'status' && !item.text) {
      if (this.item?.kind === 'wake') return this.close();
      return [];
    }
    if (this.item?.kind === 'approval' && item.kind !== 'approval') {
      this.queue.push(item); 
      return [];
    }
    if (this.holdPopups && POPUPS.includes(item.kind)) {
      this.queue.push(item);
      return [];
    }
    if (item.kind === 'cue' && this.item && this.item.kind !== 'wake') {
      this.queue.push(item); 
      return [];
    }
    const wasApproval = this.item?.kind === 'approval';
    this.item = item;
    this.shownAt = now;
    this.pinned = false;
    this.expanded = false;
    if (item.kind === 'approval') return wasApproval ? [{ type: 'render' }] : [{ type: 'approvalOpen' }, { type: 'render' }];
    return [{ type: 'render' }];
  }

  tick(now: number): Effect[] {
    if (!this.item) return this.next(now);
    if (this.pinned || !TIMED.includes(this.item.kind)) return [];
    if (now - this.shownAt >= windowMsFor(this.item)) return this.close(now);
    return [{ type: 'render' }];
  }

  back(now: number): Effect[] | null {
    if (this.item?.kind !== 'news' || !this.expanded) return null;
    if (!this.item.text) return this.close(now); 
    this.expanded = false;
    this.shownAt = now; 
    return [{ type: 'render' }];
  }

  press(now: number): Effect[] {
    if (!this.item) return []; 
    if (this.item.kind === 'approval') return []; 
    if (this.item.greeting) return [...this.close(now), { type: 'talk' }]; 
    if (this.item.kind === 'news' && !this.expanded && this.item.topic) {
      this.expanded = true;
      this.shownAt = now;
      return [{ type: 'expandNews', topic: this.item.topic }];
    }
    return this.close(now);
  }

  keepOpen(now: number): Effect[] {
    if (!this.item || !TIMED.includes(this.item.kind)) return [];
    this.pausedLeft = Math.max(1000, windowMsFor(this.item) - (now - this.shownAt));
    this.pinned = true;
    return [{ type: 'render' }];
  }

  awaitingDecision(): boolean {
    return this.item?.kind === 'approval';
  }

  decide(approve: boolean, now: number): Effect[] {
    const it = this.item;
    if (it?.kind !== 'approval') return [];
    if (approve) this.completedUntil = now + COMPLETED_MS;
    return [{ type: 'decide', id: it.id ?? '', decision: approve ? 'approve' : 'deny' }, ...this.close(now)];
  }

  background(): Effect[] {
    const it = this.item;
    const queued = this.queue.filter((q) => q.kind === 'approval');
    this.queue = [];
    this.busy = null;
    const fx: Effect[] = [];
    if (it?.kind === 'approval') fx.push({ type: 'decide', id: it.id ?? '', decision: 'dismissed' });
    for (const q of queued) fx.push({ type: 'decide', id: q.id ?? '', decision: 'dismissed' });
    return it ? [...fx, ...this.close()] : fx;
  }

  endMode(mode: { meeting?: boolean; translating?: string }, _now: number): Effect[] {
    this.queue = this.queue.filter((q) => !(q.pushed && staleModeItem(q, mode)));
    if (this.item?.pushed && staleModeItem(this.item, mode)) return this.close();
    return [];
  }

  close(now = 0): Effect[] {
    const wasApproval = this.item?.kind === 'approval';
    this.item = null;
    this.pinned = false;
    this.expanded = false;
    const fx: Effect[] = wasApproval ? [{ type: 'approvalClose' }, { type: 'clear' }] : [{ type: 'clear' }];
    return now ? [...fx, ...this.next(now)] : fx;
  }

  next(now: number): Effect[] {
    if (this.holdPopups && this.queue.length && POPUPS.includes(this.queue[0].kind)) return []; 
    const queued = this.queue.shift();
    return queued ? this.offer(queued, now) : [];
  }
}

export const CHOICES = ['APPROVE', 'DENY'];
export const SEND_CHOICES = ['SEND', 'CANCEL'];

export const YES_NO = ['YES', 'NO'];
export const CONFIRM_MS = 10_000;
export type StopAsk = 'translation' | 'meeting' | 'pause';
export function stopAsk(m: { listening: boolean; meeting: boolean; translating: boolean }): StopAsk | null {
  if (!m.listening) return null;
  if (m.translating) return 'translation';
  if (m.meeting) return 'meeting';
  return 'pause';
}
export const STOP_QUESTION: Record<StopAsk, string> = {
  translation: 'Stop translation?\n\nLifelogging keeps running.',
  meeting: 'Exit meeting mode?\n\nLive cues stop. Back to lifelogging.',
  pause: 'Pause lifelogging?\n\nThe mic goes off until you double tap again.',
};

export type ModeAction = 'meeting' | 'lifelog' | 'translate' | 'translate_off' | 'news' | 'pause' | 'resume';
export function modeMenu(m: { listening: boolean; meeting: boolean; translating: boolean }): { label: string; action: ModeAction }[] {
  const rows: { label: string; action: ModeAction }[] = [
    m.meeting ? { label: 'Stop Meeting Mode', action: 'lifelog' } : { label: 'Start Meeting Mode', action: 'meeting' },
    m.translating ? { label: 'Stop Translation', action: 'translate_off' } : { label: 'Start Translation', action: 'translate' },
    { label: 'Top News', action: 'news' },
  ];
  return m.listening ? [...rows, { label: 'Pause Listening', action: 'pause' }] : [{ label: 'Resume Listening', action: 'resume' }, ...rows];
}

export const HOLD_MAX_MS = 90_000;

export const APPROVAL_MAX_CHARS = 220;
export function approvalText(text: string): string {
  const t = (text || '').trim();
  return t.length <= APPROVAL_MAX_CHARS ? t : `${t.slice(0, APPROVAL_MAX_CHARS - 1).trimEnd()}…`;
}

export function pickedIndex(ev: { currentSelectItemIndex?: number; currentSelectItemName?: string }, names: string[]): number {
  if (typeof ev.currentSelectItemIndex === 'number') return ev.currentSelectItemIndex;
  const byName = names.indexOf(String(ev.currentSelectItemName ?? ''));
  return byName >= 0 ? byName : 0;
}

export function pickerOrder(all: string[], first: string): string[] {
  return all.includes(first) ? [first, ...all.filter((l) => l !== first)] : [...all];
}

export function chosenIndex(ev: { currentSelectItemIndex?: number; currentSelectItemName?: string }, choices: string[] = CHOICES): number {
  if (typeof ev.currentSelectItemIndex === 'number') return ev.currentSelectItemIndex;
  const byName = choices.indexOf(String(ev.currentSelectItemName ?? '').toUpperCase());
  return byName >= 0 ? byName : 0;
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

export interface Story {
  topic: string;
  place?: string;
  title: string;
  summary?: string;
  source?: string;
  at?: number; 
}

export function storyTime(atSec: number | undefined, nowMs = Date.now()): string {
  if (!atSec) return '';
  const d = new Date(atSec * 1000), now = new Date(nowMs);
  const time = `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
  if (d.toDateString() === now.toDateString()) return time;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()} ${time}`;
}

export function truncBytes(text: string, max = 60): string {
  const enc = new TextEncoder();
  if (enc.encode(text).length <= max) return text;
  let out = '';
  for (const ch of text) {
    if (enc.encode(out + ch + '…').length > max) break;
    out += ch;
  }
  return `${out.trimEnd()}…`;
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

export function newsRow(s: Story, nowMs = Date.now()): string {
  const when = storyTime(s.at, nowMs);
  const topic = s.place || SHORT_TOPIC[s.topic] || s.topic;
  return fitRow(`${when ? `${when} | ` : ''}${topic} | ${asciiPunct(s.title)}`, ROW_PX, LIST_ROW_BYTES);
}

export const LIST_ROW_BYTES = 63;
const SHORT_TOPIC: Record<string, string> = { Technology: 'Tech', 'Global economy': 'Economy' };
export function asciiPunct(t: string): string {
  return t.replace(/[\u2018\u2019\u201A\u2032]/g, "'").replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2013\u2014]/g, '-').replace(/\u00A0/g, ' ');
}

export function storyText(s: Story): string {
  return [s.title, s.summary, s.source ? `— ${s.source}` : ''].filter((x) => x && x.trim()).join('\n\n');
}

export interface Turn {
  q: string;
  a: string;
  cancelled?: boolean; 
}

export const HISTORY_LINES = 3;
export const QUESTION_LINES = 1;
export const CURRENT_LINES = 3;
export const CHAT_WRAP_PX = 552;
export const HISTORY_CHARS = 180;
export const QUESTION_CHARS = 60;

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

export const TALK_LINES = 7;
export const TALK_WRAP_PX = 351; 

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

export function talkPast(turns: Turn[]): string[] {
  return turns.filter((t) => t.a && !t.cancelled).flatMap((t) => [`You: ${t.q}`, `Hermes: ${t.a}`]);
}

export function talkBoxes(past: string[], current: string, lines = TALK_LINES, widthPx = TALK_WRAP_PX): { you: string; hermes: string } {
  const cur = current.trim() || ' ';
  const rowsOf = (piece: string) => (piece.trim() ? wrappedLines(piece, widthPx) : 1);
  const entryRows = (e: string) => e.split('\n').reduce((n, p) => n + rowsOf(p), 0);
  const curPieces = cur.split('\n');
  const used = curPieces.reduce((n, p) => n + rowsOf(p), 0);
  if (used > lines) {
    const rest = curPieces.filter((p) => !p.startsWith('You:')).join('\n').trim();
    return rest ? { you: ' ', hermes: rest } : { you: fitTail(cur, lines, widthPx) || ' ', hermes: ' ' }; 
  }
  const room = lines - used;
  let keep = past.map((text) => ({ text, mine: text.startsWith('You:') }));
  while (keep.length && keep.reduce((n, e) => n + entryRows(e.text), 0) > room) {
    if (keep.length === 1) { 
      const t = room > 0 ? fitTail(keep[0].text, room, widthPx) : '';
      keep = t && entryRows(t) <= room ? [{ text: t, mine: keep[0].mine }] : [];
      break;
    }
    keep = keep.slice(1);
  }
  const you: string[] = [], hermes: string[] = [];
  const add = (piece: string, mine: boolean) => {
    const blank = Array(rowsOf(piece)).fill('').join('\n');
    you.push(mine ? piece : blank);
    hermes.push(mine ? blank : piece);
  };
  for (const e of keep) for (const p of e.text.split('\n')) add(p, e.mine);
  for (const p of curPieces) add(p, p.startsWith('You:'));
  const tidy = (rows: string[]) => rows.join('\n').replace(/\n+$/, '') || ' ';
  return { you: tidy(you), hermes: tidy(hermes) };
}

export interface LogLine { text: string; who: 'you' | 'hermes' | '' }
export const LOG_SHADE = { you: 1, hermes: 3, '': 1 } as const;

export function chatView(turns: Turn[], o: { draft?: string; live?: string; waiting?: boolean; listening?: boolean; ended?: boolean; held?: boolean; nothingHeard?: boolean; sinceHold?: number }): {
  history: string; log: LogLine[]; question: string; current: string; footer: string;
} {
  const fmt = (t: Turn) => [t.q ? `You: ${t.q}` : '', t.a ? `Hermes: ${t.a}` : t.cancelled ? '(cancelled)' : ''].filter(Boolean).join('  ·  ');
  const last = turns[turns.length - 1];
  const done = !last || !!last.a || !!last.cancelled; 
  const asking = !!(o.draft || (o.live && done) || (o.held && done) || o.nothingHeard);
  const older = asking || !last ? turns : turns.slice(0, -1); 
  const history = fitTail(older.map(fmt).filter(Boolean).join('\n'), HISTORY_LINES);
  const lines: LogLine[] = [];
  for (const turn of older) {
    if (turn.q) lines.push({ who: 'you', text: fitHead(`You: ${turn.q}${!turn.a && turn.cancelled ? '  ·  (cancelled)' : ''}`, 1) });
    if (turn.a) lines.push({ who: 'hermes', text: fitHead(`Hermes: ${turn.a}`, 1) });
  }
  const log = lines.slice(-HISTORY_LINES);
  while (log.length < HISTORY_LINES) log.unshift({ who: '', text: ' ' });
  let question = '';
  let current: string;
  let footer: string;
  const said = (words: string) => fitTail(`You: “${words}”`, CURRENT_LINES);
  if (o.draft) {
    current = said(o.draft + (o.live && !o.draft.endsWith(o.live) ? ` ${o.live}` : ''));
    footer = o.held ? 'tap to send  ·  double tap: cancel' : '▶ TAP TO SEND  ·  double tap: cancel';
  } else if (o.live && asking) {
    current = said(o.live);
    footer = o.held ? 'tap to send  ·  double tap: cancel' : ''; 
  } else if (o.nothingHeard) {
    current = 'No speech detected';
    footer = 'tap to talk again  •  double tap: cancel';
  } else if (o.held) {
    current = listeningDots(o.sinceHold ?? 0); 
    footer = 'tap to send  ·  double tap: cancel';
  } else if (last?.cancelled && !last.a) {
    question = fitHead(`You: ${last.q}`, QUESTION_LINES);
    current = 'Cancelled.';
    footer = 'tap: ask more  ·  double tap: exit';
  } else if (last && !last.a) {
    question = fitHead(`You: ${last.q}`, QUESTION_LINES);
    current = '…';
    footer = o.waiting ? 'waiting for Hermes…  ·  double tap: cancel' : ''; 
  } else if (last) {
    question = fitHead(`You: ${last.q}`, QUESTION_LINES);
    current = `Hermes: ${last.a}`; 
    footer = 'tap: ask more  ·  double tap: exit';
  } else {
    current = 'Tap to talk.';
    footer = 'tap, speak, tap to send';
  }
  return { history: history || ' ', log, question: question || ' ', current, footer };
}

export const LISTEN_DOTS_MS = 400;
const DOTS = ['', '.', '..', '...', '..', '.'];
export function listeningDots(sinceMs: number): string {
  return `Listening${DOTS[Math.floor(Math.max(0, sinceMs) / LISTEN_DOTS_MS) % DOTS.length]}`;
}

export function micGlyph(level: number | null | undefined): string {
  if (level === null || level === undefined) return '';
  if (level < 0) return ' mic —';
  const bars = level >= 0.25 ? 3 : level >= 0.08 ? 2 : level >= 0.02 ? 1 : 0;
  return ` mic ${bars ? '|'.repeat(bars) : '·'}`;
}

export function doubleTapAction(o: { conversing: boolean; awaiting: boolean; canGoBack: boolean; cardShowing: boolean }):
  'cancel-conversation' | 'back' | 'close' | 'menu' {
  if (o.conversing && !o.awaiting) return 'cancel-conversation';
  if (o.canGoBack) return 'back';
  if (o.cardShowing) return 'close';
  return 'menu';
}

export function capFirst(s: string): string {
  const i = s.search(/[a-z]/i); 
  return i < 0 ? s : s.slice(0, i) + s[i].toUpperCase() + s.slice(i + 1);
}

export const CORNER_CHARS = 32; 

export function headerLine(opts: { online: boolean; listening: boolean; meeting: boolean; conversing: boolean; translating?: boolean; pauseReason?: string; status?: string; mic?: number | null; awaiting?: boolean }): string {
  if (!opts.online) return '○ OFFLINE';
  const circle = opts.awaiting ? '◌' : opts.listening || opts.conversing ? '●' : '○';
  const idle = opts.awaiting ? 'WAITING' : opts.conversing ? 'TALK WITH HERMES' : !opts.listening ? (opts.pauseReason === 'battery' ? 'PAUSED (BATTERY)' : 'PAUSED')
    : opts.translating ? 'TRANSLATING' : opts.meeting ? 'MEETING' : 'HERMES'; 
  const s = (opts.status || '').trim().toUpperCase();
  const word = !s ? idle : s.length > CORNER_CHARS ? `${s.slice(0, CORNER_CHARS - 1).trimEnd()}…` : s;
  return `${circle} ${word}`;
}

export const IDLE_CORNER_MS = 15_000;
export class IdleCorner {
  private since: number | null = null; 

  activity(now: number): void {
    if (this.since !== null) this.since = now;
  }

  line(header: string, now: number): string {
    if (header !== '● HERMES') {
      this.since = null;
      return header;
    }
    if (this.since === null) this.since = now;
    return now - this.since >= IDLE_CORNER_MS ? ' ' : header;
  }
}

export function micCorner(opts: { listening: boolean; awaiting?: boolean; mic?: number | null }): string {
  return opts.listening && !opts.awaiting ? micGlyph(opts.mic).trim() || ' ' : ' ';
}

export const PAUSED_FADE_MS = 10_000; 
export const QUIET_GRACE_MS = 8_000;
export const PAUSED_SLEEP_MS = PAUSED_FADE_MS + FADE_FRAMES.length * FADE_STEP_MS; 
export class ScreenSleep {
  private state: 'on' | 'fade' | 'off' = 'on';
  private since = 0; 
  private gestureAt = 0; 
  private why: 'paused' | 'quiet' = 'paused'; 

  get off(): boolean {
    return this.state === 'off';
  }

  get offBetweenPopups(): boolean {
    return this.state === 'off' && this.why === 'quiet';
  }

  showForCard(): void {
    if (this.offBetweenPopups) this.state = 'on';
  }

  get fading(): boolean {
    return this.state === 'fade';
  }

  fadeFrame(now: number): Frame {
    const i = Math.floor((now - this.since - timing.pausedFadeMs) / FADE_STEP_MS);
    return FADE_FRAMES[Math.max(0, Math.min(FADE_FRAMES.length - 1, i))];
  }

  activity(now: number): void {
    this.since = now;
    this.gestureAt = now;
  }

  update(now: number, s: { listening: boolean; needsScreen: boolean; quiet?: boolean; busy?: boolean; popup?: boolean }): 'fade' | 'sleep' | 'wake' | null {
    if (s.listening || s.needsScreen) {
      this.since = now;
      if (s.listening && s.quiet && !s.needsScreen) {
        if (this.state === 'off' && this.why === 'quiet') return null; 
        if (this.state !== 'on') { 
          this.state = 'on';
          return 'wake';
        }
        if (s.busy || (!s.popup && now - this.gestureAt < QUIET_GRACE_MS)) return null;
        this.state = 'off';
        this.why = 'quiet';
        return 'sleep';
      }
      if (this.state === 'on') return null;
      this.state = 'on';
      return 'wake';
    }
    if (!this.since) this.since = now;
    if (this.state === 'off') return null; 
    const left = now - this.since;
    const fadeAt = timing.pausedFadeMs;
    const want = left >= fadeAt + FADE_FRAMES.length * FADE_STEP_MS ? 'off' : left >= fadeAt ? 'fade' : 'on';
    if (want === this.state) return null;
    this.state = want;
    if (want === 'off') this.why = 'paused';
    return want === 'off' ? 'sleep' : want === 'fade' ? 'fade' : 'wake';
  }

  wake(now: number): boolean {
    this.since = now;
    this.gestureAt = now;
    const was = this.state === 'off';
    this.state = 'on';
    return was;
  }
}
