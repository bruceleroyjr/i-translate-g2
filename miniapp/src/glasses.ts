
import {
  AudioInputSource,
  ImuReportPace,
  ImageRawDataUpdateResult,
  StartUpPageCreateResult,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk';
import { getTextWidth } from '@evenrealities/pretext';
import { CHOICES, SEND_CHOICES, capFirst, type Frame } from './window.ts';

export const IDS = {
  avatar: { containerID: 1, containerName: 'avatar' },
  header: { containerID: 3, containerName: 'header' }, 
  body: { containerID: 4, containerName: 'body' },
  countdown: { containerID: 5, containerName: 'countdown' }, 
  footer: { containerID: 6, containerName: 'footer' }, 
  choice: { containerID: 8, containerName: 'choice' },
  langs: { containerID: 9, containerName: 'langs' },
  status: { containerID: 10, containerName: 'status' }, 
  history: { containerID: 11, containerName: 'history' }, 
  question: { containerID: 13, containerName: 'question' }, 
  mic: { containerID: 12, containerName: 'mic' }, 
  log0: { containerID: 14, containerName: 'log0' },
  log1: { containerID: 15, containerName: 'log1' },
  log2: { containerID: 16, containerName: 'log2' },
  trayL: { containerID: 17, containerName: 'trayL' },
  trayR: { containerID: 18, containerName: 'trayR' },
  artL: { containerID: 27, containerName: 'artL' },
  artR: { containerID: 28, containerName: 'artR' },
  headerSrc: { containerID: 19, containerName: 'headerSrc' },
  headerTitle: { containerID: 20, containerName: 'headerTitle' },
  headerTime: { containerID: 21, containerName: 'headerTime' },
  headerDivider: { containerID: 22, containerName: 'headerDivider' },
  bottomStatus: { containerID: 23, containerName: 'bottomStatus' },
  bottomHint: { containerID: 24, containerName: 'bottomHint' },
  bottomDateTime: { containerID: 25, containerName: 'bottomDateTime' },
  origin: { containerID: 26, containerName: 'origin' },
  homeRow0: { containerID: 29, containerName: 'homeRow0' },
  homeRow1: { containerID: 30, containerName: 'homeRow1' },
  homeRow2: { containerID: 31, containerName: 'homeRow2' },
  homeBattery: { containerID: 32, containerName: 'homeBattery' },
};
export const HOME_ROW_IDS = [IDS.homeRow0, IDS.homeRow1, IDS.homeRow2];
export const CARD_IDS = {
  cardA: { containerID: 35, containerName: 'cardA' },
  cardB: { containerID: 36, containerName: 'cardB' },
  cardC: { containerID: 37, containerName: 'cardC' },
};
export type CardBox = keyof typeof CARD_IDS;

export type CardLayout = 'lifelog' | 'news' | 'mail' | 'talk' | 'cue' | 'translation' | 'calendar' | 'hermes' | 'myturn'
  | 'cuesolo' 
  | 'translationsolo' 
  | 'translationideas' 
  | 'newslist' | 'langlist' | 'meetlist' 
  | 'maillist' | 'loglist' | 'chatlist' | 'callist' 
  | 'approve'; 
type R = { x: number; y: number; w: number; h: number };
export const LAYOUT_ART: Record<CardLayout, Partial<Record<CardBox, R>>> = {
  lifelog: { cardA: { x: 0, y: 0, w: 200, h: 144 }, cardB: { x: 0, y: 144, w: 200, h: 144 } },
  news: { cardA: { x: 0, y: 0, w: 288, h: 112 }, cardB: { x: 288, y: 0, w: 288, h: 112 } },
  mail: { cardA: { x: 380, y: 0, w: 196, h: 144 }, cardB: { x: 380, y: 144, w: 196, h: 144 } },
  talk: { cardA: { x: 396, y: 0, w: 180, h: 144 }, cardB: { x: 396, y: 144, w: 180, h: 144 } }, 
  cue: {}, cuesolo: {}, 
  translation: {}, translationsolo: {}, translationideas: {}, 
  calendar: { cardA: { x: 360, y: 0, w: 216, h: 144 }, cardB: { x: 360, y: 144, w: 216, h: 144 }, cardC: { x: 8, y: 0, w: 288, h: 72 } },
  hermes: { cardA: { x: 360, y: 0, w: 216, h: 144 }, cardB: { x: 360, y: 144, w: 216, h: 144 } },
  myturn: {}, 
  newslist: { cardA: { x: 0, y: 0, w: 288, h: 112 }, cardB: { x: 288, y: 0, w: 288, h: 112 } }, 
  langlist: { cardA: { x: 400, y: 0, w: 176, h: 144 }, cardB: { x: 400, y: 144, w: 176, h: 144 } }, 
  meetlist: { cardA: { x: 0, y: 0, w: 144, h: 144 } }, 
  maillist: { cardA: { x: 380, y: 0, w: 196, h: 144 }, cardB: { x: 380, y: 144, w: 196, h: 144 } }, 
  loglist: { cardA: { x: 376, y: 0, w: 200, h: 144 }, cardB: { x: 376, y: 144, w: 200, h: 144 } }, 
  chatlist: { cardA: { x: 360, y: 0, w: 216, h: 144 }, cardB: { x: 360, y: 144, w: 216, h: 144 } }, 
  callist: { cardA: { x: 360, y: 0, w: 216, h: 144 }, cardB: { x: 360, y: 144, w: 216, h: 144 } }, 
  approve: { cardA: { x: 360, y: 0, w: 216, h: 144 }, cardB: { x: 360, y: 144, w: 216, h: 144 } }, 
};
export const ART_FILE: Partial<Record<CardLayout, CardLayout>> = { newslist: 'news', langlist: 'translation', 
  maillist: 'mail', loglist: 'lifelog', chatlist: 'hermes', 
  callist: 'calendar', approve: 'hermes' };
export const LIST_LAYOUT: Partial<Record<CardLayout, { list: R; status: R; hint: R }>> = {
  newslist: { list: { x: 8, y: 116, w: 560, h: 136 }, status: { x: 8, y: 256, w: 148, h: 28 }, hint: { x: 160, y: 256, w: 408, h: 28 } },
  langlist: { list: { x: 8, y: 4, w: 384, h: 212 }, status: { x: 8, y: 222, w: 384, h: 28 }, hint: { x: 8, y: 254, w: 384, h: 28 } },
  meetlist: { list: { x: 152, y: 4, w: 416, h: 212 }, status: { x: 8, y: 222, w: 560, h: 28 }, hint: { x: 8, y: 254, w: 560, h: 28 } },
  maillist: { list: { x: 8, y: 4, w: 364, h: 212 }, status: { x: 8, y: 222, w: 364, h: 28 }, hint: { x: 8, y: 254, w: 364, h: 28 } },
  loglist: { list: { x: 8, y: 4, w: 360, h: 212 }, status: { x: 8, y: 222, w: 360, h: 28 }, hint: { x: 8, y: 254, w: 360, h: 28 } },
  chatlist: { list: { x: 8, y: 4, w: 344, h: 212 }, status: { x: 8, y: 222, w: 344, h: 28 }, hint: { x: 8, y: 254, w: 344, h: 28 } },
  callist: { list: { x: 8, y: 4, w: 344, h: 212 }, status: { x: 8, y: 222, w: 344, h: 28 }, hint: { x: 8, y: 254, w: 344, h: 28 } },
};

type TB = [keyof typeof IDS, number, number, number, number, number, Record<string, unknown>?];
const L = 27; 
const FOOT_ROW: TB[] = [['headerSrc', 8, 256, 232, 28, 3], ['bottomHint', 240, 256, 328, 28, 2]];
const CENTRE_PAIR: TB[] = [['origin', 8, 10, 560, 4 * L, 2], ['log1', 8, 118, 560, 2, 2, { borderWidth: 1, borderColor: 2 }],
  ['body', 8, 124, 560, 4 * L, 4]];
const CUE_FOOT: TB[] = [['headerSrc', 8, 256, 560, 28, 2], ['bottomHint', 8, 256, 560, 28, 2]];
export const LAYOUT_TEXT: Record<CardLayout, TB[]> = {
  lifelog: [['headerSrc', 214, 0, 204, 28, 3], ['headerTime', 418, 0, 150, 28, 3], ['headerDivider', 214, 30, 354, 2, 2, { borderWidth: 1, borderColor: 2 }],
    ['body', 214, 36, 354, 7 * L, 4], ['bottomHint', 214, 256, 280, 28, 2], ['bottomDateTime', 494, 256, 74, 28, 2]],
  news: [['headerSrc', 8, 114, 380, 28, 3], ['headerTime', 388, 114, 180, 28, 3], ['headerDivider', 8, 143, 560, 2, 2, { borderWidth: 1, borderColor: 2 }],
    ['body', 8, 148, 560, 4 * L, 4], ['bottomHint', 8, 258, 480, 28, 2], ['bottomDateTime', 494, 258, 74, 28, 2]],
  mail: [['headerDivider', 4, 60, 368, 190, 2, { borderWidth: 1, borderColor: 2, borderRadius: 6 }], 
    ['headerSrc', 8, 0, 364, 28, 4], ['headerTime', 8, 28, 364, 28, 3],
    ['body', 16, 66, 346, 6 * L, 4], ['bottomHint', 8, 256, 290, 28, 2], ['bottomDateTime', 298, 256, 74, 28, 2]],
  talk: [['log2', 8, 34, 383, 216, 3, { borderWidth: 1, borderColor: 3, borderRadius: 10 }], 
    ['headerSrc', 8, 0, 317, 28, 3], ['bottomDateTime', 325, 0, 66, 28, 2],
    ['origin', 20, 40, 359, 7 * L, 0], ['body', 20, 40, 359, 7 * L, 4], ['bottomHint', 8, 256, 383, 28, 2]],
  cue: [['origin', 8, 0, 560, 4 * L, 0], CENTRE_PAIR[1], CENTRE_PAIR[2], ...CUE_FOOT],
  cuesolo: [['body', 8, 0, 560, 9 * L, 4], ...CUE_FOOT],
  translation: [['origin', 8, 0, 560, 9 * L, 0], ['body', 8, 0, 560, 9 * L, 4], ...FOOT_ROW],
  translationsolo: [['body', 8, 10, 560, 8 * L, 4], ...FOOT_ROW],
  translationideas: [['origin', 8, 0, 560, 2 * L, 0], 
    ['question', 8, 0, 560, 6 * L, 4], ['body', 8, 0, 560, 6 * L, 4], 
    ['headerDivider', 8, 165, 560, 2, 2, { borderWidth: 1, borderColor: 2 }], ['bottomStatus', 8, 170, 560, L + 1, 2],
    ['log0', 8, 200, 276, 2 * L, 2], ['log2', 296, 200, 272, 2 * L, 2], ['headerSrc', 8, 258, 560, L + 1, 2]],
  calendar: [['body', 12, 80, 340, 4 * L, 4], ['bottomStatus', 12, 188, 340, 28, 2], ['bottomHint', 12, 254, 280, 28, 2], ['bottomDateTime', 294, 254, 58, 28, 2]],
  hermes: [['log2', 8, 34, 348, 216, 3, { borderWidth: 1, borderColor: 3, borderRadius: 10 }], 
    ['headerSrc', 8, 0, 238, 28, 3], ['headerTime', 246, 0, 110, 28, 2], 
    ['body', 20, 40, 324, 7 * L, 4], ['bottomHint', 8, 256, 280, 28, 2], ['bottomDateTime', 290, 256, 66, 28, 2]],
  myturn: [...CENTRE_PAIR, ...FOOT_ROW],
  newslist: [], langlist: [], meetlist: [], maillist: [], loglist: [], chatlist: [], callist: [], approve: [], 
};

function listLayoutSpec(layout: CardLayout, t: Texts) {
  const L = LIST_LAYOUT[layout]!;
  const images = Object.entries(LAYOUT_ART[layout]).map(([box, r], i) => ({ ...CARD_IDS[box as CardBox], xPosition: r!.x, yPosition: r!.y, width: r!.w, height: r!.h, zOrderIndex: 1 + i }));
  const names = (t.langs ?? []).slice(0, 20).map((n) => n.slice(0, 40));
  return {
    containerTotalNum: images.length + 3,
    imageObject: images,
    textObject: [
      text(IDS.bottomStatus, L.status.x, L.status.y, L.status.w, L.status.h, t.bottomStatus ?? t.header, 6, { textColor: 4 }),
      text(IDS.bottomHint, L.hint.x, L.hint.y, L.hint.w, L.hint.h, capFirst(t.bottomHint ?? ' '), 7, { textColor: 3 }),
    ],
    listObject: [{
      ...IDS.langs, xPosition: L.list.x, yPosition: L.list.y, width: L.list.w, height: L.list.h, zOrderIndex: 8, isEventCapture: 1,
      borderWidth: 0, paddingLength: 2,
      itemContainer: { itemCount: names.length, itemWidth: L.list.w - 4, isItemSelectBorderEn: 1, itemName: names },
    }],
  };
}

function layoutSpec(layout: CardLayout, t: Texts) {
  const images = Object.entries(LAYOUT_ART[layout]).map(([box, r], i) => ({ ...CARD_IDS[box as CardBox], xPosition: r!.x, yPosition: r!.y, width: r!.w, height: r!.h, zOrderIndex: 1 + i }));
  const texts = LAYOUT_TEXT[layout].map(([name, x, y, w, h, lvl, extra], i) =>
    text(IDS[name], x, y, w, h, name === 'body' ? t.body : ' ', 10 + i, { textColor: lvl, ...(name === 'body' ? { isEventCapture: 1 } : {}), ...(extra ?? {}) }));
  return { containerTotalNum: images.length + texts.length, imageObject: images, textObject: texts };
}
export const HOME_HEAD_H = 28;
export const HOME_BATTERY = { x: 14, y: 0, w: 98, h: 28 }; 
export const HOME_MID = { x: 116, w: 236 }; 
export const HOME_TIME = { x: 352, w: 216 }; 
export const HOME_LIST = { x: 4, y: 30, w: 364, h: 257 };
export const HOME_ROW = { x: 6, y: 31, w: 360, h: 84, pitch: 86 }; 
export const HOME_ART = { x: 372, y: 30, w: 204, h: 129 }; 
export const TRAY_Y = 2;
export const TRAY_H = 144;
export const HOME_AVATAR = 48;
export const HOME_AVATAR_X = 264; 
export const HOME_AVATAR_Y = TRAY_Y + TRAY_H + 4; 
export const HOME_LINE_Y = [200, 228, 256]; 
export const HOME_W = 560;
export const HEADER_Y = 0;
export const HEADER_H = 28;
export const DIVIDER_Y = 29;
export const DIVIDER_H = 2;
export const BODY_Y = 36;
export const BODY_H = 189; 
export const BOTTOM_Y = 226;
export const BOTTOM_H = 56; 
export const BARE_BODY_Y = 4;
export const BARE_BODY_H = BODY_H + BODY_Y - BARE_BODY_Y; 
export const BARE_STATUS_W = 440; 
export const BARE_TIME_X = 504;
export const BARE_TIME_W = 72; 
export const ORIG_H = 56; 
export const BOTTOM_STATUS_Y = 226;
export const BOTTOM_HINT_Y = 254;
export const BOTTOM_ROW_H = 28;
export const HEADER_SRC_X = 8;
export const HEADER_SRC_W = 176;
export const HEADER_TITLE_X = 192;
export const HEADER_TITLE_W = 192;
export const HEADER_TIME_X = 392;
export const HEADER_TIME_W = 176;
export const BOTTOM_X = 64;
export const BOTTOM_W = 496; 
export const LOG_IDS = [IDS.log0, IDS.log1, IDS.log2];

export const AVATAR = 48; 
export const IMAGE_TIMEOUT_MS = 5000; 
export const LINK_WAIT_MS = 6000;
export const LINK_WAIT_IMAGE_MS = 3000;
export const AVATAR_X = 8; 
export const AVATAR_Y = 232; 

export const MENU_ID = { meetingStart: 1, meetingStop: 7, topNews: 3, translateStart: 4, translateStop: 5, pause: 8, resume: 9, imuProbe: 10, translateTo: 11 } as const;
export interface MenuState { meeting: boolean; translating: boolean; listening: boolean }
export function menuFor(m: MenuState) {
  return {
    menuItems: [
      m.translating ? { itemName: 'Stop Translation', itemID: MENU_ID.translateStop } : { itemName: 'Start Translation', itemID: MENU_ID.translateStart },
      { itemName: 'Change Languages', itemID: MENU_ID.translateTo },
    ],
  };
}

type Id = { containerID: number; containerName: string };
export type TrayBox = 'trayL' | 'trayR' | 'artL' | 'artR';
export type Page = 'normal' | 'approval' | 'confirm' | 'langs' | 'chat' | 'dark';

const text = (id: Id, x: number, y: number, w: number, h: number, content: string, z: number, extra: Record<string, unknown> = {}) => ({
  ...id, xPosition: x, yPosition: y, width: w, height: h, content: content || ' ', zOrderIndex: z, isEventCapture: 0,
  ...(extra.isEventCapture === 1 ? {} : { paddingLength: 0 }), ...extra,
});

type Texts = { header: string; body: string; headerSrc?: string; headerTitle?: string; headerTime?: string;
  bottomStatus?: string; bottomHint?: string; bottomDateTime?: string; homeBattery?: string; footer?: string; langs?: string[]; status?: string; history?: string; question?: string;
  tray?: boolean; tree?: boolean; rows?: string[]; orig?: boolean; origin?: string; bare?: boolean; asleep?: boolean; cards?: number; layout?: CardLayout | null };

export function pageSpec(kind: Page, t: Texts, menu?: MenuState, dim = 4) {
  const spec = dimSpec(baseSpec(kind, t), dim);
  const out = menu ? { ...spec, menuObject: menuFor(menu) } : spec;
  const layout = (kind === 'chat' && (t.layout === 'talk' || t.layout === 'myturn')) || (kind === 'normal' && !t.tray && t.layout && t.layout !== 'talk' && !LIST_LAYOUT[t.layout])
    || (kind === 'langs' && t.layout && LIST_LAYOUT[t.layout]) ? t.layout : kind === 'approval' || kind === 'confirm' ? 'approve' : null;
  Object.defineProperty(out, 'layout', { value: layout, enumerable: false }); 
  return out;
}

export function dimSpec<T>(spec: T, dim: number): T {
  const s = spec as { textObject?: Record<string, unknown>[] };
  if (dim >= 4 || !s.textObject) return spec;
  const cap = (v: unknown) => Math.min(v as number, dim);
  return {
    ...s,
    textObject: s.textObject.map((b) => ({
      ...b,
      ...(b.textColor !== undefined ? { textColor: cap(b.textColor) } : {}),
      ...(b.borderColor !== undefined ? { borderColor: cap(b.borderColor) } : {}),
    })),
  } as T;
}

const hasList = (spec: unknown): boolean => !!(spec as { listObject?: unknown[] } | null)?.listObject?.length;
type Spec = { textObject?: { containerName: string; content?: string; textColor?: number }[]; listObject?: unknown[]; menuObject?: unknown };

function baseSpec(kind: Page, t: Texts) {
  if (kind === 'dark') {
    return {
      containerTotalNum: 1,
      textObject: [text(IDS.body, 8, 4, 560, 280, ' ', 5, { isEventCapture: 1 })],
    };
  }
  if (kind === 'langs' && t.layout && LIST_LAYOUT[t.layout]) return listLayoutSpec(t.layout, t); 
  if (kind === 'langs') {
    const names = (t.langs ?? []).slice(0, 20).map((n) => n.slice(0, 40));
    return {
      containerTotalNum: 3, 
      imageObject: [] as Id[],
      textObject: [
        text(IDS.bottomStatus, BOTTOM_X, BOTTOM_STATUS_Y, BOTTOM_W, BOTTOM_ROW_H, t.bottomStatus ?? t.header, 4, { textColor: 4 }),
        text(IDS.bottomHint, BOTTOM_X, BOTTOM_HINT_Y, BOTTOM_W, BOTTOM_ROW_H, capFirst(t.bottomHint ?? ' '), 5, { textColor: 3 }),
      ],
      listObject: [{
        ...IDS.langs, xPosition: 8, yPosition: 4, width: 560, height: 220, zOrderIndex: 8, isEventCapture: 1,
        borderWidth: 0, paddingLength: 2,
        itemContainer: { itemCount: names.length, itemWidth: 556, isItemSelectBorderEn: 1, itemName: names },
      }],
    };
  }
  if (kind === 'chat' && (t.layout === 'talk' || t.layout === 'myturn')) return layoutSpec(t.layout, t); 
  if (kind === 'normal' && !t.tray && t.layout && t.layout !== 'talk') return layoutSpec(t.layout, t); 
  if (kind === 'chat') {
    const headerSrc = text(IDS.headerSrc, HEADER_SRC_X, HEADER_Y, HEADER_TIME_X - HEADER_SRC_X, HEADER_H, t.headerSrc ?? ' ', 3, { textColor: 4 });
    const headerTime = text(IDS.headerTime, HEADER_TIME_X, HEADER_Y, HEADER_TIME_W, HEADER_H, t.headerTime ?? ' ', 5, { textColor: 3 });
    const headerDivider = text(IDS.headerDivider, 8, DIVIDER_Y, 560, DIVIDER_H, ' ', 6, { textColor: 2, borderWidth: 1, borderColor: 2 });
    const body = t.bare ? text(IDS.body, 8, BARE_BODY_Y, 560, BARE_BODY_H, t.body, 7, { textColor: 4, isEventCapture: 1 })
      : text(IDS.body, 8, BODY_Y, 560, BODY_H, t.body, 7, { textColor: 4, isEventCapture: 1 }); 
    const bottomStatus = text(IDS.bottomStatus, BOTTOM_X, BOTTOM_STATUS_Y, t.bare ? BARE_STATUS_W : 300, BOTTOM_ROW_H, t.bottomStatus ?? ' ', 8, { textColor: 3 });
    const bottomHint = text(IDS.bottomHint, BOTTOM_X, BOTTOM_HINT_Y, BOTTOM_W, BOTTOM_ROW_H, t.bottomHint ?? ' ', 9, { textColor: 2 });
    const bottomDateTime = t.bare ? text(IDS.bottomDateTime, BARE_TIME_X, BOTTOM_STATUS_Y, BARE_TIME_W, BOTTOM_ROW_H, t.bottomDateTime ?? ' ', 10, { textColor: 2 })
      : text(IDS.bottomDateTime, 408, BOTTOM_STATUS_Y, 168, BOTTOM_ROW_H, t.bottomDateTime ?? ' ', 10, { textColor: 2 });
    const head = t.bare ? [] : [headerSrc, headerTime, headerDivider];
    return {
      containerTotalNum: head.length + 4, 
      imageObject: [] as Id[],
      textObject: [...head, body, bottomStatus, bottomHint, bottomDateTime],
    };
  }
  if (kind === 'normal') {
    if (t.tray) {
      const images = [
        ...(t.tree ? [
          { ...IDS.artL, xPosition: HOME_ART.x, yPosition: HOME_ART.y, width: HOME_ART.w, height: HOME_ART.h, zOrderIndex: 1 },
          { ...IDS.artR, xPosition: HOME_ART.x, yPosition: HOME_ART.y + HOME_ART.h, width: HOME_ART.w, height: 288 - HOME_ART.y - HOME_ART.h, zOrderIndex: 2 },
        ] : []),
      ];
      const body = text(IDS.body, HOME_LIST.x, HOME_LIST.y, HOME_LIST.w, HOME_LIST.h, ' ', 3, { textColor: 4, isEventCapture: 1, borderWidth: 0 });
      const bottomStatus = text(IDS.bottomStatus, HOME_MID.x, 0, HOME_MID.w, HOME_HEAD_H, t.bottomStatus ?? ' ', 8, { textColor: 3 });
      const bottomDateTime = text(IDS.bottomDateTime, HOME_TIME.x, 0, HOME_TIME.w, HOME_HEAD_H, t.bottomDateTime ?? ' ', 10, { textColor: 3 }); 
      const homeBattery = text(IDS.homeBattery, HOME_BATTERY.x, HOME_BATTERY.y, HOME_BATTERY.w, HOME_BATTERY.h, t.homeBattery ?? ' ', 14, { textColor: 3 });
      const cards = t.asleep ? 0 : Math.max(0, Math.min(HOME_ROW_IDS.length, t.cards ?? HOME_ROW_IDS.length));
      const rows = HOME_ROW_IDS.map((id, i) => text(id, HOME_ROW.x, HOME_ROW.y + i * HOME_ROW.pitch, HOME_ROW.w, HOME_ROW.h, ' ', 15 + i,
        { textColor: 2, borderWidth: i < cards ? 1 : 0, borderColor: 2, borderRadius: 7 }));
      if (t.asleep) { bottomStatus.content = ' '; bottomDateTime.content = ' '; homeBattery.content = ' '; }
      return {
        containerTotalNum: images.length + 4 + rows.length,
        imageObject: images,
        textObject: [body, bottomStatus, bottomDateTime, homeBattery, ...rows],
      };
    }
    const headerSrc = text(IDS.headerSrc, HEADER_SRC_X, HEADER_Y, HEADER_TIME_X - HEADER_SRC_X, HEADER_H, t.headerSrc ?? ' ', 3, { textColor: 4 });
    const headerTime = text(IDS.headerTime, HEADER_TIME_X, HEADER_Y, HEADER_TIME_W, HEADER_H, t.headerTime ?? ' ', 5, { textColor: 3 });
    const headerDivider = text(IDS.headerDivider, 8, DIVIDER_Y, 560, DIVIDER_H, ' ', 6, { textColor: 2, borderWidth: 1, borderColor: 2 });
    const y0 = t.bare ? BARE_BODY_Y : BODY_Y, h0 = t.bare ? BARE_BODY_H : BODY_H;
    const origin = t.orig ? [text(IDS.origin, 8, y0, 560, ORIG_H, t.origin ?? ' ', 11, { textColor: 2 })] : [];
    const body = text(IDS.body, 8, y0 + (t.orig ? ORIG_H : 0), 560, h0 - (t.orig ? ORIG_H : 0), t.body, 7, { textColor: 4, isEventCapture: 1 }); 
    const bottomStatus = text(IDS.bottomStatus, BOTTOM_X, BOTTOM_STATUS_Y, t.bare ? BARE_STATUS_W : 300, BOTTOM_ROW_H, t.bottomStatus ?? ' ', 8, { textColor: 3 });
    const bottomHint = text(IDS.bottomHint, BOTTOM_X, BOTTOM_HINT_Y, BOTTOM_W, BOTTOM_ROW_H, t.bottomHint ?? ' ', 9, { textColor: 2 });
    const bottomDateTime = t.bare ? text(IDS.bottomDateTime, BARE_TIME_X, BOTTOM_STATUS_Y, BARE_TIME_W, BOTTOM_ROW_H, t.bottomDateTime ?? ' ', 10, { textColor: 2 })
      : text(IDS.bottomDateTime, 408, BOTTOM_STATUS_Y, 168, BOTTOM_ROW_H, t.bottomDateTime ?? ' ', 10, { textColor: 2 });
    const head = t.bare ? [] : [headerSrc, headerTime, headerDivider];
    return {
      containerTotalNum: head.length + 4 + origin.length, 
      imageObject: [] as Id[],
      textObject: [...head, ...origin, body, bottomStatus, bottomHint, bottomDateTime],
    };
  }
  const rows = kind === 'confirm' ? (t.rows ?? SEND_CHOICES) : CHOICES; 
  const art = LAYOUT_ART.approve;
  return {
    containerTotalNum: 5,
    imageObject: (['cardA', 'cardB'] as const).map((b, i) => ({ ...CARD_IDS[b], xPosition: art[b]!.x, yPosition: art[b]!.y, width: art[b]!.w, height: art[b]!.h, zOrderIndex: 1 + i })),
    textObject: [
      text(IDS.header, 248, 254, 104, 30, t.header, 4, { textColor: 3 }),
      text(IDS.body, 8, 4, 344, 196, t.body, 5, { textColor: 4, borderWidth: 1, borderColor: 3, borderRadius: 10 }),
    ],
    listObject: [{
      ...IDS.choice, xPosition: 8, yPosition: 206, width: 236, height: 78, zOrderIndex: 8, isEventCapture: 1,
      borderWidth: 0, paddingLength: 2,
      itemContainer: { itemCount: rows.length, itemWidth: 232, isItemSelectBorderEn: 1, itemName: [...rows] },
    }],
  };
}

const utf8Len = (s: string): number => new TextEncoder().encode(s).length;

export function centred(s: string, boxW = HOME_W): string {
  const t = s.trim();
  if (!t) return ' ';
  const space = getTextWidth(' ') || 6;
  const n = Math.max(0, Math.floor((boxW - 8 - getTextWidth(t)) / 2 / space));
  return ' '.repeat(n) + t;
}

export class Glasses {
  bridge: EvenAppBridge;
  images: Record<string, number[]> = {};
  images48: Record<string, number[]> = {}; 
  shown = ''; 
  lastImageMs = 0;
  imageMs: Record<string, number> = {}; 
  screenTimes: string[] = [];
  static SCREEN_TIMES = 8;
  static TIMING_IDLE_MS = 200; 
  static TIMING_MAX_MS = 5000; 
  private timing: { label: string; builtAt: number; buildMs: number; pics: string[]; lastAt: number; idle: ReturnType<typeof setTimeout> | null } | null = null;
  page: Page = 'normal';
  menu: MenuState = { meeting: false, translating: false, listening: true }; 
  lastRebuild = ''; 
  private texts: Record<string, string> = {};
  private imageChain: Promise<unknown> = Promise.resolve();
  private sending = false; 
  private wanted: Frame | null = null; 
  imageStats = { ok: 0, failed: 0, timeouts: 0, last: '' }; 
  writeFails: string[] = [];
  private textYes = 0; 
  private noteFail(what: string): void {
    this.writeFails.push(`${new Date().toISOString().slice(11, 19)} ${what}`);
    if (this.writeFails.length > 8) this.writeFails.shift();
  }

  async settle(): Promise<void> {
    if (this.pendingSpec) return; 
    const spec = this.full;
    if (this.lastRebuild !== 'true' && spec && this.page !== 'dark') {
      await this.rebuild(() => spec, () => { this.traySent = {}; this.texts = {}; this.shown = ''; });
      return;
    }
    this.texts = {};
  }
  trayOn = false;
  private traySent: Record<string, string> = {}; 
  private trayWanted: Record<string, { key: string; png: number[] }> = {};
  private link: Promise<unknown> = Promise.resolve(); 
  treeOn = false;
  private artBuilt = false; 
  get homeArtUp(): boolean { return this.artBuilt && this.trayBuilt && this.page === 'normal'; }
  private trayBuilt = false; 
  origOn = false;
  private origBuilt = false;
  bareFor: (kind: Page) => boolean = () => false;
  layoutFor: (kind: Page) => CardLayout | null = () => null;
  layoutBuilt: CardLayout | null = null; 
  private avatarBuilt = false; 
  private cardWanted: Partial<Record<CardBox, { key: string; png: number[] }>> = {};
  private cardSent: Partial<Record<CardBox, string>> = {};
  boxW(name: string, fallback: number): number {
    return (this.full?.textObject as { containerName: string; width?: number }[] | undefined)?.find((b) => b.containerName === name)?.width ?? fallback;
  }
  showCard(box: CardBox, key: string, png: number[]): Promise<void> {
    this.cardWanted[box] = { key, png };
    return this.pump();
  }
  cardNeeds(box: CardBox, key: string): boolean {
    return !this.cooling(box) && !this.listHidden && !!this.layoutBuilt && !!LAYOUT_ART[this.layoutBuilt][box] && this.cardSent[box] !== key && this.cardWanted[box]?.key !== key;
  }
  private bareBuilt = false; 
  homeAsleep = false; 
  cardsFor: () => number = () => 3;
  private homeCardsBuilt = 3;
  get bare(): boolean { return this.bareBuilt; }
  dim = 4;
  imagesDark = false;
  hideAll = false;
  private swapsOut(spec: Spec | null): boolean {
    return this.imagesDark && !!spec && (this.hideAll || hasList(spec));
  }
  private base: Record<string, number> = {}; 
  private built: Record<string, number> = {}; 
  private colors: Record<string, number> = {}; 
  private full: Spec | null = null; 
  private listHidden = false; 
  private darkBusyAt = 0; 
  dimDirty = false;

  get dimmedAway(): boolean {
    return this.imagesDark || this.listHidden || (this.darkBusyAt > 0 && Date.now() - this.darkBusyAt < 8000);
  }

  constructor(bridge: EvenAppBridge) {
    this.bridge = bridge;
  }

  private queue<T>(fn: () => Promise<T>, maxWaitMs = LINK_WAIT_MS): Promise<T> {
    const before = this.link;
    const run = before.then(fn);
    this.link = new Promise((next) => {
      const done = () => next(undefined);
      run.then(done, done);
      before.then(() => setTimeout(done, maxWaitMs)); 
    });
    return run;
  }

  async loadImages(frames: Frame[], base = './avatar48/', into: Record<string, number[]> = this.images): Promise<void> {
    await Promise.all(
      [...frames, 'blank'].map(async (n) => {
        const res = await fetch(`${base}${n}.png`);
        if (!res.ok || !(res.headers.get('content-type') || '').includes('image')) return console.warn(`avatar frame ${n} missing`); 
        into[n] = Array.from(new Uint8Array(await res.arrayBuffer()));
      }),
    );
  }

  private frames(): Record<string, number[]> {
    return this.trayBuilt && this.page === 'normal' ? this.images48 : this.images;
  }

  async create(t: { header: string; body: string }): Promise<boolean> {
    const spec = pageSpec('normal', { ...t, tray: this.trayOn, tree: this.treeOn }, this.menu);
    let ok = await this.queue(async () => {
      const dimAt = this.dim; 
      const made = (await this.bridge.createStartUpPageContainer(dimSpec(spec, dimAt) as any)) === StartUpPageCreateResult.success;
      if (made) this.adopt(spec, false, dimAt);
      return made;
    });
    if (!ok) ok = await this.rebuild(() => spec);
    this.trayBuilt = this.trayOn;
    this.artBuilt = this.trayOn && this.treeOn;
    this.bareBuilt = false; 
    this.page = 'normal';
    this.texts = { headerSrc: ' ', headerTitle: ' ', headerTime: ' ', headerDivider: ' ', body: t.body || ' ', bottomStatus: ' ', bottomDateTime: ' ', bottomHint: ' ' };
    this.shown = '';
    this.traySent = {};
    return ok;
  }

  async setPage(kind: Page, t: { header: string; body: string; countdown?: string; footer?: string; bottomStatus?: string; bottomHint?: string; langs?: string[]; status?: string; history?: string; question?: string; rows?: string[]; tray?: boolean }, force = false): Promise<boolean> {
    if (this.page === kind && !force) return true; 
    if (t.tray !== undefined) this.trayOn = t.tray;
    return this.defer(() => pageSpec(kind, { ...t, tray: this.trayOn, tree: this.treeOn, orig: this.origOn && !this.trayOn, bare: (kind === 'chat' || !this.trayOn) && this.bareFor(kind), asleep: this.homeAsleep, cards: this.cardsFor(), layout: this.layoutFor(kind) }, this.menu), () => {
      this.traySent = {};
      this.page = kind;
      this.texts = { headerSrc: ' ', headerTitle: ' ', headerTime: ' ', headerDivider: ' ', body: t.body || ' ', bottomStatus: ' ', bottomDateTime: ' ', bottomHint: ' ' };
      this.shown = '';
    });
  }

  private rebuild(spec: () => unknown | null, after?: () => void, dip = true): Promise<boolean> {
    return this.queue(async () => {
      const asked = spec() as Spec | null; 
      if (!asked) return false;
      const dipping = dip && this.transitions && this.page !== 'dark' && !this.listHidden && !hasList(asked) && this.ceil > 1;
      this.dipping = dipping;
      if (dipping) {
        this.fade = 1;
        await this.colorPass();
        await new Promise((r) => setTimeout(r, Glasses.FADE_STEP_MS));
      } else if (this.fade < 4) {
        this.fade = 4; 
      }
      const dimAt = this.ceil;
      const hide = this.swapsOut(asked);
      const page = hide
        ? { containerTotalNum: 1, textObject: [text(IDS.body, 8, 4, 560, 280, ' ', 5, { isEventCapture: 1 })], ...(asked.menuObject ? { menuObject: asked.menuObject } : {}) }
        : dimSpec(asked, dimAt);
      try {
        const res = await this.bridge.rebuildPageContainer(page as any);
        this.lastRebuild = JSON.stringify(res);
        if (res !== true) this.noteFail(`page ${JSON.stringify((page as Spec).textObject?.map((b) => b.containerName) ?? [])} -> ${this.lastRebuild}`);
        this.markBuilt(page as Spec, asked, hide, dimAt);
        after?.();
        if (dipping) { 
          await new Promise((r) => setTimeout(r, Glasses.FADE_STEP_MS));
          this.fade = 3;
          await this.colorPass();
          this.fade = 4;
          await this.colorPass();
        }
        this.dipping = false;
        return true;
      } catch (e) {
        this.fade = 4;
        this.dipping = false;
        this.lastRebuild = `error: ${String(e).slice(0, 80)}`;
        this.noteFail(`page -> ${this.lastRebuild}`);
        return false;
      }
    });
  }

  private markBuilt(page: Spec, asked: Spec, hide: boolean, dimAt: number): void {
    const imgs = (page as { imageObject?: Id[] }).imageObject ?? [];
    this.trayBuilt = !!page.textObject?.some((i) => i.containerName === 'homeRow0'); 
    this.artBuilt = imgs.some((i) => i.containerName === 'artL');
    this.origBuilt = !!page.textObject?.some((i) => i.containerName === 'origin');
    const boxes = page.textObject?.map((i) => i.containerName) ?? [];
    this.layoutBuilt = (asked as { layout?: CardLayout | null }).layout ?? null;
    this.avatarBuilt = imgs.some((i) => i.containerName === 'avatar');
    this.cardSent = {}; 
    this.failUntil = {}; 
    this.failRuns = {};
    this.bareBuilt = !this.layoutBuilt && !this.trayBuilt && !hasList(page) && boxes.includes('bottomStatus') && !boxes.includes('headerSrc');
    const tb = (page as { textObject?: { containerName: string; borderWidth?: number }[] }).textObject ?? [];
    this.homeCardsBuilt = tb.filter((b) => b.containerName.startsWith('homeRow') && b.borderWidth === 1).length;
    this.adopt(asked, hide, dimAt);
  }

  static FLUSH_MS = 40;
  static BUILD_TEXT_MAX = 300;
  static BUILD_TEXT_TOTAL = 900; 
  private pendingSpec: (() => unknown | null) | null = null; 
  private pendingAsked: Spec | null = null; 
  private staged: Record<string, string> = {}; 
  private stagedColor: Record<string, number> = {};
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  holds = 0;
  noted = 0;
  static HOLD_MAX_MS = 600;
  private pendingSince = 0;
  get building(): boolean { return !!this.pendingSpec; }
  onBuilt: (() => void) | null = null;

  private defer(spec: () => unknown | null, after?: () => void, keep = false): Promise<boolean> {
    const asked = spec() as Spec | null;
    if (!asked) return Promise.resolve(false);
    const kept = keep ? { ...this.texts } : {};
    const hide = this.swapsOut(asked);
    this.markBuilt(hide ? { textObject: [{ containerName: 'body' }] } : asked, asked, hide, this.ceil);
    after?.();
    if (!this.pendingSpec) { this.staged = {}; this.stagedColor = {}; }
    Object.assign(this.staged, kept);
    this.pendingSpec = spec;
    this.pendingAsked = asked;
    this.noted++;
    if (!this.pendingSince) this.pendingSince = Date.now();
    if (!this.flushTimer) this.flushTimer = setTimeout(() => this.timerFlush(), Glasses.FLUSH_MS);
    return Promise.resolve(true);
  }

  private timerFlush(): void {
    this.flushTimer = null;
    if (this.holds > 0 && Date.now() - this.pendingSince < Glasses.HOLD_MAX_MS) { 
      this.flushTimer = setTimeout(() => this.timerFlush(), 20);
      return;
    }
    void this.flush();
  }

  private dropPending(): void {
    this.pendingSpec = null;
    this.pendingSince = 0;
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; }
  }

  flush(): Promise<void> {
    if (this.flushTimer) { clearTimeout(this.flushTimer); this.flushTimer = null; }
    if (!this.pendingSpec) return Promise.resolve();
    return this.queue(async () => {
      const spec = this.pendingSpec;
      if (!spec) return; 
      this.pendingSpec = null;
      this.pendingSince = 0;
      const asked0 = (spec() as Spec | null) ?? this.pendingAsked;
      this.pendingAsked = null;
      if (!asked0) return;
      const staged = this.staged, colors = this.stagedColor;
      this.staged = {}; this.stagedColor = {};
      const asked = {
        ...asked0,
        textObject: asked0.textObject?.map((b) => {
          const name = b.containerName;
          return {
            ...b,
            ...(staged[name] !== undefined ? { content: staged[name] || ' ' } : {}),
            ...(colors[name] !== undefined ? { textColor: colors[name] } : {}),
          };
        }),
      } as Spec;
      Object.defineProperty(asked, 'layout', { value: (asked0 as { layout?: CardLayout | null }).layout ?? null, enumerable: false });
      const later: Record<string, string> = {};
      let total = 0;
      const inPage = (keep: boolean) => ({
        ...asked,
        textObject: asked.textObject?.map((b) => {
          const c = b.content || ' ';
          const n = utf8Len(c);
          if (!keep || (c.trim() && (n > Glasses.BUILD_TEXT_MAX || total + n > Glasses.BUILD_TEXT_TOTAL))) {
            if (c.trim()) later[b.containerName] = c;
            return { ...b, content: ' ' };
          }
          total += n;
          return b;
        }),
      }) as Spec;
      const dimAt = this.ceil;
      const hide = this.swapsOut(asked);
      const blankPage = (spec: Spec) => hide
        ? { containerTotalNum: 1, textObject: [text(IDS.body, 8, 4, 560, 280, ' ', 5, { isEventCapture: 1 })], ...(asked.menuObject ? { menuObject: asked.menuObject } : {}) }
        : dimSpec(spec, dimAt);
      let page = blankPage(inPage(true));
      if (this.fade < 4) this.fade = 4; 
      const send = async (pg: unknown): Promise<unknown> => {
        try {
          const res = await this.bridge.rebuildPageContainer(pg as any);
          this.lastRebuild = JSON.stringify(res);
          return res;
        } catch (e) {
          this.lastRebuild = `error: ${String(e).slice(0, 80)}`;
          return 'error';
        }
      };
      const names = () => JSON.stringify((page as Spec).textObject?.map((b) => b.containerName) ?? []);
      const gen = this.noted; 
      const t0 = performance.now();
      let res = await send(page);
      if (res === false || res === 'error') {
        this.noteFail(`page ${names()} with ${total} bytes of text -> ${this.lastRebuild}; sent again without texts`);
        for (const k of Object.keys(later)) delete later[k];
        total = 0;
        page = blankPage(inPage(false));
        res = await send(page);
      }
      if (res !== true) this.noteFail(`page ${names()} -> ${this.lastRebuild}`);
      if (this.noted !== gen) return;
      this.markBuilt(page as Spec, asked, hide, dimAt);
      this.startTiming(performance.now() - t0);
      this.texts = {};
      for (const b of (page as Spec).textObject ?? []) this.texts[b.containerName] = b.content ?? ' ';
      if (!hide) {
        for (const [name, content] of Object.entries(later)) { 
          const id = (IDS as Record<string, Id>)[name];
          if (!id) continue;
          const eff = Math.min(this.base[name] ?? 4, this.ceil);
          try {
            const ok = await this.bridge.textContainerUpgrade({ ...id, content: content.slice(0, 2000), textColor: eff } as any);
            if (ok !== false) { this.texts[name] = content; this.colors[name] = eff; }
            else this.noteFail(`text ${name} -> false (after the page)`);
          } catch (e) {
            this.noteFail(`text ${name} -> error ${String(e).slice(0, 60)}`);
          }
        }
      }
      this.shown = '';
      this.traySent = {};
    }).then(() => {
      void this.pump(); 
      this.onBuilt?.();
      this.timingIdle();
    });
  }

  private startTiming(buildMs: number): void {
    this.closeTiming(); 
    const at = new Date();
    const hms = [at.getHours(), at.getMinutes(), at.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
    const t = { label: `${hms} ${this.page}/${this.layoutBuilt ?? '-'}`, builtAt: performance.now(), buildMs, pics: [] as string[], lastAt: 0, idle: null as ReturnType<typeof setTimeout> | null };
    this.timing = t;
    setTimeout(() => { if (this.timing === t) this.closeTiming(); }, Glasses.TIMING_MAX_MS);
  }

  private timePicture(box: string, ms: number): void {
    const t = this.timing;
    if (!t || !/^(card|tray|art)/.test(box)) return;
    t.pics.push(`${box} ${Math.round(ms)}ms`);
    t.lastAt = performance.now();
    this.timingIdle();
  }

  private timingIdle(): void {
    const t = this.timing;
    if (!t) return;
    if (t.idle) clearTimeout(t.idle);
    t.idle = setTimeout(() => {
      if (this.timing !== t) return;
      const wanted = Object.keys(this.cardWanted).length > 0 || Object.keys(this.trayWanted).length > 0;
      if (this.sending || wanted) return this.timingIdle();
      this.closeTiming();
    }, Glasses.TIMING_IDLE_MS);
  }

  private closeTiming(): void {
    const t = this.timing;
    if (!t) return;
    this.timing = null;
    if (t.idle) clearTimeout(t.idle);
    const pics = t.pics.length ? `pictures ${t.pics.join(', ')}, last picture +${Math.round(t.lastAt - t.builtAt)}ms` : 'no pictures';
    this.screenTimes.push(`${t.label} build ${Math.round(t.buildMs)}ms, ${pics}`);
    if (this.screenTimes.length > Glasses.SCREEN_TIMES) this.screenTimes.splice(0, this.screenTimes.length - Glasses.SCREEN_TIMES);
  }

  private adopt(asked: Spec, hidden: boolean, dim: number): void {
    this.full = asked;
    this.listHidden = hidden;
    this.base = {};
    this.built = {};
    this.colors = {};
    for (const b of asked.textObject ?? []) {
      if (b.textColor === undefined) continue;
      this.base[b.containerName] = b.textColor;
      this.built[b.containerName] = this.colors[b.containerName] = Math.min(b.textColor, dim);
    }
  }

  fade = 4;
  private dipping = false;
  transitions = false; 
  static readonly FADE_STEP_MS = 45;

  private get ceil(): number {
    return Math.min(this.dim, this.fade);
  }

  private async colorPass(): Promise<void> {
    if (this.listHidden || this.pendingSpec || typeof this.bridge.textContainerUpgrade !== 'function') return; 
    for (const name of Object.keys(this.base)) {
      const eff = Math.min(this.base[name], this.ceil);
      if (this.colors[name] === eff) continue;
      const id = (IDS as Record<string, Id>)[name];
      if (!id) continue;
      const content = this.texts[name] ?? this.full?.textObject?.find((b) => b.containerName === name)?.content ?? ' ';
      if (!content.trim() && !this.full?.textObject?.find((b) => b.containerName === name && (b as { borderWidth?: number }).borderWidth)) {
        this.colors[name] = eff; 
        continue;
      }
      try {
        await this.bridge.textContainerUpgrade({ ...id, content: content.slice(0, 2000), textColor: eff } as any);
        this.colors[name] = eff;
      } catch {
        delete this.colors[name];
        this.dimDirty = true;
      }
    }
  }

  setFade(level: number): Promise<void> {
    const f = Math.max(0, Math.min(4, Math.round(level)));
    if (f === this.fade || this.dipping) return Promise.resolve(); 
    this.fade = f;
    return this.queue(() => this.colorPass());
  }

  setDim(level: number): Promise<void> {
    const dim = Math.max(0, Math.min(4, Math.round(level)));
    if (dim === this.dim && !this.dimDirty) return Promise.resolve();
    this.dim = dim;
    return this.queue(async () => {
      this.dimDirty = false;
      if (this.listHidden || this.pendingSpec) return; 
      for (const name of Object.keys(this.base)) {
        const eff = Math.min(this.base[name], this.ceil);
        if (this.colors[name] === eff) continue;
        const id = (IDS as Record<string, Id>)[name];
        if (!id) continue;
        const content = this.texts[name] ?? this.full?.textObject?.find((b) => b.containerName === name)?.content ?? ' ';
        try {
          await this.bridge.textContainerUpgrade({ ...id, content: content.slice(0, 2000), textColor: eff } as any);
          this.colors[name] = eff; 
        } catch {
          delete this.colors[name]; 
          this.dimDirty = true;
        }
      }
    });
  }

  async setImagesDark(on: boolean): Promise<void> {
    if (on === this.imagesDark) return;
    await this.flush(); 
    this.imagesDark = on;
    this.darkBusyAt = Date.now();
    try {
      await this.rebuild(() => (this.full && this.listHidden !== this.swapsOut(this.full) ? this.full : null), () => {
        this.shown = '';
        this.traySent = {};
      });
      await this.pump();
    } finally {
      this.darkBusyAt = 0;
    }
  }

  menuDiffers(m: MenuState): boolean {
    return m.meeting !== this.menu.meeting || m.translating !== this.menu.translating || m.listening !== this.menu.listening;
  }

  async refreshMenu(m: MenuState): Promise<boolean> {
    if (m.meeting === this.menu.meeting && m.translating === this.menu.translating && m.listening === this.menu.listening) return false;
    this.menu = { ...m };
    if (this.page !== 'normal' && this.page !== 'chat' && this.page !== 'dark') return false;
    if (this.pendingSpec) return true; 
    if (this.page !== 'dark') return this.defer(() => (this.page === 'normal' || this.page === 'chat' ? this.keptSpec() : null), () => {
      this.shown = '';
      this.traySent = {};
    }, true);
    return this.rebuild(() => {
      if (this.page !== 'normal' && this.page !== 'chat' && this.page !== 'dark') return null;
      return this.keptSpec();
    }, () => {
      if (this.page !== 'dark') this.shown = ''; 
      this.traySent = {};
    }, false);
  }

  private blankSpec() {
    const saved = this.texts;
    this.texts = {};
    try { return this.keptSpec(); } finally { this.texts = saved; }
  }

  private keptSpec() {
    const keep = { ...this.texts };
    const tray = this.page === 'normal' && this.trayOn;
    return pageSpec(this.page, { ...keep, header: keep.header || ' ', body: keep.body || ' ', tray: this.trayOn, tree: this.treeOn,
      orig: this.page === 'normal' && this.origOn && !this.trayOn, bare: !tray && this.bareFor(this.page), asleep: this.homeAsleep, cards: this.cardsFor(),
      layout: tray ? null : this.layoutFor(this.page) } as Texts, this.menu);
  }

  async syncBare(): Promise<boolean> {
    const fits = () => (this.page === 'chat' || (this.page === 'normal' && !this.trayBuilt && !this.trayOn));
    const differs = () => { const lay = this.layoutFor(this.page); return lay !== this.layoutBuilt || (!lay && this.bareFor(this.page) !== this.bareBuilt); };
    if (!fits() || !differs()) return false;
    return this.defer(() => (fits() && differs() ? this.keptSpec() : null), () => {
      this.shown = ''; 
      this.traySent = {};
      this.texts = { body: this.texts.body || ' ' }; 
    });
  }

  async syncHomeSleep(): Promise<boolean> {
    const fits = () => this.page === 'normal' && this.trayBuilt;
    const want = () => (this.homeAsleep ? 0 : this.cardsFor());
    if (!fits() || want() === this.homeCardsBuilt) return false;
    const asleep = this.homeAsleep;
    return this.defer(() => (fits() ? (this.homeAsleep ? this.blankSpec() : this.keptSpec()) : null), () => {
      this.traySent = {}; 
      this.texts = asleep ? {} : { body: ' ' };
    });
  }

  async setTray(on: boolean, t: { header: string; body: string }, orig = false): Promise<boolean> {
    if (on === this.trayOn && orig === this.origOn) return false;
    this.trayOn = on;
    this.origOn = orig;
    if (this.page !== 'normal') return false; 
    return this.defer(() => (this.page === 'normal' ? pageSpec('normal', { ...t, tray: this.trayOn, tree: this.treeOn, orig: this.origOn && !this.trayOn, bare: !this.trayOn && this.bareFor('normal'), asleep: this.homeAsleep, cards: this.cardsFor(), layout: this.layoutFor('normal') }, this.menu) : null), () => {
      this.texts = { headerSrc: ' ', headerTitle: ' ', headerTime: ' ', headerDivider: ' ', body: t.body || ' ', bottomStatus: ' ', bottomDateTime: ' ', bottomHint: ' ' };
      this.shown = '';
      this.traySent = {};
    });
  }

  trayNeeds(box: TrayBox, key: string): boolean {
    if ((box === 'artL' || box === 'artR') && !this.artBuilt) return false; 
    if (box === 'trayR') return false; 
    return !this.cooling(box) && this.page === 'normal' && this.trayOn && this.traySent[box] !== key && this.trayWanted[box]?.key !== key;
  }

  showTray(box: TrayBox, key: string, png: number[]): Promise<void> {
    this.trayWanted[box] = { key, png };
    return this.pump();
  }

  private stage(id: Id, content: string, textColor?: number): void {
    const name = id.containerName;
    if (this.page === 'langs' || !(this.full?.textObject ?? []).some((b) => b.containerName === name)) return;
    const hint = name === 'footer' || name === 'bottomHint';
    let value = (hint ? capFirst(content || '') : content) || ' ';
    if (this.trayBuilt && this.page === 'normal' && name === 'bottomStatus') value = centred(value, HOME_MID.w);
    this.staged[name] = value;
    this.texts[name] = value;
    if (textColor !== undefined) { this.stagedColor[name] = textColor; this.base[name] = textColor; }
  }

  setText(id: Id, content: string, textColor?: number, force = false): Promise<void> {
    if (this.pendingSpec) { this.stage(id, content, textColor); return Promise.resolve(); }
    return this.queue(async () => {
      if (this.pendingSpec) return this.stage(id, content, textColor);
      const has: Record<Page, string[]> = {
        normal: this.trayBuilt ? ['body', 'bottomStatus', 'bottomDateTime', 'homeBattery', 'homeRow0', 'homeRow1', 'homeRow2'] : [...(this.bareBuilt ? [] : ['headerSrc', 'headerTime', 'headerDivider']), 'body', 'bottomStatus', 'bottomDateTime', 'bottomHint', ...(this.origBuilt ? ['origin'] : [])],
        chat: [...(this.bareBuilt ? [] : ['headerSrc', 'headerTime', 'headerDivider']), 'body', 'bottomStatus', 'bottomHint', 'bottomDateTime'],
        dark: ['body'],
        approval: ['header', 'body'],
        confirm: ['header', 'body'],
        langs: [], 
      };
      const onLayout = this.layoutBuilt && (this.page === 'normal' || this.page === 'chat');
      if (onLayout ? !(this.full?.textObject ?? []).some((b) => b.containerName === id.containerName) : !has[this.page].includes(id.containerName)) return;
      const hint = id.containerName === 'footer' || id.containerName === 'bottomHint';
      let value = (hint ? capFirst(content || '') : content) || ' '; 
      if (this.trayBuilt && this.page === 'normal' && id.containerName === 'bottomStatus') value = centred(value, HOME_MID.w); 
      const name = id.containerName;
      if (this.listHidden) { 
        const box = this.full?.textObject?.find((b) => b.containerName === name);
        if (box) box.content = value.slice(0, 1000);
        this.texts[name] = value;
        return;
      }
      if (textColor !== undefined) this.base[name] = textColor;
      const eff = Math.min(this.base[name] ?? 4, this.ceil);
      if (!force && this.texts[name] === value && (this.colors[name] ?? eff) === eff) return; 
      const was = { text: this.texts[name], color: this.colors[name] };
      this.texts[name] = value;
      const state = textColor !== undefined || eff !== (this.built[name] ?? eff);
      this.colors[name] = eff;
      const forget = (): void => { 
        if (was.text === undefined) delete this.texts[name]; else this.texts[name] = was.text;
        if (was.color === undefined) delete this.colors[name]; else this.colors[name] = was.color;
      };
      let ok: unknown;
      try {
        ok = await this.bridge.textContainerUpgrade({ ...id, content: value.slice(0, 2000), ...(state ? { textColor: eff } : {}) } as any);
      } catch (e) {
        forget();
        this.noteFail(`text ${name} -> error ${String(e).slice(0, 60)}`);
        throw e;
      }
      if (ok === true) this.textYes++;
      else if (ok === false) {
        if (this.textYes > 0) forget();
        this.noteFail(`text ${name} -> false${this.textYes > 0 ? '' : ' (never answered yes: not resent)'}`);
      }
    });
  }

  showAvatar(frame: Frame): Promise<void> {
    const set = this.frames();
    this.wanted = set[frame] || !set.idle ? frame : 'idle';
    return this.pump();
  }

  private transfer(id: Id, data: number[], label: string, still: () => boolean = () => true): Promise<boolean> {
    return this.queue(() => (still() ? this.transferNow(id, data, label) : Promise.resolve(false)), LINK_WAIT_IMAGE_MS);
  }

  private failUntil: Record<string, number> = {};
  private failRuns: Record<string, number> = {};
  cooling(box: string): boolean {
    return (this.failUntil[box] ?? 0) > Date.now();
  }
  private noteImage(box: string, ok: boolean): void {
    if (ok) { delete this.failUntil[box]; delete this.failRuns[box]; return; }
    const n = (this.failRuns[box] = (this.failRuns[box] ?? 0) + 1);
    this.failUntil[box] = Date.now() + Math.min(60_000, 2000 * 2 ** (n - 1));
  }

  private async transferNow(id: Id, data: number[], label: string): Promise<boolean> {
    const ok = await this.transferRaw(id, data, label);
    this.noteImage(id.containerName, ok);
    if (ok) this.timePicture(id.containerName, this.lastImageMs);
    return ok;
  }

  private async transferRaw(id: Id, data: number[], label: string): Promise<boolean> {
    const t0 = performance.now();
    const res = await Promise.race([
      this.bridge.updateImageRawData({ ...id, imageData: data } as any),
      new Promise((r) => setTimeout(() => r('timeout'), IMAGE_TIMEOUT_MS)),
    ]);
    this.lastImageMs = performance.now() - t0;
    this.imageMs[label] = Math.round(this.lastImageMs);
    if (res === 'timeout') {
      this.imageStats.timeouts++;
      return false;
    }
    if (!ImageRawDataUpdateResult.isSuccess(res as any)) {
      this.imageStats.failed++;
      this.imageStats.last = String(res).slice(0, 40);
      console.warn('image update failed', label, res);
      return false;
    }
    this.imageStats.ok++;
    return true;
  }

  private pump(): Promise<void> {
    if (this.sending) return this.imageChain.then(() => undefined);
    this.sending = true;
    const run = (async () => {
      try {
        for (;;) {
          if (this.pendingSpec) break; 
          const f = this.wanted && this.imagesDark ? 'blank' : this.wanted; 
          const set = this.frames(); 
          if (f && f !== this.shown && set[f] && this.avatarBuilt) { 
            if (!(await this.transfer(IDS.avatar, set[f], f, () => this.page !== 'dark' && !this.listHidden && this.avatarBuilt && this.frames() === set))) break; 
            this.shown = f;
            continue;
          }
          const card = (['cardA', 'cardB', 'cardC'] as const).find((b) => this.cardWanted[b]);
          if (card) { 
            const job = this.cardWanted[card]!;
            delete this.cardWanted[card];
            const here = () => (this.page === 'normal' || this.page === 'chat' || this.page === 'langs' || this.page === 'approval' || this.page === 'confirm') && !this.listHidden && !!this.layoutBuilt && !!LAYOUT_ART[this.layoutBuilt][card];
            if (!here() || this.cardSent[card] === job.key) continue;
            if (!(await this.transfer(CARD_IDS[card], job.png, card, here))) break;
            this.cardSent[card] = job.key;
            continue;
          }
          const box = (['trayL', 'trayR', 'artL', 'artR'] as const).find((b) => this.trayWanted[b]);
          if (!box) break;
          const job = this.trayWanted[box];
          delete this.trayWanted[box];
          if (this.page !== 'normal' || !this.trayOn || this.traySent[box] === job.key || ((box === 'artL' || box === 'artR') && !this.artBuilt)) continue; 
          if (!(await this.transfer(IDS[box], job.png, box, () => this.page === 'normal' && this.trayBuilt && ((box !== 'artL' && box !== 'artR') || this.artBuilt)))) break;
          this.traySent[box] = job.key;
        }
      } finally {
        this.sending = false;
      }
    })();
    this.imageChain = run.catch(() => undefined);
    return run;
  }

  async blank(): Promise<boolean> {
    if (this.avatarBuilt) {
      await Promise.race([this.showAvatar('blank'), new Promise((r) => setTimeout(r, 3000))]);
      await Promise.race([this.imageChain, new Promise((r) => setTimeout(r, 1000))]);
    }
    this.wanted = null;
    this.dropPending(); 
    return this.rebuild(() => pageSpec('dark', { header: ' ', body: ' ' }, this.menu), () => {
      this.traySent = {};
      this.page = 'dark';
      this.texts = {};
      this.shown = 'blank';
    });
  }

  mic(on: boolean, source: 'glasses' | 'phone' = 'glasses'): Promise<boolean> {
    return this.bridge.audioControl(on, source === 'phone' ? AudioInputSource.Phone : AudioInputSource.Glasses);
  }

  imuControl(isOpen: boolean, reportFrq = ImuReportPace.P100): Promise<boolean> {
    return this.bridge.imuControl(isOpen, reportFrq);
  }
}
