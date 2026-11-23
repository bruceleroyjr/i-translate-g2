
import { ImuReportPace, OsEventTypeList, AudioSpeakerRole, waitForEvenAppBridge, type EvenAppBridge, type EvenHubEvent } from '@evenrealities/even_hub_sdk';
import { getTextWidth } from '@evenrealities/pretext';
import { ImuProbe, probeCard, type ProbeSample } from './imuProbe';
import { Anchor, IMU_MAP, type ImuMap } from './anchor';
import { Glasses, IDS, MENU_ID, HEADER_TITLE_W, HEADER_TIME_W, BARE_STATUS_W, BARE_TIME_W, HOME_ROW_IDS, HOME_TIME, LAYOUT_ART, LAYOUT_TEXT,  type CardBox, type CardLayout, type Page } from './glasses';
import { MicStats } from './mic';
import { wrappedLines, bottomV, centerV } from './center';
import { type Mode } from './relay';
import { LocalRelay } from './engine';
import { demoOn, installDemo } from './demo';
import { PROVIDERS, provider } from './ai.ts';
import { ReadAloud } from './readAloud';
import { readableText, groupVoices } from './readText';
import { LANG_BCP47, LANG_SAMPLE, VOICE_CHOICES, bases, pickVoice, type VoiceChoice } from './langVoices';
import { NEURAL_VOICES, naturalVoice, neuralOptions } from './neuralVoices';
import { type ReadKind, VOICE_ENGINES, type VoiceEngine, CUE_MODES, LANGUAGES, MESSAGE_CHOICES, MSG_KINDS, type MsgKind, SCREEN_OFF_CHOICES, load, relaySettings, save, setPairSide, type Settings, type Store } from './settings';
import { esc } from './phoneToday';
import { TrLog, linesHtml, composerHtml, ideasHtml, type TrLine } from './phoneTranslate';
import { Tray, LIST_MAX, itemText, listStatus, LIST_HINT, openStatus, HomeList, homeEntries, homeRowText, type HomeEntry, type TrayKind } from './tray';
import { homePngs, ORBIT_FRAMES, type HomeArt, type HomeBox } from './trayImage';
import { growthStage, orbGrowth } from './memoryTree';
import { History, SUMMARY_SYSTEM, summaryPrompt, parseSummary, listHtml, pairHtml, stamp, length, UNTITLED, type Recording } from './history';
import { windowMsFor, mutedWhileLit, staleModeItem, talkBoxes, talkPast, spokenPair, middlePair, ModeQuiet, timing } from './window';
import { FRAMES, FADE_FRAMES, fitRow, IdleSleep, NAP_FRAMES, NAPFADE_FRAMES, asleepFrame, doubleTapAction, TapGuard, WindowState, chatView, newsRow, storyText, type Story, type Turn, chosenIndex, headerLine, pickedIndex, pickerOrder, ScreenSleep, IdleCorner, HOLD_MAX_MS, ANIM_FRAMES, ANIM_MS, Boot, DECODE_MS, decodeText, fitHead, fitTail, countdownText, listeningFrame, lifelogFrame, listeningDots, setTiming, type Effect, type Frame, type Item, type View } from './window';

const REPLY_POLL_MS = 1000;
const LIVE_POLL_MS = 100; 
const LIVE_WAIT_MS = 1500;
const CHAT_IDLE_MS = 5 * 60_000; 
const HEARTBEAT_MS = 5000;
const AUDIO_FLUSH_MS = 200; 
const AUDIO_FLUSH_BYTES = 6_400; 
const BODY_LINES = 7; 
const CENTERED: Item['kind'][] = ['translation', 'cue', 'news', 'mail', 'note', 'calendar']; 
const CARD_LINES = 7; 
const ORIG_LINES = 2; 
const FULL_TEXT: Item['kind'][] = ['news', 'mail', 'note', 'calendar']; 

const relay = new LocalRelay(); 
const win = new WindowState();
let settings: Settings;
let store: Store;
let bridge: EvenAppBridge | null = null;
let glasses: Glasses | null = null;
let mode: Mode = { listening: true, meeting: false, conversing: false };
let replySeq = -1;
let replySig = ''; 
let micOn = false;
let micSource: 'glasses' | 'phone' = 'glasses';
let liveText = '';
let draftText = ''; 
let pageReady = false; 
let foreground = true;
let battery: number | null = null;
let charging = false; 
let expandedText = '';
let pcm: Uint8Array[] = [];
let pcmBytes = 0;
let audioSending = false; 
const mic = new MicStats();
let picker: string[] | null = null; 
let pickerSide: 'from' | 'to' | 'setup' = 'from';
let pickerFromSetup = false; 
const PICKER_IDLE_MIN_MS = 30_000; 
let lastGestureAt = 0; 
let meetingPicker: string[] | null = null; 
let imuProbeOpen = false; 
const probe = new ImuProbe(); 
let probeDoneAt = 0; 
let probePending: ProbeSample[] = []; 
const PROBE_TITLE = 'IMU PROBE';
let newsList: Story[] | null = null; 
let lastStories: Story[] = []; 
let storyOpen = false; 
let chatOpen = false; 
let myTurn = false;
let wasMeeting = false; 
let turns: Turn[] = []; 
let chatActivity = 0; 
let nothingHeard = false; 
let notMe = false; 
let sending = false; 
let cancelWhileSending = false; 
let uiGen = 0; 
let holding = false; 
let holdAt = 0;
let holdStarting: Promise<void> = Promise.resolve(); 
const idleCorner = new IdleCorner(); 
const screen = new ScreenSleep(); 
const idleSleep = new IdleSleep(); 
const tray = new Tray(); 
let trayRev = -1; 
const BODY_LINES_UNDER_TRAY = 5;

function bodyLines(): number {
  return glasses?.trayOn && glasses.page === 'normal' ? BODY_LINES_UNDER_TRAY : BODY_LINES;
}

function quiet(now: number): boolean {
  return !!mode.listening && !mode.meeting && !mode.translating && !mode.conversing && !mode.awaiting && !chatOpen && !holding
    && !sending && !win.item && !win.busy && !picker && !newsList && !tray.focused(now) && !tray.list && !win.awaitingDecision()
    && !boot.active(now); 
}




function saveSeen(): void {
  store.set('traySeen', JSON.stringify({ day: tray.data.day, seen: tray.seen })).catch(() => undefined);
}

function trayWanted(): boolean {
  return false; 
}

let lastCue: Item | null = null;
let lastLine: Item | null = null;
function modeLayout(): CardLayout | null {
  const m = modeScreen();
  if (m === 'translation') return trLayout();
  if (m === 'cue' && settings?.showSaid === false) return 'cuesolo';
  return m;
}
function modeScreen(): CardLayout | null {
  return mode.meeting ? 'cue' : mode.translating ? 'translation' : null;
}
function modeItem(): Item | null {
  const m = modeScreen();
  if (m === 'cue') return lastCue ?? { seq: 0, kind: 'cue', title: 'CUE', text: 'Listening for cues…' };
  if (m === 'translation') return lastLine ?? { seq: 0, kind: 'translation', title: '', text: 'Listening…', original: '…' };
  return null;
}

async function drawTray(now: number): Promise<void> {
  if (!glasses || screen.off || glasses.page !== 'normal' && glasses.page !== 'chat') return;
  const want = trayWanted();
  const wantOrig = !want && origShown(win.item);
  if (want !== glasses.trayOn || wantOrig !== glasses.origOn) await glasses.setTray(want, { header: header(now), body: ' ' }, wantOrig);
  await glasses.syncBare(); 
  if (!want || glasses.page !== 'normal') return;
  tray.focused(now); 
  const turned = glasses.imagesDark; 
  const asleep = turned || (idleSleep.asleep && quiet(now));
  const slots = tray.slots();
  const art = homeArt();
  const artKey = art ? `|orb${art.growth}:${art.captures.notes}.${art.captures.meetings}.${art.captures.translations}.${art.captures.read ?? 0}` : '|orb-';
  const boxes: [HomeBox, number][] = art ? [['artL', 2], ['artR', 3]] : [];
  if (!boxes.length) return;
  const frame = orbitFrame(now, asleep); 
  const keys = boxes.map(() => (turned ? 'turned' : asleep ? 'asleep' : `art${artKey}|o${frame}`));
  if (!boxes.some(([box], i) => glasses!.trayNeeds(box, keys[i]))) return;
  const pngs = asleep ? await blankRow() : await homePngs(slots, art, frame);
  boxes.forEach(([box], i) => {
    if (glasses!.trayNeeds(box, keys[i])) void glasses!.showTray(box, keys[i], pngs[box]); 
  });
}

const ORBIT_FRAME_MS = 2500;
const ORBIT_REST_MS = 2000;
const ORBIT_RUN_MS = 60_000;
let orbitFrom = 0; 
let orbitHeld = 0; 
function orbitFrame(now: number, asleep: boolean): number {
  const since = now - orbitFrom;
  const live = !asleep && !!glasses?.homeArtUp && !win.item && !chatOpen && !screen.off && !screen.fading && !fadedOff(now)
    && since >= ORBIT_REST_MS && since <= ORBIT_RUN_MS;
  if (live) orbitHeld = Math.floor(now / ORBIT_FRAME_MS) % ORBIT_FRAMES;
  return orbitHeld;
}

function homeArt(): HomeArt | null {
  if (!settings?.memoryTree) return null;
  const t = tray.data.tree;
  const notes = tray.data.items.note || [];
  const read = t?.read ?? notes.filter((e) => e.seen).length;
  const translations = t?.translations ?? notes.filter((e) => !e.seen && /^Translation\b/.test(e.title)).length;
  const captures = { notes: t ? t.notes : notes.length - translations - read, meetings: t?.meetings ?? (tray.data.items.meeting || []).length, translations, read };
  const growth = t?.growth ?? orbGrowth(captures);
  const any = captures.notes + captures.meetings + captures.translations + read > 0;
  return { stage: t?.stage ?? growthStage(growth, any), growth, captures };
}

let blankPngs: Record<HomeBox, number[]> | null = null;
async function blankRow(): Promise<Record<HomeBox, number[]>> {
  return (blankPngs ??= await homePngs([]));
}

const LIST_FRAME: Record<TrayKind, Frame> = { note: 'idle', news: 'news', mail: 'mail', chat: 'speaking', meeting: 'meeting', calendar: 'calendar' };

async function openTrayList(now = Date.now()): Promise<void> {
  if (!glasses || win.awaitingDecision() || !tray.focus) return;
  const items = tray.openList(now);
  if (!items.length) return;
  saveSeen();
  if (win.item) win.close();
  await glasses.setPage('langs', { header: listStatus(tray.list!, tray.data.items[tray.list!].length), bottomStatus: listStatus(tray.list!, tray.data.items[tray.list!].length), bottomHint: LIST_HINT, body: ' ', langs: tray.rows() }, true);
  await render();
}

async function closeTrayList(): Promise<void> {
  tray.list = null;
  tray.open = null;
  if (!glasses) return;
  await glasses.setPage('normal', { header: header(), body: ' ', tray: trayWanted() });
  await render();
}

const homeList = new HomeList();
const CASCADE_STEP_MS = 0; 
const GLIDE_MS = 140;
const homeAnim = { shown: false, page: -1, cascadeAt: 0, picked: '', prev: '', movedAt: 0 };
function homeAnimating(now: number): boolean {
  return now - homeAnim.cascadeAt < CASCADE_STEP_MS * 3 + ANIM_MS || now - homeAnim.movedAt < GLIDE_MS + ANIM_MS;
}
function homeKick(): void { 
  for (const ms of [CASCADE_STEP_MS, CASCADE_STEP_MS * 2, GLIDE_MS + 10]) setTimeout(() => void render(), ms);
}
let homeOpen = false; 

const NOTICE_MS = 2600;
const BLINK_MS = 300;
const notice = { text: '', at: 0, seen: false, meeting: false, translating: false };
function modeNotice(now: number): void { 
  const m = !!mode.meeting, t = !!mode.translating;
  if (!m) lastCue = null; 
  if (!t) { lastLine = null; ideas = null; }
  if (notice.seen && (m !== notice.meeting || t !== notice.translating)) {
    notice.text = t !== notice.translating ? `TRANSLATION ${t ? 'ON' : 'OFF'}` : `MEETING MODE ${m ? 'ON' : 'OFF'}`;
    notice.at = now;
    screen.wake(now); 
    popupOff = false;
    for (const ms of [BLINK_MS, BLINK_MS * 2, BLINK_MS * 3, BLINK_MS * 4, NOTICE_MS + 50]) setTimeout(() => void render(), ms);
  }
  notice.meeting = m;
  notice.translating = t;
}
function noticeOn(now: number): boolean {
  return !!notice.text && now - notice.at < NOTICE_MS;
}
function noticeLevel(now: number): number {
  const step = Math.floor((now - notice.at) / BLINK_MS);
  return step < 4 && step % 2 === 1 ? 2 : 4;
}
function isModeNotice(it: Item): boolean {
  return (it.kind === 'status' && ['MEETING', 'LIFELOG', 'TRANSLATION OFF'].includes(it.title))
    || (it.kind === 'cue' && it.title === 'MEETING MODE')
    || (it.kind === 'translation' && !it.original && !it.mine && /^Translating\b/.test(it.text || ''));
}

function homeStatus(now: number, page: number, pages: number): string {
  const s = header(now).trim();
  return `${!s || s === '● HERMES' ? 'TODAY' : s} · ${page + 1}/${pages}`;
}

async function openHomeItem(h: HomeEntry): Promise<void> {
  tray.list = h.kind;
  tray.open = h.e;
  homeOpen = true;
  await showTrayEntry(h.kind, h.e, `${h.cat.toUpperCase()} · TODAY`);
}

async function openTrayItem(index: number): Promise<void> {
  const k = tray.list;
  const e = tray.pick(index);
  if (!k || !e) return;
  homeOpen = false;
  await showTrayEntry(k, e, openStatus(k, e, tray.data));
}

async function showTrayEntry(k: TrayKind, e: NonNullable<Tray['open']>, status: string): Promise<void> {
  if (!glasses) return;
  const now = Date.now();
  win.close();
  await apply(win.offer({
    seq: 0,
    kind: k === 'note' || k === 'chat' ? 'reply' : k,
    title: e.title,
    source: k === 'chat' ? 'Chat' : k === 'note' ? (/^Translation\b/.test(e.title) ? 'Translation' : 'Lifelog') : k === 'calendar' ? (e.reminder ? 'Reminder' : 'Calendar') : kindHeaderSource(k as Item['kind']), 
    time: e.time,
    at: e.at, 
    text: itemText(k, e),
    tray: true,
    lifelog: k === 'note',
    trayStatus: status,
  }, now));
  win.keepOpen(now); 
  await glasses.setPage('normal', { header: header(), body: ' ', tray: false }); 
  await render();
  if (k === 'mail' && e.gmail_id && !e.read) {
    e.read = true;
    relay.control({ action: 'mail_read', id: e.gmail_id }).catch(() => { e.read = false; }); 
  }
  await render();
}

async function trayItemBack(): Promise<void> {
  if (homeOpen) { 
    homeOpen = false;
    homeList.touch(Date.now());
    tray.list = tray.open = null;
    win.close();
    if (!glasses) return render();
    await glasses.setPage('normal', { header: header(), body: ' ', tray: trayWanted() });
    return render();
  }
  tray.back(Date.now());
  win.close();
  if (!glasses || !tray.list) return render();
  await glasses.setPage('langs', { header: listStatus(tray.list, tray.data.items[tray.list].length), bottomStatus: listStatus(tray.list, tray.data.items[tray.list].length), bottomHint: LIST_HINT, body: ' ', langs: tray.rows() }, true);
  await render();
}

function fadedOff(now: number): boolean {
  return glasses?.page === 'normal' && idleSleep.update(now, quiet(now)) && asleepFrame(now - idleSleep.asleepAt) === 'blank';
}

function avatarFrame(now: number): Frame {
  const b = boot.frame(now);
  if (b) return b;
  if (screen.fading) return screen.fadeFrame(now);
  if (idleSleep.update(now, quiet(now))) return asleepFrame(now - idleSleep.asleepAt); 
  if (read.speaking && win.item && win.item.kind !== 'approval') return 'speaking'; 
  return win.frame(now);
}
const read = new ReadAloud();
function readKindFor(it: Item): ReadKind | null {
  if (it.greeting) return null;
  if (it.lifelog || it.kind === 'note') return 'lifelogs';
  switch (it.kind) {
    case 'news': return 'news';
    case 'mail': return 'mail';
    case 'calendar': return 'mail'; 
    case 'reply': return 'chats';
    case 'meeting': return 'meetings';
    case 'cue': return it.title === 'MEETING MODE' ? null : 'meetings'; 
    case 'translation': return it.original ? (it.mine ? 'myturn' : 'translations') : null; 
    default: return null;
  }
}

function phoneSay(text: string, language: string, gender: VoiceChoice | null): void {
  if (gender === null) { read.speak(text); return; }
  const picked = settings?.phoneVoices?.[language];
  if (picked && read.voices().some((x) => x.voiceURI === picked)) { read.speak(text, LANG_BCP47[language], picked); return; }
  const v = pickVoice(read.voices(), language, gender);
  read.speak(text, LANG_BCP47[language], v.uri || false);
}

function sayAloud(text: string, language: string, gender: VoiceChoice | null): void {
  ideaVoice = false; 
  const id = settings?.voiceEngine === 'natural' && relay.ready() ? naturalVoice(language, settings.naturalVoices) : '';
  if (id) read.speakNatural(text, id, () => phoneSay(text, language, gender));
  else phoneSay(text, language, gender);
}

