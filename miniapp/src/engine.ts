
import { AiClient, AiError } from './ai.ts';
import type { Mode } from './relay';
import { LANG_NOTES, TRANSLATE_TEMPLATE } from './prompts.ts';

export const LANGS: Record<string, [string, string]> = {
  English: ['EN', 'en'], Korean: ['KO', 'ko'], Japanese: ['JA', 'ja'], 'Chinese - Mandarin': ['ZH', 'zh'], 'Chinese - Cantonese': ['YUE', 'zh'],
  Spanish: ['ES', 'es'], Portuguese: ['PT', 'pt'], French: ['FR', 'fr'], German: ['DE', 'de'], Thai: ['TH', 'th'],
  Vietnamese: ['VI', 'vi'], Filipino: ['TL', 'tl'], Hawaiian: ['HAW', 'haw'],
};

const SONIOX_URL = 'wss://stt-rt.soniox.com/transcribe-websocket';
const SONIOX_MODELS = ['stt-rt-v6', 'stt-rt-v3'];
const REPLY_CHARS = 800;
const TRANSLATE_IDLE_MS = 10 * 60_000; 
const APP_GONE_MS = 10 * 60_000;
const HOLD_MAX_MS = 90_000;
const RELEASE_CUT_MS = 800; 
const RELEASE_GRACE_MS = 3000;
const HOLD_PRE_MS = 500;
const SEND_WAIT_MS = 4000;
const LIVE_SHOW_MS = 6000;
const KEEPALIVE_MS = 5000;
const ECHO_MS = 25_000; 
const ECHO_SAME = 0.72;
const CUT_MIN = 12; 
const CUT_MAX = 110; 
const SENTENCE_END = /[.!?。！？…]['"”’)\]]*\s*$/;
const TRANSLATE_OFF = /\b(?:stop|end|quit|exit|cancel)\s+(?:the\s+)?translat\w*|\btranslat\w*\s+(?:mode\s+)?off\b/i;
const NOT_A_TRANSLATION = /\b(fragment|no (?:full |complete )?sentence|not enough (?:context|text)|can(?:no|')t (?:be )?translat|unable to translate|incomplete|unclear (?:what|meaning)|nothing to translate)\b/i;

const TRANSLATE_SYSTEM = 'You are a translation engine inside a smart-glasses app. Reply with the translation of the transcript, in the target language, and nothing else: no preface, no apology, no notes.';
const IDEAS_SYSTEM = 'You suggest what a traveller could say next in a conversation that is being translated live. Answer with JSON only, no other text.';
const IDEAS_PROMPT = `A live conversation is being translated on smart glasses. I speak {mine}. The other person speaks {theirs}.
The conversation so far (oldest first, already in {mine}):
{lines}

Write what I could say back to their LAST line, in {mine}:
- 1 reply (the most likely answer or statement) and 1 question (the most useful thing to ask next).
- Each one short and natural, the way people really talk: at most 8 words, no emoji, no quotes.
- Polite and useful. Fit the situation (a shop, a taxi, a restaurant, a meeting).
Answer with exactly this JSON: {"replies": ["..."], "questions": ["..."]}`;

export type Idea = { kind: 'reply' | 'ask'; text: string };
type Item = { seq: number; kind: string; title: string; text: string; at: number; [k: string]: unknown };
type Utterance = { text: string; lang?: string | null; started?: number | null; typed?: boolean };

function refused(code: number, reason = ''): Error {
  return new Error(`relay HTTP ${code}${reason ? ` ${reason}` : ''}`);
}

export function buildTranslatePrompt(text: string, source: string, target: string): string {
  const s = LANG_NOTES[source], t = LANG_NOTES[target];
  return TRANSLATE_TEMPLATE.replace('watch translation app', 'smart-glasses translation app')
    .replace('{{PAIR}}', `${source}-to-${target}`)
    .replace('{{TARGET}}', t?.prompt ?? target)
    .replace('{{REGISTER_NOTE}}', s?.source ?? '')
    .replace('{{TARGET_NOTE}}', t?.target ?? '')
    .replace('{{TRANSCRIPT}}', text.trim());
}

export function cleanTranslation(output: string): string {
  let out = (output || '').trim().replace(/^```[a-z]*\n?|\n?```$/g, '').trim();
  const paras = out.split(/\n\s*\n/).filter((p) => p.trim());
  if (paras.length > 1 && /translat|sorry|I can|I won|I'm only|limited/i.test(paras[0])) out = paras.slice(1).join('\n\n').trim();
  out = out.replace(/^\s*(sure|here(?:'s| is| are)|translation|english|certainly|okay)\b[^\n]*?:\s*/i, '');
  out = out.split(/\n\s*\n(?=\s*(?:\(|\[|note\b|notes\b|explanation\b|\*\*note))/i)[0].trim();
  if (out.length > 1 && '"“'.includes(out[0]) && '"”'.includes(out[out.length - 1])) out = out.slice(1, -1).trim();
  return out.replace(/\*\*|__|`/g, '').slice(0, REPLY_CHARS);
}

export function parseIdeas(out: string): Idea[] {
  const m = (out || '').replace(/^```[a-z]*\n?|\n?```$/g, '').match(/\{[\s\S]*\}/);
  if (!m) return [];
  let data: { replies?: unknown; questions?: unknown };
  try { data = JSON.parse(m[0]); } catch { return []; }
  const tidy = (xs: unknown): string[] => (Array.isArray(xs) ? xs : [])
    .map((x) => String(x).replace(/\s+/g, ' ').trim().replace(/^["“”']+|["“”']+$/g, ''))
    .filter((t, i, a) => t && t.length <= 60 && a.indexOf(t) === i).slice(0, 1);
  const r = tidy(data.replies), q = tidy(data.questions);
  return [...r.map((text) => ({ kind: 'reply' as const, text })), ...q.map((text) => ({ kind: 'ask' as const, text }))];
}

export function cutNow(heard: string): boolean {
  const t = heard.trim();
  if (t.length >= CUT_MIN && SENTENCE_END.test(heard)) return true;
  return t.length >= CUT_MAX && /\s$/.test(heard);
}

const plain = (t: string) => (t || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''); 
export function similarity(a: string, b: string): number {
  if (!a.length && !b.length) return 1;
  const prev = new Array(b.length + 1).fill(0);
  for (let i = 1; i <= a.length; i++) {
    let diag = 0;
    for (let j = 1; j <= b.length; j++) {
      const up = prev[j];
      prev[j] = a[i - 1] === b[j - 1] ? diag + 1 : Math.max(prev[j], prev[j - 1]);
      diag = up;
    }
  }
  return (2 * prev[b.length]) / (a.length + b.length);
}

export class LocalRelay {
  online = false;
  private sonioxKey = '';
  private aiConf = '';
  ai: AiClient | null = null;
  private settings = { from: 'Korean', to: 'English', replyIdeas: true };
  private translating: string | null = null;
  private translateTo = 'English';
  private myTurn = false;
  private conversing = false;
  private held = false;
  private heldAt = 0;
  private releasedAt = 0;
  private cutAt = 0;
  private ptt = false;
  private draft = '';
  private live = { text: '', at: 0 };
  private heardAt = 0;
  private lastSpeech = 0;
  private appSeen = 0;
  private phraseOpen = false;
  private phraseStarted = 0;
  private items: Item[] = [];
  private seq = Date.now();
  private waiters: (() => void)[] = [];
  private sttStatus = 'idle';
  private trRecent: ['them' | 'me', string][] = [];
  private ideasGen = 0;
  private played: [number, string][] = [];
  private trCount = 0;
  private trShown = 0;
  private trReady = new Map<number, () => void>();
  private ws: WebSocket | null = null;
  private wsOpen = false;
  private wsLegacy = false; 
  private modelI = 0;
  private lastSent = 0;
  private retryAt = 0;
  private failures = 0;
  private words: string[] = [];
  private langs: Record<string, number> = {};
  private speaker: unknown = null;
  private phraseStart: number | null = null;

  constructor() {
    setInterval(() => this.tick(), 1000);
  }

  configure(sonioxKey: string, ai: { provider: string; key: string; model: string }): void {
    const conf = JSON.stringify([ai.provider, (ai.key || '').trim(), (ai.model || '').trim()]);
    if (conf !== this.aiConf) {
      this.aiConf = conf;
      this.ai = ai.key.trim() ? new AiClient(ai.provider, ai.key.trim(), ai.model || '') : null; 
    }
    const changed = sonioxKey !== this.sonioxKey;
    this.sonioxKey = (sonioxKey || '').trim();
    if (changed) {
      this.wsLegacy = false;
      this.failures = 0;
      this.retryAt = 0;
    }
  }

  ready(): boolean {
    return !!(this.sonioxKey && this.ai);
  }

  mode(): Mode & Record<string, unknown> {
    return { listening: true, meeting: false, conversing: this.conversing, awaiting: false, held: this.held, my_turn: this.myTurn,
      translating: this.translating ? `${this.translating} → ${this.translateTo}` : undefined, stt: this.sttStatus };
  }

  private out(after: number) {
    const now = Date.now();
    if (after < 0) after = this.seq;
    const showLive = this.conversing && now - this.live.at < LIVE_SHOW_MS;
    const o = {
      seq: this.seq, items: this.items.filter((i) => i.seq > after), mode: this.mode(), live: showLive ? this.live : { text: '', at: 0 },
      draft: this.conversing ? this.draft : '', heard_s: this.heardAt ? Math.round((now - this.heardAt) / 100) / 10 : null, sig: '',
    };
    o.sig = String(hash(JSON.stringify([o.seq, o.live.text, o.draft, o.mode])));
    return o;
  }

  async replies(after: number, sig = '', waitMs = 0) {
    const deadline = Date.now() + Math.min(Math.max(0, waitMs), 2000);
    for (;;) {
      const o = this.out(after);
      if (!sig || o.sig !== sig || o.items.length || Date.now() >= deadline) return o;
      await new Promise<void>((r) => {
        const t = setTimeout(r, Math.min(100, Math.max(0, deadline - Date.now())));
        this.waiters.push(() => { clearTimeout(t); r(); });
      });
    }
  }

  private changed(): void {
    const w = this.waiters;
    this.waiters = [];
    w.forEach((f) => f());
  }

  async health() {
    return { ok: true, service: 'i-translate-engine', mode: this.mode() };
  }

  async voiceId() {
    return null;
  }

  async allNews() {
    return { items: [] }; 
  }

  async closed(why: string) {
    this.appClosed(why);
    return { ok: true, mode: this.mode() };
  }

  async tts(_text: string, _voice: string): Promise<Blob> {
    throw new Error('no natural voices in i-translate'); 
  }

  private push(kind: string, title = '', text = '', extra: Record<string, unknown> = {}): Item {
    this.seq += 1;
    const item: Item = { seq: this.seq, kind, title: title.slice(0, 60), text: text.slice(0, REPLY_CHARS), at: Date.now() / 1000, ...extra };
    this.items.push(item);
    if (this.items.length > 100) this.items.shift();
    this.changed();
    return item;
  }

  async control(data: Record<string, unknown>): Promise<{ ok: boolean; mode: Mode } & Record<string, any>> {
    const action = String(data.action ?? '');
    const now = Date.now();
    const ok = () => ({ ok: true, mode: this.mode() });
    switch (action) {
      case 'settings':
        if (typeof data.translate_from === 'string' && LANGS[data.translate_from]) this.settings.from = data.translate_from;
        if (typeof data.translate_to === 'string' && LANGS[data.translate_to]) this.settings.to = data.translate_to;
        if (typeof data.reply_ideas === 'boolean') this.settings.replyIdeas = data.reply_ideas;
        return ok();
      case 'telemetry':
        this.appSeen = now;
        return ok();
      case 'app_closed':
        this.appClosed(String(data.why ?? ''));
        return ok();
      case 'translate': {
        const from = String(data.from || this.settings.from), to = String(data.to || this.settings.to);
        if (!LANGS[from] || !LANGS[to]) throw refused(400, 'unknown language');
        if (!this.ready()) throw refused(409, 'keys');
        this.startTranslation(from, to);
        return ok();
      }
      case 'translate_off':
        this.stopTranslation();
        return ok();
      case 'my_turn': {
        const on = !!data.on;
        if (on && !this.translating) throw refused(409, 'not translating');
        this.myTurn = on;
        if (!on) { this.conversing = this.held = this.ptt = false; this.draft = ''; this.releasedAt = 0; }
        this.lastSpeech = now;
        this.changed();
        return ok();
      }
      case 'hold': {
        if (!this.translating) throw refused(409, 'not translating');
        this.conversing = true;
        this.lastSpeech = now;
        this.push('wake', 'LISTENING', '');
        this.held = true;
        this.heldAt = now;
        this.ptt = true;
        this.releasedAt = 0;
        this.cutAt = this.phraseOpen && this.phraseStarted < now - HOLD_PRE_MS ? now : 0;
        this.draft = String(data.draft || '').trim().slice(0, REPLY_CHARS);
        this.live = { text: '', at: 0 };
        this.changed();
        return ok();
      }
      case 'release':
        if (this.held) {
          this.held = false;
          this.releasedAt = now;
          this.cutAt = now + RELEASE_CUT_MS;
          this.lastSpeech = now;
          this.changed();
        }
        return ok();
      case 'send': {
        if (!this.translating) throw refused(409, 'not translating');
        await this.waitForPhrase();
        const text = this.draft.trim();
        this.draft = '';
        this.lastSpeech = Date.now();
        this.releasedAt = 0;
        if (!text) {
          if (this.ptt && this.conversing) {
            this.conversing = this.ptt = false;
            this.push('status', 'NOTHING HEARD', "Didn't catch that. Tap, speak, then tap again.");
          }
          throw refused(409, 'silence');
        }
        this.conversing = this.held = this.ptt = false;
        this.changed();
        if (TRANSLATE_OFF.test(text)) { this.stopTranslation(); return ok(); }
        this.translate(text, true);
        return ok();
      }
      case 'discard':
        this.draft = '';
        this.held = false;
        this.releasedAt = 0;
        this.lastSpeech = now;
        this.changed();
        return ok();
      case 'end':
      case 'cancel_wait':
        this.conversing = this.held = this.ptt = false;
        this.draft = '';
        this.changed();
        return ok();
      case 'my_turn_text': {
        const text = String(data.text ?? '').trim().slice(0, 600);
        if (!text) throw refused(400, 'empty text');
        if (!this.translating) throw refused(409, 'not translating');
        this.lastSpeech = now;
        this.translate(text, true, !!data.idea);
        return ok();
      }
      default:
        return ok(); 
    }
  }

  async audio(pcm: Uint8Array, _source = '') {
    if (this.translating && this.ws && this.wsOpen) {
      this.ws.send(pcm);
      this.lastSent = Date.now();
    }
    return { ok: true, mode: this.mode() };
  }

  async testKeys(): Promise<{ ai: string; aiName: string; model: string; soniox: string }> {
    const ai = this.ai ? await this.ai.test() : 'no key';
    if (ai === 'ok') this.online = true;
    const soniox = await new Promise<string>((resolve) => {
      if (!this.sonioxKey) return resolve('no key');
      let done = false;
      const finish = (r: string) => { if (!done) { done = true; resolve(r); try { ws.close(); } catch {  } } };
      const ws = new WebSocket(SONIOX_URL, ['soniox-api-key', this.sonioxKey]);
      ws.onopen = () => {
        ws.send(JSON.stringify(this.sttConfig(['en'])));
        ws.send(new Uint8Array(3200)); 
        ws.send(''); 
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(String(ev.data));
          const why = String(msg.error_message || msg.error_code || '');
          if (/no audio/i.test(why)) finish('ok'); 
          else if (msg.error_code || msg.error_message) finish(`refused: ${why}`);
          else if (msg.finished) finish('ok');
        } catch {  }
      };
      ws.onerror = () => finish("couldn't connect");
      ws.onclose = () => finish("couldn't connect");
      setTimeout(() => finish('no answer'), 10_000);
    });
    return { ai, aiName: this.ai?.p.name ?? 'AI', model: this.ai?.model ?? '', soniox };
  }

  private startTranslation(lang: string, to: string): void {
    if (to === lang) to = lang === 'English' ? 'Korean' : 'English';
    this.translating = lang;
    this.translateTo = to;
    this.myTurn = false;
    this.conversing = this.held = this.ptt = false;
    this.draft = '';
    this.lastSpeech = Date.now();
    this.trRecent = [];
    this.played = [];
    this.push('translation', this.pairTitle(lang, to), `Translating ${lang} → ${to}.`);
    this.closeStt(); 
    this.failures = 0;
    this.retryAt = 0;
    this.openStt();
  }

  private stopTranslation(): void {
    if (!this.translating) return;
    this.translating = null;
    this.myTurn = false;
    this.conversing = this.held = this.ptt = false;
    this.draft = '';
    this.closeStt();
    this.push('status', 'TRANSLATION OFF', 'Translation off.');
  }

  private appClosed(_why: string): void {
    this.stopTranslation();
  }

  private pairTitle(a: string, b: string): string {
    return `${LANGS[a]?.[0] ?? a} → ${LANGS[b]?.[0] ?? b}`;
  }

  private targetCode(): string {
    return LANGS[this.translateTo]?.[1] ?? 'en';
  }

  private myTurnListening(): boolean {
    return !!this.translating && this.myTurn && this.ptt && this.conversing;
  }

  private tick(): void {
    const now = Date.now();
    if (this.translating && this.appSeen && now - this.appSeen > APP_GONE_MS) { this.appSeen = 0; this.appClosed('app gone'); }
    if (this.held && now - this.heldAt > HOLD_MAX_MS) void this.control({ action: 'release' });
    if (this.translating && now - this.lastSpeech > TRANSLATE_IDLE_MS) this.stopTranslation();
    if (!this.translating) return;
    if (!this.ws && now >= this.retryAt) this.openStt();
    if (this.ws && this.wsOpen) {
      if (this.cutAt && now >= this.cutAt && this.myTurnListening()) { this.cutAt = 0; this.ws.send(JSON.stringify({ type: 'finalize' })); }
      else if (this.cutAt && now >= this.cutAt) this.cutAt = 0;
      if (now - this.lastSent >= KEEPALIVE_MS) { this.ws.send(JSON.stringify({ type: 'keepalive' })); this.lastSent = now; }
    }
  }

  private async waitForPhrase(): Promise<void> {
    const end = Date.now() + SEND_WAIT_MS;
    while (Date.now() < end && this.ptt && this.phraseOpen && this.releasedAt && this.phraseStarted <= this.releasedAt) {
      if (this.cutAt && Date.now() >= this.cutAt) this.tick();
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  private holdOwns(started: number | null | undefined): boolean {
    if (started != null && started < this.heldAt - HOLD_PRE_MS) return false;
    if (this.held) return true;
    if (!this.releasedAt) return false;
    if (started != null) return started <= this.releasedAt;
    return Date.now() - this.releasedAt <= RELEASE_GRACE_MS;
  }

  private sttConfig(hints: string[]): Record<string, unknown> {
    return { ...(this.wsLegacy ? { api_key: this.sonioxKey } : {}), model: SONIOX_MODELS[this.modelI], audio_format: 'pcm_s16le', sample_rate: 16000,
      num_channels: 1, language_hints: hints, enable_language_identification: true, enable_speaker_diarization: true, enable_endpoint_detection: true };
  }

  private openStt(): void {
    if (this.ws || !this.translating || !this.sonioxKey) return;
    const hints = [...new Set([this.targetCode(), LANGS[this.translating]?.[1] ?? 'en'])];
    let ws: WebSocket;
    try {
      ws = this.wsLegacy ? new WebSocket(SONIOX_URL) : new WebSocket(SONIOX_URL, ['soniox-api-key', this.sonioxKey]);
    } catch {
      this.sttFailed('error: no connection');
      return;
    }
    this.ws = ws;
    this.wsOpen = false;
    this.sttStatus = 'connecting';
    this.words = [];
    this.langs = {};
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => {
      if (this.ws !== ws) return;
      ws.send(JSON.stringify(this.sttConfig(hints)));
      this.wsOpen = true;
      this.lastSent = Date.now();
      this.sttStatus = 'live (soniox)';
      this.changed();
    };
    ws.onmessage = (ev) => {
      if (this.ws !== ws) return;
      let msg: { tokens?: { text?: string; is_final?: boolean; language?: string; speaker?: unknown }[]; finished?: boolean; error_code?: number; error_message?: string };
      try { msg = JSON.parse(String(ev.data)); } catch { return; }
      if (msg.error_code || msg.error_message) {
        const m = String(msg.error_message || '');
        if (/model/i.test(m) && this.modelI + 1 < SONIOX_MODELS.length) this.modelI++;
        this.sttFailed(msg.error_code === 401 || /api key|unauthori/i.test(m) ? 'Soniox key refused' : `error ${msg.error_code ?? ''}`.trim(), msg.error_code === 401);
        return;
      }
      this.failures = 0;
      this.onTokens(msg.tokens || []);
      if (msg.finished) this.flush();
    };
    ws.onerror = () => { if (this.ws === ws) this.sttFailed('error: connection'); };
    ws.onclose = () => {
      if (this.ws !== ws) return;
      if (!this.wsOpen && !this.wsLegacy) this.wsLegacy = true; 
      this.flush();
      this.ws = null;
      this.wsOpen = false;
      if (this.translating) { this.retryAt = Date.now() + Math.min(30_000, 1000 * 2 ** Math.min(this.failures, 5)); this.failures++; }
      if (this.sttStatus.startsWith('live')) this.sttStatus = 'reconnecting';
      this.changed();
    };
  }

  private sttFailed(status: string, keyRefused = false): void {
    this.sttStatus = status;
    this.failures++;
    this.retryAt = Date.now() + (keyRefused ? 60_000 : Math.min(30_000, 1000 * 2 ** Math.min(this.failures, 5)));
    const ws = this.ws;
    this.ws = null;
    this.wsOpen = false;
    try { ws?.close(); } catch {  }
    if (keyRefused) this.push('status', 'SONIOX KEY', 'Soniox refused the API key. Check it in Settings › API keys.');
    this.changed();
  }

  private closeStt(): void {
    const ws = this.ws;
    this.flush();
    this.ws = null;
    this.wsOpen = false;
    if (ws) {
      try { if (ws.readyState === WebSocket.OPEN) ws.send(''); } catch {  }
      setTimeout(() => { try { ws.close(); } catch {  } }, 1500);
    }
    this.sttStatus = 'idle';
  }

  private onTokens(tokens: { text?: string; is_final?: boolean; language?: string; speaker?: unknown }[]): void {
    const mine = this.myTurnListening();
    const tgt = this.targetCode();
    const keep = (t: { language?: string }) => !mine || t.language == null || t.language === tgt; 
    let partial = '';
    for (const tok of tokens) {
      const text = tok.text ?? '';
      if (text === '<end>' || text === '<fin>') { this.flush(); continue; }
      if (!keep(tok)) continue;
      if (!tok.is_final) {
        partial += text;
        this.lastSpeech = Date.now();
        if (text.trim()) this.begin();
        continue;
      }
      this.begin();
      if (tok.speaker != null && this.speaker != null && tok.speaker !== this.speaker && this.words.length) this.flush();
      this.speaker = tok.speaker ?? this.speaker;
      if (tok.language) this.langs[tok.language] = (this.langs[tok.language] ?? 0) + text.length;
      this.words.push(text);
      if (this.translating && !mine && cutNow(this.words.join(''))) this.flush(); 
    }
    const heard = (this.words.join('') + partial).replace(/<end>|<fin>/g, '');
    if (heard.trim()) this.setLive(heard, this.phraseStart);
  }

  private begin(): void {
    if (this.phraseStart == null) this.phraseStart = Date.now();
    if (!this.phraseOpen) {
      this.phraseOpen = true;
      this.phraseStarted = Date.now();
      if (this.cutAt && this.phraseStarted >= this.cutAt) this.cutAt = 0; 
    }
  }

  private flush(): void {
    const text = this.words.join('').trim();
    const langs = Object.entries(this.langs);
    const lang = langs.length ? langs.sort((a, b) => b[1] - a[1])[0][0] : null;
    const started = this.phraseStart;
    const mine = this.myTurnListening();
    this.words = [];
    this.langs = {};
    this.phraseStart = null;
    this.phraseOpen = false;
    if (!text) return;
    this.onUtterance({ text, lang: mine ? this.targetCode() : lang, started });
  }

  private setLive(text: string, started: number | null): void {
    const t = text.replace(/\s+/g, ' ').trim();
    if (!t) return;
    this.heardAt = Date.now();
    if (this.ptt && !this.holdOwns(started)) return;
    this.live = { text: t.slice(-300), at: Date.now() };
    this.changed();
  }

  private onUtterance(u: Utterance): void {
    const now = Date.now();
    let text = u.text.replace(/\s+/g, ' ').trim();
    if (!text || !this.translating) return;
    if (!u.typed) this.heardAt = now;
    this.lastSpeech = now;
    if (TRANSLATE_OFF.test(text)) { this.stopTranslation(); return; }
    const src = LANGS[this.translating]?.[1], tgt = this.targetCode();
    const myTurnNow = this.conversing && this.ptt; 
    if (this.myTurn && !myTurnNow) return; 
    if (!myTurnNow) {
      if (u.lang !== tgt || src === tgt) { 
        text = this.withoutEcho(text);
        if (text) this.translate(text, false);
      }
      return;
    }
    if (!this.holdOwns(u.started)) return; 
    this.draft = `${this.draft} ${text}`.trim().slice(-REPLY_CHARS);
    this.changed();
  }

  private withoutEcho(text: string): string {
    const now = Date.now();
    const heard = plain(text);
    if (!heard) return text;
    for (const [at, said] of this.played) {
      if (now - at > ECHO_MS) continue;
      const p = plain(said);
      if (!p) continue;
      if (heard === p || similarity(heard, p) >= ECHO_SAME) return '';
      if (p.length >= 4 && heard.includes(p)) {
        let rest = text;
        for (const piece of said.split(/[\s.,!?。、？！]+/)) if (piece) rest = rest.split(piece).join(' ');
        rest = rest.replace(/\s+/g, ' ').trim().replace(/^[ .,!?。、？！]+|[ .,!?。、？！]+$/g, '');
        return plain(rest).length >= 2 ? rest : '';
      }
    }
    return text;
  }

  private aiError(e: unknown): string {
    if (e instanceof AiError) {
      if (/reach/.test(e.message)) this.online = false;
      return e.message;
    }
    return 'failed';
  }

  async summarize(system: string, prompt: string): Promise<string> {
    return this.ask(system, prompt, 300);
  }

  private async ask(system: string, prompt: string, maxTokens: number): Promise<string> {
    if (!this.ai) throw new AiError('no AI key');
    const out = await this.ai.ask(system, prompt, maxTokens);
    this.online = true;
    return out;
  }

  private translate(text: string, mine: boolean, idea = false): void {
    if (!this.translating) return;
    const lang = mine ? this.translateTo : this.translating;
    const to = mine ? this.translating : this.translateTo;
    const n = ++this.trCount;
    this.push('status', 'TRANSLATING', '');
    const deliver = (show: () => void) => {
      this.trReady.set(n, show);
      while (this.trReady.has(this.trShown + 1)) {
        this.trShown++;
        const fn = this.trReady.get(this.trShown)!;
        this.trReady.delete(this.trShown);
        fn();
      }
    };
    void (async () => {
      let out: string;
      try {
        out = cleanTranslation(await this.ask(TRANSLATE_SYSTEM, buildTranslatePrompt(text, lang, to), 1024));
      } catch (e) {
        const why = this.aiError(e);
        deliver(() => this.push('translation', this.pairTitle(lang, to), `(translation failed: ${why})`, { mine }));
        return;
      }
      if (!out || NOT_A_TRANSLATION.test(out)) { deliver(() => this.push('status', 'IDLE', '')); return; }
      deliver(() => {
        if (!this.translating) return; 
        const item = this.push('translation', this.pairTitle(lang, to), out, { original: text.slice(0, 300), speak_in: to, mine, ...(idea ? { idea: true } : {}) });
        this.trRecent.push(mine ? ['me', text] : ['them', out]); 
        if (this.trRecent.length > 8) this.trRecent.shift();
        if (mine && idea) { this.played.push([Date.now(), out]); if (this.played.length > 6) this.played.shift(); }
        if (!mine) this.wantIdeas(item.seq);
      });
    })();
  }

  private wantIdeas(seq: number): void {
    if (!this.settings.replyIdeas || !this.translating) return;
    this.ideasGen = seq;
    const recent = this.trRecent.slice(-6);
    const mine = this.translateTo, theirs = this.translating;
    const lines = recent.map(([who, t]) => `- ${who === 'me' ? 'Me' : 'Them'}: ${t}`).join('\n') || '- Them: (nothing yet)';
    const prompt = IDEAS_PROMPT.replace(/\{mine\}/g, mine).replace(/\{theirs\}/g, theirs).replace('{lines}', lines);
    void (async () => {
      let ideas: Idea[] = [];
      try { ideas = parseIdeas(await this.ask(IDEAS_SYSTEM, prompt, 512)); } catch { return; }
      if (!ideas.length || seq !== this.ideasGen || !this.translating) return;
      this.push('ideas', '', '', { ideas, for_seq: seq });
    })();
  }
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
