import { validateEvenHubPageContainer } from '@evenrealities/even_hub_sdk';
import { pageSpec, AVATAR, AVATAR_X, AVATAR_Y, IDS } from '../src/glasses.ts';

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) fails++;
};

for (const kind of ['normal', 'approval']) {
  const p = pageSpec(kind, { header: 'HERMES ●  ● LISTENING', body: 'x'.repeat(800) });
  const all = [...(p.imageObject || []), ...(p.textObject || []), ...(p.listObject || [])];
  check(`${kind}: containerTotalNum matches (${all.length})`, p.containerTotalNum === all.length);
  check(`${kind}: <= 12 containers, <= 8 texts, <= 4 images`, all.length <= 12 && p.textObject.length <= 8 && p.imageObject.length <= 4);
  check(`${kind}: exactly one isEventCapture`, all.filter((c) => c.isEventCapture === 1).length === 1);
  check(`${kind}: everything inside 576x288`, all.every((c) => c.xPosition >= 0 && c.yPosition >= 0 && c.xPosition + c.width <= 576 && c.yPosition + c.height <= 288));
  check(`${kind}: no Hermes sprite box`, !p.imageObject.some((i) => i.containerName === 'avatar'));
  check(`${kind}: pictures inside the 20..288 x 20..144 limits`, p.imageObject.every((img) => img.width >= 20 && img.width <= 288 && img.height >= 20 && img.height <= 144));
  const body = p.textObject.find((c) => c.containerName === 'body');
  check(`${kind}: the text sits above the footer`, body.xPosition === 8 && body.yPosition + body.height <= 226);
  check(`${kind}: text content within the 1000-char create limit`, p.textObject.every((c) => c.content.length <= 1000));
  const ovl = (a, b) => a.xPosition < b.xPosition + b.width && b.xPosition < a.xPosition + a.width && a.yPosition < b.yPosition + b.height && b.yPosition < a.yPosition + a.height;
  const overlaps = all.filter((c) => !p.imageObject.includes(c) && p.imageObject.some((i) => ovl(c, i)));
  check(`${kind}: nothing overlaps a picture`, overlaps.length === 0, overlaps.map((c) => c.containerName).join());
  const v = validateEvenHubPageContainer(p);
  check(`${kind}: SDK validator accepts the page`, v === true || v?.ok === true || v?.valid === true || (Array.isArray(v?.errors) && !v.errors.length), JSON.stringify(v).slice(0, 300));
}
for (const kind of ['normal', 'chat', 'approval', 'langs', 'dark']) {
  const v = validateEvenHubPageContainer(pageSpec(kind, { header: 'h', body: 'b', history: 'h', question: 'q', langs: ['Korean', 'Spanish'] }));
  check(`SDK validator accepts the ${kind} page`, v?.valid === true, JSON.stringify(v).slice(0, 200));
}
const n = pageSpec('normal', { header: 'h', body: 'b' });
check('normal page: the body is the input box (native scroll)', n.textObject.find((c) => c.containerName === 'body').isEventCapture === 1);
const a = pageSpec('approval', { header: 'h', body: 'b' });
const list = a.listObject[0];
check('approval page: list APPROVE, DENY captures input', list.isEventCapture === 1 && list.itemContainer.itemName.join() === 'APPROVE,DENY' && list.containerID === IDS.choice.containerID);
check('approval page: list item names fit 63 bytes', list.itemContainer.itemName.every((s) => Buffer.byteLength(s) <= 63));

const overlap = (a, b) => a.xPosition < b.xPosition + b.width && b.xPosition < a.xPosition + a.width && a.yPosition < b.yPosition + b.height && b.yPosition < a.yPosition + a.height;
const np = pageSpec('normal', { header: 'h', body: 'b', status: 'thinking...' });
for (const kind of ['normal', 'chat', 'approval']) {
  check(`option B ${kind}: no separate status line (statuses live in the corner)`, !pageSpec(kind, { header: 'h', body: 'b' }).textObject.some((c) => c.containerName === 'status'));
}
const ap = pageSpec('approval', { header: '● APPROVAL NEEDED', body: 'b' });
const alist = ap.listObject[0];
const ahd = ap.textObject.find((c) => c.containerName === 'header');
check('approval: APPROVE / DENY under the question, the status right of the list, both left of the drawing', alist.xPosition === 8
  && ahd.xPosition >= alist.xPosition + alist.width && !overlap(ahd, alist) && ahd.content === '● APPROVAL NEEDED' && alist.yPosition + alist.height <= 288
  && ap.imageObject.every((i) => !overlap(i, ahd) && !overlap(i, alist)) && ap.imageObject.length === 2 && ap.layout === 'approve');