let readKey = '';
let readInRender = false; 
function readNewCard(): void {
  const it = win.item;
  if (!it) { readKey = ''; return; }
  const key = `${it.kind}|${it.seq}|${it.title}|${(it.text || '').slice(0, 40)}`;
  if (key === readKey) return;
  readKey = key;
  const kind = readKindFor(it);
  if (!kind) return;
  if (ideaVoice && read.speaking) return;
  readInRender = true;
  try {
    if (read.speaking) read.stop();
    if (!settings?.readKinds?.[kind]) return;
    const text = readableText(it);
    if (text && (kind === 'translations' || kind === 'myturn')) {
      const language = it.speak_in || (it.mine ? settings.translateFrom : settings.translateTo);
      const gender = language === settings.translateFrom ? settings.voiceSpoken : settings.voiceTranslated;
      sayAloud(text, language, gender);
    } else if (text) sayAloud(text, 'English', null);
  } finally {
    readInRender = false;
  }
}

const boot = new Boot(); 
let decodeKey = '';
let decodeAt = 0;
const DECODED: Item['kind'][] = [];
const HEAD_FIRST_MS = 160;
function decoded(key: string, text: string, now: number): string {
  if (key !== decodeKey) {
    decodeKey = key;
    decodeAt = now;
  }
  const t = now - decodeAt - HEAD_FIRST_MS; 
  return t < 0 ? ' ' : decodeText(text, t / DECODE_MS, decodeAt % 97);
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;


function header(now = Date.now()): string {
  if (screen.off || fadedOff(now)) return ' '; 
  if (screen.fading) return ' '; 
  if (glasses?.page === 'approval' || glasses?.page === 'confirm') return ' ';
  const booting = boot.line(now);
  if (booting) return booting;
  const status = win.title(now);
  return idleCorner.line(headerLine({ online: relay.online, listening: mode.listening, meeting: mode.meeting, conversing: mode.conversing, translating: !!mode.translating, pauseReason: mode.pause_reason,
    status, mic: micOn ? mic.headerLevel(now) : null, awaiting: !!mode.awaiting }), now);
}


function origShown(item: Item | null | undefined): boolean {
  return !!item && item.kind === 'translation' && !item.tray && !!item.original && settings?.showOriginal !== false;
}

function bareCard(item: Item | null | undefined): boolean {
  return !!item && item.kind === 'translation' && !item.tray;
}
function barePage(kind: Page): boolean {
  return kind === 'chat' ? myTurn : kind === 'normal' && bareCard(win.item);
}

const LANG_CODES: Record<string, string> = { korean: 'KO', english: 'EN', japanese: 'JA', chinese: 'ZH', spanish: 'ES', french: 'FR',
  german: 'DE', italian: 'IT', portuguese: 'PT', russian: 'RU', vietnamese: 'VI', thai: 'TH', tagalog: 'TL', filipino: 'TL',
  hawaiian: 'HAW', indonesian: 'ID', hindi: 'HI', arabic: 'AR', dutch: 'NL' };
function langCodes(pair: string[]): string {
  return pair.map((n) => LANG_CODES[n.toLowerCase()] ?? n.slice(0, 2).toUpperCase()).join(' → ');
}

function langPair(mine: boolean): string {
  return mine ? `${settings.translateTo} → ${settings.translateFrom}` : mode.translating || `${settings.translateFrom} → ${settings.translateTo}`;
}

function cardLines(item: Item | null | undefined): number {
  const lines = bareCard(item) ? CARD_LINES + 1 : CARD_LINES;
  return origShown(item) ? lines - ORIG_LINES : lines;
}

function bodyText(now = Date.now()): string {
  const v = win.view(now);
  const item = v.item;
  const live = settings?.liveWords && liveText && mode.conversing ? `“${liveText}”` : '';
  if (!item) return ' ';
  if (item.kind === 'wake') {
    if (draftText) return `“${draftText}”` + (live && !draftText.endsWith(liveText) ? `\n${live}` : '');
    return live || item.text || listeningDots(now - holdAt);
  }
  if (v.expanded) return expandedText || 'Loading top 3…';
  if (item.tray) return item.text || ' '; 
  let text: string;
  if (item.kind === 'reply') text = item.title ? `${item.title}\n\n${item.text}` : item.text;
  else if (item.kind === 'news' && !item.tray) { 
    const [head, ...rest] = (item.text || '').split('\n');
    text = rest.join('\n').trim() || head || ' ';
  }
  else if (CENTERED.includes(item.kind)) text = item.text || ' ';
  else text = item.text || ' ';
  const max = item.tray ? bodyLines() : cardLines(item);
  if (wrappedLines(text) > max) return !item.tray && FULL_TEXT.includes(item.kind) ? text : fitHead(text, max);
  return text; 
}

function formatTime(atSec: number): string {
  const d = new Date(atSec * 1000);
  const h = d.getHours() % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

function batteryText(): string {
  return battery === null ? ' ' : `G2 ${battery}%${charging ? ' ↑' : ''}`;
}

function formatDate(atSec: number): string {
  const d = new Date(atSec * 1000);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function cueName(): string {
  return CUE_MODES.find(([k]) => k === settings?.cueMode)?.[1] ?? 'Work';
}
function cueStyle(): string {
  return `${cueName()} · ${settings?.coachStyle === 'passive' ? 'Passive' : 'Active'}`;
}

function kindHeaderSource(kind: Item['kind']): string {
  switch (kind) {
    case 'news': return 'News';
    case 'mail': return 'Email';
    case 'calendar': return 'Calendar';
    case 'cue': return 'Live Cue';
    case 'meeting': return 'Meeting';
    case 'note': return 'Lifelog';
    case 'reply': return 'Hermes';
    case 'translation': return 'Translation';
    case 'done': return 'Done';
    case 'wake': return 'Listening';
    default: return kind.charAt(0).toUpperCase() + kind.slice(1);
  }
}

function statusFor(kind: Item['kind']): string {
  switch (kind) {
    case 'news': return 'NEWS';
    case 'mail': return 'EMAIL'; 
    case 'calendar': return 'CALENDAR';
    case 'cue': return `LIVE CUE · ${cueStyle()}`; 
    case 'meeting': return 'MEETING';
    case 'note': return 'LIFELOG';
    case 'reply': return 'HERMES';
    case 'translation': return 'TRANSLATION';
    case 'done': return 'DONE';
    case 'wake': return 'LISTENING';
    default: return kind.toUpperCase();
  }
}

function listLayout(): CardLayout | null {
  if (newsList) return 'newslist';
  if (picker) return 'langlist';
  if (meetingPicker) return 'meetlist';
  const t = tray.list;
  return t === 'news' ? 'newslist' : t === 'mail' ? 'maillist' : t === 'note' ? 'loglist' : t === 'chat' ? 'chatlist' : t === 'meeting' ? 'meetlist' : t === 'calendar' ? 'callist' : null;
}

function trLayout(): CardLayout {
  if (settings?.replyIdeas) return 'translationideas'; 
  return settings?.showOriginal === false ? 'translationsolo' : 'translation';
}
const trFootOff = () => settings?.trFooter === false;
const isTrLayout = (l: CardLayout | null | undefined) => l === 'translation' || l === 'translationsolo' || l === 'translationideas';

type Idea = { kind: 'reply' | 'ask'; text: string };
let ideas: { list: Idea[]; idx: number; forSeq: number; said: number[] } | null = null;
let ideaSending = false;
function ideasScreenUp(): boolean {
  if (!settings?.replyIdeas || !mode.translating || myTurn || chatOpen || mode.conversing || win.awaitingDecision()) return false;
  const it = win.item;
  return !it || (it.kind === 'translation' && !!it.original && !it.mine && !it.tray);
}
const IDEA_BOXES = ['log0', 'log2'] as const;
function ideaCells(): { text: string; level: number }[] {
  const cells = IDEA_BOXES.map(() => ({ text: ' ', level: 2 }));
  if (!ideas || !ideas.list.length) {
    cells[0].text = 'Ideas show after they speak.';
    return cells;
  }
  const anySaid = ideas.said.length > 0;
  const left = ideas.list.map((x, i) => ({ x, i })).filter((o) => o.x.kind !== 'ask').slice(0, 1);
  const right = ideas.list.map((x, i) => ({ x, i })).filter((o) => o.x.kind === 'ask').slice(0, 1);
  [...left.map((o) => ({ ...o, box: 0 })), ...right.map((o) => ({ ...o, box: 1 }))].forEach(({ x, i, box }) => {
    const on = i === ideas!.idx;
    if (ideas!.said.includes(i)) cells[box] = { text: `√ Said: ${x.text}`, level: 3 };
    else if (anySaid) cells[box] = { text: ' ', level: 2 }; 
    else cells[box] = { text: `${on ? '▶ ' : ''}${x.text}`, level: on ? 4 : 2 };
  });
  return cells;
}
const openIdeas = () => (ideas && !ideas.said.length ? ideas.list.map((_, i) => i) : []);
async function moveIdea(step: number): Promise<void> {
  const open = openIdeas();
  if (!ideas || !open.length || ideaSending) return;
  if (ideas.idx < 0 || !open.includes(ideas.idx)) ideas.idx = open[0]; 
  else if (open.length < 2) return;
  else ideas.idx = open[(open.indexOf(ideas.idx) + (step > 0 ? 1 : open.length - 1)) % open.length]; 
  if (win.item && !win.pinned) await apply(win.keepOpen(Date.now())); 
  await render();
}
async function pickIdea(): Promise<void> {
  if (!ideas || ideaSending || ideas.idx < 0 || ideas.said.includes(ideas.idx) || !ideas.list[ideas.idx]) return;
  const picked = ideas.idx;
  const pick = ideas.list[picked].text;
  read.unlockAudio();
  ideaSending = true;
  await render();
  const res = await relay.control({ action: 'my_turn_text', text: pick, idea: true }).catch(() => null);
  ideaSending = false;
  if (res?.mode) mode = res.mode;
  if (res && ideas) { ideas.said.push(picked); ideas.idx = -1; } 
  await render();
}

function layoutForItem(it: Item | null): CardLayout | null {
  if (!it) return null;
  if (it.kind === 'calendar') return 'calendar';
  if (it.kind === 'mail') return 'mail';
  if (it.kind === 'news') return 'news';
  if (it.kind === 'cue' && !it.tray && settings?.showSaid === false) return 'cuesolo';
  if (it.kind === 'cue' || it.kind === 'meeting') return 'cue';
  if (it.kind === 'translation' && it.mine && !it.tray) return 'myturn'; 
  if (it.kind === 'translation' && it.original && !it.tray) return trLayout();
  if (it.kind === 'note' || it.lifelog) return 'lifelog';
  if (it.kind === 'approval') return null; 
  return 'hermes'; 
}

const blackArt: Record<string, number[]> = {};
async function pngOf(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): Promise<number[]> {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  draw(g);
  const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/png'));
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}
function bigCountdown(it: Item): string {
  const first = (it.text || '').split('\n')[0];
  const m = first.match(/^(In \d+ min|Starting now)/i);
  return (m ? m[1] : it.time || first.split('·')[0] || ' ').trim().toUpperCase();
}
const LANG_GLYPH: Record<string, string> = { English: 'A', Korean: '가', Japanese: 'あ', 'Chinese - Mandarin': '中', 'Chinese - Cantonese': '粵',
  Spanish: 'Ñ', Portuguese: 'Ã', French: 'É', German: 'Ä', Thai: 'ก', Vietnamese: 'Ơ', Filipino: 'Ng', Hawaiian: 'Ā' };

function drawBubble(g: CanvasRenderingContext2D, w: number, h: number, top: boolean, glyph: string): void {
  const bw = Math.round(w * 0.62), bh = Math.round(h * 0.56);
  const x = top ? Math.round(w * 0.08) : w - bw - Math.round(w * 0.06);
  const y = top ? Math.round(h * 0.16) : Math.round(h * 0.06);
  const r = 12;
  const tailX = top ? x + Math.round(bw * 0.3) : x + Math.round(bw * 0.72);
  const tip = top ? tailX - 16 : tailX + 16;
  const color = top ? '#ffffff' : '#a8a8a8';
  g.strokeStyle = color;
  g.lineWidth = 3;
  g.lineJoin = 'round';
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + bw - r, y);
  g.arcTo(x + bw, y, x + bw, y + r, r);
  g.lineTo(x + bw, y + bh - r);
  g.arcTo(x + bw, y + bh, x + bw - r, y + bh, r);
  g.lineTo(tailX + 10, y + bh);
  g.lineTo(tip, y + bh + 20);
  g.lineTo(tailX - 10, y + bh);
  g.lineTo(x + r, y + bh);
  g.arcTo(x, y + bh, x, y + bh - r, r);
  g.lineTo(x, y + r);
  g.arcTo(x, y, x + r, y, r);
  g.closePath();
  g.stroke();
  g.fillStyle = color;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 ${Math.round(bh * 0.62)}px "Apple SD Gothic Neo", "Hiragino Sans", "PingFang SC", "Thonburi", "Malgun Gothic", "Segoe UI", sans-serif`;
  g.fillText(glyph, x + bw / 2, y + bh / 2 + 2, bw - 12);
}


async function drawCardArt(layout: CardLayout, it: Item | null): Promise<void> {
  if (!glasses) return;
  for (const [box, r] of Object.entries(LAYOUT_ART[layout]) as [CardBox, { w: number; h: number }][]) {
    let key: string;
    let png: number[] | undefined;
    if (glasses.imagesDark) {
      key = 'dark';
      png = blackArt[`${r.w}x${r.h}`] ??= await pngOf(r.w, r.h, () => undefined);
    } else if (box === 'cardC') {
      const big = it ? bigCountdown(it) : ' ';
      key = `big:${big}`;
      if (!glasses.cardNeeds(box, key)) continue;
      png = await pngOf(r.w, r.h, (g) => {
        g.fillStyle = '#fff';
        g.font = '600 46px "Bahnschrift", "Segoe UI", sans-serif';
        g.textBaseline = 'top';
        g.fillText(big, 2, 6, r.w - 4);
      });
    } else {
      const top = box === 'cardA';
      const lang = top ? settings.translateFrom : settings.translateTo;
      key = `bubble:${top ? 'a' : 'b'}:${lang}:${r.w}x${r.h}`;
      if (!glasses.cardNeeds(box, key)) continue;
      png = await pngOf(r.w, r.h, (g) => drawBubble(g, r.w, r.h, top, LANG_GLYPH[lang] ?? lang.slice(0, 1)));
    }
    if (png && glasses.cardNeeds(box, key)) void glasses.showCard(box, key, png);
  }
}

async function renderLayout(item: Item, v: View, now: number, body: string, idle = false): Promise<void> {
  if (!glasses) return;
  const L = glasses.layoutBuilt!;
  const parts = headerParts(item)!;
  const clock = item.time || formatTime((typeof item.at === 'number' && item.at > 1e9 ? item.at : now / 1000));
  const W = (name: string, f: number) => glasses!.boxW(name, f);
  const one = (name: string, s: string) => fitRow(s, W(name, 300) - 10); 
  const fadeTo = 4;
  if (glasses.fade !== fadeTo) await glasses.setFade(fadeTo);
  const pair = (mode.translating || `${settings.translateFrom} → ${settings.translateTo}`).split('→').map((x) => x.trim());
  let text = body;
  if (L === 'lifelog') {
    await glasses.setText(IDS.headerSrc, one('headerSrc', cardHeader(item, parts.source)));
    await glasses.setText(IDS.headerTime, rightPad(parts.time, W('headerTime', 150)));
  } else if (L === 'news') {
    const topic = item.place || item.topic || '';
    await glasses.setText(IDS.headerSrc, one('headerSrc', `NEWS${topic ? ` · ${topic.toUpperCase()}` : ''}`));
    await glasses.setText(IDS.headerTime, rightPad(parts.time, W('headerTime', 180)));
    if (!item.tray) { 
      const head = (item.text || '').split('\n')[0].trim();
      text = head && !body.startsWith(head) ? `${head}\n${body}` : body;
    }
  } else if (L === 'mail') {
    const sender = item.tray ? (item.title || '').split(' - ')[0] : (item.title || '').replace(/^MAIL\s*[—–-]\s*/i, '');
    await glasses.setText(IDS.headerSrc, one('headerSrc', `From   ${sender}`));
    await glasses.setText(IDS.headerTime, one('headerTime', `To       you  ·  ${clock}`));
  } else if (L === 'cue') {
    const said = (item as { said?: string }).said || ((item.text || '').match(/Said just before: “([^”]+)”/)?.[1] ?? '');
    if (said) text = text.replace(/\n*Said just before: “[^”]+”/, '');
    const hideSaid = !item.tray && settings?.showSaid === false; 
    await glasses.setText(IDS.origin, said && !hideSaid ? fitHead(`“${said}”`, 4) : ' ', 0); 
    text = fitHead(text, 4);
  } else if (L === 'cuesolo') { 
    text = text.replace(/\n*Said just before: “[^”]+”/, '');
    text = centerV(fitHead(text, 9), 9); 
  } else if (L === 'translation') {
    const shown = middlePair(item.original || '', text);
    await glasses.setText(IDS.origin, shown.origin, 0);
    text = shown.question;
  } else if (L === 'translationideas') { 
    const cmds = !openIdeas().length || ideas!.idx < 0 ? 'Double tap: speak your own' : 'Tap: say it · Double tap: speak your own';
    const status = noticeOn(now) ? `● ${notice.text}` : ideaSending ? `${langCodes(pair)}  ·  Saying it…`
      : bothEnds(langCodes(pair), cmds, W('headerSrc', 560));
    await glasses.setText(IDS.headerSrc, trFootOff() ? ' ' : fitRow(status, W('headerSrc', 560) - 10, 400), noticeOn(now) ? noticeLevel(now) : 2);
    await glasses.setText(IDS.bottomStatus, columnLabels(), 2);
    const cells = ideaCells();
    for (let k = 0; k < IDEA_BOXES.length; k++)
      await glasses.setText(IDS[IDEA_BOXES[k]], fitHead(cells[k].text, 2, (k === 0 ? 276 : 272) - 8) || ' ', ideaSending ? 2 : cells[k].level);
    const them = [...trLog.lines].reverse().find((l) => l.who === 'them');
    const shown = them ? spokenPair(them.original, them.text) : spokenPair('', text);
    await glasses.setText(IDS.origin, shown.origin, 0);
    await glasses.setText(IDS.question, shown.question, 4);
    await glasses.setText(IDS.body, ' ');
    await drawCardArt(L, item);
    return;
  } else if (L === 'translationsolo') { 
    text = centerV(fitHead(text, 8), 8);
  } else if (L === 'hermes') { 
    await glasses.setText(IDS.headerSrc, one('headerSrc', cardHeader(item, parts.source)));
    await glasses.setText(IDS.headerTime, rightPad(clock, W('headerTime', 110)));
  } else if (L === 'myturn') { 
    await glasses.setText(IDS.origin, bottomV(fitHead(item.text || ' ', 4), 4) || ' ');
    text = fitHead(item.original || ' ', 4);
  } else if (L === 'calendar') {
    const lines = (item.text || '').split('\n').map((x) => x.trim()).filter(Boolean);
    const when = (lines[0] || '').split('·').slice(1).join('·').trim() || lines[0] || '';
    text = [item.title, item.tray ? lines[0] : when, ...lines.slice(1)].filter(Boolean).join('\n');
    await glasses.setText(IDS.bottomStatus, one('bottomStatus', `${item.title?.startsWith('Reminder') ? 'REMINDER' : 'CALENDAR'}  ·  ${formatDate((typeof item.at === 'number' && item.at > 1e9 ? item.at : now / 1000))}`));
  }
  const cueL = L === 'cue' || L === 'cuesolo';
  let cueLabel = '';
  const noFoot = trFootOff() && (isTrLayout(L) || L === 'myturn'); 
  if (noFoot) await glasses.setText(IDS.headerSrc, ' ');
  else if (noticeOn(now) && (cueL || isTrLayout(L))) { 
    cueLabel = one('headerSrc', `● ${notice.text}`);
    await glasses.setText(IDS.headerSrc, cueLabel, noticeLevel(now));
  } else if (cueL) {
    cueLabel = one('headerSrc', item.kind === 'meeting' ? cardHeader(item, 'MEETING') : `MEETING · ${cueName()}`);
    await glasses.setText(IDS.headerSrc, cueLabel, 2); 
  }
  else if (isTrLayout(L)) await glasses.setText(IDS.headerSrc, one('headerSrc', `TRANSLATION · ${langCodes(pair)}`), 3);
  else if (L === 'myturn') await glasses.setText(IDS.headerSrc, one('headerSrc', `YOUR TURN · ${langCodes(langPair(true).split('→').map((x) => x.trim()))}`), 3);
  const timed = !idle && !item.tray && v.secondsLeft > 0 && (item.kind !== 'reply' || item.greeting) && !win.pinned; 
  const timer = timed && !screen.fading && !fadedOff(now) ? countdownText(v.secondsLeft) : '';
  await glasses.setText(IDS.bottomDateTime, timer ? rightPad(timer, W('bottomDateTime', 74)) : ' '); 
  let hint = isTrLayout(L) ? `Tap: ${L === 'translation' ? 'hide' : 'show'} · Double tap: your turn` 
    : L === 'myturn' ? 'Double tap: your turn' 
    : cueL && !item.tray && mode.meeting 
      ? `Tap: ${settings?.showSaid === false ? 'show' : 'hide'} said · Double tap: Hermes` 
    : bottomHintFor(item, now, v, overflowsLayout(L, text) ?? undefined);
  const footRow = isTrLayout(L) || L === 'myturn' || cueL; 
  await glasses.setText(IDS.bottomHint, noFoot ? ' ' : cueL ? cueFootRight(cueLabel, capFirstHint(hint), timer, W('bottomHint', 560))
    : footRow ? footHint(capFirstHint(hint), timer, W('bottomHint', 328)) : one('bottomHint', capFirstHint(hint)));
  await glasses.setText(IDS.body, text || ' ');
  await drawCardArt(L, item);
}

function cueFootRight(label: string, hint: string, timer: string, boxW: number): string {
  const room = boxW - 30 - getTextWidth(label.trim()) - 12;
  const both = timer.trim() ? `${hint}  ${timer.trim()}` : hint;
  const right = getTextWidth(both) <= room ? both : getTextWidth(hint) <= room ? hint : fitRow(hint, Math.max(40, room));
  return rightPad(right, boxW);
}

function columnLabels(): string {
  let s = 'REPLY';
  while (getTextWidth(`${s} `) < 286 && s.length < 80) s += ' ';
  return `${s}ASK`;
}

const capFirstHint = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function cardHeader(item: Item, source: string): string {
  const cat = item.kind === 'status' ? 'I-Translate' : source;
  let title = (item.title || '').trim();
  if (item.kind === 'mail' && !item.tray) title = title.replace(/^MAIL\s*[—–-]\s*/i, ''); 
  if (item.kind === 'news' && !item.tray) title = (item.text || '').split('\n')[0].trim() || title; 
  title = title.replace(/^[A-Z]{2,}(?: [A-Z]+)?\s*[—–]\s*/, ''); 
  if (/^[A-Z0-9 ]{2,}$/.test(title)) title = title.charAt(0) + title.slice(1).toLowerCase(); 
  const generic = ['cue', 'done', 'status', 'hermes', 'news', 'mail', 'email', 'lifelog', 'meeting', 'calendar'];
  if (!title || title.toLowerCase() === cat.toLowerCase() || generic.includes(title.toLowerCase())) return cat;
  return `${cat} · ${title}`;
}

function headerParts(item: Item | null): { source: string; title: string; time: string } | null {
  if (!item) return null;
  const source = item.source || (item.greeting ? 'I-Translate' : kindHeaderSource(item.kind)); 
  const title = item.title || '';
  const clock = item.time || (typeof item.at === 'number' ? formatTime(item.at) : '');
  const day = formatDate(typeof item.at === 'number' && item.at > 1e9 ? item.at : Date.now() / 1000); 
  return { source, title, time: clock ? `${day}  ${clock}` : '' };
}

function centerPad(text: string, boxW: number): string {
  const t = text || ' ';
  const tw = getTextWidth(t);
  if (tw >= boxW) return t;
  const spaceW = getTextWidth(' ') || 6;
  const pad = Math.max(0, Math.floor((boxW - tw) / (2 * spaceW)));
  return ' '.repeat(pad) + t;
}

function rightPad(text: string, boxW: number): string {
  const t = text || ' ';
  const tw = getTextWidth(t);
  if (tw >= boxW - 8) return t;
  const spaceW = getTextWidth(' ') || 6;
  const pad = Math.max(0, Math.floor((boxW - 8 - tw) / spaceW));
  return ' '.repeat(pad) + t;
}

function footHint(hint: string, timer: string, boxW: number): string {
  const both = timer.trim() ? `${hint}  ${timer.trim()}` : hint;
  return rightPad(both !== hint && getTextWidth(both) < boxW - 8 ? both : hint, boxW);
}

function bothEnds(left: string, right: string, boxW: number): string {
  const spaceW = getTextWidth(' ') || 6;
  const gap = Math.floor((boxW - 30 - getTextWidth(left) - getTextWidth(right)) / spaceW);
  return gap >= 3 ? `${left}${' '.repeat(gap)}${right}` : `${left} · ${right}`;
}

function overflowsLayout(layout: CardLayout | null | undefined, text: string): boolean | null {
  const box = layout ? LAYOUT_TEXT[layout]?.find((b) => b[0] === 'body') : undefined;
  if (!box) return null;
  return wrappedLines(text, box[3] - 8) > Math.floor(box[4] / 27);
}


function bottomHintFor(item: Item, now: number, v: View, over = wrappedLines(bodyText(now)) > cardLines(item)): string {
  if (item.kind === 'wake') {
    if (draftText && mode.conversing) return '▶ TAP TO SEND · double tap: cancel';
    return ' ';
  }
  if (item.tray) return 'swipe: scroll · double tap: back';
  if (item.kind === 'news' && storyOpen) return 'double tap: back to the list';
  if (item.kind === 'news' && !v.expanded) return over ? 'swipe for more · Tap: more headlines · 2× Tap: close' : 'tap: more headlines · double tap: close';
  if (item.kind === 'news') return 'double tap: back';
  if (item.kind === 'translation' && item.original && !item.tray) 
    return 'double tap: your turn to speak'; 
  if (item.kind === 'translation' && !item.tray) return 'double tap: close'; 
  if (over) return FULL_TEXT.includes(item.kind) ? 'swipe for more · 2× Tap: close' : 'swipe for more · double tap: close';
  return 'double tap: close'; 
}

const anchor = new Anchor((globalThis as { __IMU_MAP_TEST?: ImuMap }).__IMU_MAP_TEST ?? IMU_MAP);
anchor.fadeOff = true; 
const ANCHOR_APPLY_MS = 500; 
const ANCHOR_PRESS_GUARD_MS = 400; 
let anchorAppliedAt = 0;
let anchorBusy = false;
let anchorBusyAt = 0;
let anchorGestureAt = 0; 
let anchorScreen = ''; 
let anchorPressAt = 0;

function anchorScreenKey(): string {
  const it = win.item;
  return [glasses?.page, it ? `${it.kind}:${it.seq}:${win.shownAt}` : '', tray.list ?? '', tray.open ?? '', picker ? 'picker' : '',
    newsList ? 'news' : '', storyOpen ? 'story' : '', meetingPicker ? 'meet' : '', chatOpen ? 'chat' : ''].join('|');
}

async function syncImu(): Promise<void> {
  if (!glasses) return;
  await glasses.imuControl(anchor.on || probe.active, ImuReportPace.P100).catch(() => false);
}

async function anchorTick(force = false): Promise<void> {
  const now = Date.now();
  if (!glasses || (anchorBusy && now - anchorBusyAt < 8000)) return;
  const suspended = screen.off || glasses.page === 'dark' || fadedOff(now) || imuProbeOpen;
  if (suspended !== anchor.suspended) {
    anchor.suspended = suspended;
    if (!suspended) {
      if (now - anchorGestureAt < 1500 || imuProbeOpen) anchor.reset(now);
      else anchor.capture(now); 
    }
  }
  if (anchor.suspended && anchor.on && !imuProbeOpen) return; 
  const key = anchorScreenKey();
  if (key !== anchorScreen) { 
    anchorScreen = key;
    anchor.capture(now);
  }
  const level = anchor.level(now); 
  const dark = anchor.on && !anchor.suspended && anchor.state === 'TURNED';
  if (level === glasses.dim && dark === glasses.imagesDark && glasses.dimDirty) return void glasses.setDim(level); 
  if (level === glasses.dim && dark === glasses.imagesDark) return;
  if (dark === glasses.imagesDark && !force && now - anchorAppliedAt < ANCHOR_APPLY_MS) return;
  anchorBusy = true;
  anchorBusyAt = now;
  try {
    anchorAppliedAt = now;
    if (dark !== glasses.imagesDark) {
      glasses.hideAll = anchor.fadeOff;
      if (dark) await glasses.setImagesDark(true);
      await glasses.setDim(level);
      if (!dark) await glasses.setImagesDark(false);
      await render(); 
    } else {
      await glasses.setDim(level);
    }
  } finally {
    anchorBusy = false;
  }
}

async function anchorSwallows(e: EvenHubEvent, now: number): Promise<boolean> {
  const type = eventType(e);
  const press = !!e.listEvent || type === OsEventTypeList.CLICK_EVENT || type === OsEventTypeList.DOUBLE_CLICK_EVENT
    || type === OsEventTypeList.SCROLL_TOP_EVENT || type === OsEventTypeList.SCROLL_BOTTOM_EVENT || type === OsEventTypeList.LONG_PRESS_EVENT;
  if (!press) return false;
  anchorGestureAt = now;
  if (now - anchorPressAt < ANCHOR_PRESS_GUARD_MS) return true; 
  const restored = anchor.press(now);
  if (!restored && !(anchor.on && !anchor.suspended && glasses?.dimmedAway)) return false;
  anchorPressAt = now;
  await anchorTick(true);
  return true;
}




let lastCorner = '';
async function screenTick(): Promise<void> {
  if (!glasses) return;
  if (chatOpen && !mode.conversing && !mode.awaiting && !holding && !draftText && Date.now() - chatActivity > CHAT_IDLE_MS) {
    if (myTurn) return exitMyTurn(); 
    await endConversation(); 
    return;
  }
  const now = Date.now();
  if (picker && !mode.translating && timing.idleSleepMs > 0 && now - lastGestureAt > Math.max(timing.idleSleepMs, PICKER_IDLE_MIN_MS)) return closePicker();
  const step = screen.update(now, { listening: mode.listening, needsScreen: win.awaitingDecision(), quiet: displayQuiet(now), busy: screenBusy(now), popup: popupOff });
  if (step === 'wake' || step === 'fade') return render(); 
  if (step === null && !screen.off) { const h = header(); if (h !== lastCorner) { lastCorner = h; return render(); } } 
  if (step !== 'sleep') return;
  await goDark();
}

let popupOff = false; 

const modeQuiet = new ModeQuiet();

function displayQuiet(now = Date.now()): boolean {
  if (modeScreen()) return modeQuiet.quiet(now, timing.idleSleepMs);
  return true; 
}

function displayLit(now: number): boolean {
  if (!glasses || screen.off || screen.fading || glasses.page === 'dark' || glasses.imagesDark || fadedOff(now)) return false;
  if (win.item?.pushed && popupOff) return false;
  return true;
}

const modeWas = { meeting: false, translating: false };
async function noteModeChange(now: number): Promise<void> {
  const ended = (modeWas.meeting && !mode.meeting) || (modeWas.translating && !mode.translating);
  if ((!modeWas.meeting && mode.meeting) || (!modeWas.translating && mode.translating)) modeQuiet.activity(now); 
  modeWas.meeting = !!mode.meeting;
  modeWas.translating = !!mode.translating;
  if (!ended || !glasses) return;
  popupOff = false;
  screen.wake(now);
  const fx = win.endMode(mode, now);
  if (fx.length) await apply(fx);
}

function screenBusy(now: number): boolean {
  return !!(noticeOn(now) || win.item || chatOpen || holding || sending || win.busy || picker || newsList || meetingPicker || tray.list || tray.focused(now)
    || win.awaitingDecision() || mode.conversing || mode.awaiting || imuProbeOpen || boot.active(now));
}

let darkJob: Promise<void> | null = null;
function goDark(): Promise<void> {
  if (darkJob) return darkJob;
  darkJob = (async () => {
    if (!glasses) return;
    picker = null;
    newsList = null;
    storyOpen = false;
    chatOpen = false;
    tray.list = tray.open = null;
    tray.clearFocus();
    if (win.item?.tray) win.close();
    const lay = glasses.layoutBuilt;
    const homeArt = glasses.homeArtUp;
    const ok = await glasses.blank(); 
    if (!ok) { 
      if (homeArt) {
        const black = await blankRow();
        await Promise.race([
          Promise.all((['artL', 'artR'] as const).map((b) => (glasses!.trayNeeds(b, 'asleep') ? glasses!.showTray(b, 'asleep', black[b]) : undefined))),
          new Promise((r) => setTimeout(r, 4000)),
        ]);
      }
      if (lay) {
        await Promise.race([
          Promise.all((Object.entries(LAYOUT_ART[lay]) as [CardBox, { w: number; h: number }][]).map(async ([box, r]) => {
            const png = blackArt[`${r.w}x${r.h}`] ??= await pngOf(r.w, r.h, () => undefined);
            if (glasses!.cardNeeds(box, 'dark')) await glasses!.showCard(box, 'dark', png);
          })),
          new Promise((r) => setTimeout(r, 4000)),
        ]);
      }
      for (const id of [IDS.header, IDS.body, IDS.bottomDateTime, IDS.countdown, IDS.footer]) await glasses.setText(id, ' ');
      await glasses.showAvatar('blank');
    }
    renderPhone();
  })().finally(() => { darkJob = null; });
  return darkJob;
}

async function maybeDark(now: number): Promise<boolean> {
  if (!glasses || screen.off || !mode.listening || !displayQuiet(now)) return false;
  const step = screen.update(now, { listening: true, needsScreen: win.awaitingDecision(), quiet: true, busy: screenBusy(now), popup: popupOff });
  if (step !== 'sleep') return false;
  await goDark();
  return true;
}

let animBusy = false;
let animWas = false;
async function animTick(): Promise<void> {
  if (!glasses || screen.off || animBusy) return;
  const now = Date.now();
  const active = boot.active(now) || (decodeAt > 0 && now - decodeAt < HEAD_FIRST_MS + DECODE_MS + ANIM_MS) || homeAnimating(now) || holding || win.item?.kind === 'note' || win.item?.kind === 'calendar' || !!win.item?.lifelog || (tray.list === 'note' && glasses.page === 'langs'); 
  if (!active && !animWas) return;
  animWas = active;
  animBusy = true;
  try {
    await render();
  } finally {
    animBusy = false;
  }
}

async function render(): Promise<void> {
  const g = glasses;
  if (!g) return renderNow();
  const noted = g.noted; 
  g.holds++;
  try {
    await renderNow();
  } finally {
    g.holds--;
    if (g.holds === 0 && g.building) {
      if (noted === g.noted) await g.flush();
      else void render();
    }
  }
}

async function renderNow(): Promise<void> {
  if (!glasses) return;
  if (darkJob) await darkJob; 
  await noteModeChange(Date.now()); 
  modeNotice(Date.now()); 
  readNewCard(); 
  if (screen.offBetweenPopups && win.item) screen.showForCard(); 
  if (screen.off) {
    await glasses.setText(IDS.bottomDateTime, ' ');
    return;
  }
  const now = Date.now();
  if (glasses.page === 'dark') { 
    chatOpen = false;
    glasses.menu = { meeting: !!mode.meeting, translating: !!mode.translating, listening: !!mode.listening };
    glasses.origOn = !trayWanted() && origShown(win.item); 
    glasses.homeAsleep = false; 
    await glasses.setPage('normal', { header: header(now), body: ' ', tray: trayWanted() });
  }
  if (await maybeDark(now)) return; 
  const menuNow = { meeting: !!mode.meeting, translating: !!mode.translating, listening: !!mode.listening };
  if (glasses.page === 'normal' && glasses.menuDiffers(menuNow)) {
    glasses.trayOn = trayWanted();
    glasses.origOn = !glasses.trayOn && origShown(win.item);
  }
  await glasses.refreshMenu(menuNow);
  if ((picker || newsList || meetingPicker || tray.list) && glasses.page === 'langs' && glasses.layoutBuilt) return void (await drawCardArt(glasses.layoutBuilt, null));
  if (picker) return void (await glasses.showAvatar('translation')); 
  if (newsList) return void (await glasses.showAvatar('news'));
  if (tray.list && glasses.page === 'langs') return void (await glasses.showAvatar(tray.list === 'note' ? lifelogFrame(now) : LIST_FRAME[tray.list])); 
  if (meetingPicker) return void (await glasses.showAvatar('meeting')); 
  if (tray.open && !win.item?.tray) tray.open = tray.list = null; 
  await drawTray(now);
  if (chatOpen && glasses.page === 'chat') return renderChat(now);
  const v = win.view(now);
  const item = v.item;
  let body = bodyText(now);
  if (!item && tray.focused(now)) { 
    body = tray.preview();
  }
  if (item && !item.tray && DECODED.includes(item.kind) && !v.expanded) body = decoded(`${item.kind}:${item.seq}:${win.shownAt}:${storyOpen}`, body, now);
  if (imuProbeOpen) {
    const waiting = probePending.length > 0 && (!probeDoneAt || now - probeDoneAt < 8000); 
    if (item?.title === PROBE_TITLE) body = probe.active || !waiting ? probeCard(probe.step(now), !probePending.length) : 'IMU PROBE\nSaving…';
    if (!item) { imuProbeOpen = false; probe.stop(); probePending = []; win.holdPopups = chatOpen; void syncImu(); } 
  }
  if (glasses.page === 'chat') return;
  if (glasses.page === 'langs') return;
  if (glasses.page === 'normal' && glasses.layoutBuilt && glasses.layoutBuilt !== 'talk') { 
    const shown = item ?? modeItem(); 
    if (shown) return renderLayout(shown, v, now, item ? body : shown.text || ' ', !item);
  }
  if (glasses.page === 'normal') {
    const parts = headerParts(item);
    if (parts && item) {
      const headerSrcText = cardHeader(item, parts.source); 
      await glasses.setText(IDS.headerSrc, headerSrcText);
      await glasses.setText(IDS.headerTime, rightPad(parts.time, HEADER_TIME_W));
    } else {
      await glasses.setText(IDS.headerSrc, ' ');
      await glasses.setText(IDS.headerTime, ' ');
    }
    await glasses.setText(IDS.headerDivider, ' ');
    const home = glasses.trayOn && !item;
    const homeLines: string[] = []; 
    const homeOff = home && (screen.fading || fadedOff(now));
    const hv = home && !homeOff ? homeList.view(homeEntries(tray.data), now) : null;
    glasses.homeAsleep = homeOff;
    const asleepSwap = home && (await glasses.syncHomeSleep()) && homeOff;
    if (homeOff && !asleepSwap) for (const id of HOME_ROW_IDS) await glasses.setText(id, ' ');
    if (!hv) homeAnim.shown = false;
    if (hv) { 
      const pickedId = hv.picked?.e.id ?? '';
      if (!homeAnim.shown) orbitFrom = now; 
      if (!homeAnim.shown || hv.page !== homeAnim.page) { homeAnim.cascadeAt = now; homeKick(); } 
      else if (pickedId !== homeAnim.picked) { homeAnim.prev = homeAnim.picked; homeAnim.movedAt = now; homeKick(); } 
      homeAnim.shown = true;
      homeAnim.page = hv.page;
      homeAnim.picked = pickedId;
      const gliding = now - homeAnim.movedAt < GLIDE_MS;
      for (let i = 0; i < HOME_ROW_IDS.length; i++) {
        const r = hv.rows[i];
        const inYet = now - homeAnim.cascadeAt >= i * CASCADE_STEP_MS;
        const lvl = !r ? 2 : r.picked ? (gliding ? 3 : 4) : gliding && r.h.e.id === homeAnim.prev ? 3 : 2;
        await glasses.setText(HOME_ROW_IDS[i], !inYet ? ' ' : r ? homeRowText(r.h, r.picked) : i === 0 ? '  Nothing yet today' : ' ', lvl);
      }
    }
    const fadeTo = 4;
    if (glasses.fade !== fadeTo) await glasses.setFade(fadeTo);
    const statusLine = item ? (item.kind === 'reply' && item.tray ? (tray.list === 'chat' ? 'CHATS' : 'LIFELOGS')
      : item.kind === 'news' && !item.tray && (item.place || item.topic) ? `NEWS · ${item.place || item.topic}` : statusFor(item.kind)) : header(now); 
    if (hv && noticeOn(now)) await glasses.setText(IDS.bottomStatus, `● ${notice.text}`, noticeLevel(now)); 
    else if (asleepSwap) {  }
    else await glasses.setText(IDS.bottomStatus, homeOff ? ' ' : hv ? homeStatus(now, hv.page, hv.pages)
      : glasses.bare && bareCard(item) ? fitRow(`${statusLine} · ${langPair(false)}`, BARE_STATUS_W - 16) : statusLine, hv ? 3 : undefined);
    if (screen.fading || screen.off || fadedOff(now)) {
      if (!asleepSwap) await glasses.setText(IDS.bottomDateTime, ' ');
    } else if (item && (item.kind !== 'reply' || item.greeting) && !item.tray) {
      await glasses.setText(IDS.bottomDateTime, rightPad(countdownText(v.secondsLeft), glasses.bare ? BARE_TIME_W : 168)); 
    } else if (glasses.trayOn) {
      await glasses.setText(IDS.bottomDateTime, rightPad(`${formatDate(now / 1000)}  ${formatTime(now / 1000)}`, HOME_TIME.w)); 
    } else {
      await glasses.setText(IDS.bottomDateTime, ' ');
    }
    const dateShown = !(screen.fading || screen.off || fadedOff(now)) && !(item && (item.kind !== 'reply' || item.greeting) && !item.tray) && glasses.trayOn;
    await glasses.setText(IDS.homeBattery, dateShown ? batteryText() : ' ');
    await glasses.setText(IDS.bottomHint, item ? bottomHintFor(item, now, v) : (homeLines[1] || ' '));
  } else {
    await glasses.setText(IDS.header, header(now));
  }
  if (glasses.page === 'normal' && glasses.origOn) await glasses.setText(IDS.origin, origShown(item) ? fitHead(item!.original!, ORIG_LINES) : ' ');
  await glasses.setText(IDS.body, glasses.page === 'normal' && glasses.trayOn && !item ? ' ' : body); 
  await glasses.showAvatar(avatarFrame(now)); 
  if ((glasses.page === 'approval' || glasses.page === 'confirm') && glasses.layoutBuilt) await drawCardArt(glasses.layoutBuilt, null); 
}

let waitSince = 0; 
function waitClock(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s`;
}

let talkHermesShown = ''; 
async function renderChat(now: number): Promise<void> {
  if (!glasses) return;
  const live = settings?.liveWords && mode.conversing ? liveText : '';
  const view = chatView(turns, { draft: draftText, live, waiting: !!mode.awaiting || !!win.busy, listening: mode.conversing, ended: !mode.conversing, held: holding, nothingHeard, sinceHold: now - holdAt });

  const last = turns[turns.length - 1];
  const question = last?.q || '';
  const answer = last?.a || '';

  let body: string;
  const asking = holding || !!draftText || !!live || nothingHeard; 
  const them = myTurn ? settings.translateFrom : 'Hermes'; 
  if (last?.a && !asking) {
    body = `You: ${question}\n\n${them}: ${answer}`;
  } else if (last?.a) {
    body = view.current; 
  } else if (draftText) {
    body = `You: “${draftText}”`;
  } else if (view.current.startsWith('You:')) {
    body = view.current;
  } else if (view.current === 'Cancelled.') {
    body = 'Cancelled.';
  } else if (view.current === 'No speech detected') {
    body = notMe ? "That didn't sound like your voice.\nTap and say it again, a little closer or louder." : 'No speech detected';
  } else if (view.current === '…') {
    body = myTurn ? (win.busy || sending ? `Translating into ${settings.translateFrom}…` : 'Not translated. Tap to say it again.') : 'Waiting for Hermes…';
  } else if (view.current.startsWith('Listening')) {
    body = view.current;
  } else {
    body = view.current || ' ';
  }

  const nowStr = `${formatDate(now / 1000)}  ${formatTime(now / 1000)}`; 
  const statusWord = headerLine({ online: relay.online, listening: mode.listening, meeting: mode.meeting, conversing: mode.conversing || holding, translating: !!mode.translating, pauseReason: mode.pause_reason, status: '', mic: micOn ? mic.headerLevel(now) : null, awaiting: !!mode.awaiting });

  if (glasses.layoutBuilt === 'myturn' && myTurn) { 
    const waitingT = !!mode.awaiting || !!win.busy || sending;
    if (waitingT && !waitSince) waitSince = now;
    if (!waitingT) waitSince = 0;
    const [mine, theirs] = langPair(true).split('→').map((x) => x.trim());
    const answered = !!last?.a && !asking;
    const translating = !answered && view.current === '…'; 
    const said = answered || translating ? question : body.replace(/^You:\s*/, '').replace(/^“|”$/g, '');
    const transl = answered ? answer : translating ? body : ' ';
    await glasses.setText(IDS.origin, bottomV(fitHead(transl === '…' ? 'Translating…' : transl || ' ', 4), 4) || ' ');
    await glasses.setText(IDS.body, (answered || translating ? fitHead(said || ' ', 4) : fitTail(said || ' ', 4)) || ' ');
    const st = statusWord.replace('TALK WITH HERMES', 'YOUR TURN').replace(/^● TRANSLATING$/, '● YOUR TURN').replace('WAITING', 'TRANSLATING');
    const off = trFootOff(); 
    await glasses.setText(IDS.headerSrc, off ? ' ' : fitRow(`${st} · ${langCodes([mine, theirs])}`, glasses.boxW('headerSrc', 306) - 10));
    const tapHint = holding ? 'Tap: send' : sending || win.busy ? '' : 'Tap: again'; 
    await glasses.setText(IDS.bottomHint, off ? ' ' : footHint(tapHint ? `${tapHint} · Double tap: back` : 'Double tap: back', waitingT ? waitClock(now - waitSince) : '', glasses.boxW('bottomHint', 328)));
    await drawCardArt('myturn', null);
    return;
  }
  if (glasses.layoutBuilt === 'talk' && !myTurn) { 
    const waitingT = !!mode.awaiting || !!win.busy || sending;
    if (waitingT && !waitSince) waitSince = now;
    if (!waitingT) waitSince = 0;
    await glasses.setText(IDS.headerSrc, fitRow(statusWord, glasses.boxW('headerSrc', 290) - 10));
    await glasses.setText(IDS.bottomDateTime, waitingT ? rightPad(waitClock(now - waitSince), glasses.boxW('bottomDateTime', 66)) : ' ');
    const answered = !!last?.a && !asking;
    let cur = answered ? `You: ${question}\nHermes: ${answer}` : body;
    if (!answered && !asking && question && !last?.a && !cur.startsWith('You:')) cur = `You: ${question}\n${cur}`; 
    const t = talkBoxes(talkPast(answered ? turns.slice(0, -1) : turns), cur);
    const hermesChanged = t.hermes !== talkHermesShown;
    talkHermesShown = t.hermes;
    await glasses.setText(IDS.body, t.hermes);
    await glasses.setText(IDS.origin, t.you, 0, hermesChanged);
    await glasses.setText(IDS.bottomHint, fitRow(view.footer, glasses.boxW('bottomHint', 348) - 10));
    await drawCardArt('talk', null);
    return;
  }
  await glasses.setText(IDS.headerSrc, myTurn ? 'Your turn' : 'Talk with Hermes'); 
  await glasses.setText(IDS.headerTitle, centerPad(question || (myTurn ? `SPEAK ${settings.translateTo.toUpperCase()}` : 'TALK WITH HERMES'), HEADER_TITLE_W));
  await glasses.setText(IDS.headerTime, rightPad(nowStr, HEADER_TIME_W));
  await glasses.setText(IDS.headerDivider, ' ');
  await glasses.setText(IDS.body, body);
  const noFoot = myTurn && trFootOff(); 
  await glasses.setText(IDS.bottomStatus, noFoot ? ' ' : myTurn ? fitRow(`${statusWord.replace('TALK WITH HERMES', 'YOUR TURN').replace(/^● TRANSLATING$/, '● YOUR TURN').replace('WAITING', 'TRANSLATING')} · ${langPair(true)}`, (glasses.bare ? BARE_STATUS_W : 300) - 16) : statusWord);
  const waiting = !!mode.awaiting || !!win.busy || sending;
  if (waiting && !waitSince) waitSince = now;
  if (!waiting) waitSince = 0;
  await glasses.setText(IDS.bottomDateTime, waiting && !noFoot ? rightPad(waitClock(now - waitSince), glasses.bare ? BARE_TIME_W : 168) : ' ');
  await glasses.setText(IDS.bottomHint, noFoot ? ' ' : myTurn ? myTurnHint() : view.footer);
  await glasses.showAvatar(holding ? listeningFrame(now, holdAt) : screen.fading ? screen.fadeFrame(now) : read.speaking ? 'speaking' : win.frame(now));
}

async function wakeWord(rest: string): Promise<void> {
  const now = Date.now();
  if (!glasses) return;
  if (holding || sending || mode.awaiting || mode.meeting || mode.translating || picker || meetingPicker || win.awaitingDecision() || imuProbeOpen) return;
  const wasOff = screen.off || fadedOff(now) || glasses.page === 'dark';
  if (!chatOpen) {
    wakeBack = wasOff ? { off: true } : {
      off: false,
      item: win.item && win.item.kind !== 'wake' && !storyOpen ? win.item : null,
      pinned: win.pinned,
      list: tray.list,
      open: tray.open?.id ?? null,
      news: newsList ? [...newsList] : storyOpen ? [...lastStories] : null,
    };
  }
  tray.list = tray.open = null;
  newsList = null;
  storyOpen = false;
  if (win.item && win.item.kind !== 'wake') win.close();
  screen.wake(now);
  screen.activity(now);
  idleSleep.activity(now);
  idleCorner.activity(now);
  popupOff = false;
  await startHold(now, rest);
}

type WakeBack = { off: true } | { off: false; item: Item | null; pinned: boolean; list: TrayKind | null; open: string | null; news: Story[] | null };
let wakeBack: WakeBack | null = null;

async function goBack(back: WakeBack): Promise<boolean> {
  const now = Date.now();
  if (back.off || !glasses) return false;
  if (back.list) { 
    tray.focus = back.list;
    const i = back.open ? (tray.data.items[back.list] || []).slice(0, LIST_MAX).findIndex((e) => e.id === back.open) : -1;
    if (i >= 0) {
      tray.list = back.list;
      await openTrayItem(i);
      return true;
    }
    await openTrayList(now);
    return !!tray.list;
  }
  if (back.news) { await openNewsList(back.news); return true; } 
  if (back.item) { 
    await glasses.setPage('normal', { header: header(), body: ' ', tray: false });
    await apply(win.offer({ ...back.item, pushed: false }, now)); 
    if (back.pinned) win.keepOpen(now);
    return true;
  }
  return false;
}

async function startHold(now: number, draft = ''): Promise<void> {
  if (holding || !glasses) return;
  if (picker || newsList || tray.list || win.awaitingDecision()) return; 
  if (mode.awaiting) return; 
  holding = true;
  popupOff = false; 
  holdAt = now;
  chatActivity = now;
  nothingHeard = false;
  uiGen++; 
  let done: () => void = () => undefined;
  holdStarting = new Promise((r) => (done = r));
  try {
    screen.wake(now);
    draftText = '';
    liveText = '';
    if (win.item && win.item.kind !== 'wake') win.close(); 
    await openChat();
    await render();
    if (draft) draftText = draft; 
    const res = await relay.control({ action: 'hold', ...(draft ? { draft } : {}) }).catch(() => null);
    if (!res) {
      holding = false;
      if (!turns.length) await closeChat();
      await apply(win.offer({ seq: 0, kind: 'status', title: 'CAN\'T LISTEN', text: relay.ready() ? 'Your turn can\'t start right now. Is translation still on?' : 'Add your API keys on the phone: Settings › API keys.' }, now));
      return;
    }
    if (res.mode) mode = res.mode;
    await syncMic(true);
    await render();
  } finally {
    done();
  }
}

async function endHold(_now: number): Promise<void> {
  if (!holding) return;
  await holdStarting;
  if (!holding) return; 
  holding = false;
  if (win.awaitingDecision()) { 
    const res = await relay.control({ action: 'release' }).catch(() => null);
    if (res?.mode) mode = res.mode;
    return render();
  }
  uiGen++;
  sending = true;
  cancelWhileSending = false;
  const said = (draftText + (liveText && !draftText.endsWith(liveText) ? ` ${liveText}` : '')).trim();
  turns.push({ q: said || '…', a: '' }); 
  draftText = '';
  liveText = '';
  mode = { ...mode, awaiting: true };
  win.busy = { label: 'thinking', since: Date.now() };
  await render();
  let sent = false;
  let heardNothing = false;
  try {
    await relay.control({ action: 'release' }).catch(() => null);
    await syncMic(); 
    const res = await relay.control({ action: 'send' }).catch((e) => { 
      heardNothing = String(e).includes('409'); 
      notMe = String(e).includes('not_me'); 
      return null;
    });
    sent = !!res;
    if (res?.mode) mode = res.mode;
    if (sent && cancelWhileSending) await relay.control({ action: 'cancel_wait' }).catch(() => null); 
  } finally {
    sending = false;
    uiGen++;
  }
  if (!sent) { 
    const last = turns[turns.length - 1];
    if (last && !last.a && !last.cancelled) turns.pop();
    win.busy = null;
    mode = { ...mode, awaiting: false, conversing: false };
    if (heardNothing) nothingHeard = true;
  }
  await syncMic();
  await render();
}

async function cancelHold(): Promise<void> {
  await holdStarting;
  if (!holding) return;
  holding = false;
  await relay.control({ action: 'release' }).catch(() => null);
  draftText = '';
  liveText = '';
  await relay.control({ action: 'discard' }).catch(() => null);
  const res = await relay.control({ action: 'end' }).catch(() => null); 
  if (res?.mode) mode = res.mode;
  if (!turns.length) {
    await apply(win.close());
    await closeChat();
  }
  await syncMic();
  await render();
}

async function onMenu(id: number | undefined): Promise<void> {
  const now = Date.now();
  if (screen.wake(now)) await render(); 
  tapGuard.menuActivity(now); 
  if (id === MENU_ID.translateStart) await openSetup(); 
  if (id === MENU_ID.translateStop) await stopTranslation();
  if (id === MENU_ID.translateTo) await openSetup(); 
  renderPhone();
  await render(); 
}


async function openChat(): Promise<void> {
  if (!glasses || chatOpen || picker || newsList || win.awaitingDecision()) return;
  chatOpen = true;
  chatActivity = Date.now();
  win.holdPopups = true; 
  await glasses.setPage('chat', { header: header(), body: ' ', history: ' ' });
}

async function closeChat(): Promise<void> {
  if (!chatOpen || !glasses) return;
  chatOpen = false;
  nothingHeard = false;
  turns = [];
  win.holdPopups = false;
  const back = wakeBack; 
  wakeBack = null;
  if (win.item && ['reply', 'wake', 'done', 'status'].includes(win.item.kind)) win.close(); 
  const waited = win.next(Date.now()); 
  if (back?.off) {
    popupOff = true;
    if (!waited.length && (await maybeDark(Date.now()))) return;
  }
  if (back && !waited.length && (await goBack(back))) return; 
  await glasses.setPage('normal', { header: header(), body: ' ', tray: trayWanted() });
  await apply(waited.length ? waited : [{ type: 'render' }]);
}

function basePage(): 'chat' | 'normal' {
  return chatOpen ? 'chat' : 'normal';
}

let closeTimer: ReturnType<typeof setTimeout> | null = null;
function armClose(): void {
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = null;
  const due = win.dueIn(Date.now());
  if (due !== null) closeTimer = setTimeout(() => apply(win.tick(Date.now())), due + 5);
}

async function apply(fx: Effect[]): Promise<void> {
  for (const f of fx) {
    armClose();
    if (f.type === 'decide') {
      relay.control({ action: 'decide', id: f.id, decision: f.decision }).catch(() => undefined);
      continue;
    }
    if (f.type === 'talk') {
      await startHold(Date.now()); 
      continue;
    }
    if (!glasses) continue;
    if (f.type === 'approvalOpen') {
      screen.wake(Date.now()); 
      popupOff = false; 
      picker = null; 
      newsList = null;
      tray.list = tray.open = null; 
          await glasses.setPage('approval', { header: ' ', body: bodyText() }); 
    } else if (f.type === 'approvalClose') {
      await glasses.setPage(basePage(), { header: header(), body: ' ', tray: trayWanted() });
    } else if (f.type === 'clear') {
      expandedText = ''; 
      afterClose(); 
      storyOpen = false;
    } else if (f.type === 'expandNews') {
      await openNewsList();
      return;
    }
  }
  await render();
}

const popupLog: string[] = []; 
function notePopup(line: string): void {
  popupLog.push(`${new Date().toISOString().slice(11, 19)} ${line}`);
  if (popupLog.length > 8) popupLog.shift();
}
let lastShown: { key: string; label: string; at: number; overdue: boolean } | null = null;
function watchPopup(now: number): void {
  const it = win.item;
  const key = it ? `${it.kind}:${it.seq}:${win.shownAt}` : '';
  if (lastShown && lastShown.key !== key) {
    notePopup(`${lastShown.label} closed after ${((now - lastShown.at) / 1000).toFixed(1)} s${screen.off ? ' (display off)' : ''}`);
    lastShown = null;
  }
  if (it && !lastShown) {
    lastShown = { key, label: `${it.kind} #${it.seq}${it.tray ? ' (opened)' : ''}`, at: win.shownAt, overdue: false };
    notePopup(`${lastShown.label} shown${screen.off ? ' (display off)' : ''}`);
  }
  if (it && lastShown && !lastShown.overdue && !win.pinned && !it.tray && win.dueIn(now) !== null
    && now - win.shownAt > windowMsFor(it) + 3000) { 
    lastShown.overdue = true;
    notePopup(`${lastShown.label} STILL UP ${Math.round((now - win.shownAt) / 1000)} s (page ${glasses?.page}, display ${screen.off ? 'off' : 'on'})`);
  }
}

let afterCloseTimer: ReturnType<typeof setTimeout> | null = null;
function afterClose(): void {
  if (afterCloseTimer) clearTimeout(afterCloseTimer);
  afterCloseTimer = setTimeout(() => {
    afterCloseTimer = null;
    if (!glasses || win.item) return; 
    if (glasses.page === 'dark') { 
      if (glasses.lastRebuild !== 'true') void glasses.blank();
      return;
    }
    void glasses.settle().then(() => render());
  }, 2500);
}


function eventType(e: EvenHubEvent): number | undefined | null {
  const src = e.listEvent ?? e.textEvent ?? e.sysEvent;
  if (!src) return null;
  return src.eventType ?? (e.sysEvent?.imuData ? null : OsEventTypeList.CLICK_EVENT);
}

const events: Record<string, unknown>[] = []; 
const tapGuard = new TapGuard();

async function onEvent(e: EvenHubEvent): Promise<void> {
  if (e.audioEvent) return onAudio(e.audioEvent);
  if (e.sysEvent?.imuData) {
    const { imuData } = e.sysEvent;
    const at = Date.now();
    probe.add(imuData.x ?? 0, imuData.y ?? 0, imuData.z ?? 0, at);
    anchor.feed(imuData.x ?? 0, imuData.y ?? 0, imuData.z ?? 0, at);
    return;
  }
  if (await anchorSwallows(e, Date.now())) return;
  if (e.menuItemClickEvent) {
    anchorGestureAt = Date.now();
    if (anchor.press(anchorGestureAt)) await anchorTick(true);
  }
  const le = e.listEvent as { currentSelectItemIndex?: number; currentSelectItemName?: string } | undefined;
  events.push({ t: new Date().toISOString().slice(11, 19), type: eventType(e), from: e.listEvent ? 'list' : e.textEvent ? 'text' : e.sysEvent ? 'sys' : e.menuItemClickEvent ? 'menu' : '?',
    idx: le?.currentSelectItemIndex, name: le?.currentSelectItemName, menu: (e.menuItemClickEvent as { itemID?: number } | undefined)?.itemID,
    page: glasses?.page, picker: !!picker });
  if (events.length > 8) events.shift();
  const et = eventType(e);
  if (et === OsEventTypeList.SYSTEM_EXIT_EVENT || et === OsEventTypeList.ABNORMAL_EXIT_EVENT) return appClosing(et === OsEventTypeList.SYSTEM_EXIT_EVENT ? 'exit' : 'abnormal exit');
  lastGestureAt = Date.now();
  if (!e.menuItemClickEvent && !mode.translating && !picker && !myTurn && !win.item && !chatOpen && !win.awaitingDecision()
    && (et === OsEventTypeList.CLICK_EVENT || et === OsEventTypeList.DOUBLE_CLICK_EVENT)) {
    if (!tapGuard.allows(et, Date.now())) return;
    screen.wake(Date.now());
    popupOff = false;
    return openSetup();
  }
  if (!screen.off && !e.menuItemClickEvent && fadedOff(Date.now())) {
    if (eventType(e) !== OsEventTypeList.DOUBLE_CLICK_EVENT || !tapGuard.allows(eventType(e), Date.now())) return;
    idleSleep.activity(Date.now());
    idleCorner.activity(Date.now());
    screen.activity(Date.now());
    return render();
  }
  screen.activity(Date.now());
  if (!win.item) popupOff = false; 
  idleCorner.activity(Date.now());
  idleSleep.activity(Date.now()); 
  modeQuiet.activity(Date.now()); 
  orbitFrom = Date.now(); 
  if (e.menuItemClickEvent) return onMenu((e.menuItemClickEvent as { itemID?: number }).itemID);
  const now = Date.now();
  const type = eventType(e);
  if (type === OsEventTypeList.FOREGROUND_ENTER_EVENT || type === OsEventTypeList.FOREGROUND_EXIT_EVENT) tapGuard.menuActivity(now);
  if (!tapGuard.allows(type, now)) return; 
  read.unlockSilently(); 
  if (type === OsEventTypeList.CLICK_EVENT && read.speaking) read.stop(); 
  if (type === OsEventTypeList.LONG_PRESS_EVENT || type === OsEventTypeList.LONG_PRESS_RELEASE_EVENT) return;
  if (myTurn && chatOpen && !win.awaitingDecision()) {
    if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) return exitMyTurn();
    if (type === OsEventTypeList.CLICK_EVENT) {
      if (holding) return endHold(now);
      if (sending || win.busy) return; 
      return startHold(now);
    }
    return;
  }
  if (holding) {
    if (type === OsEventTypeList.CLICK_EVENT) return endHold(now);
    if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) return cancelHold();
    return;
  }
  if (mode.awaiting && !win.awaitingDecision() && !picker && !newsList) {
    if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) return cancelWait();
    if (type === OsEventTypeList.CLICK_EVENT) return;
  }
  if (screen.off) {
    if (type !== OsEventTypeList.DOUBLE_CLICK_EVENT) return;
    screen.wake(now);
    if (!mode.listening) return toggleListening();
    if (mode.translating) { popupOff = false; return startMyTurn(now); } 
    if (mode.meeting) { popupOff = false; return startHold(now); } 
    return render();
  }
  if (picker) {
    if (type === OsEventTypeList.CLICK_EVENT) {
      const i = e.listEvent ? pickedIndex(e.listEvent, picker) : 0;
      if (pickerSide === 'setup') return setupPick(i);
      const lang = picker[i];
      if (pickerFromSetup) return setupSide(pickerSide, lang);
      return pickerSide === 'to' ? pickTarget(lang) : startTranslation(lang);
    }
    if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      if (pickerFromSetup) return openSetup();
      if (pickerSide === 'setup' && setupExits()) return requestExit();
      return closePicker();
    }
    return; 
  }
  if (meetingPicker) {
    if (type === OsEventTypeList.CLICK_EVENT) {
      const style = meetingPicker[e.listEvent ? pickedIndex(e.listEvent, meetingPicker) : 0];
      return pickMeetingStyle(style);
    }
    if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      meetingPicker = null;
      await glasses?.setPage(basePage(), { header: header(), body: ' ', tray: trayWanted() });
      await render();
      return;
    }
    return;
  }
  if (newsList) {
    if (type === OsEventTypeList.CLICK_EVENT) return openStory(e.listEvent ? pickedIndex(e.listEvent, newsList.map((x) => newsRow(x))) : 0);
    if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) return closeNewsList();
    return;
  }
  if (tray.list && glasses?.page === 'langs') {
    if (type === OsEventTypeList.CLICK_EVENT) return openTrayItem(e.listEvent ? pickedIndex(e.listEvent, tray.rows()) : 0);
    if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) return closeTrayList();
    return;
  }
  if (win.item?.tray) {
    if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) return trayItemBack();
    if (type === OsEventTypeList.CLICK_EVENT) return;
  }
  if (!win.item && !chatOpen && !win.awaitingDecision() && glasses?.page === 'normal' && glasses.trayOn) {
    const list = homeEntries(tray.data);
    if (type === OsEventTypeList.SCROLL_BOTTOM_EVENT || type === OsEventTypeList.SCROLL_TOP_EVENT) {
      if (homeList.move(list, type === OsEventTypeList.SCROLL_BOTTOM_EVENT ? 1 : -1, now)) return render();
      return;
    }
    const picked = homeList.view(list, now).picked;
    if (type === OsEventTypeList.CLICK_EVENT && picked) {
      homeList.touch(now);
      return openHomeItem(picked);
    }
    if (tray.focused(now)) {
      if (type === OsEventTypeList.CLICK_EVENT) return openTrayList(now);
      if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) {
        tray.clearFocus();
        return render();
      }
    }
  }
  if (storyOpen && win.item?.kind === 'news' && type === OsEventTypeList.DOUBLE_CLICK_EVENT) {
    storyOpen = false;
    return openNewsList(lastStories); 
  }
  if (chatOpen && !win.awaitingDecision()) {
    if (draftText) {
      if (type === OsEventTypeList.CLICK_EVENT) return sendDraft(true); 
      if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) return sendDraft(false); 
    } else if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      if (nothingHeard && turns.length) { 
        nothingHeard = false;
        return render();
      }
      return endConversation(); 
    } else if (type === OsEventTypeList.CLICK_EVENT) {
      return startHold(now); 
    }
  }
  if (mode.conversing && draftText && win.item?.kind === 'wake') {
    if (type === OsEventTypeList.CLICK_EVENT) return sendDraft(true);
    if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) return sendDraft(false);
  }
  if (win.awaitingDecision()) {
    if (type === OsEventTypeList.CLICK_EVENT && e.listEvent) return apply(win.decide(chosenIndex(e.listEvent) === 0, now));
    if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) return apply(win.decide(false, now));
  }
  if (type === OsEventTypeList.CLICK_EVENT && cueScreenUp()) return toggleSaid();
  if (type === OsEventTypeList.DOUBLE_CLICK_EVENT && cueScreenUp() && mode.meeting && !holding && !mode.awaiting) {
    popupOff = false;
    return startHold(now);
  }
  if (ideasScreenUp()) {
    if (type === OsEventTypeList.SCROLL_BOTTOM_EVENT || type === OsEventTypeList.SCROLL_TOP_EVENT)
      return moveIdea(type === OsEventTypeList.SCROLL_BOTTOM_EVENT ? 1 : -1);
    if (type === OsEventTypeList.CLICK_EVENT) return pickIdea();
  }
  const trLine = win.item?.kind === 'translation' && !!win.item.original && !win.item.tray;
  if (type === OsEventTypeList.CLICK_EVENT && trLine && win.item!.mine) return;
  if (type === OsEventTypeList.CLICK_EVENT && (trLine || (!win.item && !chatOpen && !mode.conversing && !win.awaitingDecision() && modeScreen() === 'translation'))) return toggleOriginal();
  switch (type) {
    case OsEventTypeList.CLICK_EVENT: {
      const fx = win.press(now);
      if (!win.item || fx.some((f) => f.type === 'expandNews')) popupOff = false;
      return apply(fx);
    }
    case OsEventTypeList.DOUBLE_CLICK_EVENT: {
      const theirLine = !!win.item && win.item.kind === 'translation' && !!win.item.original && !win.item.tray;
      if (mode.translating && (!win.item || theirLine) && !holding && !chatOpen && !mode.awaiting && !win.awaitingDecision()) return startMyTurn(now);
      const canGoBack = win.item?.kind === 'news' && win.view(now).expanded;
      const act = doubleTapAction({ conversing: !!mode.conversing, awaiting: !!mode.awaiting, canGoBack, cardShowing: !!win.item });
      if (act === 'cancel-conversation') return endConversation(); 
      if (act === 'back') return apply(win.back(now) ?? []); 
      if (act === 'close') { popupOff = false; return apply(win.close(now)); } 
      return mode.listening ? startHold(now) : toggleListening();
    }
    case OsEventTypeList.SCROLL_TOP_EVENT:
    case OsEventTypeList.SCROLL_BOTTOM_EVENT:
      if (win.item && !win.item.tray && FULL_TEXT.includes(win.item.kind) && !win.pinned) return apply(win.keepOpen(now));
      return;
    case OsEventTypeList.FOREGROUND_EXIT_EVENT:
      foreground = false;
      return;
    case OsEventTypeList.FOREGROUND_ENTER_EVENT:
      foreground = true;
      await syncMic(true); 
      return render();
    default:
      return;
  }
}

