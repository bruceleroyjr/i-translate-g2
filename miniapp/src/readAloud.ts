import { chunks } from './readText';

type Synth = SpeechSynthesis | undefined;
const synth = (): Synth => (typeof speechSynthesis !== 'undefined' ? speechSynthesis : undefined);

export const LEAD_IN_MS = 350;

export function silentWav(ms: number): Uint8Array {
  const n = Math.max(1, Math.round(8 * ms));
  const b = new Uint8Array(44 + n);
  const v = new DataView(b.buffer);
  const tag = (at: number, s: string) => { for (let i = 0; i < 4; i++) b[at + i] = s.charCodeAt(i); };
  tag(0, 'RIFF'); v.setUint32(4, 36 + n, true); tag(8, 'WAVE'); tag(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); tag(36, 'data'); v.setUint32(40, n, true);
  b.fill(128, 44);
  return b;
}

export class ReadAloud {
  speaking = false;
  endedAt = 0; 
  voiceURI = '';
  status = '';
  onChange: () => void = () => undefined;
  private gen = 0; 
  fetchAudio: ((text: string, voice: string) => Promise<Blob>) | null = null;
  private audio: HTMLAudioElement | null = null;
  private audioUrl = '';
  private unlocked = false;
  leadInMs = LEAD_IN_MS;
  private silenceUrl = '';

  private leadIn(gen: number, go: () => void): void {
    if (this.leadInMs <= 0) { go(); return; }
    let done = false;
    const once = () => {
      if (done || gen !== this.gen) return;
      done = true;
      clearTimeout(guard);
      go();
    };
    const later = () => { clearTimeout(guard); setTimeout(once, this.leadInMs); };
    const guard = setTimeout(once, this.leadInMs + 500);
    try {
      if (typeof Audio === 'undefined') { later(); return; }
      if (!this.silenceUrl) this.silenceUrl = URL.createObjectURL(new Blob([silentWav(this.leadInMs).buffer as ArrayBuffer], { type: 'audio/wav' }));
      const a = this.player();
      a.onended = () => once();
      a.onerror = () => later();
      a.src = this.silenceUrl;
      const p = a.play();
      if (p && typeof p.catch === 'function') p.catch(() => later());
    } catch {
      later();
    }
  }

  get available(): boolean {
    return !!synth() && typeof SpeechSynthesisUtterance !== 'undefined';
  }

  private set(speaking: boolean, status?: string): void {
    const changed = this.speaking !== speaking;
    if (changed && !speaking) this.endedAt = Date.now();
    this.speaking = speaking;
    if (status !== undefined) this.status = status;
    if (changed) this.onChange();
  }

  speak(text: string, lang?: string, voice?: string | false): boolean {
    const s = synth();
    if (!s || !this.available || !text.trim()) {
      this.set(false, s ? 'Nothing to read.' : 'Text-to-speech is not available in this WebView.');
      return false;
    }
    s.cancel();
    const gen = ++this.gen;
    const parts = chunks(text);
    let i = 0;
    const next = (): void => {
      if (gen !== this.gen) return;
      if (i >= parts.length) return this.set(false, `Finished reading (${parts.length} part${parts.length === 1 ? '' : 's'}).`);
      const u = new SpeechSynthesisUtterance(parts[i++]);
      if (lang) u.lang = lang;
      const wanted = voice === undefined ? this.voiceURI : voice;
      const v = wanted ? s.getVoices().find((x) => x.voiceURI === wanted) : undefined;
      if (v) { u.voice = v; u.lang = v.lang; } 
      u.onstart = () => { if (gen === this.gen) this.set(true, 'Speaking…'); };
      u.onend = () => next();
      u.onerror = (e) => {
        if (gen !== this.gen) return;
        const why = (e as SpeechSynthesisErrorEvent).error || 'error';
        if (why === 'interrupted' || why === 'canceled') return; 
        this.set(false, `Speech error: ${why}`);
      };
      try {
        s.speak(u);
      } catch (e) {
        this.set(false, `Speech failed: ${String(e).slice(0, 60)}`);
      }
    };
    this.set(true, 'Starting…');
    this.leadIn(gen, next); 
    setTimeout(() => {
      if (gen === this.gen && this.speaking && this.status === 'Starting…' && !s.speaking) this.set(false, 'No sound started: tap "Test read-aloud" once on the phone to enable audio.');
    }, 2500 + this.leadInMs);
    return true;
  }

