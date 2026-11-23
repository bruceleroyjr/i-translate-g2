
import { OsEventTypeList, waitForEvenAppBridge, type EvenAppBridge, type EvenHubEvent } from '@evenrealities/even_hub_sdk';
import { getTextWidth } from '@evenrealities/pretext';
import { Glasses, IDS, MENU_ID, LAYOUT_ART, LAYOUT_TEXT, type CardBox, type CardLayout } from './glasses';
import { MicWatchdog } from './mic';
import { wrappedLines, bottomV, centerV } from './center';
import { LocalRelay, type Mode, type Idea } from './engine';
import { demoOn, installDemo } from './demo';
import { PROVIDERS, provider } from './ai.ts';
import { ReadAloud } from './readAloud';
import { readableText, groupVoices } from './readText';
import { LANG_BCP47, LANG_SAMPLE, VOICE_CHOICES, bases, pickVoice, type VoiceChoice } from './langVoices';
import { type ReadKind, LANGUAGES, MESSAGE_CHOICES, MSG_KINDS, type MsgKind, SCREEN_OFF_CHOICES, load, relaySettings, save, setPairSide, type Settings, type Store } from './settings';
import { TrLog, esc, linesHtml, composerHtml, ideasHtml, type TrLine } from './phoneTranslate';
import { History, SUMMARY_SYSTEM, summaryPrompt, parseSummary, listHtml, pairHtml, stamp, length, UNTITLED, type Recording } from './history';
import { spokenPair, middlePair, ModeQuiet, timing, fitRow, TapGuard, WindowState, type Turn, pickedIndex, pickerOrder, ScreenSleep, HOLD_MAX_MS, ANIM_MS, fitHead, fitTail, countdownText, listeningDots, setTiming, staleModeItem, turnView, type Effect, type Item, type View } from './window';

const REPLY_POLL_MS = 1000;
const LIVE_POLL_MS = 100; 
const LIVE_WAIT_MS = 1500;
const CHAT_IDLE_MS = 5 * 60_000; 
const HEARTBEAT_MS = 5000;
const AUDIO_FLUSH_MS = 200;
const AUDIO_FLUSH_BYTES = 6_400; 
const CARD_LINES = 7; 
const ORIG_LINES = 2; 

const relay = new LocalRelay(); 
const win = new WindowState();
let settings: Settings;
let store: Store;
let bridge: EvenAppBridge | null = null;
let glasses: Glasses | null = null;
let mode: Mode = { conversing: false };
let replySeq = -1;
let replySig = ''; 
let micOn = false;
let micSource: 'glasses' | 'phone' = 'glasses';
let liveText = '';
let draftText = ''; 
let pageReady = false; 
let foreground = true;
let pcm: Uint8Array[] = [];
let pcmBytes = 0;
let audioSending = false; 
const mic = new MicWatchdog();
let picker: string[] | null = null; 
let pickerSide: 'from' | 'to' | 'setup' = 'setup'; 
const PICKER_IDLE_MIN_MS = 30_000; 
let lastGestureAt = 0; 
let chatOpen = false; 
let myTurn = false;
let turns: Turn[] = []; 
let chatActivity = 0; 
let nothingHeard = false; 
let sending = false; 
let uiGen = 0; 
let holding = false; 
let holdAt = 0;
let holdStarting: Promise<void> = Promise.resolve(); 
let darkAfterTurn = false; 
const screen = new ScreenSleep();

let lastLine: Item | null = null;
function modeLayout(): CardLayout | null {
  return mode.translating ? trLayout() : null;
}
function modeItem(): Item | null {
  if (!mode.translating) return null;
  return lastLine ?? { seq: 0, kind: 'translation', title: '', text: 'Listening…', original: '…' };
}

const NOTICE_MS = 2600;
const BLINK_MS = 300;
const notice = { text: '', at: 0, seen: false, translating: false };
function modeNotice(now: number): void { 
  const t = !!mode.translating;
  if (!t) { lastLine = null; ideas = null; }
  if (notice.seen && t !== notice.translating) {
    notice.text = `TRANSLATION ${t ? 'ON' : 'OFF'}`;
    notice.at = now;
    screen.wake(now); 
    popupOff = false;
    for (const ms of [BLINK_MS, BLINK_MS * 2, BLINK_MS * 3, BLINK_MS * 4, NOTICE_MS + 50]) setTimeout(() => void render(), ms);
  }
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
  return (it.kind === 'status' && it.title === 'TRANSLATION OFF')
    || (it.kind === 'translation' && !it.original && !it.mine && /^Translating\b/.test(it.text || ''));
}