let closing = false;
async function appClosing(why: string): Promise<void> {
  if (closing) return;
  closing = true;
  void relay.closed(why);
  if (glasses && micOn) void glasses.mic(false).catch(() => undefined);
}
function setupExits(): boolean {
  return !mode.translating && !mode.meeting;
}
async function requestExit(): Promise<void> {
  if (!bridge) return;
  try { await bridge.shutDownPageContainer(1); } catch {  }
}
let startChecked = false;
async function endLeftoverModes(): Promise<void> {
  if (startChecked) return;
  startChecked = true;
  if (!mode.meeting && !mode.translating) return;
  const res = await relay.closed('app opened');
  if (res?.mode) mode = res.mode;
  renderPhone();
  await render();
}

function cueScreenUp(): boolean {
  const it = win.item;
  if (chatOpen || mode.conversing || win.awaitingDecision() || modeScreen() !== 'cue') return false;
  return !it || (it.kind === 'cue' && it.title !== 'TIP' && !it.tray);
}

async function toggleSaid(): Promise<void> {
  settings.showSaid = settings.showSaid === false;
  await save(store, settings).catch(() => undefined);
  renderPhone(); 
  await render();
}

async function toggleOriginal(): Promise<void> {
  settings.showOriginal = settings.showOriginal === false;
  await save(store, settings).catch(() => undefined);
  renderPhone(); 
  await render();
}

