import { AiClient } from './ai';
import type { LocalRelay } from './engine';

const LINES: [string, string, string, string][] = [
  ['안녕하세요. 어디에서 오셨어요?', 'Hello. Where are you from?', "I'm from Canada.", 'Have you been there?'],
  ['역은 여기서 걸어서 5분 정도 걸려요.', "The station is about a five-minute walk from here.", 'Thank you so much!', 'Which exit should I take?'],
  ['이 근처에 맛있는 식당이 많아요.', 'There are lots of good restaurants around here.', 'I would love to try one.', 'Which one do you like best?'],
];
const MINE: Record<string, string> = {
  "I'm from Canada.": '저는 캐나다에서 왔어요.',
  'Have you been there?': '거기 가 보셨어요?',
  'Thank you so much!': '정말 감사합니다!',
  'Which exit should I take?': '몇 번 출구로 나가야 해요?',
  'I would love to try one.': '한번 가 보고 싶어요.',
  'Which one do you like best?': '어디가 제일 좋아요?',
};

class FakeWS {
  static OPEN = 1;
  static last: FakeWS | null = null;
  readyState = 0;
  onopen?: () => void;
  onmessage?: (e: { data: string }) => void;
  onclose?: () => void;
  onerror?: () => void;
  constructor(public url: string, public protocols?: string[]) {
    FakeWS.last = this;
    setTimeout(() => { this.readyState = 1; this.onopen?.(); }, 5);
  }
  send(): void {  }
  close(): void { this.readyState = 3; if (FakeWS.last === this) FakeWS.last = null; }
  emit(text: string): void {
    this.onmessage?.({ data: JSON.stringify({ tokens: [{ text, is_final: true, language: 'ko' }, { text: '<end>', is_final: true }] }) });
  }
}

const fakeClaude = {
  messages: {
    create: async (req: { system?: string; messages: { content: string }[] }) => {
      const text = String(req.messages[0]?.content ?? '');
      const reply = (t: string) => ({ stop_reason: 'end_turn', content: [{ type: 'text', text: t }] });
      await new Promise((r) => setTimeout(r, 300));
      if ((req.system ?? '').startsWith('You suggest')) {
        const at = (l: (typeof LINES)[number]) => Math.max(text.lastIndexOf(l[0]), text.lastIndexOf(l[1]));
        const line = [...LINES].sort((a, b) => at(b) - at(a))[0]; 
        return reply(JSON.stringify({ replies: [line[2]], questions: [line[3]] }));
      }
      const t = (text.match(/Transcript: (.*)$/s)?.[1] ?? text).trim();
      const theirs = LINES.find((l) => l[0] === t);
      if (theirs) return reply(theirs[1]);
      if (MINE[t]) return reply(MINE[t]);
      return reply(text.length > 200 ? 'Directions in Seoul' : `[${t}]`); 
    },
  },
};

export const demoOn = new URLSearchParams(location.search).has('demo');

export function installDemo(relay: LocalRelay, gapMs = 7000): void {
  (globalThis as { WebSocket: unknown }).WebSocket = FakeWS;
  const realConfigure = relay.configure.bind(relay);
  relay.configure = () => {
    realConfigure('demo-soniox-key', { provider: 'anthropic', key: 'demo-key', model: '' });
    relay.ai = new AiClient('anthropic', 'demo-key', '', undefined, fakeClaude);
  };
  let playing: FakeWS | null = null;
  setInterval(() => {
    const ws = FakeWS.last;
    if (!ws || ws === playing || ws.readyState !== 1) return;
    playing = ws;
    LINES.forEach((l, i) => setTimeout(() => { if (FakeWS.last === ws) ws.emit(l[0]); }, 1500 + i * gapMs));
  }, 500);
}
