
import {
  AudioInputSource,
  ImageRawDataUpdateResult,
  StartUpPageCreateResult,
  type EvenAppBridge,
} from '@evenrealities/even_hub_sdk';
import { capFirst } from './window.ts';

export const IDS = {
  body: { containerID: 4, containerName: 'body' },
  langs: { containerID: 9, containerName: 'langs' },
  question: { containerID: 13, containerName: 'question' },
  log0: { containerID: 14, containerName: 'log0' },
  log1: { containerID: 15, containerName: 'log1' },
  log2: { containerID: 16, containerName: 'log2' },
  headerSrc: { containerID: 19, containerName: 'headerSrc' },
  headerTime: { containerID: 21, containerName: 'headerTime' },
  headerDivider: { containerID: 22, containerName: 'headerDivider' },
  bottomStatus: { containerID: 23, containerName: 'bottomStatus' },
  bottomHint: { containerID: 24, containerName: 'bottomHint' },
  bottomDateTime: { containerID: 25, containerName: 'bottomDateTime' },
  origin: { containerID: 26, containerName: 'origin' },
};
export const CARD_IDS = {
  cardA: { containerID: 35, containerName: 'cardA' },
  cardB: { containerID: 36, containerName: 'cardB' },
};
export type CardBox = keyof typeof CARD_IDS;

export type CardLayout =
  | 'translation' 
  | 'translationsolo' 
  | 'translationideas' 
  | 'myturn' 
  | 'card' 
  | 'langlist'; 
type R = { x: number; y: number; w: number; h: number };
export const LAYOUT_ART: Record<CardLayout, Partial<Record<CardBox, R>>> = {
  translation: {}, translationsolo: {}, translationideas: {}, myturn: {}, 
  card: { cardA: { x: 360, y: 0, w: 216, h: 144 }, cardB: { x: 360, y: 144, w: 216, h: 144 } },
  langlist: { cardA: { x: 400, y: 0, w: 176, h: 144 }, cardB: { x: 400, y: 144, w: 176, h: 144 } },
};
export const LIST_LAYOUT: Partial<Record<CardLayout, { list: R; status: R; hint: R }>> = {
  langlist: { list: { x: 8, y: 4, w: 384, h: 212 }, status: { x: 8, y: 222, w: 384, h: 28 }, hint: { x: 8, y: 254, w: 384, h: 28 } },
};

type TB = [keyof typeof IDS, number, number, number, number, number, Record<string, unknown>?];
const L = 27; 
const FOOT_ROW: TB[] = [['headerSrc', 8, 256, 232, 28, 3], ['bottomHint', 240, 256, 328, 28, 2]];
const CENTRE_PAIR: TB[] = [['origin', 8, 10, 560, 4 * L, 2], ['log1', 8, 118, 560, 2, 2, { borderWidth: 1, borderColor: 2 }],
  ['body', 8, 124, 560, 4 * L, 4]];
export const LAYOUT_TEXT: Record<CardLayout, TB[]> = {
  translation: [['origin', 8, 0, 560, 9 * L, 0], ['body', 8, 0, 560, 9 * L, 4], ...FOOT_ROW],
  translationsolo: [['body', 8, 10, 560, 8 * L, 4], ...FOOT_ROW],
  translationideas: [['origin', 8, 0, 560, 2 * L, 0],
    ['question', 8, 0, 560, 6 * L, 4], ['body', 8, 0, 560, 6 * L, 4],
    ['headerDivider', 8, 165, 560, 2, 2, { borderWidth: 1, borderColor: 2 }], ['bottomStatus', 8, 170, 560, L + 1, 2],
    ['log0', 8, 200, 276, 2 * L, 2], ['log2', 296, 200, 272, 2 * L, 2], ['headerSrc', 8, 258, 560, L + 1, 2]],
  myturn: [...CENTRE_PAIR, ...FOOT_ROW],
  card: [['log2', 8, 34, 348, 216, 3, { borderWidth: 1, borderColor: 3, borderRadius: 10 }],
    ['headerSrc', 8, 0, 238, 28, 3], ['headerTime', 246, 0, 110, 28, 2],
    ['body', 20, 40, 324, 7 * L, 4], ['bottomHint', 8, 256, 280, 28, 2], ['bottomDateTime', 290, 256, 66, 28, 2]],
  langlist: [], 
};