for (const kind of ['approval']) {
  const pg = pageSpec(kind, { header: '●  ● LISTENING', body: 'b' });
  const hd = pg.textObject.find((c) => c.containerName === 'header');
  const others = [...pg.imageObject, ...pg.textObject, ...(pg.listObject || [])].filter((c) => c !== hd);
  check(`option A ${kind}: status line on the bottom edge, overlapping nothing`, hd?.xPosition >= 8
    && hd?.yPosition + hd.height >= 280 && hd?.xPosition + hd.width <= 576 && others.every((c) => !overlap(c, hd)));
  const ft = pg.textObject.find((c) => c.containerName === 'footer');
  if (ft) {
    check(`option A ${kind}: one-line hint above the status line, right of the avatar`, ft.xPosition >= AVATAR_X + AVATAR && ft.yPosition + ft.height <= (hd?.yPosition ?? 288)
      && ft.width >= 390 && others.every((c) => c === ft || !overlap(c, ft)));
    check(`option A ${kind}: status line about 390 px wide`, hd?.width >= 390);
  }
}
{
  const np = pageSpec('normal', { header: 'h', body: 'b', headerSrc: 'WSJ · Pixel glasses ship update improves battery +20%', headerTime: '9:41 AM', bottomStatus: 'NEWS', bottomHint: 'TAP: TOP 3 · SWIPE: NEXT' });
  const src = np.textObject.find((c) => c.containerName === 'headerSrc');
  const time = np.textObject.find((c) => c.containerName === 'headerTime');
  const div = np.textObject.find((c) => c.containerName === 'headerDivider');
  const bstatus = np.textObject.find((c) => c.containerName === 'bottomStatus');
  const bhint = np.textObject.find((c) => c.containerName === 'bottomHint');
  const body = np.textObject.find((c) => c.containerName === 'body');
  check('normal: headerSrc at top-left (source+title combined)', src?.xPosition === 8 && src?.yPosition === 0 && src?.content === 'WSJ · Pixel glasses ship update improves battery +20%' && src?.width === 384);
  check('normal: headerTime at top-right', time?.xPosition === 392 && time?.yPosition === 0);
  check('normal: divider directly below header row', div?.yPosition === 29 && div?.height === 2 && div?.width === 560);
  check('normal: body below divider y=36..225 (7 lines)', body?.yPosition === 36 && body?.yPosition + body?.height === 225 && body?.isEventCapture === 1);
  check('normal: bottom row status + hints right of the 48 px avatar within y=226..282', bstatus?.xPosition === 64 && bstatus?.yPosition === 226
    && bhint?.xPosition === 64 && bhint?.yPosition === 254 && bhint?.yPosition + bhint.height <= 288
    && bstatus?.content === 'NEWS' && bhint?.content === 'TAP: TOP 3 · SWIPE: NEXT');
  check('normal: header row single-line boxes (never wraps)', src?.height === 28 && time?.height === 28);
  const allNp = [...np.imageObject, ...np.textObject, ...(np.listObject || [])];
  check('normal: exactly one isEventCapture (body)', allNp.filter((c) => c.isEventCapture === 1).length === 1);
  check('normal: everything inside 576x288', allNp.every((c) => c.xPosition >= 0 && c.yPosition >= 0 && c.xPosition + c.width <= 576 && c.yPosition + c.height <= 288));
  check('normal: <= 8 text, <= 4 images, <= 12 containers', np.textObject.length <= 8 && np.imageObject.length <= 4 && allNp.length <= 12);
}
{
  const hp = pageSpec('normal', { header: ' ', body: ' ', tray: true, tree: true });
  const all = [...hp.imageObject, ...hp.textObject];
  const names = hp.imageObject.map((i) => i.containerName).sort().join();
  check('home + orb: 2 orb pictures, no Hermes box, <= 11 containers, every layer number used once',
    names === 'artL,artR' && all.length <= 11 && hp.textObject.length <= 8 && hp.containerTotalNum === all.length && new Set(all.map((c) => c.zOrderIndex)).size === all.length, names);
  const pics = hp.imageObject;
  check('home + orb: pictures within the 20..288 x 20..144 limits, inside the screen',
    pics.every((i) => i.width >= 20 && i.height >= 20 && i.width <= 288 && i.height <= 144 && i.xPosition >= 0 && i.xPosition + i.width <= 576 && i.yPosition + i.height <= 288));
  const art = pics.filter((i) => i.containerName.startsWith('art'));
  const frame = hp.textObject.find((c) => c.containerName === 'body');
  check('home + orb: the orb column is right of the list, from under the header to the bottom edge',
    art.every((i) => i.xPosition >= frame.xPosition + frame.width && i.xPosition + i.width === 576) && Math.min(...art.map((i) => i.yPosition)) === 30 && Math.max(...art.map((i) => i.yPosition + i.height)) === 288);
  const rows = hp.textObject.filter((c) => c.containerName.startsWith('homeRow'));
  check('home: 3 item boxes of 3 lines (>= 81 px) inside the list area, not touching each other',
    rows.length === 3 && rows.every((r) => r.height >= 81 && r.xPosition >= frame.xPosition && r.xPosition + r.width <= frame.xPosition + frame.width && r.yPosition >= frame.yPosition && r.yPosition + r.height <= frame.yPosition + frame.height)
    && rows.every((r, i) => i === 0 || rows[i - 1].yPosition + rows[i - 1].height <= r.yPosition));
  check('home: item cards - each item its own dim rounded box, no outer frame; the list area is the one input box',
    rows.every((r) => r.zOrderIndex > frame.zOrderIndex && r.borderWidth === 1 && r.borderColor <= 2 && r.borderRadius > 0) && frame.borderWidth === 0
    && frame.isEventCapture === 1 && all.filter((c) => c.isEventCapture === 1).length === 1);
  const two = pageSpec('normal', { header: ' ', body: ' ', tray: true, tree: true, cards: 2 });
  check('home: a last page with 2 items - the 3rd slot has no card border', two.textObject.filter((c) => c.containerName.startsWith('homeRow')).map((c) => c.borderWidth).join() === '1,1,0');
  check('home: the cards do not touch (a gap between them) and fit the screen',
    rows.every((r, i) => i === 0 || r.yPosition - (rows[i - 1].yPosition + rows[i - 1].height) >= 2) && rows.at(-1).yPosition + rows.at(-1).height <= 288);
  const asleep = pageSpec('normal', { header: ' ', body: ' ', tray: true, tree: true, asleep: true });
  check('home, display off: no card borders', asleep.textObject.filter((c) => c.containerName === 'body' || c.containerName.startsWith('homeRow')).every((c) => c.borderWidth === 0));
  const head = ['homeBattery', 'bottomStatus', 'bottomDateTime'].map((n) => all.find((c) => c.containerName === n));
  check('home: battery, page and date/time share the header row, left to right, without overlapping',
    head.every((c) => c.yPosition === 0 && c.height <= 28) && head[0].xPosition + head[0].width <= head[1].xPosition && head[1].xPosition + head[1].width <= head[2].xPosition && head[2].xPosition + head[2].width <= 576);
  const v = validateEvenHubPageContainer(hp);
  check('home + orb: SDK validator accepts it', v?.valid === true, JSON.stringify(v).slice(0, 200));
  const off = pageSpec('normal', { header: ' ', body: ' ', tray: true });
  check('home, orb off: no pictures at all, no Hermes box', off.imageObject.length === 0 && validateEvenHubPageContainer(off)?.valid === true, JSON.stringify(validateEvenHubPageContainer(off)).slice(0, 200));
  const bat = all.find((c) => c.containerName === 'homeBattery');
  const time = all.find((c) => c.containerName === 'bottomDateTime');
  check('home: "G2 83%" is a text box like the date / time (same height, same level), not a picture',
    !!bat && bat.height === time.height && bat.textColor === time.textColor && !hp.imageObject.some((i) => i.containerName === 'trayL'));
}
const lp = pageSpec('langs', { header: 'TRANSLATE FROM', bottomStatus: 'TRANSLATE FROM', bottomHint: 'Tap a language', body: ' ', langs: ['Korean', 'Spanish'] });
check('langs: list above the avatar, whole height, category + hint in the bottom footer', lp.listObject[0].yPosition + lp.listObject[0].height <= AVATAR_Y
  && lp.listObject[0].yPosition <= 4 && lp.textObject.some((c) => c.containerName === 'bottomStatus' && c.yPosition === 226) && lp.textObject.some((c) => c.containerName === 'bottomHint' && c.yPosition === 254) && lp.listObject[0].width === 560);

