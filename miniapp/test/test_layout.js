import { validateEvenHubPageContainer } from '@evenrealities/even_hub_sdk';
import { pageSpec, menuFor } from '../src/glasses.ts';

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${JSON.stringify(detail).slice(0, 300)}`}`);
  if (!ok) fails++;
};
const menu = { translating: true };
const box = (p, n) => p.textObject.find((c) => c.containerName === n);
const all = (p) => [...(p.imageObject || []), ...(p.textObject || []), ...(p.listObject || [])];
const ovl = (a, b) => a.xPosition < b.xPosition + b.width && b.xPosition < a.xPosition + a.width && a.yPosition < b.yPosition + b.height && b.yPosition < a.yPosition + a.height;

const PAGES = [
  ['start screen / language list', pageSpec('langs', { body: ' ', bottomStatus: 'I-TRANSLATE · KO → EN', bottomHint: 'Tap: choose', langs: ['▶ Start   Korean → English', 'They speak:  Korean'], layout: 'langlist' }, menu)],
  ['Translation (ideas off)', pageSpec('normal', { body: 'b', layout: 'translation' }, menu)],
  ['Translation (what they said hidden)', pageSpec('normal', { body: 'b', layout: 'translationsolo' }, menu)],
  ['Translation (reply ideas)', pageSpec('normal', { body: 'b', layout: 'translationideas' }, menu)],
  ['your translated line', pageSpec('normal', { body: 'b', layout: 'myturn' }, menu)],
  ['Your turn', pageSpec('chat', { body: 'b', layout: 'myturn' }, menu)],
  ['status card', pageSpec('normal', { body: 'x'.repeat(800), layout: 'card' }, menu)],
  ['empty page', pageSpec('normal', { body: ' ' }, menu)],
  ['dark', pageSpec('dark', { body: ' ' }, menu)],
];
for (const [name, p] of PAGES) {
  const a = all(p);
  check(`${name}: containerTotalNum matches (${a.length})`, p.containerTotalNum === a.length);
  check(`${name}: <= 4 pictures, <= 8 texts, <= 11 boxes`, (p.imageObject || []).length <= 4 && p.textObject.length <= 8 && a.length <= 11, a.length);
  check(`${name}: exactly one input box`, a.filter((c) => c.isEventCapture === 1).length === 1);
  check(`${name}: everything inside 576x288`, a.every((c) => c.xPosition >= 0 && c.yPosition >= 0 && c.xPosition + c.width <= 576 && c.yPosition + c.height <= 288));
  check(`${name}: pictures inside the 20..288 x 20..144 limits`, (p.imageObject || []).every((img) => img.width >= 20 && img.width <= 288 && img.height >= 20 && img.height <= 144));
  check(`${name}: every layer number used once`, new Set(a.map((c) => c.zOrderIndex)).size === a.length);
  const overText = a.filter((c) => !(p.imageObject || []).includes(c) && (p.imageObject || []).some((i) => ovl(c, i)));
  check(`${name}: nothing overlaps a picture`, overText.length === 0, overText.map((c) => c.containerName));
  const bad = p.textObject.filter((c) => c.isEventCapture !== 1).filter((c) => c.paddingLength !== 0 || !(c.height === 2 || c.height >= 27));
  check(`${name}: no scroll bars on fixed boxes`, bad.length === 0, bad.map((c) => `${c.containerName} h${c.height} pad${c.paddingLength}`));
  const v = validateEvenHubPageContainer(p);
  check(`${name}: SDK validator accepts it`, v?.valid === true, v);
  check(`${name}: carries the side menu`, !!p.menuObject?.menuItems?.length);
}

check('side menu: Start Translation + Change Languages', menuFor({ translating: false }).menuItems.map((i) => i.itemName).join('|') === 'Start Translation|Change Languages');
check('side menu: translating reads Stop', menuFor({ translating: true }).menuItems.map((i) => i.itemName).join('|') === 'Stop Translation|Change Languages');

{
  const p = PAGES[0][1];
  const list = p.listObject[0];
  check('list: the list takes the input, rows fit 63 bytes', list.isEventCapture === 1 && list.itemContainer.itemName.every((s) => Buffer.byteLength(s) <= 63));
  check('list: two pictures right of the list', p.imageObject.length === 2 && p.imageObject.every((i) => i.xPosition >= list.xPosition + list.width));
  check('list: status + hint under the list', ['bottomStatus', 'bottomHint'].every((n) => box(p, n).yPosition >= list.yPosition + list.height));
  check('list: layout noted for the app', p.layout === 'langlist');
}