function listLayoutSpec(layout: CardLayout, t: Texts) {
  const Lt = LIST_LAYOUT[layout]!;
  const images = Object.entries(LAYOUT_ART[layout]).map(([box, r], i) => ({ ...CARD_IDS[box as CardBox], xPosition: r!.x, yPosition: r!.y, width: r!.w, height: r!.h, zOrderIndex: 1 + i }));
  const names = (t.langs ?? []).slice(0, 20).map((n) => n.slice(0, 40));
  return {
    containerTotalNum: images.length + 3,
    imageObject: images,
    textObject: [
      text(IDS.bottomStatus, Lt.status.x, Lt.status.y, Lt.status.w, Lt.status.h, t.bottomStatus ?? ' ', 6, { textColor: 4 }),
      text(IDS.bottomHint, Lt.hint.x, Lt.hint.y, Lt.hint.w, Lt.hint.h, capFirst(t.bottomHint ?? ' '), 7, { textColor: 3 }),
    ],
    listObject: [{
      ...IDS.langs, xPosition: Lt.list.x, yPosition: Lt.list.y, width: Lt.list.w, height: Lt.list.h, zOrderIndex: 8, isEventCapture: 1,
      borderWidth: 0, paddingLength: 2,
      itemContainer: { itemCount: names.length, itemWidth: Lt.list.w - 4, isItemSelectBorderEn: 1, itemName: names },
    }],
  };
}

function layoutSpec(layout: CardLayout, t: Texts) {
  const images = Object.entries(LAYOUT_ART[layout]).map(([box, r], i) => ({ ...CARD_IDS[box as CardBox], xPosition: r!.x, yPosition: r!.y, width: r!.w, height: r!.h, zOrderIndex: 1 + i }));
  const texts = LAYOUT_TEXT[layout].map(([name, x, y, w, h, lvl, extra], i) =>
    text(IDS[name], x, y, w, h, name === 'body' ? t.body : ' ', 10 + i, { textColor: lvl, ...(name === 'body' ? { isEventCapture: 1 } : {}), ...(extra ?? {}) }));
  return { containerTotalNum: images.length + texts.length, imageObject: images, textObject: texts };
}

export const IMAGE_TIMEOUT_MS = 5000; 
export const LINK_WAIT_MS = 6000;
export const LINK_WAIT_IMAGE_MS = 3000;

export const MENU_ID = { translateStart: 4, translateStop: 5, translateTo: 11 } as const;
export interface MenuState { translating: boolean }
export function menuFor(m: MenuState) {
  return {
    menuItems: [
      m.translating ? { itemName: 'Stop Translation', itemID: MENU_ID.translateStop } : { itemName: 'Start Translation', itemID: MENU_ID.translateStart },
      { itemName: 'Change Languages', itemID: MENU_ID.translateTo },
    ],
  };
}

type Id = { containerID: number; containerName: string };
export type Page = 'normal' | 'langs' | 'chat' | 'dark';

const text = (id: Id, x: number, y: number, w: number, h: number, content: string, z: number, extra: Record<string, unknown> = {}) => ({
  ...id, xPosition: x, yPosition: y, width: w, height: h, content: content || ' ', zOrderIndex: z, isEventCapture: 0,
  ...(extra.isEventCapture === 1 ? {} : { paddingLength: 0 }), ...extra,
});

type Texts = { body: string; bottomStatus?: string; bottomHint?: string; langs?: string[]; layout?: CardLayout | null };

export function pageSpec(kind: Page, t: Texts, menu?: MenuState) {
  const spec = baseSpec(kind, t);
  const out = menu ? { ...spec, menuObject: menuFor(menu) } : spec;
  const layout = (kind === 'chat' && t.layout === 'myturn') || (kind === 'normal' && t.layout && !LIST_LAYOUT[t.layout])
    || (kind === 'langs' && t.layout && LIST_LAYOUT[t.layout]) ? t.layout : null;
  Object.defineProperty(out, 'layout', { value: layout, enumerable: false }); 
  return out;
}

type Spec = { textObject?: { containerName: string; content?: string; textColor?: number }[]; listObject?: unknown[]; menuObject?: unknown };

const emptyPage = () => ({ containerTotalNum: 1, textObject: [text(IDS.body, 8, 4, 560, 280, ' ', 5, { isEventCapture: 1 })] });

function baseSpec(kind: Page, t: Texts) {
  if (kind === 'langs') return listLayoutSpec('langlist', t);
  if (kind === 'chat') return layoutSpec('myturn', t);
  if (kind === 'normal' && t.layout && !LIST_LAYOUT[t.layout]) return layoutSpec(t.layout, t);
  return emptyPage(); 
}

const utf8Len = (s: string): number => new TextEncoder().encode(s).length;

