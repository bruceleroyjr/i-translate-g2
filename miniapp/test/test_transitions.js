import { Glasses, IDS } from '../src/glasses.ts';
import './flush_now.js';

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) fails++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function slowBridge(log, ms = { rebuild: 120, text: 20, image: 80 }) {
  const op = (kind, name, dur) => async () => {
    log.push({ kind, name, at: 'start' });
    await wait(dur);
    log.push({ kind, name, at: 'end' });
    return kind === 'image' ? 'success' : true;
  };
  return {
    rebuildPageContainer: (s) => op('rebuild', [...(s.textObject || []), ...(s.listObject || []), ...(s.imageObject || [])].map((c) => c.containerName).join(','), ms.rebuild)(),
    createStartUpPageContainer: async () => 0,
    textContainerUpgrade: (c) => op('text', c.containerName, ms.text)(),
    updateImageRawData: (c) => op('image', c.containerName, ms.image)(),
  };
}
const overlaps = (log) => {
  const bad = [];
  let open = null;
  for (const e of log) {
    if (e.at === 'start') {
      if (open) bad.push(`${e.kind}:${e.name} during ${open.kind}:${open.name}`);
      open = open || e;
    } else if (open && open.kind === e.kind && open.name === e.name) open = null;
  }
  return bad;
};

{
  const log = [];
  const g = new Glasses(slowBridge(log));
  g.layoutFor = (k) => (k === 'normal' ? 'card' : null);
  await g.create({ body: ' ' });
  await g.setPage('langs', { body: ' ', bottomStatus: 'THEY SPEAK', langs: ['a', 'b'] });
  log.length = 0;
  const back = g.setPage('normal', { body: ' ' });
  const others = [g.setText(IDS.body, 'late text'), g.setText(IDS.headerSrc, 'I-Translate'), g.showCard('cardA', 'a', [1])];
  await Promise.all([back, ...others]);
  await wait(250);
  check('no text or picture goes out while the page is being rebuilt', overlaps(log).length === 0, overlaps(log).join(' | '));
  const names = log.filter((e) => e.at === 'start').map((e) => `${e.kind}:${e.name}`);
  check('the rebuild goes first, with the texts inside it; the picture after it', names[0].startsWith('rebuild:') && !names.includes('text:headerSrc')
    && names.indexOf('image:cardA') > 0, names.join(' / '));
}

{
  const log = [];
  const g = new Glasses(slowBridge(log));
  g.layoutFor = (k) => (k === 'normal' ? 'card' : null);
  await g.create({ body: ' ' });
  log.length = 0;
  const go = g.setPage('langs', { body: ' ', bottomStatus: 'I-TRANSLATE', langs: ['a'] }, true);
  const late = g.setText(IDS.headerSrc, 'I-Translate'); 
  await Promise.all([go, late]);
  check('a late text for the old page is not sent to the list page', !log.some((e) => e.kind === 'text'), JSON.stringify(log));
  log.length = 0;
  await g.setText(IDS.bottomStatus, 'late');
  check("a list's status line is never overwritten by a late text", !log.some((e) => e.kind === 'text'));
}

{
  let n = 0;
  const g = new Glasses({ rebuildPageContainer: async () => true, createStartUpPageContainer: async () => 0, updateImageRawData: async () => 'success',
    textContainerUpgrade: () => (++n === 1 ? new Promise(() => {}) : Promise.resolve(true)) });
  g.layoutFor = () => 'card';
  await g.create({ body: ' ' });
  await g.setPage('chat', { body: ' ' });
  await g.setPage('normal', { body: ' ' });
  void g.setText(IDS.body, 'never answered');
  const t0 = Date.now();
  await g.setText(IDS.headerSrc, 'next');
  check('a text the glasses never answer: the next one still goes out (within ~6 s)', n === 2 && Date.now() - t0 < 7000, `${n} ${Date.now() - t0}`);
}

console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