async function cancelWait(): Promise<void> {
  if (sending) cancelWhileSending = true; 
  const res = await relay.control({ action: 'cancel_wait' }).catch(() => null);
  mode = res?.mode ?? { ...mode, awaiting: false, conversing: false };
  win.busy = null; 
  if (win.item?.kind === 'wake') win.close();
  const last = turns[turns.length - 1];
  if (last && !last.a) last.cancelled = true;
  chatActivity = Date.now();
  await syncMic(); 
  await render();
}

function myTurnHint(): string {
  const back = 'double tap: back to translating';
  if (holding) return `tap: send  ·  ${back}`;
  if (sending || win.busy) return back;
  return `tap: speak again  ·  ${back}`;
}

async function startMyTurn(now: number): Promise<void> {
  if (!mode.translating || myTurn) return;
  myTurn = true;
  turns = [];
  nothingHeard = false;
  const res = await relay.control({ action: 'my_turn', on: true }).catch(() => null);
  if (res?.mode) mode = res.mode;
  await startHold(now);
  if (!chatOpen) { 
    myTurn = false;
    await relay.control({ action: 'my_turn', on: false }).catch(() => null);
  }
}

async function exitMyTurn(fromPhone = false): Promise<void> {
  if (!myTurn) return;
  if (fromPhone) wakeBack = { off: true };
  await holdStarting;
  holding = false;
  draftText = '';
  liveText = '';
  win.busy = null;
  if (read.speaking) read.stop();
  uiGen++;
  const res = await relay.control({ action: 'my_turn', on: false }).catch(() => null);
  mode = res?.mode ?? { ...mode, conversing: false };
  uiGen++;
  await closeChat();
  myTurn = false;
  await syncMic();
  await render();
}