{
  const { menuFor, MENU_ID } = await import('../src/glasses.ts');
  const m1 = menuFor({ meeting: false, translating: false, listening: true }).menuItems;
  check('side menu (i-translate): Start Translation + Change Languages', m1.map((i) => i.itemName).join('|') === 'Start Translation|Change Languages');
  const m2 = menuFor({ meeting: true, translating: true, listening: false }).menuItems;
  check('side menu (i-translate): translating reads Stop', m2.map((i) => i.itemName).join('|') === 'Stop Translation|Change Languages'
    && m2[0].itemID === MENU_ID.translateStop && m2[1].itemID === MENU_ID.translateTo);
  for (const kind of ['normal', 'chat', 'approval', 'confirm', 'langs', 'dark']) {
    const spec = pageSpec(kind, { header: 'h', body: 'b', langs: ['a'] }, { meeting: false, translating: false, listening: true });
    const r = validateEvenHubPageContainer(spec);
    check(`side menu on the ${kind} page, SDK validator accepts it`, spec.menuObject?.menuItems?.length === 2 && (r === true || r.valid === true), JSON.stringify(r).slice(0, 200));
  }
}

const cp = pageSpec('chat', { header: 'h', body: 'b', headerSrc: 'Hermes · What is the weather?', headerTime: '10:45 AM', bottomStatus: '● TALK WITH HERMES', bottomHint: 'swipe: scroll · double tap: close · Nov 10 10:45 AM', bottomDateTime: '15s' });
const src = cp.textObject.find((c) => c.containerName === 'headerSrc');
const time = cp.textObject.find((c) => c.containerName === 'headerTime');
const div = cp.textObject.find((c) => c.containerName === 'headerDivider');
const cb = cp.textObject.find((c) => c.containerName === 'body');
const bstatus = cp.textObject.find((c) => c.containerName === 'bottomStatus');
const bhint = cp.textObject.find((c) => c.containerName === 'bottomHint');
const bdt = cp.textObject.find((c) => c.containerName === 'bottomDateTime');
check('chat: headerSrc at top-left (source+title combined)', src?.xPosition === 8 && src?.yPosition === 0 && src?.content === 'Hermes · What is the weather?' && src?.width === 384);
check('chat: headerTime at top-right', time?.xPosition === 392 && time?.yPosition === 0);
check('chat: divider directly below header row', div?.yPosition === 29 && div?.height === 2 && div?.width === 560);
check('chat: body full height y=36..225', cb?.yPosition === 36 && cb?.yPosition + cb?.height === 225 && cb?.isEventCapture === 1);
check('chat: bottom row status + hints right of the 48 px avatar within y=226..282', bstatus?.xPosition === 64 && bstatus?.yPosition === 226
  && bhint?.xPosition === 64 && bhint?.yPosition === 254 && bhint?.yPosition + bhint.height <= 288
  && bstatus?.content === '● TALK WITH HERMES' && bhint?.content === 'swipe: scroll · double tap: close · Nov 10 10:45 AM');
