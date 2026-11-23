
import { esc } from './phoneToday.ts';

export interface TalkMsg { q: string; a: string; typed?: boolean; cancelled?: boolean }

export class TalkLog {
  msgs: TalkMsg[] = [];
  static KEEP = 60;

  sync(turns: TalkMsg[]): void {
    for (const t of turns) if (!this.msgs.includes(t) && (t.q || t.a)) this.msgs.push(t);
    if (this.msgs.length > TalkLog.KEEP) this.msgs.splice(0, this.msgs.length - TalkLog.KEEP);
  }

  clear(): void { this.msgs = []; }
}

export interface TalkView {
  msgs: TalkMsg[];
  listening: boolean; 
  live: string; 
  thinking: boolean; 
  pending: string; 
  canSpeak: boolean; 
  translating: boolean;
}

const DOTS = '<span class="dots" aria-label="Hermes is thinking"><i></i><i></i><i></i></span>';
const me = (label: string, text: string, cls = '') =>
  `<div class="bubble-row me"><span class="bubble-label${cls ? ` ${cls}-label` : ''}">${label}</span><div class="bubble${cls ? ` ${cls}` : ''}">${text}</div></div>`;
const hermes = (html: string) => `<div class="bubble-row hermes"><span class="bubble-label">Hermes</span><div class="bubble">${html}</div></div>`;

export function talkFeedHtml(v: TalkView): string {
  const rows: string[] = [];
  v.msgs.forEach((m, i) => {
    const last = i === v.msgs.length - 1;
    if (m.q && m.q !== '…') rows.push(me(m.typed ? 'typed' : 'spoken', esc(m.q)));
    if (m.a) rows.push(hermes(esc(m.a)));
    else if (last && m.q && !m.cancelled && v.thinking && !v.pending) rows.push(hermes(DOTS));
    else if (m.cancelled && !m.a) rows.push(hermes('<span class="muted">Stopped waiting.</span>'));
  });
  if (v.pending) rows.push(me('sending…', esc(v.pending)), hermes(DOTS));
  if (v.listening) rows.push(me('<span class="rec-dot"></span>Listening', v.live ? esc(v.live) : '…', 'live'));
  if (!rows.length) {
    return '<p class="talk-empty">Ask Hermes anything: tap the mic and speak, or type below. '
      + 'It is the same conversation as on your glasses.</p>';
  }
  return rows.join('');
}

const MIC = 'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3';
const STOP = 'M7 7h10v10H7z';

export function talkBarHtml(v: TalkView): { mic: string; line: string } {
  const off = !v.listening && (!v.canSpeak || v.thinking || !!v.pending);
  const label = v.listening ? 'Stop and send' : 'Speak to Hermes';
  const mic = `<button type="button" id="talk-mic" class="mic${v.listening ? ' rec' : ''}" aria-label="${label}" title="${label}"${off ? ' disabled' : ''}>`
    + `<svg width="20" height="20" viewBox="0 0 24 24" fill="${v.listening ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.8" `
    + `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${v.listening ? STOP : MIC}"></path></svg></button>`;
  const status = v.listening ? 'Speak. Tap ■ to send.'
    : v.thinking || v.pending ? 'Hermes is thinking…'
      : v.translating ? 'Translating: typed questions still go to Hermes.'
        : !v.canSpeak ? 'Connect your glasses to speak. You can still type.'
          : 'Tap the mic and speak, or type.';
  const line = `<span class="tr-status">${esc(status)}</span>`
    + (v.listening ? '<button type="button" id="talk-cancel" class="tr-back">Cancel</button>' : '');
  return { mic, line };
}