const read = new ReadAloud();
function readKindFor(it: Item): ReadKind | null {
  if (it.kind !== 'translation' || !it.original) return null; 
  return it.mine ? 'myturn' : 'translations'; 
}

function sayAloud(text: string, language: string, gender: VoiceChoice): void {
  ideaVoice = false; 
  const picked = settings?.phoneVoices?.[language];
  if (picked && read.voices().some((x) => x.voiceURI === picked)) { read.speak(text, LANG_BCP47[language], picked); return; }
  const v = pickVoice(read.voices(), language, gender);
  read.speak(text, LANG_BCP47[language], v.uri || false);
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
    if (!text) return;
    const language = it.speak_in || (it.mine ? settings.translateFrom : settings.translateTo);
    sayAloud(text, language, language === settings.translateFrom ? settings.voiceSpoken : settings.voiceTranslated);
  } finally {
    readInRender = false;
  }
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;


function origShown(item: Item | null | undefined): boolean {
  return !!item && item.kind === 'translation' && !!item.original && settings?.showOriginal !== false;
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
  const lines = item?.kind === 'translation' ? CARD_LINES + 1 : CARD_LINES;
  return origShown(item) ? lines - ORIG_LINES : lines;
}

function bodyText(now = Date.now()): string {
  const item = win.view(now).item;
  const live = settings?.liveWords && liveText && mode.conversing ? `“${liveText}”` : '';
  if (!item) return ' ';
  if (item.kind === 'wake') {
    if (draftText) return `“${draftText}”` + (live && !draftText.endsWith(liveText) ? `\n${live}` : '');
    return live || item.text || listeningDots(now - holdAt);
  }
  const text = item.text || ' ';
  return wrappedLines(text) > cardLines(item) ? fitHead(text, cardLines(item)) : text;
}

