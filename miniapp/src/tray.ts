
import { getTextWidth } from '@evenrealities/pretext';
import { fitRow, ROW_PX } from './window.ts';

export type TrayKind = 'note' | 'news' | 'mail' | 'chat' | 'meeting' | 'calendar'; 
export const TRAY_KINDS: TrayKind[] = ['note', 'news', 'mail', 'chat', 'meeting']; 
export const TRAY_LABEL: Record<TrayKind, string> = { note: 'Lifelogs', news: 'News', mail: 'Emails', chat: 'Chats', meeting: 'Meetings', calendar: 'Calendar' };
const ZERO = (): Record<TrayKind, number> => ({ note: 0, news: 0, mail: 0, chat: 0, meeting: 0, calendar: 0 });
export const FOCUS_MS = 10_000;
export const LIST_MAX = 20; 

export interface TrayEntry { id: string; at: number; time: string; title: string; text: string; live?: boolean; topic?: string;
  gmail_id?: string; read?: boolean; seen?: 'news' | 'mail'; reminder?: boolean; soon?: string; where?: string } 
export interface TrayData { day: string; rev: number; counts: Record<TrayKind, number>; items: Record<TrayKind, TrayEntry[]>;
  tree?: { notes: number; meetings?: number; translations?: number; read?: number; growth?: number; stage: number } }

export const EMPTY_TRAY: TrayData = { day: '', rev: 0, counts: ZERO(), items: { note: [], news: [], mail: [], chat: [], meeting: [], calendar: [] } };

export interface Slot { kind: TrayKind; label: string; count: number; bright: boolean; dot: boolean; picked: boolean; flash?: boolean }

export class Tray {
  data: TrayData = EMPTY_TRAY;
  seen: Record<TrayKind, number> = ZERO();
  focus: TrayKind | null = null;
  focusAt = 0;
  list: TrayKind | null = null; 
  open: TrayEntry | null = null; 

  update(d: TrayData): void {
    if (d.day !== this.data.day) {
      this.seen = ZERO(); 
      this.focus = null;
      this.list = null;
      this.open = null;
    }
    this.data = d;
    if (this.focus && !this.visible().includes(this.focus)) this.focus = null;
  }

  visible(): TrayKind[] {
    return TRAY_KINDS;
  }

  shown(): boolean {
    return true;
  }

  unseen(k: TrayKind): number {
    return (this.data.items[k] || []).filter((e) => e.at > this.seen[k] && !e.seen).length; 
  }

  slots(): Slot[] {
    return TRAY_KINDS.map((k) => {
      const n = this.data.counts[k] ?? 0;
      const dot = this.unseen(k) > 0;
      const picked = this.focus === k;
      return { kind: k, label: TRAY_LABEL[k], count: n, bright: dot || picked, dot, picked };
    });
  }

  key(): string {
    return JSON.stringify(this.slots());
  }

  focused(now: number): boolean {
    if (this.focus && now - this.focusAt > FOCUS_MS && !this.list && !this.open) this.focus = null;
    return !!this.focus;
  }

  swipe(dir: 1 | -1, now: number): boolean {
    const vis = this.visible();
    if (!vis.length) return false;
    const i = this.focus ? vis.indexOf(this.focus) : -1;
    this.focus = i < 0 ? (dir > 0 ? vis[0] : vis[vis.length - 1]) : vis[Math.max(0, Math.min(vis.length - 1, i + dir))];
    this.focusAt = now;
    return true;
  }

  clearFocus(): void {
    this.focus = null;
  }

  preview(): string {
    const k = this.focus;
    if (!k) return ' ';
    const items = this.data.items[k] || [];
    const n = this.unseen(k);
    const head = `${TRAY_LABEL[k]} today: ${items.length}${n ? `  ·  ${n} new` : ''}`;
    const top = items[0];
    return top ? `${head}\nNewest ${top.time} · ${top.title}${top.live ? ' (live)' : ''}` : head;
  }

  openList(now: number): TrayEntry[] {
    const k = this.focus;
    if (!k) return [];
    this.focusAt = now;
    const items = (this.data.items[k] || []).slice(0, LIST_MAX);
    if (!items.length) return []; 
    this.list = k;
    this.seen[k] = Math.max(this.seen[k], ...items.map((e) => e.at), 0);
    return items;
  }

