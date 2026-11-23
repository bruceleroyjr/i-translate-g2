
import type { VoiceChoice } from './langVoices';

export type ReadKind = 'translations' | 'myturn';
export const READ_KINDS: ReadKind[] = ['translations', 'myturn'];

export interface Settings {
  sonioxKey: string; 
  anthropicKey: string; 
  aiProvider: string; 
  aiKeys: Record<string, string>; 
  aiModels: Record<string, string>; 
  translateFrom: string; 
  translateTo: string; 
  translateMic: 'phone' | 'glasses'; 
  micsV: number; 
  myTurnMic: 'phone' | 'glasses'; 
  liveWords: boolean; 
  screenOffS: number;
  messageS: number; 
  messageKinds: Record<MsgKind, number>; 
  voiceSpoken: VoiceChoice; 
  voiceTranslated: VoiceChoice; 
  phoneVoices: Record<string, string>; 
  readKinds: Record<ReadKind, boolean>; 
  trFooter: boolean; 
  replyIdeas: boolean; 
  showOriginal: boolean; 
}

export const SCREEN_OFF_CHOICES: [number, string][] = [[10, '10 seconds'], [15, '15 seconds'], [30, '30 seconds'], [60, '1 minute'], [120, '2 minutes'], [300, '5 minutes'], [0, 'Never']];
export const MSG_KINDS = ['translations'] as const;
export type MsgKind = (typeof MSG_KINDS)[number];
export const MESSAGE_CHOICES: [number, string][] = [[5, '5 seconds'], [10, '10 seconds'], [15, '15 seconds'], [20, '20 seconds'], [30, '30 seconds'], [45, '45 seconds'], [60, '1 minute']];
const pick = (v: unknown, choices: [number, string][], dflt: number) => (choices.some(([k]) => k === Number(v)) ? Number(v) : dflt);

export const LANGUAGES = ['English', 'Korean', 'Japanese', 'Chinese - Mandarin', 'Chinese - Cantonese', 'Spanish', 'Portuguese', 'French',
  'German', 'Thai', 'Vietnamese', 'Filipino', 'Hawaiian'];

export function setPairSide(s: { translateFrom: string; translateTo: string }, side: 'from' | 'to', lang: string): boolean {
  if (!LANGUAGES.includes(lang)) return false;
  const [mine, other] = side === 'from' ? (['translateFrom', 'translateTo'] as const) : (['translateTo', 'translateFrom'] as const);
  if (s[other] === lang) s[other] = s[mine];
  s[mine] = lang;
  return true;
}

export function defaults(): Settings {
  return {
    sonioxKey: '',
    anthropicKey: '',
    aiProvider: 'anthropic',
    aiKeys: {},
    aiModels: {},
    translateFrom: 'Korean',
    translateTo: 'English',
    translateMic: 'glasses', 
    micsV: 1,
    myTurnMic: 'glasses',
    liveWords: true,
    screenOffS: 10,
    messageS: 15,
    messageKinds: { translations: 0 },
    showOriginal: true,
    trFooter: true,
    replyIdeas: true,
    voiceSpoken: 'female',
    voiceTranslated: 'female',
    phoneVoices: {},
    readKinds: { translations: false, myturn: true }, 
  };
}

export interface Store {
  get(key: string): Promise<string>;
  set(key: string, value: string): Promise<unknown>;
}

const KEY = 'i-translate-settings';

export async function load(store: Store): Promise<Settings> {
  try {
    const raw = await store.get(KEY);
    const saved = raw ? JSON.parse(raw) : null;
    const s = defaults();
    if (saved && typeof saved === 'object') for (const k of Object.keys(s) as (keyof Settings)[]) if (k in saved) (s as unknown as Record<string, unknown>)[k] = saved[k];
    if (saved && (Number(saved.micsV) || 0) < 1) { s.translateMic = 'glasses'; s.myTurnMic = 'glasses'; s.micsV = 1; } 
    if (s.translateMic !== 'phone') s.translateMic = 'glasses';
    if (s.myTurnMic !== 'phone') s.myTurnMic = 'glasses';
    s.liveWords = s.liveWords !== false;
    s.showOriginal = s.showOriginal !== false;
    s.trFooter = s.trFooter !== false;
    s.replyIdeas = s.replyIdeas !== false;
    s.readKinds = Object.fromEntries(READ_KINDS.map((k) => {
      const v = (saved?.readKinds as Record<string, unknown> | undefined)?.[k];
      return [k, k === 'myturn' ? v !== false : v === true];
    })) as Record<ReadKind, boolean>;
    if (s.voiceSpoken !== 'male') s.voiceSpoken = 'female';
    if (s.voiceTranslated !== 'male') s.voiceTranslated = 'female';
    s.sonioxKey = typeof s.sonioxKey === 'string' ? s.sonioxKey.trim() : '';
    s.anthropicKey = typeof s.anthropicKey === 'string' ? s.anthropicKey.trim() : '';
    const strMap = (m: unknown) => Object.fromEntries(Object.entries(m && typeof m === 'object' ? m : {})
      .filter(([k, v]) => typeof k === 'string' && typeof v === 'string').map(([k, v]) => [k, (v as string).trim()])) as Record<string, string>;
    s.aiKeys = strMap(s.aiKeys);
    s.aiModels = strMap(s.aiModels);
    if (s.anthropicKey && !s.aiKeys.anthropic) s.aiKeys.anthropic = s.anthropicKey; 
    s.anthropicKey = '';
    if (typeof s.aiProvider !== 'string' || !s.aiProvider) s.aiProvider = 'anthropic';
    s.phoneVoices = Object.fromEntries(Object.entries(s.phoneVoices && typeof s.phoneVoices === 'object' ? s.phoneVoices : {})
      .filter(([k, v]) => typeof k === 'string' && typeof v === 'string' && v)) as Record<string, string>;
    s.messageS = pick(s.messageS, MESSAGE_CHOICES, 15);
    s.messageKinds = Object.fromEntries(MSG_KINDS.map((k) => {
      const v = Number((saved?.messageKinds as Record<string, unknown> | undefined)?.[k]);
      return [k, MESSAGE_CHOICES.some(([c]) => c === v) ? v : 0];
    })) as Record<MsgKind, number>;
    s.screenOffS = pick(s.screenOffS, SCREEN_OFF_CHOICES, 10);
    if (!LANGUAGES.includes(s.translateFrom)) s.translateFrom = 'Korean';
    if (!LANGUAGES.includes(s.translateTo)) s.translateTo = 'English';
    if (s.translateTo === s.translateFrom) s.translateTo = s.translateFrom === 'English' ? 'Korean' : 'English';
    return s;
  } catch {
    return defaults();
  }
}

export async function save(store: Store, s: Settings): Promise<void> {
  await store.set(KEY, JSON.stringify(s));
}

export function relaySettings(s: Settings) {
  return { action: 'settings', translate_from: s.translateFrom, translate_to: s.translateTo, reply_ideas: s.replyIdeas };
}