function formatTime(atSec: number): string {
  const d = new Date(atSec * 1000);
  const h = d.getHours() % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

function listLayout(): CardLayout | null {
  return picker ? 'langlist' : null;
}

function trLayout(): CardLayout {
  if (settings?.replyIdeas) return 'translationideas';
  return settings?.showOriginal === false ? 'translationsolo' : 'translation';
}
const trFootOff = () => settings?.trFooter === false;
const isTrLayout = (l: CardLayout | null | undefined) => l === 'translation' || l === 'translationsolo' || l === 'translationideas';

let ideas: { list: Idea[]; idx: number; forSeq: number; said: number[] } | null = null;
let ideaSending = false;
function ideasScreenUp(): boolean {
  if (!settings?.replyIdeas || !mode.translating || myTurn || chatOpen || mode.conversing) return false;
  const it = win.item;
  return !it || (it.kind === 'translation' && !!it.original && !it.mine);
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
  if (it.kind === 'translation' && it.mine) return 'myturn'; 
  if (it.kind === 'translation' && it.original) return trLayout();
  return 'card'; 
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

async function drawCardArt(layout: CardLayout): Promise<void> {
  if (!glasses) return;
  for (const [box, r] of Object.entries(LAYOUT_ART[layout]) as [CardBox, { w: number; h: number }][]) {
    const top = box === 'cardA';
    const lang = top ? settings.translateFrom : settings.translateTo;
    const key = `bubble:${top ? 'a' : 'b'}:${lang}:${r.w}x${r.h}`;
    if (!glasses.cardNeeds(box, key)) continue;
    const png = await pngOf(r.w, r.h, (g) => drawBubble(g, r.w, r.h, top, LANG_GLYPH[lang] ?? lang.slice(0, 1)));
    if (glasses.cardNeeds(box, key)) void glasses.showCard(box, key, png);
  }
}

async function renderLayout(item: Item, v: View, now: number, body: string, idle = false): Promise<void> {
  if (!glasses) return;
  const L = glasses.layoutBuilt!;
  const W = (name: string, f: number) => glasses!.boxW(name, f);
  const one = (name: string, s: string) => fitRow(s, W(name, 300) - 10); 
  const pair = (mode.translating || `${settings.translateFrom} → ${settings.translateTo}`).split('→').map((x) => x.trim());
  let text = body;
  if (L === 'translation') {
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
    return;
  } else if (L === 'translationsolo') { 
    text = centerV(fitHead(text, 8), 8);
  } else if (L === 'card') { 
    const clock = item.time || formatTime(typeof item.at === 'number' && item.at > 1e9 ? item.at : now / 1000);
    await glasses.setText(IDS.headerSrc, one('headerSrc', cardHeader(item)));
    await glasses.setText(IDS.headerTime, rightPad(clock, W('headerTime', 110)));
  } else if (L === 'myturn') { 
    await glasses.setText(IDS.origin, bottomV(fitHead(item.text || ' ', 4), 4) || ' ');
    text = fitHead(item.original || ' ', 4);
  }
  const noFoot = trFootOff() && (isTrLayout(L) || L === 'myturn'); 
  if (noFoot) await glasses.setText(IDS.headerSrc, ' ');
  else if (noticeOn(now) && isTrLayout(L)) await glasses.setText(IDS.headerSrc, one('headerSrc', `● ${notice.text}`), noticeLevel(now)); 
  else if (isTrLayout(L)) await glasses.setText(IDS.headerSrc, one('headerSrc', `TRANSLATION · ${langCodes(pair)}`), 3);
  else if (L === 'myturn') await glasses.setText(IDS.headerSrc, one('headerSrc', `YOUR TURN · ${langCodes(langPair(true).split('→').map((x) => x.trim()))}`), 3);
  const timed = !idle && v.secondsLeft > 0 && !win.pinned; 
  const timer = timed ? countdownText(v.secondsLeft) : '';
  await glasses.setText(IDS.bottomDateTime, timer ? rightPad(timer, W('bottomDateTime', 74)) : ' ');
  const hint = isTrLayout(L) ? `Tap: ${L === 'translation' ? 'hide' : 'show'} · Double tap: your turn`
    : L === 'myturn' ? 'Double tap: your turn'
    : bottomHintFor(item, overflowsLayout(L, text) ?? undefined);
  const footRow = isTrLayout(L) || L === 'myturn'; 
  await glasses.setText(IDS.bottomHint, noFoot ? ' ' : footRow ? footHint(capFirstHint(hint), timer, W('bottomHint', 328)) : one('bottomHint', capFirstHint(hint)));
  await glasses.setText(IDS.body, text || ' ');
  await drawCardArt(L);
}

function columnLabels(): string {
  let s = 'REPLY';
  while (getTextWidth(`${s} `) < 286 && s.length < 80) s += ' ';
  return `${s}ASK`;
}

const capFirstHint = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

function cardHeader(item: Item): string {
  const cat = item.source || (item.kind === 'translation' ? 'Translation' : item.kind === 'wake' ? 'Listening' : 'I-Translate');
  let title = (item.title || '').trim();
  title = title.replace(/^[A-Z]{2,}(?: [A-Z]+)?\s*[—–]\s*/, ''); 
  if (/^[A-Z0-9 ]{2,}$/.test(title)) title = title.charAt(0) + title.slice(1).toLowerCase();
  if (!title || title.toLowerCase() === cat.toLowerCase() || title.toLowerCase() === 'status') return cat;
  return `${cat} · ${title}`;
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

function bottomHintFor(item: Item, over = false): string {
  if (item.kind === 'wake') return draftText && mode.conversing ? '▶ TAP TO SEND · double tap: cancel' : ' ';
  if (item.kind === 'translation' && item.original) return 'double tap: your turn to speak';
  if (over) return 'swipe for more · double tap: close';
  return 'double tap: close';
}

async function screenTick(): Promise<void> {
  if (!glasses) return;
  if (chatOpen && !mode.conversing && !mode.awaiting && !holding && !draftText && Date.now() - chatActivity > CHAT_IDLE_MS) return exitMyTurn();
  const now = Date.now();
  if (picker && !mode.translating && timing.idleSleepMs > 0 && now - lastGestureAt > Math.max(timing.idleSleepMs, PICKER_IDLE_MIN_MS)) return closePicker();
  const step = screen.update(now, { quiet: displayQuiet(now), busy: screenBusy(now), popup: popupOff });
  if (step === 'wake') return render();
  if (step === 'sleep') await goDark();
}

let popupOff = false; 
const modeQuiet = new ModeQuiet();

function displayQuiet(now = Date.now()): boolean {
  if (modeLayout()) return modeQuiet.quiet(now, timing.idleSleepMs);
  return true;
}

let wasTranslating = false;
async function noteModeChange(now: number): Promise<void> {
  const ended = wasTranslating && !mode.translating;
  if (!wasTranslating && mode.translating) modeQuiet.activity(now); 
  wasTranslating = !!mode.translating;
  if (!ended || !glasses) return;
  popupOff = false;
  screen.wake(now);
  const fx = win.endMode(mode);
  if (fx.length) await apply(fx);
}

function screenBusy(now: number): boolean {
  return !!(noticeOn(now) || win.item || chatOpen || holding || sending || win.busy || picker || mode.conversing || mode.awaiting);
}

let darkJob: Promise<void> | null = null;
function goDark(): Promise<void> {
  if (darkJob) return darkJob;
  darkJob = (async () => {
    if (!glasses) return;
    picker = null;
    chatOpen = false;
    const lay = glasses.layoutBuilt;
    const ok = await glasses.blank(); 
    if (!ok) { 
      if (lay) {
        await Promise.race([
          Promise.all((Object.entries(LAYOUT_ART[lay]) as [CardBox, { w: number; h: number }][]).map(async ([box, r]) => {
            const png = blackArt[`${r.w}x${r.h}`] ??= await pngOf(r.w, r.h, () => undefined);
            if (glasses!.cardNeeds(box, 'dark')) await glasses!.showCard(box, 'dark', png);
          })),
          new Promise((r) => setTimeout(r, 4000)),
        ]);
      }
      for (const id of [IDS.headerSrc, IDS.body, IDS.bottomDateTime, IDS.bottomHint]) await glasses.setText(id, ' ');
    }
    renderPhone();
  })().finally(() => { darkJob = null; });
  return darkJob;
}

async function maybeDark(now: number): Promise<boolean> {
  if (!glasses || screen.off || !displayQuiet(now)) return false;
  const step = screen.update(now, { quiet: true, busy: screenBusy(now), popup: popupOff });
  if (step !== 'sleep') return false;
  await goDark();
  return true;
}

let animBusy = false;
let animWas = false;
async function animTick(): Promise<void> {
  if (!glasses || screen.off || animBusy) return;
  const active = holding;
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
  if (screen.off && win.item) screen.showForCard(); 
  if (screen.off) return;
  const now = Date.now();
  if (glasses.page === 'dark') { 
    chatOpen = false;
    glasses.menu = { translating: !!mode.translating };
    await glasses.setPage('normal', { body: ' ' });
  }
  if (await maybeDark(now)) return; 
  await glasses.refreshMenu({ translating: !!mode.translating }); 
  if (picker) { 
    if (glasses.page === 'langs' && glasses.layoutBuilt) await drawCardArt(glasses.layoutBuilt);
    return;
  }
  await glasses.syncLayout(); 
  if (chatOpen && glasses.page === 'chat') return renderChat(now);
  if (glasses.page !== 'normal') return; 
  const v = win.view(now);
  const item = v.item;
  const shown = item ?? modeItem(); 
  if (shown && glasses.layoutBuilt) return renderLayout(shown, v, now, item ? bodyText(now) : shown.text || ' ', !item);
  await glasses.setText(IDS.body, ' '); 
}

let waitSince = 0; 
function waitClock(ms: number): string {
  const sec = Math.max(0, Math.floor(ms / 1000));
  return sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, '0')}s`;
}

function turnStatus(): string {
  if (!relay.online) return '○ OFFLINE';
  return mode.awaiting ? '◌ TRANSLATING' : '● YOUR TURN';
}

async function renderChat(now: number): Promise<void> {
  if (!glasses) return;
  const live = settings?.liveWords && mode.conversing ? liveText : '';
  const current = turnView(turns, { draft: draftText, live, held: holding, nothingHeard, sinceHold: now - holdAt });
  const last = turns[turns.length - 1];
  const question = last?.q || '';
  const answer = last?.a || '';
  const asking = holding || !!draftText || !!live || nothingHeard; 
  let body: string;
  if (last?.a && !asking) body = `You: ${question}\n\n${settings.translateFrom}: ${answer}`;
  else if (draftText) body = `You: “${draftText}”`;
  else if (current === '…') body = win.busy || sending ? `Translating into ${settings.translateFrom}…` : 'Not translated. Tap to say it again.';
  else body = current || ' ';
  const waitingT = !!mode.awaiting || !!win.busy || sending;
  if (waitingT && !waitSince) waitSince = now;
  if (!waitingT) waitSince = 0;
  const [mine, theirs] = langPair(true).split('→').map((x) => x.trim());
  const answered = !!last?.a && !asking;
  const translating = !answered && current === '…'; 
  const said = answered || translating ? question : body.replace(/^You:\s*/, '').replace(/^“|”$/g, '');
  const transl = answered ? answer : translating ? body : ' ';
  await glasses.setText(IDS.origin, bottomV(fitHead(transl === '…' ? 'Translating…' : transl || ' ', 4), 4) || ' ');
  await glasses.setText(IDS.body, (answered || translating ? fitHead(said || ' ', 4) : fitTail(said || ' ', 4)) || ' ');
  const off = trFootOff();
  await glasses.setText(IDS.headerSrc, off ? ' ' : fitRow(`${turnStatus()} · ${langCodes([mine, theirs])}`, glasses.boxW('headerSrc', 306) - 10));
  const tapHint = holding ? 'Tap: send' : sending || win.busy ? '' : 'Tap: again';
  await glasses.setText(IDS.bottomHint, off ? ' ' : footHint(tapHint ? `${tapHint} · Double tap: back` : 'Double tap: back', waitingT ? waitClock(now - waitSince) : '', glasses.boxW('bottomHint', 328)));
}

async function startHold(now: number): Promise<void> {
  if (holding || !glasses || picker) return;
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
    const res = await relay.control({ action: 'hold' }).catch(() => null);
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

async function endHold(): Promise<void> {
  if (!holding) return;
  await holdStarting;
  if (!holding) return; 
  holding = false;
  uiGen++;
  sending = true;
  const said = (draftText + (liveText && !draftText.endsWith(liveText) ? ` ${liveText}` : '')).trim();
  turns.push({ q: said || '…', a: '' });
  draftText = '';
  liveText = '';
  mode = { ...mode, awaiting: true };
  win.busy = { label: 'translating', since: Date.now() };
  await render();
  let sent = false;
  let heardNothing = false;
  try {
    await relay.control({ action: 'release' }).catch(() => null);
    await syncMic(); 
    const res = await relay.control({ action: 'send' }).catch((e) => {
      heardNothing = String(e).includes('409'); 
      return null;
    });
    sent = !!res;
    if (res?.mode) mode = res.mode;
  } finally {
    sending = false;
    uiGen++;
  }
  if (!sent) { 
    const last = turns[turns.length - 1];
    if (last && !last.a) turns.pop();
    win.busy = null;
    mode = { ...mode, awaiting: false, conversing: false };
    if (heardNothing) nothingHeard = true;
  }
  await syncMic();
  await render();
}

async function onMenu(id: number | undefined): Promise<void> {
  const now = Date.now();
  if (screen.wake(now)) await render(); 
  tapGuard.menuActivity(now); 
  if (id === MENU_ID.translateStart || id === MENU_ID.translateTo) await openSetup(); 
  if (id === MENU_ID.translateStop) await stopTranslation();
  renderPhone();
  await render(); 
}

async function openChat(): Promise<void> {
  if (!glasses || chatOpen || picker) return;
  chatOpen = true;
  chatActivity = Date.now();
  win.holdPopups = true; 
  await glasses.setPage('chat', { body: ' ' });
}

async function closeChat(): Promise<void> {
  if (!chatOpen || !glasses) return;
  chatOpen = false;
  nothingHeard = false;
  turns = [];
  win.holdPopups = false;
  const toDark = darkAfterTurn;
  darkAfterTurn = false;
  if (win.item && (win.item.kind === 'wake' || win.item.kind === 'status')) win.close(); 
  const waited = win.next(Date.now()); 
  if (toDark) { 
    popupOff = true;
    if (!waited.length && (await maybeDark(Date.now()))) return;
  }
  await glasses.setPage('normal', { body: ' ' });
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
    if (f.type === 'clear') afterClose(); 
  }
  await render();
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

const tapGuard = new TapGuard();

async function onEvent(e: EvenHubEvent): Promise<void> {
  if (e.audioEvent) return onAudio(e.audioEvent);
  if (e.sysEvent?.imuData) return; 
  const et = eventType(e);
  if (et === OsEventTypeList.SYSTEM_EXIT_EVENT || et === OsEventTypeList.ABNORMAL_EXIT_EVENT) return appClosing(et === OsEventTypeList.SYSTEM_EXIT_EVENT ? 'exit' : 'abnormal exit');
  lastGestureAt = Date.now();
  if (!e.menuItemClickEvent && !mode.translating && !picker && !myTurn && !win.item && !chatOpen
    && (et === OsEventTypeList.CLICK_EVENT || et === OsEventTypeList.DOUBLE_CLICK_EVENT)) {
    if (!tapGuard.allows(et, Date.now())) return;
    screen.wake(Date.now());
    popupOff = false;
    return openSetup();
  }
  screen.activity(Date.now());
  if (!win.item) popupOff = false; 
  modeQuiet.activity(Date.now()); 
  if (e.menuItemClickEvent) return onMenu((e.menuItemClickEvent as { itemID?: number }).itemID);
  const now = Date.now();
  const type = et;
  if (type === OsEventTypeList.FOREGROUND_ENTER_EVENT || type === OsEventTypeList.FOREGROUND_EXIT_EVENT) tapGuard.menuActivity(now);
  if (!tapGuard.allows(type, now)) return; 
  read.unlockSilently(); 
  if (type === OsEventTypeList.CLICK_EVENT && read.speaking) read.stop(); 
  if (type === OsEventTypeList.LONG_PRESS_EVENT || type === OsEventTypeList.LONG_PRESS_RELEASE_EVENT) return;
  if (myTurn && chatOpen) {
    if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) return exitMyTurn();
    if (type === OsEventTypeList.CLICK_EVENT) {
      if (holding) return endHold();
      if (sending || win.busy) return; 
      return startHold(now);
    }
    return;
  }
  if (screen.off) {
    if (type !== OsEventTypeList.DOUBLE_CLICK_EVENT) return;
    screen.wake(now);
    if (mode.translating) { popupOff = false; return startMyTurn(now); }
    return render();
  }
  if (picker) {
    if (type === OsEventTypeList.CLICK_EVENT) {
      const i = e.listEvent ? pickedIndex(e.listEvent, picker) : 0;
      if (pickerSide === 'setup') return setupPick(i);
      return setupSide(pickerSide, picker[i]);
    }
    if (type === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      if (pickerSide !== 'setup') return openSetup();
      if (setupExits()) return requestExit();
      return closePicker();
    }
    return; 
  }
  if (ideasScreenUp()) {
    if (type === OsEventTypeList.SCROLL_BOTTOM_EVENT || type === OsEventTypeList.SCROLL_TOP_EVENT)
      return moveIdea(type === OsEventTypeList.SCROLL_BOTTOM_EVENT ? 1 : -1);
    if (type === OsEventTypeList.CLICK_EVENT) return pickIdea();
  }
  const trLine = win.item?.kind === 'translation' && !!win.item.original;
  if (type === OsEventTypeList.CLICK_EVENT && trLine && win.item!.mine) return;
  if (type === OsEventTypeList.CLICK_EVENT && (trLine || (!win.item && !chatOpen && !mode.conversing && mode.translating))) return toggleOriginal();
  switch (type) {
    case OsEventTypeList.CLICK_EVENT: { 
      const fx = win.press(now);
      if (!win.item) popupOff = false;
      return apply(fx);
    }
    case OsEventTypeList.DOUBLE_CLICK_EVENT: {
      const theirLine = !!win.item && win.item.kind === 'translation' && !!win.item.original;
      if (mode.translating && (!win.item || theirLine) && !holding && !chatOpen && !mode.awaiting) return startMyTurn(now);
      if (win.item) { popupOff = false; return apply(win.close(now)); }
      return;
    }
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
  return !mode.translating;
}
async function requestExit(): Promise<void> {
  if (!bridge) return;
  try { await bridge.shutDownPageContainer(1); } catch {  }
}

async function toggleOriginal(): Promise<void> {
  settings.showOriginal = settings.showOriginal === false;
  await save(store, settings).catch(() => undefined);
  renderPhone(); 
  await render();
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
  if (fromPhone) darkAfterTurn = true;
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


async function openPicker(side: 'from' | 'to'): Promise<void> {
  if (!glasses) return;
  lastGestureAt = Date.now();
  screen.wake(lastGestureAt); 
  pickerSide = side;
  picker = pickerOrder(LANGUAGES, side === 'from' ? settings.translateFrom : settings.translateTo);
  await glasses.setPage('langs', { bottomStatus: side === 'from' ? 'THEY SPEAK' : 'YOU READ', bottomHint: 'Tap a language · double tap: back', body: ' ', langs: picker }, true);
  await render();
}

function setupRows(): string[] {
  const names = `${settings.translateFrom} → ${settings.translateTo}`;
  const pair = names.length <= 28 ? names : langCodes([settings.translateFrom, settings.translateTo]);
  return [`▶ ${mode.translating ? 'Restart' : 'Start'}   ${pair}`, `They speak:  ${settings.translateFrom}`, `You read:  ${settings.translateTo}`, '↔ Swap languages'];
}
async function openSetup(): Promise<void> {
  if (!glasses) return;
  lastGestureAt = Date.now();
  screen.wake(lastGestureAt);
  pickerSide = 'setup';
  picker = setupRows();
  await glasses.setPage('langs', { bottomStatus: `I-TRANSLATE · ${langCodes([settings.translateFrom, settings.translateTo])}`,
    bottomHint: `Tap: choose · double tap: ${setupExits() ? 'exit' : 'close'}`, body: ' ', langs: picker }, true);
  await render();
}
async function setupPick(i: number): Promise<void> {
  if (i === 0) return startTranslation(settings.translateFrom);
  if (i === 1) return openPicker('from');
  if (i === 2) return openPicker('to');
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

async function closePicker(): Promise<void> {
  if (!picker || !glasses) return;
  picker = null;
  await glasses.setPage(basePage(), { body: bodyText() });
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
function beginSwitch(next: Mode): Mode {
  const before = mode;
  modeSwitching++;
  mode = next;
  if (glasses) glasses.menu = { translating: !!mode.translating };
  return before;
}
async function endSwitch(body: Record<string, unknown>, before: Mode): Promise<void> {
  try {
    const res = await relay.control(body).catch(() => null);
    mode = res?.mode ?? before;
  } finally {
    modeSwitching--;
    switchesDone++;
  }
  await render();
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


function onAudio(a: { audioPcm: Uint8Array }): void {
  if (!a.audioPcm?.length) return;
  const phoneSpeaking = !!mode.translating && !ideaVoice && (read.speaking || Date.now() - read.endedAt < 800);
  const keep = !phoneSpeaking;
  mic.frame(Date.now());
  pcm.push(keep ? a.audioPcm : new Uint8Array(a.audioPcm.length));
  pcmBytes += a.audioPcm.length;
  if (pcmBytes >= AUDIO_FLUSH_BYTES) flushAudio(); 
}

function heartbeat(): void {
  const now = Date.now();
  if (holding && now - holdAt > HOLD_MAX_MS) endHold();
  if (glasses && mic.needsRearm(now, micOn)) {
    mic.armed(now);
    syncMic(true); 
  }
  if (relay.ready()) relay.control({ action: 'telemetry' }).catch(() => undefined);
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
    const res = await relay.audio(out);
    if (res.mode) mode = res.mode;
  } catch {
  } finally {
    audioSending = false;
  }
  if (pcmBytes >= AUDIO_FLUSH_BYTES) flushAudio(); 
}

async function syncMic(force = false): Promise<void> {
  if (!glasses || !pageReady) return; 
  const want = !mode.awaiting && !!mode.translating; 
  const source: 'glasses' | 'phone' = myTurn && (holding || sending) ? settings.myTurnMic : settings.translateMic === 'phone' ? 'phone' : 'glasses';
  if (want !== micOn || (force && want) || (want && source !== micSource)) {
    if (micOn && source !== micSource) await glasses.mic(false, micSource).catch(() => false); 
    const ok = await glasses.mic(want, source).catch(() => false);
    micSource = source;
    micOn = want && ok;
    if (want) mic.armed(Date.now());
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
    mode = got.mode ? (stale ? { ...got.mode, translating: mode.translating } : got.mode) : mode;
    if (!notice.seen) { notice.seen = true; notice.translating = !!mode.translating; } 
    replySeq = got.seq;
    replySig = got.sig || '';
    modeQuiet.heard(got.heard_s, Date.now()); 
    for (const it of got.items as unknown as Item[]) {
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
      if (it.kind === 'translation') modeQuiet.activity(Date.now()); 
      if (staleModeItem(it, mode)) continue; 
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
      it.pushed = true;
      if (!mode.conversing && !chatOpen && !mode.awaiting && !holding) popupOff = true; 
      await apply(win.offer(it, Date.now()));
    }
    if (myTurn && !mode.translating) await exitMyTurn(); 
    if (mode.conversing && !chatOpen) await openChat();
    if (before && !mode.conversing && win.item?.kind === 'wake') await apply(win.close());
    if (chatOpen && !myTurn && !mode.conversing && !turns.length && !draftText && !holding && !sending && !nothingHeard) await closeChat();
    await syncMic();
  } catch {
  }
  await render();
  renderPhone();
}

const TABS = ['translate', 'history', 'settings'];
let tabAutoSetup = false; 

function showTab(name: string): void {
  if (!TABS.includes(name)) name = 'translate';
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
    voice: 'iPhone',
  };
  document.querySelectorAll<HTMLElement>('[data-sum]').forEach((el) => { el.textContent = sums[el.dataset.sum || ''] ?? ''; });
}

function updateVoiceNotes(): void {
  const side = (which: 'spoken' | 'translated', language: string, gender: VoiceChoice) => {
    const sel = document.getElementById(`voice-${which}`) as HTMLSelectElement | null;
    if (!sel) return;
    const lbl = document.getElementById(`lbl-voice-${which}`);
    if (lbl) lbl.textContent = `Voice for ${language} (${which === 'spoken' ? 'spoken' : 'translated'} language)`;
    const note = document.getElementById(`note-voice-${which}`);
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
    if (note) {
      note.textContent = !LANG_BCP47[language] || !v.uri
        ? `No ${language} voice on this phone: the phone's default voice is used. Add voices in iPhone Settings > Accessibility > Spoken Content > Voices.`
        : v.matched ? `Will use: ${v.name}` : `No ${gender} ${language} voice on this phone: using ${v.name}. Add more in iPhone Settings > Accessibility > Spoken Content > Voices.`;
    }
  };
  side('spoken', settings.translateFrom, settings.voiceSpoken);
  side('translated', settings.translateTo, settings.voiceTranslated);
}