let ideaVoice = false; 
function speakIdea(it: Item): void {
  if (read.speaking) read.stop();
  const text = readableText(it) || it.text;
  if (!text) return;
  const language = it.speak_in || settings.translateFrom;
  sayAloud(text, language, language === settings.translateFrom ? settings.voiceSpoken : settings.voiceTranslated);
  ideaVoice = true;
}

function speakTurn(it: Item): void {
  if (read.speaking) read.stop();
  if (!settings?.readKinds?.myturn) return;
  const text = readableText(it) || it.text;
  if (!text) return;
  const language = it.speak_in || settings.translateFrom;
  sayAloud(text, language, language === settings.translateFrom ? settings.voiceSpoken : settings.voiceTranslated);
}

async function endConversation(): Promise<void> {
  const res = await relay.control({ action: 'end' }).catch(() => null);
  if (res?.mode) mode = res.mode;
  await apply(win.close());
  await closeChat();
}

async function sendDraft(send: boolean): Promise<void> {
  if (send && draftText) turns.push({ q: draftText, a: '' }); 
  draftText = '';
  liveText = '';
  if (send) mode = { ...mode, awaiting: true }; 
  await render();
  if (send) await syncMic(); 
  const res = await relay.control({ action: send ? 'send' : 'discard' }).catch(() => null);
  if (res?.mode) mode = res.mode;
  await syncMic();
}