  rows(): string[] {
    return this.list ? (this.data.items[this.list] || []).slice(0, LIST_MAX).map(trayRow) : [];
  }

  pick(index: number): TrayEntry | null {
    if (!this.list) return null;
    this.open = (this.data.items[this.list] || [])[index] ?? null;
    return this.open;
  }

  back(now: number): 'list' | 'closed' | 'none' {
    this.focusAt = now;
    if (this.open) {
      this.open = null;
      return 'list';
    }
    if (this.list) {
      this.list = null;
      return 'closed';
    }
    return 'none';
  }
}

export function trayRow(e: TrayEntry): string {
  const head = `${e.time.replace(/ (AM|PM)$/, (m) => m.toLowerCase().trim())}  ${e.title}`;
  if (!e.live) return fitRow(head);
  const tail = ' (live)';
  return `${fitRow(head, ROW_PX - getTextWidth(tail), 60 - tail.length)}${tail}`;
}

export function listTitle(k: TrayKind, n: number): string {
  return `${TRAY_LABEL[k].toUpperCase()} · TODAY (${n}) · tap to open · double tap: back`; 
}

export function listStatus(k: TrayKind, n: number): string {
  return `${TRAY_LABEL[k].toUpperCase()} · TODAY (${n})`;
}

export const LIST_HINT = 'Tap: open · double tap: back';

export function itemText(k: TrayKind, e: TrayEntry): string {
  if (k === 'mail') return `${e.time}  ·  ${e.text}`.trim();
  if (k === 'chat') return e.text.trim(); 
  if (k === 'meeting') return `${e.live ? '(writing notes)\n' : ''}${e.text}`.trim();
  if (k === 'note') return `${e.live ? '(still writing)\n' : ''}${e.text}`.trim();
  const head = e.title;
  const body = k === 'news' ? e.text.replace(/^[^\n]*\n\n/, '') : e.text; 
  return `${head}\n${body}`.trim();
}

export function openStatus(k: TrayKind, e: TrayEntry, data: TrayData): string {
  const list = data.items[k] || [];
  const i = list.findIndex((x) => x.id === e.id);
  return `${TRAY_LABEL[k]} ${i + 1} of ${list.length}`;
}

export const HOME_PER_PAGE = 3; 
export const HOME_ROW_PX = 348; 
export const HOME_IDLE_MS = 60_000; 
export interface HomeEntry { kind: TrayKind; cat: string; source: string; title: string; e: TrayEntry }

export function homeEntry(kind: TrayKind, e: TrayEntry): HomeEntry {
  const title = (e.title || '').trim();
  if (kind === 'mail') { 
    const i = title.indexOf(' - ');
    return { kind, cat: 'Email', source: i > 0 ? title.slice(0, i) : 'Email', title: i > 0 ? title.slice(i + 3) : title, e };
  }
  if (kind === 'news') return { kind, cat: 'News', source: e.topic || 'Today', title, e };
  if (kind === 'meeting') { 
    const m = title.match(/^(.*?)\s*·\s*(\d+\s*min)$/);
    const style = (e.text || '').match(/·\s+(Work|Personal)\s+·/)?.[1];
    return { kind, cat: 'Meeting', source: [style, m?.[2]].filter(Boolean).join(' · '), title: m ? m[1] : title, e };
  }
  if (kind === 'chat') return { kind, cat: 'Chat', source: 'Hermes', title, e };
  if (kind === 'calendar') return e.reminder ? { kind, cat: 'Reminder', source: e.soon || '', title, e } : { kind, cat: 'Calendar', source: e.where || '', title, e };
  if (!/^Translation\b/.test(title)) return { kind, cat: 'Lifelog', source: (e.text || '').match(/·\s+(Work|Personal)\b/)?.[1] || '', title: title.replace(/\s*\(still writing\)$/, ' (writing…)'), e };
  const lines = (e.text || '').split('\n').map((l) => l.trim()).filter((l) => l && !/^Places:/.test(l));
  return { kind, cat: 'Translation', source: title.replace(/^Translation\s*/, '') || 'Translation', title: lines[1] || lines[0] || title, e };
}