  stop(): void {
    const s = synth();
    this.gen++;
    if (s) s.cancel();
    this.stopAudio();
    this.set(false);
  }

  private player(): HTMLAudioElement {
    if (!this.audio) this.audio = new Audio();
    return this.audio;
  }

  private stopAudio(): void {
    if (this.audio) {
      this.audio.onended = this.audio.onerror = null;
      this.audio.pause();
    }
    if (this.audioUrl) { URL.revokeObjectURL(this.audioUrl); this.audioUrl = ''; }
  }

  speakNatural(text: string, voice: string, fallback: () => void): boolean {
    if (!this.fetchAudio || !text.trim()) { fallback(); return false; }
    const s = synth();
    if (s) s.cancel();
    this.stopAudio();
    const gen = ++this.gen;
    const parts = chunks(text, 300);
    const get = (i: number) => this.fetchAudio!(parts[i], voice);
    let pending = get(0);
    let fellBack = false;
    const fallBack = (why: string) => { 
      if (fellBack || gen !== this.gen) return;
      fellBack = true;
      this.status = why;
      fallback();
    };
    this.set(true, 'Starting (natural voice)…');
    const play = async (i: number): Promise<void> => {
      let blob: Blob;
      try {
        blob = await pending;
      } catch {
        if (gen !== this.gen) return;
        if (i === 0) return fallBack('Natural voice unavailable (PC not reachable?): the iPhone voice is used.');
        return this.set(false, 'Natural voice stopped: the PC did not answer.');
      }
      if (gen !== this.gen) return;
      if (i + 1 < parts.length) pending = get(i + 1);
      const a = this.player();
      if (this.audioUrl) URL.revokeObjectURL(this.audioUrl);
      this.audioUrl = URL.createObjectURL(blob);
      a.src = this.audioUrl;
      a.onended = () => {
        if (gen !== this.gen) return;
        if (i + 1 < parts.length) void play(i + 1);
        else this.set(false, `Finished reading (natural voice, ${parts.length} part${parts.length === 1 ? '' : 's'}).`);
      };
      a.onerror = () => {
        if (gen !== this.gen) return;
        if (i === 0) fallBack('Natural voice: the audio could not be played, the iPhone voice is used.');
        else this.set(false, 'Natural voice: the audio could not be played.');
      };
      try {
        await a.play();
        if (gen === this.gen) this.set(true, 'Speaking (natural voice)…');
      } catch {
        if (gen !== this.gen) return;
        if (i === 0) return fallBack('Audio is blocked until you tap Test read-aloud once: the iPhone voice is used.');
        this.set(false, 'Audio blocked: tap Test read-aloud once on the phone.');
      }
    };
    this.leadIn(gen, () => void play(0)); 
    return true;
  }

  unlockAudio(): void {
    try {
      const a = this.player();
      a.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
      void a.play().catch(() => undefined);
    } catch {
    }
  }

  unlockSilently(): void {
    const s = synth();
    if (!s || this.unlocked || this.speaking) return;
    this.unlocked = true;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      s.speak(u);
    } catch {
    }
  }

  voices(): { name: string; lang: string; voiceURI: string }[] {
    try {
      return (synth()?.getVoices() ?? []).filter((v) => v && v.voiceURI).map((v) => ({ name: v.name || v.voiceURI, lang: v.lang || '', voiceURI: v.voiceURI })); 
    } catch {
      return [];
    }
  }

  sample(name: string): boolean {
    this.unlocked = true;
    return this.speak(`Hello, this is ${name || 'the phone voice'}. I will read your messages aloud.`);
  }

  test(): boolean {
    this.unlocked = true;
    const voices = synth()?.getVoices().length ?? 0;
    const ok = this.speak('Sound is working. This is I-Translate on your phone.');
    if (ok) this.status = `Test started (${voices} voice${voices === 1 ? '' : 's'} on this phone)…`;
    return ok;
  }
}