check('chat: countdown timer at far right bottom corner', bdt?.xPosition === 408 && bdt?.yPosition === 226 && bdt?.xPosition + bdt.width === 576 && bdt?.content === '15s');
check('chat: header row single-line boxes (never wraps)', src?.height === 28 && time?.height === 28);
const allCp = [...cp.imageObject, ...cp.textObject, ...(cp.listObject || [])];
check('chat: exactly one isEventCapture (body)', allCp.filter((c) => c.isEventCapture === 1).length === 1);
check('chat: everything inside 576x288', allCp.every((c) => c.xPosition >= 0 && c.yPosition >= 0 && c.xPosition + c.width <= 576 && c.yPosition + c.height <= 288));
check('chat: <= 9 text, <= 4 images, <= 12 containers', cp.textObject.length <= 9 && cp.imageObject.length <= 4 && allCp.length <= 12);
check('chat: no log lines or question container', !cp.textObject.some((c) => ['log0', 'log1', 'log2', 'question', 'footer'].includes(c.containerName)));
const dk = pageSpec('dark', { header: ' ', body: ' ' });
check('dark page: no picture box at all, body only', !dk.imageObject && dk.containerTotalNum === 1
  && dk.textObject.length === 1 && dk.textObject[0].isEventCapture === 1
  && dk.textObject[0].content.trim() === ''
  && dk.textObject[0].containerID === IDS.body.containerID);
check('dark page: SDK validator accepts it', validateEvenHubPageContainer(dk).valid === true || validateEvenHubPageContainer(dk) === true, JSON.stringify(validateEvenHubPageContainer(dk)).slice(0, 200));

for (const kind of ['normal', 'chat', 'approval']) {
  const pg = pageSpec(kind, { header: 'h', body: 'b' });
  const all = [...pg.imageObject, ...pg.textObject, ...(pg.listObject || [])];
  check(`no mic box on the ${kind} page, count matches`, !pg.textObject.some((c) => c.containerName === 'mic') && pg.containerTotalNum === all.length);
}

{
  const op = pageSpec('normal', { header: 'h', body: 'b', orig: true, origin: 'spoken' });
  const og = op.textObject.find((c) => c.containerName === 'origin');
  const bd = op.textObject.find((c) => c.containerName === 'body');
  check('translation card: spoken words box above the body, dimmer', og && bd && og.yPosition === 36 && bd.yPosition === 36 + og.height && og.textColor < bd.textColor);
  check('translation card: body keeps the rest of the height', bd.yPosition + bd.height === 36 + 189);
  check('translation card: SDK validator accepts it', validateEvenHubPageContainer(op).valid, JSON.stringify(validateEvenHubPageContainer(op)));
  const plain = pageSpec('normal', { header: 'h', body: 'b' });
  check('plain card: no spoken-words box, body from y=36 with 189 px', !plain.textObject.some((c) => c.containerName === 'origin') && plain.textObject.find((c) => c.containerName === 'body').height === 189);
}