async function openNewsList(stories?: Story[]): Promise<void> {
  if (!glasses || win.awaitingDecision()) return;
  let items = stories;
  if (!items) {
    try {
      items = ((await relay.allNews()).items || []) as Story[];
    } catch {
      items = [];
    }
  }
  if (!items.length) {
    await apply(win.offer({ seq: 0, kind: 'status', title: 'NEWS', text: 'No headlines yet. The news check runs every 10 minutes.' }, Date.now()));
    return;
  }
  storyOpen = false;
  win.close();
  lastStories = items.slice(0, 20); 
  newsList = lastStories;
  await glasses.setPage('langs', { header: 'TOP NEWS', bottomStatus: 'TOP NEWS', bottomHint: 'Swipe · tap: read · double tap: close', body: ' ', langs: newsList.map((x) => newsRow(x)) });
  await render();
}

async function closeNewsList(card = false): Promise<void> {
  if (!newsList || !glasses) return;
  newsList = null;
  await glasses.setPage(basePage(), { header: header(), body: bodyText(), tray: !card && trayWanted() });
  if (!card) await render();
}

async function openStory(index: number): Promise<void> {
  const s = (newsList || [])[index];
  if (!s || !glasses) return closeNewsList();
  newsList = null; 
  await apply(win.offer({ seq: 0, kind: 'news', title: `NEWS — ${s.place || s.topic}`, text: storyText(s), topic: s.topic, place: s.place,
    ...(s.at ? { at: s.at } : {}) }, Date.now())); 
  storyOpen = true;
  await glasses.setPage(basePage(), { header: header(), body: bodyText(), tray: false });
  await render();
}



function dropOpened(): void {
  if (win.item?.tray) win.close();
  homeOpen = false;
  tray.list = tray.open = null;
  newsList = null;
  storyOpen = false;
}

async function openPicker(side: 'from' | 'to', fromSetup = false): Promise<void> {
  if (!glasses || win.awaitingDecision()) return; 
  dropOpened();
  lastGestureAt = Date.now();
  screen.wake(lastGestureAt); 
  pickerSide = side;
  pickerFromSetup = fromSetup;
  if (fromSetup) { 
    picker = pickerOrder(LANGUAGES, side === 'from' ? settings.translateFrom : settings.translateTo);
    await glasses.setPage('langs', { header: 'I-TRANSLATE', bottomStatus: side === 'from' ? 'THEY SPEAK' : 'YOU READ', bottomHint: 'Tap a language · double tap: back', body: ' ', langs: picker }, true);
  } else if (side === 'from') {
    picker = pickerOrder(LANGUAGES.filter((l) => l !== settings.translateTo), settings.translateFrom);
    await glasses.setPage('langs', { header: 'TRANSLATE', bottomStatus: `TRANSLATE FROM → ${settings.translateTo}`, bottomHint: 'Tap a language · double tap: close', body: ' ', langs: picker }, true);
  } else {
    picker = pickerOrder(LANGUAGES, settings.translateTo);
    await glasses.setPage('langs', { header: 'TRANSLATE', bottomStatus: 'TRANSLATE INTO', bottomHint: 'Tap a language · double tap: close', body: ' ', langs: picker }, true);
  }
  await render();
}

function setupRows(): string[] {
  const names = `${settings.translateFrom} → ${settings.translateTo}`;
  const pair = names.length <= 28 ? names : langCodes([settings.translateFrom, settings.translateTo]);
  return [`▶ ${mode.translating ? 'Restart' : 'Start'}   ${pair}`, `They speak:  ${settings.translateFrom}`, `You read:  ${settings.translateTo}`, '↔ Swap languages'];
}
async function openSetup(): Promise<void> {
  if (!glasses || win.awaitingDecision()) return;
  dropOpened();
  lastGestureAt = Date.now();
  screen.wake(lastGestureAt);
  pickerSide = 'setup';
  pickerFromSetup = false;
  picker = setupRows();
  await glasses.setPage('langs', { header: 'I-TRANSLATE', bottomStatus: `I-TRANSLATE · ${langCodes([settings.translateFrom, settings.translateTo])}`,
    bottomHint: `Tap: choose · double tap: ${setupExits() ? 'exit' : 'close'}`, body: ' ', langs: picker }, true);
  await render();
}
async function setupPick(i: number): Promise<void> {
  if (i === 0) return startTranslation(settings.translateFrom);
  if (i === 1) return openPicker('from', true);
  if (i === 2) return openPicker('to', true);
  setPairSide(settings, 'from', settings.translateTo); 
  await savePair();
  return openSetup();
}
async function setupSide(side: 'from' | 'to', lang: string): Promise<void> {
  setPairSide(settings, side, lang);
  await savePair();
  return openSetup();
}
async function savePair(): Promise<void> {
  await save(store, settings);
  relay.control(relaySettings(settings)).catch(() => undefined);
  renderPhone();
}

async function pickTarget(lang: string): Promise<void> {
  if (!setPairSide(settings, 'to', lang)) return;
  await save(store, settings);
  relay.control(relaySettings(settings)).catch(() => undefined);
  if (mode.translating) return startTranslation(settings.translateFrom); 
  await openPicker('from'); 
  renderPhone();
}

async function closePicker(): Promise<void> {
  if (!picker && !meetingPicker || !glasses) return;
  picker = null;
  meetingPicker = null;
  await glasses.setPage(basePage(), { header: header(), body: bodyText(), tray: trayWanted() });
  await render();
}

async function startTranslation(lang: string): Promise<void> {
  if (!setPairSide(settings, 'from', lang)) return;
  await save(store, settings);
  if (!relay.ready()) { 
    await closePicker();
    popupOff = false;
    await apply(win.offer({ seq: 0, kind: 'status', title: 'API keys', text: 'Add your Soniox key and an AI key (Claude, OpenAI, Gemini, DeepSeek…) on the phone: I-Translate › Settings › API keys.' }, Date.now()));
    renderPhone();
    return;
  }
  const before = beginSwitch({ ...mode, translating: `${settings.translateFrom} → ${settings.translateTo}` });
  await closePicker(); 
  relay.control(relaySettings(settings)).catch(() => undefined);
  await endSwitch({ action: 'translate', from: settings.translateFrom, to: settings.translateTo }, before);
  renderPhone();
}

let modeSwitching = 0;
let switchesDone = 0; 
function beginSwitch(next: typeof mode): typeof mode {
  const before = mode;
  modeSwitching++;
  mode = next;
  if (glasses) glasses.menu = { meeting: !!mode.meeting, translating: !!mode.translating, listening: !!mode.listening };
  return before;
}
async function endSwitch(body: Record<string, unknown>, before: typeof mode): Promise<void> {
  try {
    const res = await relay.control(body).catch(() => null);
    mode = res?.mode ?? before;
  } finally {
    modeSwitching--;
    switchesDone++;
  }
  await render();
}


async function pickMeetingStyle(row: string): Promise<void> {
  const style = row.split(' · ')[0];
  const key = CUE_MODES.find(([, label]) => label === style)?.[0];
  if (!key) return;
  settings.cueMode = key; 
  await save(store, settings);
  meetingPicker = null;
  if (!glasses) return;
  const g = glasses;
  const before = beginSwitch({ ...mode, meeting: true }); 
  await g.setPage(basePage(), { header: header(), body: ' ', tray: trayWanted() });
  await render();
  relay.control(relaySettings(settings)).catch(() => undefined);
  await endSwitch({ action: 'meeting', cue_mode: style }, before);
  renderPhone();
}

async function pickSide(side: 'from' | 'to', lang: string): Promise<void> {
  if (!setPairSide(settings, side, lang)) return;
  await save(store, settings);
  relay.control(relaySettings(settings)).catch(() => undefined);
  if (mode.translating) return startTranslation(settings.translateFrom);
  renderPhone();
}

async function stopTranslation(): Promise<void> {
  const before = beginSwitch({ ...mode, translating: undefined }); 
  await render();
  await endSwitch({ action: 'translate_off' }, before);
  renderPhone();
}

async function toggleListening(): Promise<void> {
  try {
    const res = await relay.control({ action: mode.listening ? 'pause' : 'resume' });
    if (res.mode) mode = res.mode;
  } catch {
    mode = { ...mode, listening: !mode.listening };
  }
  await syncMic();
  await render();
  renderPhone();
}


function onAudio(a: { audioPcm: Uint8Array; speakerRole?: string; source?: string }): void {
  if (!a.audioPcm?.length) return;
  const filterOthers = settings.ownVoiceOnly && !mode.meeting && !mode.translating && !mode.conversing && micSource === 'glasses';
  const phoneSpeaking = mode.translating && !ideaVoice && (read.speaking || Date.now() - read.endedAt < 800);
  const keep = mode.listening && !phoneSpeaking && (!filterOthers || a.speakerRole !== AudioSpeakerRole.Other);
  mic.add(a.audioPcm, a.source, a.speakerRole, keep, Date.now());
  if (!mode.listening) return;
  pcm.push(keep ? a.audioPcm : new Uint8Array(a.audioPcm.length));
  pcmBytes += a.audioPcm.length;
  if (pcmBytes >= AUDIO_FLUSH_BYTES) flushAudio(); 
}

function anchorTelemetry(now: number): Record<string, unknown> {
  const deg = anchor.angle(now);
  const up = anchor.pitch(now);
  return { on: anchor.on, state: anchor.state, level: anchor.level(now), angle: deg === null ? null : Math.round(deg), hz: anchor.hz(now),
    pitch: up === null ? null : Math.round(up) };
}

function heartbeat(): void {
  const now = Date.now();
  if (holding && now - holdAt > HOLD_MAX_MS) endHold(now); 
  if (glasses && mic.needsRearm(now, micOn)) {
    mic.armed(now, true);
    syncMic(true); 
  }
  if (!relay.ready()) return;
  relay.control({ action: 'telemetry', phone: { foreground, mic_on: micOn, mic_source: micSource, frames: mic.frames, kept: mic.kept,
    roles: mic.roles, last_frame_ago_s: mic.lastFrame ? Math.round((now - mic.lastFrame) / 1000) : null, glasses_source: mic.source,
    page: glasses?.page, picker: !!picker, screen_off: screen.off, tray: { rev: trayRev, on: glasses?.trayOn, focus: tray.focus, list: tray.list }, images: glasses?.imageStats, screens: [...(glasses?.screenTimes ?? [])], popups: [...popupLog], write_fails: [...(glasses?.writeFails ?? [])], anchor: anchorTelemetry(now), last_rebuild: glasses?.lastRebuild, events: [...events], menu_taps_ignored: tapGuard.ignored } }).catch(() => undefined);
}

async function flushAudio(): Promise<void> {
  if (!pcmBytes || !relay.ready() || audioSending) return; 
  audioSending = true;
  const out = new Uint8Array(pcmBytes);
  let at = 0;
  for (const chunk of pcm) {
    out.set(chunk, at);
    at += chunk.length;
  }
  pcm = [];
  pcmBytes = 0;
  try {
    const res = await relay.audio(out, mic.source);
    if (res.mode) mode = res.mode;
  } catch {
  } finally {
    audioSending = false;
  }
  if (pcmBytes >= AUDIO_FLUSH_BYTES) flushAudio(); 
}

async function syncMic(force = false): Promise<void> {
  if (!glasses || !pageReady) return; 
  const want = mode.listening && !mode.awaiting && (!!mode.translating || voiceTraining); 
  const source: 'glasses' | 'phone' = myTurn && (holding || sending) ? settings.myTurnMic : (mode.translating ? settings.translateMic === 'phone'
    : mode.meeting && settings.meetingMic === 'phone') ? 'phone' : 'glasses'; 
  if (want !== micOn || (force && want) || (want && source !== micSource)) {
    if (micOn && source !== micSource) await glasses.mic(false, micSource).catch(() => false); 
    const ok = await glasses.mic(want, source).catch(() => false);
    micSource = source;
    micOn = want && ok;
    if (want) mic.armed(Date.now(), ok);
  }
}


async function pollReplies(): Promise<void> {
  if (!relay.ready()) return;
  const gen = uiGen;
  const sw = switchesDone;
  try {
    const live = holding || (mode.conversing && !mode.awaiting) || !!mode.translating; 
    const got = await relay.replies(replySeq, live ? replySig : '', live ? LIVE_WAIT_MS : 0);
    if (gen !== uiGen || sending) return; 
    liveText = got.live?.text || '';
    draftText = got.draft || '';
    const before = mode.conversing;
    const stale = modeSwitching || sw !== switchesDone;
    mode = got.mode ? (stale ? { ...got.mode, meeting: mode.meeting, translating: mode.translating } : got.mode) : mode;
    if (!startChecked) await endLeftoverModes(); 
    if (!notice.seen) { notice.seen = true; notice.meeting = !!mode.meeting; notice.translating = !!mode.translating; } 
    replySeq = got.seq;
    replySig = got.sig || '';
    modeQuiet.heard(got.heard_s, Date.now()); 
    for (const it of got.items as Item[]) {
      if (it.kind === 'status' && it.title === 'NOTHING HEARD') continue; 
      if (isModeNotice(it)) continue; 
      if ((it as { kind: string }).kind === 'ideas') { 
        const got = it as unknown as { ideas?: Idea[]; for_seq?: number };
        if (mode.translating && settings.replyIdeas && Array.isArray(got.ideas) && got.ideas.length && !ideaSending) {
          const one = [got.ideas.find((x) => x.kind !== 'ask'), got.ideas.find((x) => x.kind === 'ask')].filter((x): x is Idea => !!x);
          ideas = { list: one, idx: 0, forSeq: got.for_seq ?? 0, said: [] };
          ideaSaidLine = null;
          void render();
        }
        continue;
      }
      if (it.kind === 'translation' && it.original && !it.mine && ideas?.said.length) ideas = null; 
      if (it.kind === 'cue' || it.kind === 'translation') modeQuiet.activity(Date.now()); 
      if (staleModeItem(it, mode)) continue; 
      if (mutedWhileLit(it) && displayLit(Date.now())) continue; 
      if (it.kind === 'translation' && it.original && !it.mine) lastLine = { ...it };
      if (it.kind === 'translation' && (it.original || it.mine)) {
        const textLang = it.speak_in || (it.mine ? settings.translateFrom : settings.translateTo);
        const origLang = it.mine ? settings.translateTo : settings.translateFrom;
        trLog.add({ who: it.mine ? 'me' : 'them', original: it.original || '', text: it.text, at: Date.now(), origLang, textLang });
        recordLine(trLog.lines[trLog.lines.length - 1]); 
      }
      if (it.kind === 'translation' && it.mine && it.idea && !myTurn) {
        ideaSaidLine = trLog.lines[trLog.lines.length - 1] ?? null; 
        speakIdea(it);
        void render();
        continue;
      }
      if (it.mine && myTurn) { 
        const last = turns[turns.length - 1];
        if (last && !last.a) {
          last.a = it.text;
          if (it.original) last.q = it.original; 
        } else turns.push({ q: it.original || '', a: it.text });
        win.busy = null;
        chatActivity = Date.now();
        speakTurn(it);
        continue;
      }
      if (it.mine) { 
        const last = turns[turns.length - 1];
        if (last && !last.a) turns.pop();
        win.busy = null;
        if (chatOpen) await closeChat();
      }
      if ((it as { wake_word?: boolean }).wake_word) { 
        await wakeWord(it.text || '');
        continue;
      }
      if (it.greeting) continue; 
      if (mode.conversing || chatOpen) noteTurn(it);
      it.pushed = true;
      if (!mode.conversing && !chatOpen && !mode.awaiting && !holding && it.kind !== 'approval') popupOff = true; 
      await apply(win.offer(it, Date.now()));
    }
    if (myTurn && !mode.translating) await exitMyTurn(); 
    if (mode.meeting && !wasMeeting && chatOpen) await closeChat(); 
    wasMeeting = !!mode.meeting;
    if (mode.conversing && !chatOpen) await openChat();
    if (before && !mode.conversing && win.item?.kind === 'wake') await apply(win.close());
    if (chatOpen && !myTurn && !mode.conversing && !turns.length && !draftText && !holding && !sending && !nothingHeard) await closeChat(); 
    await syncMic();
  } catch {
  }
  await render();
  renderPhone();
}