export function homeEntries(d: TrayData): HomeEntry[] {
  const out: HomeEntry[] = [];
  for (const k of ['news', 'mail', 'meeting', 'chat', 'calendar'] as TrayKind[]) for (const e of d.items[k] || []) out.push(homeEntry(k, e));
  for (const e of d.items.note || []) if (!e.seen) out.push(homeEntry('note', e));
  return out.sort((a, b) => b.e.at - a.e.at);
}

export function wrapTwo(title: string, room: number): [string, string] {
  const words = (title || '').trim().split(/\s+/).filter(Boolean);
  let first = '';
  let i = 0;
  for (; i < words.length; i++) {
    const next = first ? `${first} ${words[i]}` : words[i];
    if (getTextWidth(next) > room) break;
    first = next;
  }
  if (!first && words.length) return [fitRow(words[0], room), fitRow(words.slice(1).join(' '), room)]; 
  return [first || ' ', i < words.length ? fitRow(words.slice(i).join(' '), room) : ''];
}

export const HOME_EMOJI: Record<HomeIcon, string> = {
  news: '🔥', mail: '@', calendar: '🎉', reminder: '👉', lifelog: '✨', chat: '🙂', meeting: '👀', translation: '↔',
};
export type HomeIcon = 'news' | 'mail' | 'calendar' | 'reminder' | 'meeting' | 'chat' | 'lifelog' | 'translation';
export function homeIcon(h: HomeEntry): HomeIcon {
  if (h.kind === 'note') return h.cat === 'Translation' ? 'translation' : 'lifelog';
  if (h.kind === 'calendar') return h.cat === 'Reminder' ? 'reminder' : 'calendar';
  return h.kind as HomeIcon;
}

export function homeLabel(h: HomeEntry): string {
  if (h.kind === 'news' || h.kind === 'mail' || h.kind === 'calendar') return h.source || (h.kind === 'calendar' ? h.cat : '');
  return [h.cat, h.source].filter(Boolean).join(' · ');
}

export function homeRowText(h: HomeEntry, picked: boolean): string {
  const mark = ' ▶ '; 
  const sp = Math.max(1, getTextWidth(' '));
  const pad = ' '.repeat(Math.max(1, Math.round(getTextWidth(mark) / sp)));
  const room = HOME_ROW_PX - getTextWidth(mark);
  const iconPad = `${HOME_EMOJI[homeIcon(h)]} `; 
  const time = h.e.time || '';
  const labelRoom = room - getTextWidth(iconPad) - getTextWidth(time) - 2 * sp;
  const label = labelRoom > 0 ? fitRow(homeLabel(h), labelRoom) : '';
  const fill = Math.max(1, Math.floor((room - 3 - getTextWidth(iconPad + label) - getTextWidth(time)) / sp)); 
  const l1 = `${iconPad}${label}${' '.repeat(fill)}${time}`;
  const [l2, l3] = wrapTwo(h.title || ' ', room);
  return `${picked ? mark : pad}${l1}\n${pad}${l2}${l3 ? `\n${pad}${l3}` : ''}`;
}

export class HomeList {
  private sel: string | null = null;
  private at = 0;

  index(list: HomeEntry[], now: number): number {
    if (this.sel && now - this.at > HOME_IDLE_MS) this.sel = null;
    const i = this.sel ? list.findIndex((h) => h.e.id === this.sel) : -1;
    return i < 0 ? 0 : i;
  }

  move(list: HomeEntry[], dir: 1 | -1, now: number): boolean {
    if (!list.length) return false;
    const i = Math.max(0, Math.min(list.length - 1, this.index(list, now) + dir));
    this.sel = list[i].e.id;
    this.at = now;
    return true;
  }

  touch(now: number): void {
    this.at = now;
  }

  view(list: HomeEntry[], now: number): { page: number; pages: number; rows: { h: HomeEntry; picked: boolean }[]; picked: HomeEntry | null } {
    const i = this.index(list, now);
    const page = Math.floor(i / HOME_PER_PAGE);
    const pages = Math.max(1, Math.ceil(list.length / HOME_PER_PAGE));
    const rows = list.slice(page * HOME_PER_PAGE, (page + 1) * HOME_PER_PAGE).map((h, k) => ({ h, picked: page * HOME_PER_PAGE + k === i }));
    return { page, pages, rows, picked: list[i] ?? null };
  }
}
