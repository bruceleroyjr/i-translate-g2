import { Glasses, IDS, pageSpec } from '../src/glasses.ts';
import './flush_now.js';

let fails = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail !== undefined ? `  (${JSON.stringify(detail)})` : ''}`);
  if (!ok) fails++;
};

function make() {
  const calls = [];
  const hold = { rebuild: null, failText: 0 }; 
  const g = new Glasses({
    createStartUpPageContainer: async (s) => { calls.push({ kind: 'page', spec: s }); return 0; },
    rebuildPageContainer: async (s) => {
      calls.push({ kind: 'page', spec: s });
      if (hold.rebuild) { const h = hold.rebuild; hold.rebuild = null; await h; }
      return true;
    },
    textContainerUpgrade: async (d) => {
      if (hold.failText > 0) { hold.failText--; throw new Error('link down'); }
      calls.push({ kind: 'text', ...d });
      return true;
    },
    updateImageRawData: async (d) => { calls.push({ kind: 'img', box: d.containerName, data: d.imageData }); return 'success'; },
  });
  g.images = { idle: [1], speaking: [2], blank: [0] };
  g.transitions = false; 
  const since = (n) => calls.slice(n);
  return { g, calls, since, hold };
}
const moment = () => new Promise((r) => setTimeout(r, 10));
const texts = (cs) => cs.filter((c) => c.kind === 'text');
const pages = (cs) => cs.filter((c) => c.kind === 'page');
const imgs = (cs) => cs.filter((c) => c.kind === 'img');
const CARD = { header: ' ', body: 'hello', tray: false };
const colours = (spec) => (spec.textObject ?? []).filter((t) => t.textColor !== undefined).map((t) => t.textColor);

{
  const { g, calls, since } = make();
  await g.create({ header: ' ', body: 'hello' });
  let n = calls.length;
  await g.setText(IDS.body, 'one');
  check('never dimmed: a text update carries no textColor (as before)', texts(since(n)).length === 1 && !('textColor' in texts(since(n))[0]), since(n));

  n = calls.length;
  await g.setDim(2);
  const d2 = texts(since(n));
  check('setDim(2): the 4 boxes brighter than 2 go to 2 (D5: divider / hint / countdown are 2 already)', d2.length === 4 && d2.every((u) => u.textColor === 2), d2.map((u) => [u.containerName, u.textColor]));
  check('... the content stays', d2.find((u) => u.containerName === 'body').content === 'one');

  n = calls.length;
  await g.setDim(3);
  const d3 = texts(since(n));
  check('setDim(3): those 4 to 3 (time + status are back at their own level, the level-2 boxes stay)', d3.length === 4 && d3.every((u) => u.textColor === 3), d3.map((u) => [u.containerName, u.textColor]));
  n = calls.length;
  await g.setDim(3);
  check('the same level again sends nothing', since(n).length === 0);

  n = calls.length;
  await g.setDim(4);
  const d4 = texts(since(n));
  check('setDim(4): only the level-4 boxes change (title + body)', d4.length === 2 && d4.every((u) => u.textColor === 4) && !d4.some((u) => /Hint|DateTime|Time|Status/.test(u.containerName)), d4.map((u) => [u.containerName, u.textColor]));

  await g.setDim(0);
  n = calls.length;
  await g.setText(IDS.body, 'while dim');
  await g.setText(IDS.bottomHint, 'tap');
  const w = texts(since(n));
  check('write while dim: new text goes out at level 0', w.length === 2 && w.every((u) => u.textColor === 0) && w[0].content === 'while dim', w);
  check('every textColor ever sent is 0..4', texts(calls).every((u) => u.textColor === undefined || (Number.isInteger(u.textColor) && u.textColor >= 0 && u.textColor <= 4)));

  n = calls.length;
  await g.setPage('chat', { header: ' ', body: 'answer' });
  const born = pages(since(n))[0].spec;
  check('a page built while dim 0: every text colour is 0, the divider line too', colours(born).length === 7 && colours(born).every((c) => c === 0)
    && born.textObject.filter((t) => t.borderColor !== undefined).every((t) => t.borderColor === 0), born.textObject);
  n = calls.length;
  await g.setDim(4);
  const up = texts(since(n));
  check('... and comes up to its own colours when the user looks back (D5: two at 4, two at 3, three at 2)', up.length === 7 && up.filter((u) => u.textColor === 4).length === 2 && up.filter((u) => u.textColor === 3).length === 2 && up.filter((u) => u.textColor === 2).length === 3, up.map((u) => [u.containerName, u.textColor]));
  check('... with the text it was built with', up.find((u) => u.containerName === 'body').content === 'answer');
  n = calls.length;
  await g.setText(IDS.body, 'later');
  check('a box that differs from how it was built keeps stating its colour', texts(since(n))[0].textColor === 4);
}

{
  const T = { header: 'H', body: 'B', langs: ['a', 'b'], rows: ['YES', 'NO'] };
  const MENU = { meeting: false, translating: false, listening: true };
  let ok = true, why = '';
  for (const kind of ['normal', 'approval', 'confirm', 'langs', 'chat', 'dark']) {
    for (const tray of [false, true]) {
      const full = pageSpec(kind, { ...T, tray }, MENU);
      for (const dim of [0, 1, 2, 3, 4]) {
        const s = pageSpec(kind, { ...T, tray }, MENU, dim);
        const strip = (o) => JSON.stringify(o, (k, v) => (k === 'textColor' || k === 'borderColor' ? undefined : v));
        if (strip(s) !== strip(full)) { ok = false; why = `${kind} dim ${dim}: something other than a colour changed`; }
        (s.textObject ?? []).forEach((t, i) => {
          const base = full.textObject[i].textColor;
          if (base !== undefined && t.textColor !== Math.min(base, dim)) { ok = false; why = `${kind} ${t.containerName} dim ${dim}: ${t.textColor}`; }
        });
      }
    }
  }
  check('pageSpec(kind, t, menu, dim): nothing moves, every colour = min(own, dim)', ok, why);
  check('pageSpec without dim is full brightness', JSON.stringify(pageSpec('normal', T, MENU)) === JSON.stringify(pageSpec('normal', T, MENU, 4)));
}

{
  const { g, calls, since } = make();
  await g.create({ header: ' ', body: ' ' });
  await g.showAvatar('idle');
  let n = calls.length;
  await g.setImagesDark(true);
  check('images dark: no Hermes box, so no black sprite is sent', !imgs(since(n)).some((i) => i.box === 'avatar'), since(n));
  n = calls.length;
  await g.showAvatar('speaking');
  check('picture while dark: a new frame is not sent', imgs(since(n)).length === 0, since(n));
  n = calls.length;
  await g.setPage('chat', { header: ' ', body: ' ' });
  await g.showAvatar('speaking');
  check('a page built while dark: no sprite frame is sent', !imgs(since(n)).some((i) => i.box === 'avatar'), since(n));
  n = calls.length;
  await g.setImagesDark(false);
  check('back: still no sprite frame', !imgs(since(n)).some((i) => i.box === 'avatar'), since(n));
  n = calls.length;
  await g.setImagesDark(false);
  check('back twice sends nothing', since(n).length === 0);
}

{
  const { g, calls, since } = make();
  await g.create({ header: ' ', body: ' ' });
  await g.setPage('approval', { header: ' ', body: 'Send the email?' });
  check('approval page has its list', !!pages(calls).at(-1).spec.listObject);
  let n = calls.length;
  await g.setImagesDark(true);
  const hid = pages(since(n));
  check('dark: ONE rebuild to a page with no list and no picture, one box that takes the taps',
    hid.length === 1 && !hid[0].spec.listObject && !hid[0].spec.imageObject && hid[0].spec.textObject.length === 1 && hid[0].spec.textObject[0].isEventCapture === 1, hid.map((p) => p.spec));
  check('... the side menu stays on it', !!hid[0].spec.menuObject === !!pages(calls)[1].spec.menuObject);
  check('... the app still knows it is the approval page', g.page === 'approval');
  n = calls.length;
  await g.setText(IDS.body, 'Send the email to Sam?');
  await g.setDim(0);
  check('no text is written to boxes that are not there', texts(since(n)).length === 0, since(n));
  await g.setDim(4);
  n = calls.length;
  await g.setImagesDark(false);
  const back = pages(since(n));
  check('back: ONE rebuild, the list is there again with the newest text', back.length === 1 && back[0].spec.listObject?.[0].itemContainer.itemName.join() === 'APPROVE,DENY'
    && back[0].spec.textObject.find((t) => t.containerName === 'body').content === 'Send the email to Sam?', back.map((p) => p.spec));

  await g.setPage('normal', { header: ' ', body: ' ', tray: false });
  await g.setImagesDark(true);
  await g.setDim(0);
  n = calls.length;
  await g.setPage('approval', { header: ' ', body: 'Pay the bill?' });
  check('a list page that arrives while dark is built without its list', pages(since(n)).length === 1 && !pages(since(n))[0].spec.listObject && g.page === 'approval');
  n = calls.length;
  await g.setImagesDark(false);
  await g.setDim(4);
  check('... and shows up, list and all, when the user looks back', pages(since(n)).length === 1 && !!pages(since(n))[0].spec.listObject
    && pages(since(n))[0].spec.textObject.find((t) => t.containerName === 'body').content === 'Pay the bill?');
  n = calls.length;
  await g.setPage('langs', { header: 'News', body: ' ', langs: ['one', 'two'] });
  check('not dark: a list page is built as always', !!pages(since(n))[0].spec.listObject);
}

{
  const { g, calls, since, hold } = make();
  await g.create({ header: ' ', body: ' ' });
  await g.setDim(0);
  let release;
  hold.rebuild = new Promise((r) => { release = r; });
  let n = calls.length;
  const building = g.setPage('chat', { header: ' ', body: 'answer' }); 
  await moment();
  const back = g.setDim(4); 
  release();
  await building; await back;
  const up = texts(since(n));
  check('level changed during a rebuild: the page is brought to the new level afterwards (not stuck dark)',
    pages(since(n))[0].spec.textObject.every((t) => t.textColor === undefined || t.textColor === 0)
    && up.length === 7 && up.filter((u) => u.textColor === 4).length === 2 && up.filter((u) => u.textColor === 3).length === 2 && up.filter((u) => u.textColor === 2).length === 3, up.map((u) => [u.containerName, u.textColor]));
}
{
  const { g, calls, since, hold } = make();
  await g.create({ header: ' ', body: ' ' });
  await g.setImagesDark(true);
  let release;
  hold.rebuild = new Promise((r) => { release = r; });
  const n = calls.length;
  const building = g.setPage('approval', { header: ' ', body: 'Pay the bill?' });
  await moment();
  check('while turned away / being restored the glasses say so (presses must only restore)', g.dimmedAway === true);
  const back = g.setImagesDark(false);
  release();
  await building; await back;
  const built = pages(since(n));
  check('looked back during the rebuild: the approval list still comes up (not stuck on the empty page)',
    built.length === 2 && !built[0].spec.listObject && !!built[1].spec.listObject, built.map((p) => Object.keys(p.spec)));
  check('... and the glasses are no longer dimmed away', g.dimmedAway === false);
}
{
  const { g, calls, since, hold } = make();
  await g.create({ header: ' ', body: ' ' });
  hold.failText = 1;
  await g.setDim(2);
  check('a level change that failed on one box is remembered', g.dimDirty === true && texts(calls).length === 3); 
  let n = calls.length;
  await g.setDim(2);
  check('... and that box is sent again at the same level', texts(since(n)).length === 1 && texts(since(n))[0].textColor === 2 && g.dimDirty === false, since(n));
  hold.failText = 1;
  await g.setText(IDS.body, 'lost?').catch(() => undefined);
  n = calls.length;
  await g.setText(IDS.body, 'lost?');
  check('a text write that failed is sent again when asked again', texts(since(n)).length === 1 && texts(since(n))[0].content === 'lost?', since(n));
}

{
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const { g, calls, since } = make();
  g.hideAll = true;
  await g.create({ header: ' ', body: ' ' });
  await g.setPage('chat', { header: ' ', body: ' ' }); 
  await g.flush();
  g.layoutFor = () => 'mail';
  await g.setPage('normal', { header: ' ', body: 'Can you send the numbers?', tray: false });
  await g.showCard('cardA', 'mail-a', [9]);
  await g.flush();
  await wait(20);
  let n = calls.length;
  await g.setImagesDark(true);
  await wait(20);
  const off = since(n);
  check('hideAll: looking away = ONE rebuild to an empty page, nothing else (no per-box fades, no black pictures)',
    off.length === 1 && off[0].kind === 'page' && !off[0].spec.imageObject && off[0].spec.textObject.length === 1, off.map((c) => c.kind));
  check('... the app still knows the real page', g.page === 'normal' && g.dimmedAway);
  n = calls.length;
  await g.setText(IDS.body, 'New line while away');
  await g.setDim(0);
  await g.showCard('cardA', 'mail-b', [8]);
  await wait(20);
  check('while away: nothing is written to the glasses', since(n).length === 0, since(n).map((c) => c.kind));
  await g.setDim(4);
  n = calls.length;
  await g.setImagesDark(false);
  await g.showCard('cardA', 'mail-b', [8]); 
  await wait(20);
  const back = since(n);
  const pg = pages(back);
  check('back: ONE rebuild of the full page with the newest text, then its picture',
    pg.length === 1 && pg[0].spec.textObject.find((t) => t.containerName === 'body')?.content === 'New line while away'
    && imgs(back).some((i) => i.box === 'cardA') && back.findIndex((c) => c.kind === 'img') > back.findIndex((c) => c.kind === 'page'), back.map((c) => c.kind));
}
{
  const { g, calls, since } = make(); 
  await g.create({ header: ' ', body: ' ' });
  const n = calls.length;
  await g.setImagesDark(true);
  check('hideAll off: a normal page is not swapped for the empty one', !pages(since(n)).some((p) => p.spec.textObject?.length === 1));
}

process.exit(fails ? 1 : 0);