for (const [name, kind, orig] of [['translation card', 'normal', false], ['translation card + spoken words', 'normal', true], ['Your turn', 'chat', false]]) {
  const bp = pageSpec(kind, { header: 'h', body: 'b', orig, origin: 'o', bare: true });
  const all = [...(bp.imageObject || []), ...(bp.textObject || [])];
  const names = bp.textObject.map((c) => c.containerName);
  check(`${name} (no header): containerTotalNum matches (${all.length})`, bp.containerTotalNum === all.length);
  check(`${name} (no header): no header row boxes`, !names.some((x) => x === 'headerSrc' || x === 'headerTime' || x === 'headerDivider'), names.join());
  const top = bp.textObject.find((c) => c.containerName === (orig ? 'origin' : 'body'));
  const bd = bp.textObject.find((c) => c.containerName === 'body');
  check(`${name} (no header): text starts at y=4 and still ends at y=225`, top.yPosition === 4 && bd.yPosition + bd.height === 225);
  check(`${name} (no header): the body is 8 lines (216+ px) without spoken words`, orig || bd.height >= 216);
  const texts = bp.textObject;
  const clash = texts.flatMap((a, i) => texts.slice(i + 1).filter((b) => overlap(a, b)).map((b) => `${a.containerName}/${b.containerName}`));
  check(`${name} (no header): no two text boxes overlap`, clash.length === 0, clash.join());
  check(`${name} (no header): everything inside 576x288`, all.every((c) => c.xPosition >= 0 && c.yPosition >= 0 && c.xPosition + c.width <= 576 && c.yPosition + c.height <= 288));
  const st = bp.textObject.find((c) => c.containerName === 'bottomStatus');
  check(`${name} (no header): status line 440 px wide for the languages`, st.width === 440);
  const v = validateEvenHubPageContainer(bp);
  check(`${name} (no header): SDK validator accepts it`, v?.valid === true, JSON.stringify(v).slice(0, 200));
}
check('a card without bare keeps its header row', pageSpec('normal', { header: 'h', body: 'b' }).textObject.some((c) => c.containerName === 'headerSrc'));
check('a conversation without bare keeps its header row', pageSpec('chat', { header: 'h', body: 'b' }).textObject.some((c) => c.containerName === 'headerSrc'));

for (const [name, spec] of [
  ['home', pageSpec('normal', { header: ' ', body: ' ', tray: true, tree: true })],
  ['card', pageSpec('normal', { header: ' ', body: ' ' })],
  ['translation card', pageSpec('normal', { header: ' ', body: ' ', orig: true, bare: true })],
  ['conversation', pageSpec('chat', { header: ' ', body: ' ' })],
  ['Your turn', pageSpec('chat', { header: ' ', body: ' ', bare: true })],
  ['approval', pageSpec('approval', { header: ' ', body: ' ' })],
  ['list', pageSpec('langs', { header: ' ', body: ' ', langs: ['a', 'b'] })],
]) {
  const fixed = (spec.textObject || []).filter((c) => c.isEventCapture !== 1);
  const bad = fixed.filter((c) => c.paddingLength !== 0 || !(c.height === 2 || c.height >= 27));
  check(`no scroll bars: ${name} - fixed text boxes have no padding, at least one whole line tall`, bad.length === 0, bad.map((c) => `${c.containerName} h${c.height} pad${c.paddingLength}`).join(', '));
}

