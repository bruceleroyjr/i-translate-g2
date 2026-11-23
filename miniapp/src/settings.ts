
export type ReadKind = 'lifelogs' | 'news' | 'mail' | 'chats' | 'meetings' | 'translations' | 'myturn';
export const READ_KINDS: ReadKind[] = ['lifelogs', 'news', 'mail', 'chats', 'meetings', 'translations', 'myturn'];

export type CoachStyle = 'active' | 'passive';
export const COACH_STYLES: [CoachStyle, string][] = [
  ['active', 'Active: a cue whenever it helps'],
  ['passive', 'Passive: only what needs you'],
];

import type { VoiceChoice } from './langVoices';
import { cleanNaturalVoices, NEURAL_VOICES, naturalVoice } from './neuralVoices.ts';

export type VoiceEngine = 'natural' | 'iphone';
export const VOICE_ENGINES: [VoiceEngine, string][] = [
  ['iphone', 'iPhone voices (fastest, work without the PC)'],
  ['natural', 'Natural voices (made on your PC, about 1 s slower)'],
];

export interface Settings {
  relayUrl: string;
  relayToken: string;
  sonioxKey: string; 
  anthropicKey: string; 
  aiProvider: string; 
  aiKeys: Record<string, string>; 
  aiModels: Record<string, string>; 
  silenceS: number;
  quietStart: string;
  quietEnd: string;
  topics: string[];
  cueMode: string; 
  coachStyle: CoachStyle; 
  newsEveryMin: number; 
  locationShare: LocationShare; 
  translateFrom: string; 
  translateTo: string; 
  g0a: G0aResult | null; 
  topicsV: number; 
  translateMic: 'phone' | 'glasses'; 
  micsV: number; 
  myTurnMic: 'phone' | 'glasses'; 
  meetingMic: 'phone' | 'glasses'; 
  liveWords: boolean; 
  voiceId: boolean; 
  ownVoiceOnly: boolean; 
  screenOffS: number;
  messageS: number; 
  messageKinds: Record<MsgKind, number>; 
  memoryTree: boolean; 
  anchorDim: boolean; 
  voiceSpoken: VoiceChoice; 
  voiceTranslated: VoiceChoice; 
  voiceEngine: VoiceEngine; 
  naturalVoices: Record<string, string>; 
  phoneVoices: Record<string, string>; 
  readVoice: string; 
  readKinds: Record<ReadKind, boolean>; 
  trFooter: boolean; 
  replyIdeas: boolean; 
  showOriginal: boolean; 
  showSaid: boolean; 
  modeArt: boolean; 
}

export interface G0aResult {
  variant: string; 
  ok: boolean;
  at: string; 
}

export type LocationShare = 'off' | 'approx' | 'precise';
export const LOCATION_SHARE: [LocationShare, string][] = [
  ['approx', 'Approximate (about 1 km)'],
  ['precise', 'Precise (best for "nearest" and directions)'],
  ['off', 'Off'],
];

export const NEWS_EVERY = [5, 10, 15, 30, 60];

export const SCREEN_OFF_CHOICES: [number, string][] = [[10, '10 seconds'], [15, '15 seconds'], [30, '30 seconds'], [60, '1 minute'], [120, '2 minutes'], [300, '5 minutes'], [0, 'Never']];
export const MSG_KINDS = ['lifelogs', 'news', 'mail', 'meetings', 'translations'] as const;
export type MsgKind = (typeof MSG_KINDS)[number];
export const MESSAGE_CHOICES: [number, string][] = [[5, '5 seconds'], [10, '10 seconds'], [15, '15 seconds'], [20, '20 seconds'], [30, '30 seconds'], [45, '45 seconds'], [60, '1 minute']];
const pick = (v: unknown, choices: [number, string][], dflt: number) => (choices.some(([k]) => k === Number(v)) ? Number(v) : dflt);

export const TOPICS = ['Market', 'Technology', 'Global economy', 'Sports', 'Local']; 

export const CUE_MODES: [string, string][] = [
  ['work', 'Work'],
  ['personal', 'Personal'],
];
const OLD_PERSONAL_MODES = ['family', 'friends', 'new'];