function noteTurn(it: Item): void {
  chatActivity = Date.now();
  const last = turns[turns.length - 1];
  if (it.kind === 'status' && it.title === 'THINKING' && it.text) {
    const q = String((it as Item & { question?: string }).question || it.text).replace(/^"|"$/g, '');
    if (!last || last.a || last.cancelled) turns.push({ q, a: '' }); 
    else last.q = q; 
  } else if (it.kind === 'reply' || it.kind === 'done') {
    if (last && !last.a) last.a = it.text;
    else turns.push({ q: '', a: it.text });
  }
  if (turns.length > 12) turns.shift();
}


const TABS = ['translate', 'history', 'settings'];
let tabAutoSetup = false; 

function showTab(name: string): void {
  if (name === 'translations') name = 'translate'; 
  if (!TABS.includes(name)) name = name === 'setup' || name === 'display' ? 'settings' : 'translate';
  document.querySelectorAll<HTMLElement>('.tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === name));
  document.querySelectorAll<HTMLButtonElement>('#tabs button').forEach((b) => {
    b.classList.toggle('on', b.dataset.tab === name);
    b.setAttribute('aria-selected', String(b.dataset.tab === name));
  });
  if (name === 'settings') showPage('root');
  if (name === 'history') closeRec();
  window.scrollTo(0, 0);
}

function showPage(name: string): void {
  const pages = Array.from(document.querySelectorAll<HTMLElement>('.page'));
  if (!pages.some((pg) => pg.dataset.page === name)) name = 'root';
  pages.forEach((pg) => pg.classList.toggle('on', pg.dataset.page === name));
  window.scrollTo(0, 0);
}

function initTabs(): void {
  showTab('translate'); 
  document.querySelectorAll<HTMLButtonElement>('#tabs button').forEach((b) => { b.onclick = () => showTab(b.dataset.tab || 'translate'); });
  document.addEventListener('click', (ev) => { 
    const t = ev.target as HTMLElement | null;
    const go = t?.closest<HTMLElement>('[data-go]');
    if (go) { showTab('settings'); showPage(go.dataset.go || 'root'); return; }
    if (t?.closest('[data-back]')) { showPage('root'); return; }
    const tab = t?.closest<HTMLElement>('[data-tab-go]');
    if (tab) showTab(tab.dataset.tabGo || 'translate');
  });
}

function buildSegs(): void {
  document.querySelectorAll<HTMLSelectElement>('select.seg').forEach((sel) => {
    let box = sel.nextElementSibling as HTMLElement | null;
    if (!box || !box.classList.contains('segs')) {
      box = document.createElement('div');
      box.className = 'segs';
      box.setAttribute('role', 'radiogroup');
      box.setAttribute('aria-label', sel.getAttribute('aria-label') || '');
      sel.after(box);
    }
    box.innerHTML = Array.from(sel.options).map((o) => `<button type="button" role="radio" data-v="${esc(o.value)}">`
      + `${esc(o.dataset.short || (o.textContent || '').replace(/\s*[:(].*$/, ''))}</button>`).join('');
    box.onclick = (ev) => {
      const b = (ev.target as HTMLElement).closest<HTMLButtonElement>('button[data-v]');
      if (!b || sel.value === b.dataset.v) return;
      sel.value = b.dataset.v || '';
      sel.dispatchEvent(new Event('change'));
      paintSegs();
    };
  });
  paintSegs();
}

function paintSegs(): void {
  document.querySelectorAll<HTMLSelectElement>('select.seg').forEach((sel) => {
    sel.nextElementSibling?.querySelectorAll<HTMLButtonElement>('button[data-v]').forEach((b) => {
      const on = b.dataset.v === sel.value;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
  });
}

function renderSummaries(): void {
  const sec = (n: number): string => (n >= 60 ? `${n / 60} min` : `${n} s`);
  const sums: Record<string, string> = {
    translation: `${settings.replyIdeas ? 'Ideas on' : 'Ideas off'} · ${settings.screenOffS ? `off after ${sec(settings.screenOffS)}` : 'never off'}`,
    voice: settings.voiceEngine === 'natural' ? 'Natural' : 'iPhone',
    voiceid: settings.voiceId ? 'On' : 'Off',
  };
  document.querySelectorAll<HTMLElement>('[data-sum]').forEach((el) => { el.textContent = sums[el.dataset.sum || ''] ?? ''; });
}

function fillVoices(): void {
  document.querySelectorAll<HTMLSelectElement>('select.voice-engine').forEach((e) => {
    if (!e.options.length) e.innerHTML = VOICE_ENGINES.map(([k, label]) => `<option value="${k}">${label}</option>`).join('');
    e.value = settings?.voiceEngine ?? 'natural';
  });
}

function updateVoiceNotes(): void {
  const side = (which: 'spoken' | 'translated', language: string, gender: VoiceChoice) => {
    const sel = document.getElementById(`voice-${which}`) as HTMLSelectElement | null;
    if (!sel) return;
    const lbl = document.getElementById(`lbl-voice-${which}`);
    if (lbl) lbl.textContent = `Voice for ${language} (${which === 'spoken' ? 'spoken' : 'translated'} language)`;
    const note = document.getElementById(`note-voice-${which}`);
    if (settings.voiceEngine === 'natural' && NEURAL_VOICES[language]) { 
      const key = `n:${language}`;
      if (sel.dataset.key !== key) { sel.innerHTML = neuralOptions(language); sel.dataset.key = key; }
      sel.value = naturalVoice(language, settings.naturalVoices);
      if (note) note.textContent = 'Natural voice made on your PC. If the PC can\'t be reached, the iPhone\'s voice is used.';
      return;
    }
    const all = read.voices();
    const key = `i:${language}:${all.length}`;
    if (sel.dataset.key !== key) {
      const groups = groupVoices(all, bases(LANG_BCP47[language] || 'en'), language);
      sel.innerHTML = `<optgroup label="Automatic">${VOICE_CHOICES.map(([k, label]) => `<option value="${k}">${label} (best ${language} voice)</option>`).join('')}</optgroup>`
        + groups.map((g) => `<optgroup label="${g.label}">${g.voices.map((x) => `<option value="${x.voiceURI.replace(/"/g, '&quot;')}">${x.name} (${x.lang})</option>`).join('')}</optgroup>`).join('');
      sel.dataset.key = key;
    }
    const picked = settings.phoneVoices?.[language] || '';
    sel.value = picked && all.some((x) => x.voiceURI === picked) ? picked : gender;
    if (picked && sel.value === picked) {
      if (note) note.textContent = `Will use: ${all.find((x) => x.voiceURI === picked)?.name ?? picked}`;
      return;
    }
    const v = pickVoice(all, language, gender);
    if (note && settings.voiceEngine === 'natural') { note.textContent = `No natural ${language} voice exists: the iPhone's voice is used.`; return; }
    if (note) {
      note.textContent = !LANG_BCP47[language] || !v.uri
        ? `No ${language} voice on this phone: the phone's default voice is used. Add voices in iPhone Settings > Accessibility > Spoken Content > Voices.`
        : v.matched ? `Will use: ${v.name}` : `No ${gender} ${language} voice on this phone: using ${v.name}. Add more in iPhone Settings > Accessibility > Spoken Content > Voices.`;
    }
  };
  side('spoken', settings.translateFrom, settings.voiceSpoken);
  side('translated', settings.translateTo, settings.voiceTranslated);
  const th = document.getElementById('lbl-theirs');
  if (th) th.textContent = 'Play aloud'; 
  const mi = document.getElementById('lbl-mine');
  if (mi) mi.textContent = 'Play aloud';
}

async function pickSideVoice(which: 'spoken' | 'translated'): Promise<void> {
  read.unlockAudio(); 
  const sel = $(`voice-${which}`) as HTMLSelectElement;
  const language = which === 'spoken' ? settings.translateFrom : settings.translateTo;
  if (sel.dataset.key === `n:${language}`) settings.naturalVoices = { ...settings.naturalVoices, [language]: sel.value };
  else if (sel.value === 'female' || sel.value === 'male') { 
    const { [language]: _gone, ...rest } = settings.phoneVoices ?? {};
    settings.phoneVoices = rest;
    if (which === 'spoken') settings.voiceSpoken = sel.value;
    else settings.voiceTranslated = sel.value;
  } else settings.phoneVoices = { ...settings.phoneVoices, [language]: sel.value }; 
  await save(store, settings);
  relay.control(relaySettings(settings)).catch(() => undefined); 
  sayAloud(LANG_SAMPLE[language] || LANG_SAMPLE.English, language, which === 'spoken' ? settings.voiceSpoken : settings.voiceTranslated);
  updateVoiceNotes();
}

function paintVol(b: HTMLButtonElement): void {
  const on = !!settings?.readKinds?.[b.dataset.read as ReadKind];
  b.classList.toggle('on', on);
  b.setAttribute(b.getAttribute('role') === 'switch' ? 'aria-checked' : 'aria-pressed', String(on));
  b.title = on ? 'Read aloud on' : 'Read aloud off';
}

const trLog = new TrLog();
let trDrawn = -1; 
let trControls = '';
let trIdeas = ''; 
let ideaSaidLine: TrLine | null = null; 
let trWas: string | null = null;
let turnSince = 0; 
let trPlaying = '';
function playTrLine(btn: HTMLElement): void {
  const l = trLog.lines[Number(btn.dataset.i)];
  if (l) playLine(l, btn.dataset.part === 'orig');
}
function playLine(l: TrLine, orig: boolean): void {
  const key = `${l.at}|${orig ? 'orig' : 'text'}`;
  read.unlockAudio(); 
  const wasPlaying = read.speaking;
  if (wasPlaying) read.stop();
  if (wasPlaying && trPlaying === key) { trPlaying = ''; return; } 
  const text = (orig ? l.original : l.text).trim();
  const language = (orig ? l.origLang : l.textLang) || (orig ? settings.translateFrom : settings.translateTo);
  if (!text) return;
  trPlaying = key;
  sayAloud(text, language, language === settings.translateFrom ? settings.voiceSpoken : settings.voiceTranslated);
}
let trPlayWired = false;
let trScrollWired = false;
let trFollow = true; 
function fitTrBox(box: HTMLElement): void {
  const dock = document.getElementById('tr-dock');
  const onTab = document.querySelector('.tab[data-tab="translate"]')?.classList.contains('on');
  if (!dock || !onTab || !box.offsetParent) return;
  const card = box.closest<HTMLElement>('.tr-feed') ?? box;
  const cardPad = card.getBoundingClientRect().bottom - box.getBoundingClientRect().bottom; 
  const boxTop = box.getBoundingClientRect().top + window.scrollY; 
  const want = `${Math.max(160, Math.floor(dock.getBoundingClientRect().top - boxTop - cardPad - 8))}px`;
  if (box.style.maxHeight !== want) box.style.maxHeight = want;
}
let history: History | null = null;
let curRec: Recording | null = null; 
let recSaveTimer: ReturnType<typeof setTimeout> | null = null;
let histNewest = true;
let histDrawn = '';
let openRec: Recording | null = null;
const titling = new Set<string>();

let recWas: string | null = null; 
function trackSession(): void {
  const now = mode.translating ?? null;
  if (now === recWas) return;
  recWas = now;
  if (curRec) finishRec(curRec);
  curRec = now ? { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: Date.now(), end: Date.now(),
    from: settings.translateFrom, to: settings.translateTo, title: '', summary: '', lines: [], n: 0, seen: false } : null;
}

function recordLine(l: TrLine | undefined): void {
  trackSession(); 
  if (!curRec || !l) return;
  curRec.lines.push({ ...l });
  curRec.end = l.at;
  curRec.n = curRec.lines.length;
  if (recSaveTimer) clearTimeout(recSaveTimer);
  const r = curRec;
  recSaveTimer = setTimeout(() => { recSaveTimer = null; void history?.save(r).catch(() => undefined); }, 1500); 
}

function finishRec(r: Recording): void {
  if (recSaveTimer) { clearTimeout(recSaveTimer); recSaveTimer = null; }
  if (!r.lines.length) return; 
  void history?.save(r).then(() => titleRec(r.id)).catch(() => undefined);
}

async function titleRec(id: string): Promise<void> {
  if (!history || titling.has(id) || !relay.ready()) return;
  titling.add(id);
  try {
    const r = await history.get(id);
    if (!r || r.title || !r.lines.length) return;
    const { title, summary } = parseSummary(await relay.summarize(SUMMARY_SYSTEM, summaryPrompt(r)));
    if (!title) return;
    const fresh = (await history.get(id)) ?? r; 
    fresh.title = title;
    fresh.summary = summary;
    await history.save(fresh);
    if (openRec?.id === id) void openRecording(id, false);
  } catch {  } finally {
    titling.delete(id);
  }
}

async function retryTitles(): Promise<void> {
  for (const m of history?.untitled(curRec?.id).slice(0, 5) ?? []) await titleRec(m.id);
}

function renderHistory(): void {
  if (!history) return;
  const key = `${history.rev}|${histNewest}|${curRec && curRec.lines.length ? curRec.id : ''}`;
  if (key === histDrawn) return;
  histDrawn = key;
  const n = history.list.length;
  $('h-count').textContent = `${n} ${n === 1 ? 'Record' : 'Records'}`;
  $('h-list').innerHTML = listHtml(history.list, histNewest, curRec?.id ?? '');
  $('h-clear-all').hidden = !n || !$('h-clear-confirm').hidden;
  if (!n) $('h-clear-confirm').hidden = true;
  $('h-sort').setAttribute('aria-label', histNewest ? 'Newest first' : 'Oldest first');
  $('h-sort-icon').setAttribute('d', histNewest ? 'M7 4v16M3 16l4 4 4-4M14 6h7M14 12h5M14 18h3' : 'M7 20V4M3 8l4-4 4 4M14 6h3M14 12h5M14 18h7');
}

async function openRecording(id: string, markSeen = true): Promise<void> {
  if (!history) return;
  const live = id === curRec?.id;
  const r = live ? curRec : await history.get(id);
  if (!r) return;
  openRec = r;
  $('h-d-title').textContent = live ? 'Recording…' : r.title || UNTITLED;
  $('h-d-sub').innerHTML = `${esc(stamp(r.at))} <span class="h-dotsep">•</span> ${pairHtml(r)} <span class="h-dotsep">•</span> ${esc(length(r))}`;
  $('h-d-summary').textContent = r.summary || (r.title || live ? '' : relay.ready() ? 'Writing a title and summary…' : '');
  $('h-d-pair').textContent = `${r.lines.length} ${r.lines.length === 1 ? 'line' : 'lines'}`;
  $('h-d-lines').innerHTML = linesHtml(r.lines, 'No lines.', true);
  $('h-del').hidden = live; 
  $('h-del-confirm').hidden = true;
  $('h-list-view').hidden = true;
  $('h-detail').hidden = false;
  if (markSeen) { window.scrollTo(0, 0); if (!r.seen && !live) await history.markSeen(id).catch(() => undefined); }
  if (!r.title && !live) void titleRec(id);
}

function closeRec(): void {
  openRec = null;
  $('h-detail').hidden = true;
  $('h-list-view').hidden = false;
}

function wireHistory(): void {
  $('h-list').addEventListener('click', (ev) => {
    const card = (ev.target as HTMLElement | null)?.closest<HTMLElement>('[data-rec]');
    if (card?.dataset.rec) void openRecording(card.dataset.rec);
  });
  $('h-back').onclick = () => { closeRec(); window.scrollTo(0, 0); };
  $('h-sort').onclick = () => { histNewest = !histNewest; renderHistory(); };
  $('h-d-lines').addEventListener('click', (ev) => { 
    const b = (ev.target as HTMLElement | null)?.closest<HTMLElement>('.tr-play');
    const l = b ? openRec?.lines[Number(b.dataset.i)] : undefined;
    if (l) playLine(l, false);
  });
  $('h-del').onclick = () => { $('h-del-confirm').hidden = false; $('h-del').hidden = true; };
  $('h-del-no').onclick = () => { $('h-del-confirm').hidden = true; $('h-del').hidden = false; };
  $('h-del-yes').onclick = async () => {
    if (openRec) await history?.remove(openRec.id).catch(() => undefined);
    closeRec();
    renderHistory();
  };
  $('h-clear-all').onclick = () => {
    const n = history?.list.length ?? 0;
    $('h-clear-text').textContent = `Delete all ${n} ${n === 1 ? 'recording' : 'recordings'} from this phone? This can't be undone.`;
    $('h-clear-confirm').hidden = false;
    $('h-clear-all').hidden = true;
  };
  $('h-clear-no').onclick = () => { $('h-clear-confirm').hidden = true; $('h-clear-all').hidden = false; };
  $('h-clear-yes').onclick = async () => {
    await history?.clear().catch(() => undefined);
    $('h-clear-confirm').hidden = true;
    renderHistory();
  };
}

function renderTr(): void {
  if (!trPlayWired) {
    const box = document.getElementById('tr-live');
    if (box) {
      trPlayWired = true;
      box.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('.tr-play');
        if (btn) playTrLine(btn);
      });
    }
    document.getElementById('tr-ideas')?.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t.closest('.tr-idea-play')) { if (ideaSaidLine) playLine(ideaSaidLine, false); return; }
      const card = t.closest<HTMLButtonElement>('.tr-idea[data-idea]');
      if (!card || card.disabled || !ideas) return;
      const i = Number(card.dataset.idea);
      if (!openIdeas().includes(i)) return;
      ideas.idx = i;
      void pickIdea();
    });
  }
  const ih = ideasHtml(settings?.replyIdeas && mode.translating && !myTurn && ideas
    ? { list: ideas.list, said: ideas.said, sending: ideaSending, canReplay: !!ideaSaidLine } : null);
  if (ih !== trIdeas) { trIdeas = ih; const el = document.getElementById('tr-ideas'); if (el) el.innerHTML = ih; }
  if (mode.translating && mode.translating !== trWas) { trLog.clear(); trFollow = true; }
  trackSession();
  trWas = mode.translating ?? null;
  const box = document.getElementById('tr-live'); 
  if (box && !trScrollWired) {
    trScrollWired = true;
    box.addEventListener('scroll', () => { trFollow = box.scrollHeight - box.scrollTop - box.clientHeight < 40; }, { passive: true });
  }
  if (box && trDrawn !== trLog.rev) {
    trDrawn = trLog.rev;
    box.innerHTML = linesHtml(trLog.lines, 'Nothing translated yet. Pick the languages and tap Start translating below.', true);
  }
  if (myTurn && !turnSince) turnSince = Date.now();
  if (!myTurn) turnSince = 0;
  const mine = myTurn ? [...trLog.lines].reverse().find((l) => l.who === 'me' && l.at >= turnSince) : undefined; 
  document.querySelector('.tab[data-tab="translate"]')?.classList.toggle('myturn', !!(myTurn && mode.translating)); 
  const c = composerHtml({ translating: mode.translating ?? null, myTurn, holding, sending: sending || (myTurn && !!win.busy), draft: myTurn ? draftText : '',
    from: settings?.translateFrom ?? '', to: settings?.translateTo ?? '', said: mine?.original, saidTr: mine?.text }); 
  const line = document.getElementById('tr-controls');
  const mic = document.getElementById('tr-mic');
  if (line && mic && c.line + c.mic !== trControls) { trControls = c.line + c.mic; line.innerHTML = c.line; mic.innerHTML = c.mic; }
  if (box) { 
    fitTrBox(box);
    if (trFollow && box.scrollHeight - box.scrollTop - box.clientHeight > 1) box.scrollTop = box.scrollHeight;
  }
}
let typedSending = false;
async function sendTyped(): Promise<void> {
  const box = $('type-text') as HTMLInputElement;
  const text = box.value.trim();
  if (!text || !mode.translating || typedSending) return;
  read.unlockAudio(); 
  typedSending = true;
  $('type-note').textContent = 'Translating…';
  renderTyped();
  const res = await relay.control({ action: 'my_turn_text', text }).catch(() => null);
  typedSending = false;
  if (res) {
    box.value = '';
    if (res.mode) mode = res.mode;
    $('type-note').textContent = '';
  } else {
    $('type-note').textContent = relay.online ? "Couldn't send it. Is translation still on?" : "Couldn't send it. Check the phone's internet connection.";
  }
  renderTyped();
  renderPhone();
}