export class Glasses {
  bridge: EvenAppBridge;
  page: Page = 'normal';
  menu: MenuState = { translating: false }; 
  lastRebuild = ''; 
  private texts: Record<string, string> = {};
  private imageChain: Promise<unknown> = Promise.resolve();
  private sending = false; 
  private link: Promise<unknown> = Promise.resolve(); 
  layoutFor: (kind: Page) => CardLayout | null = () => null;
  layoutBuilt: CardLayout | null = null; 
  private cardWanted: Partial<Record<CardBox, { key: string; png: number[] }>> = {};
  private cardSent: Partial<Record<CardBox, string>> = {};
  private base: Record<string, number> = {}; 
  private built: Record<string, number> = {}; 
  private colors: Record<string, number> = {}; 
  private full: Spec | null = null; 

  constructor(bridge: EvenAppBridge) {
    this.bridge = bridge;
  }

  async settle(): Promise<void> {
    if (this.pendingSpec) return; 
    const spec = this.full;
    if (this.lastRebuild !== 'true' && spec && this.page !== 'dark') {
      await this.rebuild(() => spec, () => { this.texts = {}; });
      return;
    }
    this.texts = {};
  }

  boxW(name: string, fallback: number): number {
    return (this.full?.textObject as { containerName: string; width?: number }[] | undefined)?.find((b) => b.containerName === name)?.width ?? fallback;
  }

