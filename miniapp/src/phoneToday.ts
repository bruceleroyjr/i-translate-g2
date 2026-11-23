
import { itemText, type TrayData, type TrayEntry, type TrayKind } from './tray.ts';

export const TODAY_TABS: Record<string, TrayKind> = { lifelogs: 'note', news: 'news', emails: 'mail', chats: 'chat', meetings: 'meeting' };
export const TODAY_SHOWN = 10; 
const NOUN: Record<TrayKind, [string, string]> = {
  note: ['lifelog', 'lifelogs'], news: ['headline', 'headlines'], mail: ['email', 'emails'], chat: ['chat', 'chats'], meeting: ['meeting', 'meetings'],
  calendar: ['event', 'events'],
};

export function esc(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function entryText(k: TrayKind, e: TrayEntry): string {
  return itemText(k, e).trim();
}

export function todayHtml(k: TrayKind, data: TrayData, open: Set<string>, all: boolean): string {
  const items = (data.items[k] || []).filter((e) => !(k === 'note' && e.seen)); 
  const [one, many] = NOUN[k];
  const head = `<h2>Today <span class="today-n">${items.length ? `${items.length} ${items.length === 1 ? one : many}` : ''}</span></h2>`;
  if (!items.length) return `${head}<div class="hint">Nothing yet today.</div>`;
  const shown = all ? items : items.slice(0, TODAY_SHOWN);
  const rows = shown.map((e) => {
    const isOpen = open.has(e.id);
    const tag = e.live && !/writing/i.test(e.title) ? `<span class="today-live">${k === 'meeting' ? 'writing notes' : 'still writing'}</span>` : '';
    return `<div class="today-item${isOpen ? ' open' : ''}">`
      + `<button type="button" class="today-row" data-today-id="${esc(e.id)}" aria-expanded="${isOpen}">`
      + `<span class="today-time">${esc(e.time)}</span><span class="today-title">${esc(e.title)}</span>${tag}</button>`
      + (isOpen ? `<div class="today-text">${esc(entryText(k, e))}</div>` : '')
      + '</div>';
  }).join('');
  const more = items.length > shown.length
    ? `<button type="button" class="today-more" data-today-all="${k}">Show all ${items.length}</button>`
    : all && items.length > TODAY_SHOWN ? `<button type="button" class="today-more" data-today-all="${k}">Show fewer</button>` : '';
  return `${head}<div class="today-list">${rows}</div>${more}`;
}


export type FeedFilter = 'all' | 'note' | 'meeting' | 'chat' | 'news' | 'mail';
export const FEED_KINDS: TrayKind[] = ['note', 'meeting', 'chat', 'news', 'mail'];
export const FEED_SHOWN = 15; 
const CHIP: Record<FeedFilter, string> = { all: 'All', note: 'Lifelogs', meeting: 'Meetings', chat: 'Chats', news: 'News', mail: 'Email' };
const KIND_LABEL: Record<string, string> = { note: 'Lifelog', meeting: 'Meeting', chat: 'Chat', news: 'News', mail: 'Email' };
const ICON: Record<string, string> = {
  note: 'M12 4v16M8 8v8M16 8v8M4 11v2M20 11v2',
  meeting: 'M9 4.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7zM2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.3c2.1.7 3.5 2.6 3.5 5.7',
  chat: 'M5 5h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-8l-5 4v-4H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z',
  news: 'M6 5h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM8 9h8M8 13h8M8 16h5',
  mail: 'M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM4 7l8 6 8-6',
  translate: 'M4 5h9M8.5 3v2M6 5c.8 3.4 3 6 6 7.5M11 5c-.9 3.7-3.4 6.6-7 8M13 21l4-9 4 9M14.5 18h5',
};

export function icon(path: string, size = 18): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" `
    + `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${path}"></path></svg>`;
}

export interface FeedRow { kind: TrayKind; key: string; entry: TrayEntry }

export function feedRows(data: TrayData, filter: FeedFilter): FeedRow[] {
  const kinds = filter === 'all' ? FEED_KINDS : [filter];
  const rows: FeedRow[] = [];
  for (const k of kinds) {
    for (const e of data.items[k] || []) {
      if (k === 'note' && e.seen) continue;
      rows.push({ kind: k, key: `${k}:${e.id}`, entry: e });
    }
  }
  return rows.sort((a, b) => (b.entry.at || 0) - (a.entry.at || 0));
}

export function sideOf(e: TrayEntry): string {
  const first = String(e.text || '').split('\n', 1)[0];
  const m = first.match(/·\s*(Personal|Work)\b/i);
  return m ? m[1][0].toUpperCase() + m[1].slice(1).toLowerCase() : '';
}

export function chipsHtml(filter: FeedFilter, data: TrayData): string {
  return (Object.keys(CHIP) as FeedFilter[]).map((f) => {
    const n = feedRows(data, f).length;
    return `<button type="button" role="tab" class="chip${f === filter ? ' on' : ''}" data-feed="${f}" aria-selected="${f === filter}">`
      + `${CHIP[f]} <span class="chip-n">${n}</span></button>`;
  }).join('');
}

export function feedHtml(filter: FeedFilter, data: TrayData, open: Set<string>, all: boolean): string {
  const rows = feedRows(data, filter);
  if (!rows.length) return `<p class="feed-empty">Nothing yet today.</p>`;
  const shown = all ? rows : rows.slice(0, FEED_SHOWN);
  const html = shown.map(({ kind, key, entry: e }) => {
    const isOpen = open.has(key);
    const tr = kind === 'note' && /^Translation/i.test(e.title);
    const side = kind === 'note' || kind === 'meeting' ? sideOf(e) : '';
    const live = e.live && !/writing/i.test(e.title) ? `<span class="live">${kind === 'meeting' ? 'writing notes' : 'still writing'}</span>` : '';
    return `<li class="feed-item${isOpen ? ' open' : ''}">`
      + `<button type="button" class="feed-row" data-today-id="${esc(key)}" aria-expanded="${isOpen}">`
      + `<span class="feed-icon">${icon(ICON[tr ? 'translate' : kind])}</span>`
      + `<span class="feed-main"><span class="feed-title">${esc(e.title)}</span>`
      + `<span class="feed-meta">${esc(e.time)} · ${tr ? 'Translation' : KIND_LABEL[kind]}`
      + (side ? `<span class="tag tag-${side.toLowerCase()}">${side}</span>` : '') + live + `</span></span>`
      + `<svg class="chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"></path></svg>`
      + `</button>` + (isOpen ? `<div class="feed-text">${esc(entryText(kind, e))}</div>` : '') + `</li>`;
  }).join('');
  const more = rows.length > shown.length
    ? `<button type="button" class="feed-more" data-today-all="${filter}">Show all ${rows.length}</button>`
    : all && rows.length > FEED_SHOWN ? `<button type="button" class="feed-more" data-today-all="${filter}">Show fewer</button>` : '';
  return `<ul class="feed-list">${html}</ul>${more}`;
}