function renderTyped(): void {
  const box = document.getElementById('type-text') as HTMLInputElement | null;
  const send = document.getElementById('btn-type-send') as HTMLButtonElement | null;
  if (!box || !send) return;
  const on = !!mode.translating;
  box.disabled = !on || typedSending;
  send.disabled = !on || typedSending;
  box.placeholder = on ? `Type in ${settings.translateTo}…` : 'Start translating to type your turn';
}

function wireTr(): void {
  ($('type-turn') as HTMLFormElement).onsubmit = (ev) => { ev.preventDefault(); void sendTyped(); };
  document.addEventListener('click', async (ev) => {
    const b = (ev.target as HTMLElement | null)?.closest<HTMLButtonElement>('#tr-myturn, #tr-send, #tr-again, #tr-back, [data-turn]');
    if (!b || b.disabled) return;
    const now = Date.now();
    const act = b.dataset.turn ?? b.id.replace('tr-', ''); 
    if (act === 'myturn') await startMyTurn(now);
    else if (act === 'send' && myTurn && holding) await endHold(now);
    else if (act === 'again' && myTurn && !holding && !sending && !win.busy) await startHold(now);
    else if (act === 'back' || act === 'cancel') await exitMyTurn(true);
    renderTr();
  });
  setInterval(() => { renderTr(); renderChip(); renderHistory(); }, 500); 
}

let trSince = 0;
function renderChip(): void {
  if (mode.translating && !trSince) trSince = Date.now();
  if (!mode.translating) trSince = 0;
  const s = Math.floor((Date.now() - trSince) / 1000);
  $('status').textContent = !relay.ready() ? 'Add API keys' : mode.translating ? `Translating · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
    : !mode.listening ? 'Paused (glasses battery low)' : 'Ready';
  $('status-dot').className = `dot ${!relay.ready() || !mode.listening ? 'warn' : mode.translating ? 'rec' : 'ok'}`;
}

function renderPhone(): void {
  renderChip();
  updateVoiceNotes();
  $('read-state').textContent = !read.available ? 'Text-to-speech is not available in this WebView.' : read.status || 'Tap Test sound once.';
  $('btn-translate').className = mode.translating ? 'danger' : '';
  $('tr-go').textContent = mode.translating ? '■  Stop translating' : '▶  Start translating';
  $('tr-go-sub').textContent = mode.translating ? '' : langCodes([settings.translateFrom, settings.translateTo]);
  $('tr-dock').classList.toggle('idle', !mode.translating);
  $('tr-pair').textContent = langCodes((mode.translating || `${settings.translateFrom} → ${settings.translateTo}`).split('→').map((x) => x.trim())).replace('→', '⇄');
  $('conn-state').textContent = !relay.ready() ? 'Needed' : 'Saved';
  $('conn-dot').className = `dot ${relay.ready() ? 'ok' : 'warn'}`;
  document.querySelector('#tabs button[data-tab="settings"]')?.classList.toggle('warn', !relay.ready()); 
  if (!relay.ready() && !tabAutoSetup) { tabAutoSetup = true; showTab('settings'); showPage('connection'); } 
  ($('translate-from') as HTMLSelectElement).value = settings.translateFrom;
  ($('translate-to') as HTMLSelectElement).value = settings.translateTo;
  paintSegs(); 
  renderTyped();
  renderSummaries();
}

function fillAi(): void {
  const p = provider(settings.aiProvider);
  ($('ai-provider') as HTMLSelectElement).value = p.id;
  const key = $('ai-key') as HTMLInputElement;
  key.value = settings.aiKeys[p.id] ?? '';
  key.placeholder = `${p.placeholder ? `${p.placeholder} ` : 'paste '}from ${p.keys.split(' ')[0]}`;
  const model = $('ai-model') as HTMLInputElement;
  model.value = settings.aiModels[p.id] ?? '';
  model.placeholder = `automatic (${p.model})`;
  $('ai-key-label').textContent = `${p.name} API key`;
  $('ai-where').textContent = `Get a key: ${p.keys}.`;
}

const aiConf = () => ({ provider: settings.aiProvider, key: settings.aiKeys[settings.aiProvider] ?? '', model: settings.aiModels[settings.aiProvider] ?? '' });

function fillForm(): void {
  ($('soniox-key') as HTMLInputElement).value = settings.sonioxKey;
  fillAi();
  ($('translate-from') as HTMLSelectElement).value = settings.translateFrom;
  ($('translate-to') as HTMLSelectElement).value = settings.translateTo;
  ($('translate-mic') as HTMLSelectElement).value = settings.translateMic;
  ($('my-turn-mic') as HTMLSelectElement).value = settings.myTurnMic;
  ($('show-original') as HTMLInputElement).checked = settings.showOriginal;
  ($('reply-ideas') as HTMLInputElement).checked = settings.replyIdeas;
  ($('tr-footer') as HTMLInputElement).checked = settings.trFooter;
  document.querySelectorAll<HTMLButtonElement>('button.vol').forEach((b) => paintVol(b));
  ($('screen-off-after') as HTMLSelectElement).value = String(settings.screenOffS);
  document.querySelectorAll<HTMLSelectElement>('select.msg-for').forEach((el) => (el.value = String(settings.messageKinds[el.dataset.msg as MsgKind] ?? 0)));
}

async function saveForm(): Promise<void> {
  settings.sonioxKey = ($('soniox-key') as HTMLInputElement).value.trim();
  settings.aiKeys[settings.aiProvider] = ($('ai-key') as HTMLInputElement).value.trim();
  settings.aiModels[settings.aiProvider] = ($('ai-model') as HTMLInputElement).value.trim();
  settings.translateMic = ($('translate-mic') as HTMLSelectElement).value === 'glasses' ? 'glasses' : 'phone';
  settings.myTurnMic = ($('my-turn-mic') as HTMLSelectElement).value === 'phone' ? 'phone' : 'glasses';
  settings.showOriginal = ($('show-original') as HTMLInputElement).checked;
  settings.replyIdeas = ($('reply-ideas') as HTMLInputElement).checked;
  settings.trFooter = ($('tr-footer') as HTMLInputElement).checked;
  settings.screenOffS = Number(($('screen-off-after') as HTMLSelectElement).value);
  document.querySelectorAll<HTMLSelectElement>('select.msg-for').forEach((el) => {
    if ((MSG_KINDS as readonly string[]).includes(el.dataset.msg || '')) settings.messageKinds[el.dataset.msg as MsgKind] = Number(el.value) || 0;
  });
  applyTiming();
  await save(store, settings);
  fillForm();
  relay.configure(settings.sonioxKey, aiConf());
  try {
    await relay.control(relaySettings(settings));
    const h = await relay.health();
    mode = h.mode ?? mode;
  } catch {
  }
  renderPhone();
}

let voiceTraining = false; 

function fillKindTimeouts(): void {
  const html = [`<option value="0">Default</option>`, ...MESSAGE_CHOICES.map(([v, l]) => `<option value="${v}">${l}</option>`)].join('');
  document.querySelectorAll<HTMLSelectElement>('select.msg-for').forEach((el) => {
    el.innerHTML = html;
    el.value = String(settings.messageKinds[el.dataset.msg as MsgKind] ?? 0);
  });
}

function applyTiming(): void {
  setTiming({ messageS: settings.messageS, screenOffS: settings.screenOffS, kinds: settings.messageKinds });
}

function wirePhone(): void {
  const opts = (choices: [number, string][]) => choices.map(([k, label]) => `<option value="${k}">${label}</option>`).join('');
  ($('screen-off-after') as HTMLSelectElement).innerHTML = opts(SCREEN_OFF_CHOICES);
  fillKindTimeouts();
  wireTr();
  const options = LANGUAGES.map((l) => `<option value="${l}">${l}</option>`).join('');
  for (const side of ['from', 'to'] as const) {
    const sel = $(`translate-${side}`) as HTMLSelectElement;
    sel.innerHTML = options;
    sel.onchange = () => pickSide(side, sel.value);
  }
  let translateStartedAt = 0;
  $('btn-translate').onclick = async () => {
    if (mode.translating) {
      if (Date.now() - translateStartedAt < 2000) return;
      return stopTranslation();
    }
    translateStartedAt = Date.now();
    await startTranslation(settings.translateFrom);
  };
  ($('translate-mic') as HTMLSelectElement).onchange = () => saveForm().then(() => syncMic());
  ($('my-turn-mic') as HTMLSelectElement).onchange = () => saveForm().then(() => syncMic());
  for (const id of ['show-original', 'reply-ideas', 'tr-footer']) ($(id) as HTMLInputElement).onchange = () => void saveForm().then(() => render());
  document.querySelectorAll<HTMLButtonElement>('button.vol').forEach((b) => {
    b.onclick = async () => { 
      const k = b.dataset.read as ReadKind;
      settings.readKinds[k] = !settings.readKinds[k];
      if (!settings.readKinds[k] && read.speaking) read.stop();
      document.querySelectorAll<HTMLButtonElement>(`button.vol[data-read="${k}"]`).forEach(paintVol);
      await save(store, settings);
    };
  });
  initTabs();
  updateVoiceNotes();
  ($('voice-spoken') as HTMLSelectElement).onchange = () => void pickSideVoice('spoken');
  ($('voice-translated') as HTMLSelectElement).onchange = () => void pickSideVoice('translated');
  const synthObj = (typeof speechSynthesis !== 'undefined' ? speechSynthesis : undefined) as SpeechSynthesis | undefined;
  if (synthObj) synthObj.onvoiceschanged = () => { fillVoices(); updateVoiceNotes(); };
  fillVoices();
  buildSegs(); 
  $('btn-swap').onclick = () => void pickSide('from', settings.translateTo); 
  $('btn-read-test').onclick = () => { 
    read.unlockAudio();
    read.unlockSilently();
    if (settings.voiceEngine === 'natural') sayAloud('Sound is working. This is I-Translate on your phone.', 'English', null);
    else read.test();
    fillVoices();
    renderPhone();
  };
  read.fetchAudio = (text, voice) => relay.tts(text, voice);
  document.querySelectorAll<HTMLSelectElement>('select.voice-engine').forEach((e) => {
    e.onchange = async () => {
      settings.voiceEngine = (e.value === 'iphone' ? 'iphone' : 'natural') as VoiceEngine;
      await save(store, settings);
      relay.control(relaySettings(settings)).catch(() => undefined);
      fillVoices();
      updateVoiceNotes();
    };
  });
  read.onChange = () => { renderPhone(); if (!readInRender) void render(); };
  const pick = $('ai-provider') as HTMLSelectElement;
  pick.innerHTML = PROVIDERS.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
  pick.onchange = () => { 
    settings.aiKeys[settings.aiProvider] = ($('ai-key') as HTMLInputElement).value.trim();
    settings.aiModels[settings.aiProvider] = ($('ai-model') as HTMLInputElement).value.trim();
    settings.aiProvider = provider(pick.value).id;
    fillAi();
    $('key-note').textContent = '';
    void saveForm().then(() => renderPhone());
  };
  $('btn-save').onclick = async () => { 
    const note = $('key-note');
    note.textContent = 'Testing the keys…';
    await saveForm();
    const r = await relay.testKeys();
    note.textContent = `Soniox: ${r.soniox === 'ok' ? 'works' : r.soniox}. ${r.aiName}: ${r.ai === 'ok' ? `works (${r.model})` : r.ai}.`;
    renderPhone();
  };
  $('screen-off-after').onchange = () => saveForm().then(() => render());
  document.querySelectorAll<HTMLSelectElement>('select.msg-for').forEach((el) => (el.onchange = () => saveForm().then(() => render())));
  window.addEventListener('pagehide', () => void appClosing('page closed')); 
  document.addEventListener('visibilitychange', () => {
    foreground = document.visibilityState === 'visible';
    if (foreground) syncMic(true);
  });
}


function browserStore(): Store {
  return { get: async (k) => localStorage.getItem(k) ?? '', set: async (k, v) => localStorage.setItem(k, v) };
}

async function main(): Promise<void> {
  bridge = await Promise.race([waitForEvenAppBridge(), new Promise<null>((r) => setTimeout(() => r(null), 4000))]);
  const previewStore = new URLSearchParams(location.search).has('localstore') || demoOn;
  if (demoOn) installDemo(relay); 
  store = bridge && !previewStore ? { get: (k) => bridge!.getLocalStorage(k), set: (k, v) => bridge!.setLocalStorage(k, v) } : browserStore();
  settings = await load(store);
  anchor.setEnabled(false, Date.now()); 
  applyTiming();
  wirePhone();
  fillForm();
  relay.configure(settings.sonioxKey, aiConf());
  history = new History(store);
  await history.load().catch(() => undefined);
  wireHistory();
  setTimeout(() => void retryTitles(), 8000); 
  renderPhone(); 
  if (relay.ready()) relay.control(relaySettings(settings)).catch(() => undefined);
  await save(store, settings); 

  if (bridge) {
    glasses = new Glasses(bridge);
    glasses.bareFor = barePage;
    glasses.onBuilt = () => void render(); 
    glasses.layoutFor = (kind) => (kind === 'langs' ? listLayout() : kind === 'chat' ? (myTurn ? 'myturn' : 'talk') : kind === 'normal' && !glasses?.trayOn ? layoutForItem(win.item) ?? (win.item ? null : modeLayout()) : null); 
    glasses.cardsFor = () => 0; 
    glasses.treeOn = false;
    const allFrames = [...FRAMES, ...ANIM_FRAMES, ...FADE_FRAMES.filter((f) => f !== 'blank'), ...NAP_FRAMES, ...NAPFADE_FRAMES.filter((f) => f !== 'blank')];
    await glasses.loadImages(allFrames, './avatar48/', glasses.images48);
    glasses.images = glasses.images48;
    glasses.trayOn = false;
    pageReady = await glasses.create({ header: header(), body: ' ' });
    if (!pageReady) console.warn('glasses page was not created');
    await syncImu();
    bridge.onEvenHubEvent((e) => {
      onEvent(e);
    });
    bridge.onDeviceStatusChanged((s) => {
      if (typeof s.isCharging === 'boolean' && s.isCharging !== charging) {
        charging = s.isCharging;
        void render(); 
      }
      if (typeof s.batteryLevel === 'number' && s.batteryLevel >= 1 && s.batteryLevel <= 100) {
        const changed = s.batteryLevel !== battery;
        battery = s.batteryLevel;
        relay.control({ action: 'telemetry', battery }).catch(() => undefined);
        syncMic();
        if (changed) void render(); 
      }
    });
    bridge.getDeviceInfo().then((d) => {
      const s = d?.status;
      if (!s) return;
      if (typeof s.isCharging === 'boolean') charging = s.isCharging;
      if (battery === null && typeof s.batteryLevel === 'number' && s.batteryLevel >= 1 && s.batteryLevel <= 100) battery = s.batteryLevel;
      void render();
    }).catch(() => undefined);
    await render();
  }

  let lastPoll = 0;
  let polling = false;
  setInterval(async () => { 
    const now = Date.now();
    if (polling || (!(holding || (mode.conversing && !mode.awaiting) || mode.translating) && now - lastPoll < REPLY_POLL_MS)) return;
    polling = true;
    lastPoll = now;
    try { await pollReplies(); } finally { polling = false; }
  }, LIVE_POLL_MS);
  setInterval(flushAudio, AUDIO_FLUSH_MS);
  setInterval(() => apply(win.tick(Date.now())), 1000);
  setInterval(() => watchPopup(Date.now()), 500); 
  setInterval(screenTick, 1000);
  setInterval(animTick, ANIM_MS); 
  setInterval(heartbeat, HEARTBEAT_MS);
  await pollReplies();
  await syncMic();
  if (glasses && !mode.translating) await openSetup();
}

main();