  showCard(box: CardBox, key: string, png: number[]): Promise<void> {
    this.cardWanted[box] = { key, png };
    return this.pump();
  }
  cardNeeds(box: CardBox, key: string): boolean {
    return !this.cooling(box) && !!this.layoutBuilt && !!LAYOUT_ART[this.layoutBuilt][box] && this.cardSent[box] !== key && this.cardWanted[box]?.key !== key;
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

  async create(t: { body: string }): Promise<boolean> {
    const spec = pageSpec('normal', t, this.menu);
    let ok = await this.queue(async () => {
      const made = (await this.bridge.createStartUpPageContainer(spec as any)) === StartUpPageCreateResult.success;
      if (made) this.adopt(spec);
      return made;
    });
    if (!ok) ok = await this.rebuild(() => spec);
    this.page = 'normal';
    this.texts = { body: t.body || ' ' };
    return ok;
  }

  async setPage(kind: Page, t: { body: string; bottomStatus?: string; bottomHint?: string; langs?: string[] }, force = false): Promise<boolean> {
    if (this.page === kind && !force) return true;
    return this.defer(() => pageSpec(kind, { ...t, layout: this.layoutFor(kind) }, this.menu), () => {
      this.page = kind;
      this.texts = { body: t.body || ' ' };
    });
  }

  private rebuild(spec: () => unknown | null, after?: () => void): Promise<boolean> {
    return this.queue(async () => {
      const asked = spec() as Spec | null;
      if (!asked) return false;
      try {
        const res = await this.bridge.rebuildPageContainer(asked as any);
        this.lastRebuild = JSON.stringify(res);
        this.markBuilt(asked);
        after?.();
        return true;
      } catch (e) {
        this.lastRebuild = `error: ${String(e).slice(0, 80)}`;
        return false;
      }
    });
  }

  private markBuilt(asked: Spec): void {
    this.layoutBuilt = (asked as { layout?: CardLayout | null }).layout ?? null;
    this.cardSent = {}; 
    this.failUntil = {}; 
    this.failRuns = {};
    this.adopt(asked);
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
    this.markBuilt(asked);
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
      const gen = this.noted; 
      let page = inPage(true);
      let res = await send(page);
      if (res === false || res === 'error') {
        for (const k of Object.keys(later)) delete later[k];
        total = 0;
        page = inPage(false);
        res = await send(page);
      }
      if (this.noted !== gen) return; 
      this.markBuilt(asked);
      this.texts = {};
      for (const b of page.textObject ?? []) this.texts[b.containerName] = b.content ?? ' ';
      for (const [name, content] of Object.entries(later)) { 
        const id = (IDS as Record<string, Id>)[name];
        if (!id) continue;
        const eff = this.base[name] ?? 4;
        try {
          const ok = await this.bridge.textContainerUpgrade({ ...id, content: content.slice(0, 2000), textColor: eff } as any);
          if (ok !== false) { this.texts[name] = content; this.colors[name] = eff; }
        } catch {  }
      }
    }).then(() => {
      void this.pump(); 
      this.onBuilt?.();
    });
  }

  private adopt(asked: Spec): void {
    this.full = asked;
    this.base = {};
    this.built = {};
    this.colors = {};
    for (const b of asked.textObject ?? []) {
      if (b.textColor === undefined) continue;
      this.base[b.containerName] = b.textColor;
      this.built[b.containerName] = this.colors[b.containerName] = b.textColor;
    }
  }

  async refreshMenu(m: MenuState): Promise<boolean> {
    if (m.translating === this.menu.translating) return false;
    this.menu = { ...m };
    if (this.page === 'langs') return false;
    if (this.pendingSpec) return true; 
    if (this.page !== 'dark') return this.defer(() => (this.page === 'normal' || this.page === 'chat' ? this.keptSpec() : null), undefined, true);
    return this.rebuild(() => (this.page === 'dark' ? pageSpec('dark', { body: ' ' }, this.menu) : null));
  }

  private keptSpec() {
    return pageSpec(this.page, { body: this.texts.body || ' ', layout: this.layoutFor(this.page) }, this.menu);
  }

  async syncLayout(): Promise<boolean> {
    const fits = () => this.page === 'chat' || this.page === 'normal';
    const differs = () => this.layoutFor(this.page) !== this.layoutBuilt;
    if (!fits() || !differs()) return false;
    return this.defer(() => (fits() && differs() ? this.keptSpec() : null), () => {
      this.texts = { body: this.texts.body || ' ' }; 
    });
  }

  private stage(id: Id, content: string, textColor?: number): void {
    const name = id.containerName;
    if (this.page === 'langs' || !(this.full?.textObject ?? []).some((b) => b.containerName === name)) return;
    const value = (name === 'bottomHint' ? capFirst(content || '') : content) || ' ';
    this.staged[name] = value;
    this.texts[name] = value;
    if (textColor !== undefined) { this.stagedColor[name] = textColor; this.base[name] = textColor; }
  }

  setText(id: Id, content: string, textColor?: number, force = false): Promise<void> {
    if (this.pendingSpec) { this.stage(id, content, textColor); return Promise.resolve(); }
    return this.queue(async () => {
      if (this.pendingSpec) return this.stage(id, content, textColor);
      if (this.page === 'langs' || !(this.full?.textObject ?? []).some((b) => b.containerName === id.containerName)) return;
      const name = id.containerName;
      const value = (name === 'bottomHint' ? capFirst(content || '') : content) || ' '; 
      if (textColor !== undefined) this.base[name] = textColor;
      const eff = this.base[name] ?? 4;
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
        throw e;
      }
      if (ok === true) this.textYes++;
      else if (ok === false && this.textYes > 0) forget();
    });
  }
  private textYes = 0; 

  private transfer(id: Id, data: number[], still: () => boolean = () => true): Promise<boolean> {
    return this.queue(() => (still() ? this.transferNow(id, data) : Promise.resolve(false)), LINK_WAIT_IMAGE_MS);
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

  private async transferNow(id: Id, data: number[]): Promise<boolean> {
    const res = await Promise.race([
      this.bridge.updateImageRawData({ ...id, imageData: data } as any),
      new Promise((r) => setTimeout(() => r('timeout'), IMAGE_TIMEOUT_MS)),
    ]);
    const ok = res !== 'timeout' && ImageRawDataUpdateResult.isSuccess(res as any);
    if (!ok && res !== 'timeout') console.warn('image update failed', id.containerName, res);
    this.noteImage(id.containerName, ok);
    return ok;
  }

  private pump(): Promise<void> {
    if (this.sending) return this.imageChain.then(() => undefined);
    this.sending = true;
    const run = (async () => {
      try {
        for (;;) {
          if (this.pendingSpec) break; 
          const card = (['cardA', 'cardB'] as const).find((b) => this.cardWanted[b]);
          if (!card) break;
          const job = this.cardWanted[card]!;
          delete this.cardWanted[card];
          const here = () => this.page !== 'dark' && !!this.layoutBuilt && !!LAYOUT_ART[this.layoutBuilt][card];
          if (!here() || this.cardSent[card] === job.key) continue;
          if (!(await this.transfer(CARD_IDS[card], job.png, here))) break;
          this.cardSent[card] = job.key;
        }
      } finally {
        this.sending = false;
      }
    })();
    this.imageChain = run.catch(() => undefined);
    return run;
  }

  async blank(): Promise<boolean> {
    this.dropPending(); 
    return this.rebuild(() => pageSpec('dark', { body: ' ' }, this.menu), () => {
      this.page = 'dark';
      this.texts = {};
    });
  }

  mic(on: boolean, source: 'glasses' | 'phone' = 'glasses'): Promise<boolean> {
    return this.bridge.audioControl(on, source === 'phone' ? AudioInputSource.Phone : AudioInputSource.Glasses);
  }
}