async function pickSideVoice(which: 'spoken' | 'translated'): Promise<void> {
  read.unlockAudio();
  const sel = $(`voice-${which}`) as HTMLSelectElement;
  const language = which === 'spoken' ? settings.translateFrom : settings.translateTo;
  if (sel.value === 'female' || sel.value === 'male') { 
    const { [language]: _gone, ...rest } = settings.phoneVoices ?? {};
    settings.phoneVoices = rest;
    if (which === 'spoken') settings.voiceSpoken = sel.value;
    else settings.voiceTranslated = sel.value;
  } else settings.phoneVoices = { ...settings.phoneVoices, [language]: sel.value }; 
  await save(store, settings);
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
  const micBox = document.getElementById('tr-mic');
  if (line && micBox && c.line + c.mic !== trControls) { trControls = c.line + c.mic; line.innerHTML = c.line; micBox.innerHTML = c.mic; }
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
    else if (act === 'send' && myTurn && holding) await endHold();
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
  $('status').textContent = !relay.ready() ? 'Add API keys' : mode.translating ? `Translating · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : 'Ready';
  $('status-dot').className = `dot ${!relay.ready() ? 'warn' : mode.translating ? 'rec' : 'ok'}`;
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
  if (synthObj) synthObj.onvoiceschanged = () => updateVoiceNotes();
  buildSegs(); 
  $('btn-swap').onclick = () => void pickSide('from', settings.translateTo); 
  $('btn-read-test').onclick = () => { 
    read.unlockAudio();
    read.unlockSilently();
    read.test();
    renderPhone();
  };
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
    glasses.onBuilt = () => void render(); 
    glasses.layoutFor = (kind) => (kind === 'langs' ? listLayout() : kind === 'chat' ? 'myturn'
      : kind === 'normal' ? layoutForItem(win.item) ?? (win.item ? null : modeLayout()) : null);
    pageReady = await glasses.create({ body: ' ' });
    if (!pageReady) console.warn('glasses page was not created');
    bridge.onEvenHubEvent((e) => {
      onEvent(e);
    });
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
  setInterval(screenTick, 1000);
  setInterval(animTick, ANIM_MS); 
  setInterval(heartbeat, HEARTBEAT_MS);
  await pollReplies();
  await syncMic();
  if (glasses && !mode.translating) await openSetup();
}

main();