export const LANGUAGES = ['English', 'Korean', 'Japanese', 'Chinese - Mandarin', 'Chinese - Cantonese', 'Spanish', 'Portuguese', 'French',
  'German', 'Thai', 'Vietnamese', 'Filipino', 'Hawaiian'];

export const TRANSLATE_FROM = LANGUAGES;

export function setPairSide(s: { translateFrom: string; translateTo: string }, side: 'from' | 'to', lang: string): boolean {
  if (!LANGUAGES.includes(lang)) return false;
  const [mine, other] = side === 'from' ? (['translateFrom', 'translateTo'] as const) : (['translateTo', 'translateFrom'] as const);
  if (s[other] === lang) s[other] = s[mine];
  s[mine] = lang;
  return true;
}

export function defaults(): Settings {
  const fromRelay = typeof location !== 'undefined' && /\/app\/?/.test(location.pathname) && location.protocol === 'https:';
  return {
    relayUrl: fromRelay ? location.origin : '',
    relayToken: '',
    sonioxKey: '',
    anthropicKey: '',
    aiProvider: 'anthropic',
    aiKeys: {},
    aiModels: {},
    silenceS: 60,
    quietStart: '21:30',
    quietEnd: '07:00',
    topics: [...TOPICS],
    cueMode: 'work',
    coachStyle: 'active',
    newsEveryMin: 10,
    locationShare: 'approx',
    translateFrom: 'Korean',
    translateTo: 'English',
    g0a: null,
    topicsV: 2,
    translateMic: 'glasses', 
    micsV: 1,
    myTurnMic: 'glasses', 
    meetingMic: 'glasses',
    liveWords: true,
    voiceId: true,
    ownVoiceOnly: false,
    screenOffS: 10,
    messageS: 15,
    messageKinds: { lifelogs: 0, news: 0, mail: 0, meetings: 0, translations: 0 },
    memoryTree: true,
    anchorDim: true,
    showOriginal: true,
    trFooter: true,
    replyIdeas: true,
    showSaid: true,
    modeArt: true,
    voiceSpoken: 'female',
    voiceEngine: 'iphone', 
    naturalVoices: {},
    phoneVoices: {},
    voiceTranslated: 'female',
    readVoice: '',
    readKinds: { lifelogs: false, news: false, mail: false, chats: false, meetings: false, translations: false, myturn: true }, 
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
    const s: Settings = saved ? { ...defaults(), ...saved } : defaults();
    s.topics = s.topics.map((t) => (t === 'Old local' ? 'Local' : t)).filter((t) => TOPICS.includes(t));
    if (saved && (Number(saved.topicsV) || 0) < 2) { 
      if (!s.topics.includes('Sports')) s.topics.push('Sports'); 
      s.topicsV = 2;
    }
    if (saved && (Number(saved.micsV) || 0) < 1) { s.translateMic = 'glasses'; s.myTurnMic = 'glasses'; s.micsV = 1; } 
    if (s.translateMic !== 'phone') s.translateMic = 'glasses';
    if (s.myTurnMic !== 'phone') s.myTurnMic = 'glasses';
    if (s.meetingMic !== 'phone') s.meetingMic = 'glasses';
    s.memoryTree = s.memoryTree !== false;
    s.liveWords = s.liveWords !== false;
    s.voiceId = s.voiceId !== false;
    s.showOriginal = s.showOriginal !== false;
    s.trFooter = s.trFooter !== false;
    s.replyIdeas = s.replyIdeas !== false;
    s.showSaid = s.showSaid !== false;
    s.modeArt = s.modeArt !== false;
    s.readKinds = Object.fromEntries(READ_KINDS.map((k) => {
      const v = (saved?.readKinds as Record<string, unknown> | undefined)?.[k];
      return [k, k === 'myturn' ? v !== false : v === true];
    })) as Record<ReadKind, boolean>;
    if (s.voiceSpoken !== 'male') s.voiceSpoken = 'female';
    s.voiceEngine = 'iphone'; 
    s.voiceId = false;
    s.sonioxKey = typeof s.sonioxKey === 'string' ? s.sonioxKey.trim() : '';
    s.anthropicKey = typeof s.anthropicKey === 'string' ? s.anthropicKey.trim() : '';
    const strMap = (m: unknown) => Object.fromEntries(Object.entries(m && typeof m === 'object' ? m : {})
      .filter(([k, v]) => typeof k === 'string' && typeof v === 'string').map(([k, v]) => [k, (v as string).trim()])) as Record<string, string>;
    s.aiKeys = strMap(s.aiKeys);
    s.aiModels = strMap(s.aiModels);
    if (s.anthropicKey && !s.aiKeys.anthropic) s.aiKeys.anthropic = s.anthropicKey; 
    s.anthropicKey = '';
    if (typeof s.aiProvider !== 'string' || !s.aiProvider) s.aiProvider = 'anthropic';
    s.naturalVoices = cleanNaturalVoices(s.naturalVoices);
    s.phoneVoices = Object.fromEntries(Object.entries(s.phoneVoices && typeof s.phoneVoices === 'object' ? s.phoneVoices : {})
      .filter(([k, v]) => typeof k === 'string' && typeof v === 'string' && v)) as Record<string, string>;
    if (s.voiceTranslated !== 'male') s.voiceTranslated = 'female';
    s.readVoice = typeof s.readVoice === 'string' ? s.readVoice : '';
    delete (s as unknown as Record<string, unknown>).readAloud; 
    delete (s as unknown as Record<string, unknown>).autoRead;
    s.ownVoiceOnly = false; 
    if (!LOCATION_SHARE.some(([k]) => k === s.locationShare)) s.locationShare = 'approx';
    if (!NEWS_EVERY.includes(Number(s.newsEveryMin))) s.newsEveryMin = 10;
    s.newsEveryMin = Number(s.newsEveryMin);
    s.messageS = pick(s.messageS, MESSAGE_CHOICES, 15);
    s.messageKinds = Object.fromEntries(MSG_KINDS.map((k) => {
      const v = Number((saved?.messageKinds as Record<string, unknown> | undefined)?.[k]);
      return [k, MESSAGE_CHOICES.some(([c]) => c === v) ? v : 0];
    })) as Record<MsgKind, number>;
    if (s.screenOffS === undefined || s.screenOffS === null) {
      const oldSleep = Number((s as unknown as Record<string, unknown>).sleepS);
      if (Number.isFinite(oldSleep)) s.screenOffS = oldSleep;
      delete (s as unknown as Record<string, unknown>).sleepS;
    }
    s.screenOffS = pick(s.screenOffS, SCREEN_OFF_CHOICES, 10);
    if (OLD_PERSONAL_MODES.includes(s.cueMode)) s.cueMode = 'personal';
    if (!CUE_MODES.some(([k]) => k === s.cueMode)) s.cueMode = 'work';
    if (!COACH_STYLES.some(([k]) => k === s.coachStyle)) s.coachStyle = 'active';
    if (!LANGUAGES.includes(s.translateFrom)) s.translateFrom = 'Korean';
    if (!LANGUAGES.includes(s.translateTo)) s.translateTo = 'English';
    if (s.translateTo === s.translateFrom) s.translateTo = s.translateFrom === 'English' ? 'Korean' : 'English';
    if (s.g0a && s.g0a.variant !== '8bit') s.g0a = null; 
    delete (s as unknown as Record<string, unknown>).avatar; 
    return s;
  } catch {
    return defaults();
  }
}

export async function save(store: Store, s: Settings): Promise<void> {
  s.silenceS = Math.max(30, Math.min(300, Math.round(Number(s.silenceS) || 60)));
  await store.set(KEY, JSON.stringify(s));
}

export function relaySettings(s: Settings) {
  return {
    action: 'settings', silence_s: s.silenceS, quiet_start: s.quietStart, quiet_end: s.quietEnd, topics: s.topics,
    cue_mode: s.cueMode, coach_style: s.coachStyle, translate_from: s.translateFrom, translate_to: s.translateTo, news_every_min: s.newsEveryMin,
    voice_id: s.voiceId, reply_ideas: s.replyIdeas, my_turn_mic: s.myTurnMic,
    voice_engine: s.voiceEngine, tts_voices: Object.fromEntries(Object.keys(NEURAL_VOICES).map((l) => [l, naturalVoice(l, s.naturalVoices)])),
  };
}