{
  const { LAYOUT_ART } = await import('../src/glasses.ts');
  const fs = await import('node:fs');
  const pngSize = (f) => { const b = fs.readFileSync(f); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };
  const ov = (a, b) => a.xPosition < b.xPosition + b.width && b.xPosition < a.xPosition + a.width && a.yPosition < b.yPosition + b.height && b.yPosition < a.yPosition + a.height;
  for (const [layout, kind] of [['lifelog'], ['news'], ['mail'], ['talk', 'chat'], ['cue'], ['cuesolo'], ['translation'], ['translationsolo'], ['translationideas'], ['calendar'], ['hermes'], ['myturn', 'chat'], ['myturn', 'normal']]) {
    const p = pageSpec(kind ?? 'normal', { header: ' ', body: 'b', layout }, { meeting: false, translating: false, listening: true });
    const all = [...p.imageObject, ...p.textObject];
    const v = validateEvenHubPageContainer(p);
    check(`${layout}: SDK validator accepts it`, v?.valid === true, JSON.stringify(v).slice(0, 200));
    check(`${layout}: <= 8 texts, <= 4 pictures, one input box (the body), every layer once`, p.textObject.length <= 8 && p.imageObject.length <= 4
      && all.filter((c) => c.isEventCapture === 1).length === 1 && p.textObject.find((c) => c.isEventCapture === 1).containerName === 'body'
      && new Set(all.map((c) => c.zOrderIndex)).size === all.length && p.containerTotalNum === all.length);
    check(`${layout}: everything inside 576x288, pictures <= 288 x 144`, all.every((c) => c.xPosition >= 0 && c.yPosition >= 0 && c.xPosition + c.width <= 576 && c.yPosition + c.height <= 288)
      && p.imageObject.every((i) => i.width <= 288 && i.height <= 144 && i.width >= 20 && i.height >= 20));
    const clash = p.textObject.flatMap((t) => p.imageObject.filter((i) => ov(t, i)).map((i) => `${t.containerName}/${i.containerName}`));
    check(`${layout}: no text over a picture`, clash.length === 0, clash);
    check(`${layout}: no Hermes sprite box (the drawing replaces it)`, !p.imageObject.some((i) => i.containerName === 'avatar'));
    check(`${layout}: the page knows its layout (not sent to the glasses)`, p.layout === layout && !JSON.stringify(p).includes('"layout"'));
    for (const [box, r] of Object.entries(LAYOUT_ART[layout])) {
      if (box === 'cardC' || !fs.existsSync('public/cards')) continue; 
      const f = `public/cards/${layout}-${box === 'cardA' ? 'a' : 'b'}.png`;
      const sz = fs.existsSync(f) ? pngSize(f) : null;
      check(`${layout}: ${f} is exactly its box (${r.w} x ${r.h})`, !!sz && sz.w === r.w && sz.h === r.h, sz);
    }
  }
  const plain = pageSpec('normal', { header: ' ', body: 'b' });
  check('a card without a layout: header row, no Hermes sprite', plain.layout === null && !plain.imageObject.some((i) => i.containerName === 'avatar') && plain.textObject.some((c) => c.containerName === 'headerSrc'));
}

{
  const { LAYOUT_ART, ART_FILE } = await import('../src/glasses.ts');
  const fs = await import('node:fs');
  const pngSize = (f) => { const b = fs.readFileSync(f); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; };
  const ov = (a, b) => a.xPosition < b.xPosition + b.width && b.xPosition < a.xPosition + a.width && a.yPosition < b.yPosition + b.height && b.yPosition < a.yPosition + a.height;
  for (const layout of ['newslist', 'langlist', 'meetlist']) {
    const p = pageSpec('langs', { header: 'X', body: ' ', bottomStatus: 'STATUS', bottomHint: 'hint', langs: ['Korean', 'Japanese', 'Spanish'], layout }, { meeting: false, translating: false, listening: true });
    const all = [...p.imageObject, ...p.textObject, ...p.listObject];
    const v = validateEvenHubPageContainer(p);
    check(`${layout}: SDK validator accepts it`, v?.valid === true, JSON.stringify(v).slice(0, 200));
    check(`${layout}: the list takes the taps, every layer once`, all.filter((c) => c.isEventCapture === 1).length === 1 && p.listObject[0].isEventCapture === 1
      && new Set(all.map((c) => c.zOrderIndex)).size === all.length && p.containerTotalNum === all.length);
    check(`${layout}: everything inside 576x288`, all.every((c) => c.xPosition >= 0 && c.yPosition >= 0 && c.xPosition + c.width <= 576 && c.yPosition + c.height <= 288));
    const clash = [...p.textObject, ...p.listObject].flatMap((t) => p.imageObject.filter((i) => ov(t, i)).map((i) => `${t.containerName}/${i.containerName}`));
    check(`${layout}: nothing over a picture`, clash.length === 0, clash);
    check(`${layout}: no Hermes sprite box`, !p.imageObject.some((i) => i.containerName === 'avatar'));
    check(`${layout}: the page knows its layout`, p.layout === layout);
    check(`${layout}: the list keeps its rows + status + hint`, p.listObject[0].itemContainer.itemCount === 3 && p.textObject.some((t) => t.content === 'STATUS'));
    for (const [box, r] of Object.entries(LAYOUT_ART[layout])) {
      if (!fs.existsSync('public/cards')) continue; 
      const f = `public/cards/${ART_FILE[layout] ?? layout}-${box === 'cardA' ? 'a' : 'b'}.png`;
      const sz = fs.existsSync(f) ? pngSize(f) : null;
      check(`${layout}: ${f} is exactly its box (${r.w} x ${r.h})`, !!sz && sz.w === r.w && sz.h === r.h, sz);
    }
  }
  const tray = pageSpec('langs', { header: 'X', body: ' ', langs: ['a'] }, { meeting: false, translating: false, listening: true });
  check('a list page without a layout has no Hermes sprite either', tray.layout === null && !(tray.imageObject || []).some((i) => i.containerName === 'avatar'));
}

