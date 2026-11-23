
import { esc } from './phoneToday.ts';

export interface TrLine {
  who: 'them' | 'me'; original: string; text: string; at: number;
  origLang?: string; textLang?: string; 
}
export const TR_KEEP = 100; 

export class TrLog {
  lines: TrLine[] = [];
  rev = 0; 

  add(l: TrLine): void {
    if (!l.text.trim()) return;
    this.lines.push(l);
    if (this.lines.length > TR_KEEP) this.lines.splice(0, this.lines.length - TR_KEEP);
    this.rev++;
  }

  clear(): void {
    if (!this.lines.length) return;
    this.lines = [];
    this.rev++;
  }

  of(who: TrLine['who']): TrLine[] {
    return this.lines.filter((l) => l.who === who);
  }
}

const clock = (at: number): string => new Date(at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function linesHtml(lines: TrLine[], empty: string, who = false): string {
  if (!lines.length) return `<div class="hint">${esc(empty)}</div>`;
  const play = (i: number, part: 'text', lang?: string) => (who
    ? `<button type="button" class="tr-play" data-i="${i}" data-part="${part}" aria-label="Play${lang ? ` in ${esc(lang)}` : ''}">`
      + '<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" fill="currentColor"></path></svg></button>'
    : '');
  return lines.map((l, i) => `<div class="tr-line${who ? ` tr-${l.who}` : ''}">`
    + `<div class="tr-orig"><span class="tr-words"><span class="tr-time">${esc(clock(l.at))}</span>${who ? `<span class="tr-who">${l.who === 'me' ? 'You' : 'Them'}</span>` : ''}${esc(l.original)}</span></div>`
    + `<div class="tr-text"><span class="tr-words">${esc(l.text)}</span>${play(i, 'text', l.textLang)}</div></div>`).join('');
}

export interface TurnState {
  translating: string | null; 
  myTurn: boolean;
  holding: boolean; 
  sending: boolean; 
  draft: string; 
  from: string; 
  to: string; 
  said?: string; 
  saidTr?: string;
}

export function turnControls(s: TurnState): { status: string; buttons: { id: string; label: string; cls: string; disabled?: boolean }[] } {
  if (!s.translating) return { status: 'Start translating to use My turn.', buttons: [{ id: 'tr-myturn', label: 'My turn: speak', cls: 'secondary', disabled: true }] };
  if (!s.myTurn) return { status: `Live: translating ${s.translating}.`, buttons: [{ id: 'tr-myturn', label: `My turn: speak ${s.to}`, cls: '' }] };
  const back = { id: 'tr-back', label: 'Back to live translation', cls: 'secondary' };
  if (s.holding) {
    return { status: s.draft ? `Listening… “${s.draft}”` : `Listening… speak ${s.to}.`, buttons: [{ id: 'tr-send', label: 'Send', cls: 'ok' }, back] };
  }
  if (s.sending) return { status: `Translating into ${s.from}…`, buttons: [{ id: 'tr-send', label: 'Translating…', cls: 'secondary', disabled: true }, back] };
  return { status: 'Your turn. Tap Speak again for another line.', buttons: [{ id: 'tr-again', label: 'Speak again', cls: '' }, back] };
}

export function controlsHtml(s: TurnState): string {
  const c = turnControls(s);
  return `<div class="tr-status">${esc(c.status)}</div>`
    + c.buttons.map((b) => `<button type="button" id="${b.id}" class="${b.cls}"${b.disabled ? ' disabled' : ''}>${esc(b.label)}</button>`).join('');
}

export interface PhoneIdea { kind: 'reply' | 'ask'; text: string }
export interface IdeasState {
  list: PhoneIdea[]; 
  said: number[];
  sending: boolean; 
  canReplay: boolean; 
}
const PLAY_SVG = '<svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4.5v15l13-7.5z" fill="currentColor"></path></svg>';
export function ideasHtml(s: IdeasState | null): string {
  if (!s || !s.list.length) return '';
  const label = (k: PhoneIdea['kind']) => (k === 'ask' ? 'ASK' : 'REPLY');
  if (s.said.length) {
    const i = s.said[s.said.length - 1];
    const x = s.list[i];
    if (!x) return '';
    return `<div class="tr-idea said"><span class="tr-idea-k">SAID · ${label(x.kind)}</span><span class="tr-idea-t">${esc(x.text)}</span>`
      + (s.canReplay ? `<button type="button" class="tr-idea-play" aria-label="Play it again">${PLAY_SVG}</button>` : '') + '</div>';
  }
  return s.list.map((x, i) => `<button type="button" class="tr-idea" data-idea="${i}"${s.sending ? ' disabled' : ''}>`
    + `<span class="tr-idea-k">${label(x.kind)}</span><span class="tr-idea-t">${esc(x.text)}</span></button>`).join('')
    + (s.sending ? '<div class="tr-idea-note">Saying it…</div>' : '');
}

const MIC = 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3';
const STOP = 'M7 7h10v10H7z';

export function composerHtml(s: TurnState): { mic: string; line: string } {
  const c = turnControls(s);
  const main = c.buttons.find((b) => b.id !== 'tr-back') ?? c.buttons[0];
  const back = c.buttons.some((b) => b.id === 'tr-back');
  const rec = main.id === 'tr-send' && !main.disabled; 
  const status = !s.translating ? 'Start translating to speak or type your turn.'
    : !s.myTurn ? `Tap the mic to speak ${s.to}, or type it.` : c.status;
  const mic = `<button type="button" id="${main.id}" class="mic${rec ? ' rec' : ''}" aria-label="${esc(main.label)}" title="${esc(main.label)}"`
    + `${main.disabled ? ' disabled' : ''}><svg width="20" height="20" viewBox="0 0 24 24" fill="${rec ? 'currentColor' : 'none'}" stroke="currentColor" `
    + `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${rec ? STOP : MIC}"></path></svg></button>`;
  const line = s.translating && s.myTurn ? turnCardHtml(s)
    : `<span class="tr-status">${esc(status)}</span>` + (back ? '<button type="button" id="tr-back" class="tr-back">Back to live translation</button>' : '');
  return { mic, line };
}

export function turnCardHtml(s: TurnState): string {
  const step = s.holding ? 'listen' : s.sending ? 'think' : 'done';
  const pair = `${langCode(s.to)} → ${langCode(s.from)}`;
  const words = step === 'listen' ? s.draft : step === 'think' ? s.draft || s.said || '' : s.said || '';
  const said = words
    ? `<div class="turn-said">${esc(words)}${step === 'listen' ? '…' : ''}</div>`
    : `<div class="turn-said wait">${step === 'listen' ? `Speak ${esc(s.to)}…` : 'Tap Speak again to say something.'}</div>`;
  const tr = step === 'think' ? `<div class="turn-tr wait">Translating into ${esc(s.from)}…</div>`
    : step === 'done' && s.saidTr ? `<div class="turn-tr">${esc(s.saidTr)}</div>` : '';
  const btn = (act: string, label: string, cls = '', off = false) => `<button type="button" data-turn="${act}" class="${cls}"${off ? ' disabled' : ''}>${esc(label)}</button>`;
  const btns = step === 'listen' ? btn('send', 'Send', 'go') + btn('cancel', 'Cancel')
    : step === 'think' ? btn('send', 'Sending…', '', true) + btn('cancel', 'Cancel')
    : btn('again', 'Speak again', 'blue') + btn('cancel', 'Done');
  return `<div class="turn-card ${step}"><div class="turn-hd"><span><span class="turn-dot"></span>YOUR TURN · ${esc(pair)}</span>`
    + `<button type="button" data-turn="cancel" class="turn-x" aria-label="Back to live translation">Back to live ✕</button></div>`
    + `${said}${tr}<div class="turn-btns">${btns}</div></div>`;
}

const LANG_CODES: Record<string, string> = { English: 'EN', Korean: 'KO', Japanese: 'JA', Chinese: 'ZH', Spanish: 'ES', French: 'FR', German: 'DE',
  Italian: 'IT', Portuguese: 'PT', Russian: 'RU', Vietnamese: 'VI', Thai: 'TH', Indonesian: 'ID', Tagalog: 'TL', Hindi: 'HI', Arabic: 'AR' };
const langCode = (l: string) => LANG_CODES[l] ?? l.slice(0, 2).toUpperCase();
