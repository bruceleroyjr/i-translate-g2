
import type { Store } from './settings.ts';
import type { TrLine } from './phoneTranslate.ts';
import { esc } from './phoneToday.ts';

export interface RecMeta {
  id: string;
  at: number; 
  end: number; 
  from: string; 
  to: string; 
  title: string; 
  n: number; 
  seen: boolean; 
}
export interface Recording extends RecMeta {
  summary: string;
  lines: TrLine[];
}

export const INDEX_KEY = 'i-translate-history';
export const recKey = (id: string) => `i-translate-rec-${id}`;
export const MAX_RECORDS = 300; 
export const MAX_LINES = 600; 
export const UNTITLED = 'New translation';

const parseJson = <T>(raw: string, fallback: T): T => {
  try { return raw ? (JSON.parse(raw) as T) : fallback; } catch { return fallback; }
};

export class History {
  list: RecMeta[] = [];
  rev = 0; 
  private loaded = false;
  private store: Store;
  constructor(store: Store) { this.store = store; } 

  async load(): Promise<void> {
    const raw = await this.store.get(INDEX_KEY).catch(() => '');
    const l = parseJson<RecMeta[]>(raw, []);
    this.list = Array.isArray(l) ? l.filter((m) => m && m.id) : [];
    this.loaded = true;
    this.rev++;
  }

  async get(id: string): Promise<Recording | null> {
    const r = parseJson<Recording | null>(await this.store.get(recKey(id)).catch(() => ''), null);
    return r && r.id === id ? r : null;
  }

  async save(r: Recording): Promise<void> {
    if (!this.loaded) await this.load();
    r.lines = r.lines.slice(-MAX_LINES);
    r.n = r.lines.length;
    await this.store.set(recKey(r.id), JSON.stringify(r));
    const meta: RecMeta = { id: r.id, at: r.at, end: r.end, from: r.from, to: r.to, title: r.title, n: r.n, seen: r.seen };
    const i = this.list.findIndex((m) => m.id === r.id);
    if (i >= 0) this.list[i] = meta; else this.list.push(meta);
    const drop = this.list.length > MAX_RECORDS ? [...this.list].sort((a, b) => a.at - b.at).slice(0, this.list.length - MAX_RECORDS) : [];
    for (const d of drop) await this.store.set(recKey(d.id), '').catch(() => undefined);
    if (drop.length) this.list = this.list.filter((m) => !drop.some((d) => d.id === m.id));
    await this.writeIndex();
  }

  async remove(id: string): Promise<void> {
    await this.store.set(recKey(id), '').catch(() => undefined); 
    this.list = this.list.filter((m) => m.id !== id);
    await this.writeIndex();
  }

  async clear(): Promise<void> {
    for (const m of this.list) await this.store.set(recKey(m.id), '').catch(() => undefined);
    this.list = [];
    await this.writeIndex();
  }

  async markSeen(id: string): Promise<void> {
    const r = await this.get(id);
    if (!r || r.seen) return;
    r.seen = true;
    await this.save(r);
  }

  untitled(exceptId = ''): RecMeta[] {
    return this.list.filter((m) => !m.title && m.n > 0 && m.id !== exceptId);
  }

  private async writeIndex(): Promise<void> {
    await this.store.set(INDEX_KEY, JSON.stringify(this.list));
    this.rev++;
  }
}


export const SUMMARY_SYSTEM = 'You name and summarize a conversation that was translated live by smart glasses. Answer with JSON only, no other text.';

export function summaryPrompt(r: Pick<Recording, 'lines' | 'from' | 'to'>): string {
  const lines = r.lines.map((l) => {
    const words = l.who === 'me' ? (l.original || l.text) : l.text;
    return `${l.who === 'me' ? 'Me' : 'Them'}: ${words}`;
  });
  let text = lines.join('\n');
  if (text.length > 6000) text = `${text.slice(0, 2500)}\n…\n${text.slice(-3300)}`; 
  return `A conversation translated from ${r.from} into ${r.to}:\n\n${text}\n\n`
    + `Write in ${r.to}. Reply with JSON: {"title": "3 to 6 words naming what it was about (no quotes, no date)", `
    + `"summary": "1 or 2 short sentences: what was said or decided"}`;
}

export function parseSummary(out: string): { title: string; summary: string } {
  const m = out.match(/\{[\s\S]*\}/);
  const j = parseJson<{ title?: unknown; summary?: unknown }>(m ? m[0] : '', {});
  const clean = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').replace(/^["'“”]+|["'“”]+$/g, '').trim().slice(0, max);
  const name = (v: unknown) => clean(clean(v, 80).replace(/\.+$/, ''), 60); 
  let title = name(j.title);
  if (!title && !m) title = name(out.split('\n')[0]); 
  return { title, summary: clean(j.summary, 300) };
}


export const CODES: Record<string, string> = {
  English: 'EN', Korean: 'KO', Japanese: 'JA', Chinese: 'ZH', Spanish: 'ES', French: 'FR', German: 'DE', Italian: 'IT',
  Portuguese: 'PT', Russian: 'RU', Vietnamese: 'VI', Thai: 'TH', Indonesian: 'ID', Tagalog: 'TL', Hindi: 'HI', Arabic: 'AR',
};
export const code = (lang: string) => CODES[lang] ?? lang.slice(0, 2).toUpperCase();

const pad = (n: number) => String(n).padStart(2, '0');
export function stamp(at: number): string {
  const d = new Date(at);
  const h = d.getHours() % 12 || 12;
  return `${pad(h)}:${pad(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'} ${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
}
export function length(r: Pick<RecMeta, 'at' | 'end'>): string {
  const s = Math.max(0, Math.round((r.end - r.at) / 1000));
  return s < 60 ? `${s} s` : s < 3600 ? `${Math.round(s / 60)} min` : `${Math.floor(s / 3600)} h ${Math.round((s % 3600) / 60)} min`;
}

const SWAP = '<svg class="h-swap" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7h12l-3-3M17 17H5l3 3"></path></svg>';
const CHEV = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"></path></svg>';
export const pairHtml = (m: Pick<RecMeta, 'from' | 'to'>) => `${esc(code(m.from))} ${SWAP} ${esc(code(m.to))}`;

export function listHtml(list: RecMeta[], newest: boolean, liveId = ''): string {
  if (!list.length) return '<div class="h-empty">No translations yet.<br>Tap Start translating on the Translate tab: each session is saved here with an AI title.</div>';
  const rows = [...list].sort((a, b) => (newest ? b.at - a.at : a.at - b.at));
  return rows.map((m) => {
    const live = m.id === liveId;
    const title = live ? 'Recording…' : m.title || UNTITLED;
    return `<button type="button" class="h-card" data-rec="${esc(m.id)}">`
      + `<span class="h-main"><span class="h-title">${esc(title)}</span>`
      + `<span class="h-sub">${esc(stamp(m.at))} <span class="h-dotsep">•</span> ${pairHtml(m)}</span></span>`
      + `${live ? '<span class="h-new rec" aria-label="Recording"></span>' : m.seen ? '' : '<span class="h-new" aria-label="Not opened yet"></span>'}`
      + `<span class="h-chev">${CHEV}</span></button>`;
  }).join('');
}
