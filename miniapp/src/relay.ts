
export interface Mode {
  listening: boolean;
  meeting: boolean;
  conversing: boolean;
  pause_reason?: string;
  silence_s?: number;
  stt?: string;
  translating?: string; 
  place?: string; 
  awaiting?: boolean; 
  held?: boolean; 
}

export class Relay {
  url = '';
  token = '';
  online = false;

  configure(url: string, token: string): void {
    this.url = url.replace(/\/+$/, '');
    this.token = token;
  }

  ready(): boolean {
    return !!(this.url && this.token);
  }

  private async call(path: string, init: RequestInit = {}, timeoutMs = 10_000): Promise<any> {
    if (!this.ready()) throw new Error('relay not set up');
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(this.url + path, {
        ...init,
        signal: ctl.signal,
        headers: { Authorization: `Bearer ${this.token}`, ...(init.headers || {}) },
      });
      this.online = true; 
      if (!res.ok) { 
        const why = await res.json().then((b: { reason?: unknown }) => (typeof b?.reason === 'string' ? ` ${b.reason}` : '')).catch(() => '');
        throw new Error(`relay HTTP ${res.status}${why}`);
      }
      return await res.json();
    } catch (e) {
      if (!String(e).includes('relay HTTP')) this.online = false; 
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  replies(after: number, sig = '', waitMs = 0) {
    if (waitMs <= 0) return this.call(`/reply?after=${after}`);
    return this.call(`/reply?after=${after}&wait=${waitMs}&sig=${encodeURIComponent(sig)}`, {}, waitMs + 8000);
  }

  news(after: number) {
    return this.call(`/news?after=${after}`);
  }

  allNews() {
    return this.call('/news?all=1');
  }

  topTopic(topic: string) {
    return this.call(`/news?topic=${encodeURIComponent(topic)}`);
  }

  tray() {
    return this.call('/tray');
  }

  health() {
    return this.call('/health');
  }

  voiceId() {
    return this.call('/voiceid');
  }

  closed(why: string) {
    if (!this.ready()) return Promise.resolve(null);
    return fetch(this.url + '/control', {
      method: 'POST', keepalive: true,
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'app_closed', why }),
    }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  }

  control(body: Record<string, unknown>) {
    return this.call('/control', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }

  async tts(text: string, voice: string, timeoutMs = 20_000): Promise<Blob> {
    if (!this.ready()) throw new Error('relay not set up');
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(this.url + '/tts', {
        method: 'POST', signal: ctl.signal,
        headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice }),
      });
      if (!res.ok) throw new Error(`relay HTTP ${res.status}`);
      return await res.blob();
    } finally {
      clearTimeout(timer);
    }
  }

  audio(pcm: Uint8Array, source = '') {
    const headers: Record<string, string> = { 'Content-Type': 'application/octet-stream' };
    if (source) headers['X-Audio-Source'] = source; 
    return this.call('/audio', { method: 'POST', headers, body: pcm as unknown as BodyInit }, 8000);
  }
}