for (const [kind, t] of [['normal', { tray: true, tree: true }], ['normal', {}], ['chat', {}], ['approval', {}], ['langs', { langs: ['a'] }],
  ...['lifelog', 'news', 'mail', 'cue', 'cuesolo', 'translation', 'translationsolo', 'translationideas', 'calendar', 'hermes', 'myturn'].map((l) => ['normal', { layout: l }]), ['chat', { layout: 'talk' }],
  ...['newslist', 'langlist', 'meetlist', 'maillist', 'loglist', 'chatlist', 'callist'].map((l) => ['langs', { layout: l, langs: ['a'] }])]) {
  const p = pageSpec(kind, { header: ' ', body: ' ', ...t });
  const n = (p.imageObject || []).length + (p.textObject || []).length + (p.listObject || []).length;
  check(`${kind} ${t.layout || (t.tray ? 'home' : '')}: <= 4 pictures, <= 11 boxes`, (p.imageObject || []).length <= 4 && n <= 11, `${(p.imageObject || []).length} pictures, ${n} boxes`);
}

{
  const box = (p, n) => p.textObject.find((c) => c.containerName === n);
  for (const [layout, kind] of [['myturn', 'chat'], ['myturn', 'normal']]) {
    const p = pageSpec(kind, { header: ' ', body: 'b', layout }, { meeting: false, translating: true, listening: true });
    const o = box(p, 'origin'), line = box(p, 'log1'), b = box(p, 'body');
    check(`B ${layout}/${kind}: no pictures`, p.imageObject.length === 0);
    check(`B ${layout}/${kind}: both texts full width (8..568)`, [o, b].every((c) => c && c.xPosition === 8 && c.width === 560));
    check(`B ${layout}/${kind}: other language above the centre line, English under it`, o.yPosition + o.height <= line.yPosition && b.yPosition > line.yPosition && line.width === 560);
    check(`B ${layout}/${kind}: other language dim, English brightest`, o.textColor < b.textColor && b.textColor === 4);
    const foot = ['headerSrc', 'bottomHint'].map((n) => box(p, n));
    check(`B ${layout}/${kind}: mode left, hint + timer in one box to the right edge`, foot.every((c) => c && c.yPosition === 256)
      && foot[0].xPosition === 8 && foot[0].xPosition + foot[0].width <= foot[1].xPosition && foot[1].xPosition + foot[1].width === 568
      && foot[0].width >= 232 && !box(p, 'bottomDateTime'), foot);
    check(`B ${layout}/${kind}: text ends above the bottom row`, b.yPosition + b.height <= 256);
  }
  {
    const p = pageSpec('normal', { header: ' ', body: 'b', layout: 'cue' }, { meeting: true, translating: false, listening: true });
    const h = box(p, 'headerSrc'), o = box(p, 'origin'), line = box(p, 'log1'), b = box(p, 'body'), hint = box(p, 'bottomHint');
    check('cue: no pictures', p.imageObject.length === 0);
    check('cue: Just said at the very top (top-aligned), 4 lines', o.yPosition === 0 && o.height === 4 * 27, o);
    check('cue: Just said at level 0, a try', box(p, 'origin').textColor === 0, box(p, 'origin').textColor);
    check('cue: label in the footer, dim, left; the commands on the same row (one row, like translation)', h && h.xPosition === 8 && h.yPosition === 256 && h.textColor <= 2
      && hint && hint.yPosition === 256 && hint.xPosition === 8 && hint.width === 560, { h, hint });
    check('cue: Just said (dim) on the centre line, the cue (bright) under it, full width', o.yPosition + o.height <= line.yPosition && b.yPosition > line.yPosition
      && [o, b].every((c) => c.xPosition === 8 && c.width === 560) && o.textColor < b.textColor && b.textColor === 4);
    check('cue: text above the bottom row, no separate timer box', b.yPosition + b.height <= 256 && !box(p, 'bottomDateTime'), b);
  }
  {
    const p = pageSpec('normal', { header: ' ', body: 'b', layout: 'cuesolo' }, { meeting: true, translating: false, listening: true });
    const h = box(p, 'headerSrc'), line = box(p, 'log1'), b = box(p, 'body'), hint = box(p, 'bottomHint');
    check('cuesolo: no Just said box, no pictures', !box(p, 'origin') && p.imageObject.length === 0);
    check('cuesolo: label in the footer, no line', h.yPosition === 256 && !line, { h, line });
    check('cuesolo: the cue bright from the top, full width, 9 lines, above the bottom row', b.yPosition === 0 && b.xPosition === 8 && b.width === 560
      && b.textColor === 4 && b.height >= 9 * 27 && b.yPosition + b.height <= 256, b);
    check('cuesolo: the commands across the whole bottom row', hint.xPosition === 8 && hint.width === 560 && hint.yPosition === 256);
  }
  {
    const p = pageSpec('chat', { header: ' ', body: 'b', layout: 'talk' }, { meeting: false, translating: false, listening: true });
    const framed = p.textObject.filter((c) => c.borderWidth > 0);
    const f = framed[0], o = box(p, 'origin'), b = box(p, 'body');
    check('talk: one box border', framed.length === 1, framed.map((c) => c.containerName));
    check('talk: the frame 10% wider, the drawing still beside it', f.width === 383 && p.imageObject.every((i) => i.xPosition >= f.xPosition + f.width), { w: f.width, pics: p.imageObject.map((i) => i.xPosition) });
    check('talk: past and current (level 4) share one rectangle inside the frame', o && b && o.textColor === 0 && b.textColor === 4
      && o.xPosition === b.xPosition && o.yPosition === b.yPosition && o.width === b.width && o.height === b.height
      && b.xPosition > f.xPosition && b.yPosition > f.yPosition && b.xPosition + b.width < f.xPosition + f.width && b.yPosition + b.height < f.yPosition + f.height
      && b.height >= 7 * 27, { o, b, f });
    check('talk: the current text drawn over the past', b.zOrderIndex > o.zOrderIndex);
    check('talk: no separate question box', !box(p, 'log0'));
  }
  {
    const p = pageSpec('normal', { header: ' ', body: 'b', layout: 'translation' }, { meeting: false, translating: true, listening: true });
    const o = box(p, 'origin'), b = box(p, 'body');
    check('translation (ideas off): no pictures, no centre line', p.imageObject.length === 0 && !box(p, 'log1'));
    check('translation (ideas off): their words level 0, the English level 4, one full-width area from the top',
      o && b && o.textColor === 0 && b.textColor === 4 && o.yPosition === 0 && b.yPosition === 0 && [o, b].every((c) => c.xPosition === 8 && c.width === 560), { o, b });
    check('translation (ideas off): both boxes the same 9-line area, above the bottom row', o.height === 9 * 27 && b.height === 9 * 27 && b.yPosition + b.height <= 256, { o, b });
    check('translation (ideas off): the English drawn over their words', b.zOrderIndex > o.zOrderIndex);
    const foot = ['headerSrc', 'bottomHint'].map((n) => box(p, n));
    check('translation (ideas off): mode left, hint right on the bottom row', foot.every((c) => c && c.yPosition === 256) && foot[1].xPosition + foot[1].width === 568);
  }
  const solo = pageSpec('normal', { header: ' ', body: 'b', layout: 'translationsolo' }, { meeting: false, translating: true, listening: true });
  const sb = box(solo, 'body');
  check('B translationsolo: English alone (no other-language box, no line), bright, full width, over the middle', !box(solo, 'origin') && !box(solo, 'log1')
    && sb.textColor === 4 && sb.width === 560 && sb.yPosition < 118 && sb.yPosition + sb.height > 124 && sb.yPosition + sb.height <= 256 && solo.imageObject.length === 0);
}