{
  const p = PAGES[6][1];
  const frame = box(p, 'log2'), body = box(p, 'body');
  check('card: framed text left of the pictures', frame.borderWidth === 1 && body.xPosition >= frame.xPosition && body.xPosition + body.width <= frame.xPosition + frame.width
    && p.imageObject.length === 2 && p.imageObject.every((i) => i.xPosition >= frame.xPosition + frame.width));
  check('card: text content within the 1000-char build limit', p.textObject.every((c) => (c.content || '').length <= 1000));
}

for (const [name, p] of [PAGES[7], PAGES[8]]) check(`${name}: no picture box, body only`, !(p.imageObject || []).length && p.containerTotalNum === 1 && p.textObject[0].containerName === 'body');
check('empty page: no layout', PAGES[7][1].layout === null);

for (const [name, p] of [PAGES[4], PAGES[5]]) {
  const o = box(p, 'origin'), line = box(p, 'log1'), b = box(p, 'body');
  check(`${name}: no pictures`, p.imageObject.length === 0);
  check(`${name}: both texts full width (8..568)`, [o, b].every((c) => c && c.xPosition === 8 && c.width === 560));
  check(`${name}: other language above the centre line, yours under it`, o.yPosition + o.height <= line.yPosition && b.yPosition > line.yPosition && line.width === 560);
  check(`${name}: other language dim, yours brightest`, o.textColor < b.textColor && b.textColor === 4);
  const foot = ['headerSrc', 'bottomHint'].map((n) => box(p, n));
  check(`${name}: mode left, hint + timer in one box to the right edge`, foot.every((c) => c && c.yPosition === 256)
    && foot[0].xPosition === 8 && foot[0].xPosition + foot[0].width <= foot[1].xPosition && foot[1].xPosition + foot[1].width === 568 && !box(p, 'bottomDateTime'));
  check(`${name}: text ends above the bottom row`, b.yPosition + b.height <= 256);
}

{
  const p = PAGES[1][1];
  const o = box(p, 'origin'), b = box(p, 'body');
  check('translation (ideas off): no pictures, no centre line', p.imageObject.length === 0 && !box(p, 'log1'));
  check('translation (ideas off): their words level 0, the translation level 4, one full-width area from the top',
    o.textColor === 0 && b.textColor === 4 && o.yPosition === 0 && b.yPosition === 0 && [o, b].every((c) => c.xPosition === 8 && c.width === 560));
  check('translation (ideas off): both boxes the same 9-line area, above the bottom row', o.height === 9 * 27 && b.height === 9 * 27 && b.yPosition + b.height <= 256);
  check('translation (ideas off): the translation drawn over their words', b.zOrderIndex > o.zOrderIndex);
  const solo = PAGES[2][1], sb = box(solo, 'body');
  check('translationsolo: the translation alone, bright, full width, over the middle', !box(solo, 'origin') && !box(solo, 'log1')
    && sb.textColor === 4 && sb.width === 560 && sb.yPosition < 118 && sb.yPosition + sb.height > 124 && sb.yPosition + sb.height <= 256 && solo.imageObject.length === 0);
}

{
  const p = PAGES[3][1];
  const [b, st, dv, lab, r, a] = ['body', 'headerSrc', 'headerDivider', 'bottomStatus', 'log0', 'log2'].map((n) => box(p, n));
  const [past, now] = ['origin', 'question'].map((n) => box(p, n));
  check('translationideas: 8 texts (the limit), no pictures', p.textObject.length === 8 && p.imageObject.length === 0);
  check('translationideas: their words (level 0, 2 lines) and the translation (bright, 6-line area) from the top',
    past.yPosition === 0 && past.height === 2 * 27 && past.textColor === 0 && now.yPosition === 0 && now.height === 6 * 27 && now.textColor === 4 && now.yPosition + now.height <= dv.yPosition);
  check('translationideas: the input box is listed after the conversation boxes (over them, empty)', b.isEventCapture === 1
    && p.textObject.indexOf(b) > p.textObject.indexOf(past) && p.textObject.indexOf(b) > p.textObject.indexOf(now));
  check('translationideas: divider and labels under the translation; the status + hint line at the very bottom',
    dv.yPosition >= b.yPosition + b.height && lab.yPosition >= dv.yPosition + dv.height && lab.height >= 27
    && st.height >= 27 && st.yPosition >= r.yPosition + r.height && st.yPosition >= a.yPosition + a.height && st.yPosition + st.height <= 288);
  check('translationideas: the reply left, the question right, side by side, 2 lines each',
    r.xPosition + r.width <= a.xPosition && r.yPosition === a.yPosition && r.yPosition >= lab.yPosition + lab.height && [r, a].every((c) => c.height >= 54 && c.yPosition + c.height <= 288));
}

console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