{
  const p = pageSpec('normal', { header: ' ', body: 'b', layout: 'translationideas' }, { meeting: false, translating: true, listening: true });
  const box = (n) => p.textObject.find((c) => c.containerName === n);
  const [b, st, dv, lab, r, a] = ['body', 'headerSrc', 'headerDivider', 'bottomStatus', 'log0', 'log2'].map(box);
  const [past, now] = ['origin', 'question'].map(box);
  check('B translationideas: 8 texts (the limit), no pictures', p.textObject.length === 8 && p.imageObject.length === 0, p.textObject.length);
  check('B translationideas: their words (level 0, 2 lines) and the English (bright, 6-line area) from the top, no padding',
    past && now && past.yPosition === 0 && past.height === 2 * 27 && past.textColor === 0 && now.yPosition === 0
    && now.height === 6 * 27 && now.textColor === 4 && past.paddingLength === 0 && now.paddingLength === 0 && now.yPosition + now.height <= dv.yPosition);
  check('B translationideas: the input box is listed after the conversation boxes (over them, empty)', b && b.isEventCapture === 1
    && p.textObject.indexOf(b) > p.textObject.indexOf(past) && p.textObject.indexOf(b) > p.textObject.indexOf(now));
  check('B translationideas: divider and labels under the English; the status + hint line at the very bottom, under the ideas',
    dv.yPosition >= b.yPosition + b.height && lab.yPosition >= dv.yPosition + dv.height && lab.height >= 27
    && st.height >= 27 && st.yPosition >= r.yPosition + r.height && st.yPosition >= a.yPosition + a.height && st.yPosition + st.height <= 288);
  check('B translationideas: the reply left, the question right, side by side, 2 lines each, inside the screen',
    r.xPosition + r.width <= a.xPosition && r.yPosition === a.yPosition && r.yPosition >= lab.yPosition + lab.height && [r, a].every((c) => c.height >= 54 && c.yPosition + c.height <= 288));
  check('B translationideas: fixed boxes have no padding (no scroll bars)', p.textObject.filter((c) => c.isEventCapture !== 1).every((c) => c.paddingLength === 0));
}

console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
