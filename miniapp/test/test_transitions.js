import { existsSync } from 'node:fs';
import { Glasses, IDS } from '../src/glasses.ts';
import './flush_now.js';
import { FRAMES, ANIM_FRAMES, FADE_FRAMES, NAP_FRAMES, NAPFADE_FRAMES } from '../src/window.ts';

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
  g.images = { idle: [1], mail: [2], blank: [0] };
  await g.create({ header: ' ', body: ' ' });
  await g.setPage('langs', { header: 'EMAILS', body: ' ', langs: ['a', 'b'] });
  log.length = 0;
  const back = g.setPage('normal', { header: ' ', body: ' ' });
  const others = [g.setText(IDS.body, 'late list text'), g.setText(IDS.bottomStatus, '● HERMES'), g.showAvatar('idle')];
  await Promise.all([back, ...others]);
  await wait(150);
  check('no text or picture goes out while the page is being rebuilt', overlaps(log).length === 0, overlaps(log).join(' | '));
  const names = log.filter((e) => e.at === 'start').map((e) => `${e.kind}:${e.name}`);
  check('the rebuild goes first, with what the new page shows inside it', names[0].startsWith('rebuild:') && !names.includes('text:bottomStatus') && !names.includes('image:avatar'), names.join(' '));
  check('no sprite picture goes to the new page', g.shown !== 'idle');
}

{
  const log = [];
  const g = new Glasses(slowBridge(log));
  g.images = { idle: [1], blank: [0] };
  await g.create({ header: ' ', body: ' ' });
  log.length = 0;
  const go = g.setPage('langs', { header: 'TOP NEWS', body: ' ', langs: ['a'] }, true);
  const late = g.setText(IDS.bottomStatus, '● HERMES'); 
  await Promise.all([go, late]);
  check('a late status for the old page is not sent to the list page', !log.some((e) => e.kind === 'text'), JSON.stringify(log));
  log.length = 0;
  await g.setText(IDS.header, '● HERMES');
  check('a list\'s title is never overwritten by a late status', !log.some((e) => e.kind === 'text'));
}

{
  const log = [];
  const g = new Glasses(slowBridge(log, { rebuild: 5, text: 1, image: 1 }));
  g.images = { idle: [1], blank: [0] };
  g.trayOn = true;
  await g.create({ header: ' ', body: ' ' });
  await g.setPage('langs', { header: 'EMAILS', body: ' ', langs: ['a'] });
  log.length = 0;
  await g.setPage('normal', { header: ' ', body: ' ', tray: false }); 
  const first = log.find((e) => e.kind === 'rebuild' && e.at === 'start');
  check('list -> item: one rebuild, straight to the card layout (no tray pictures, header row)', log.filter((e) => e.kind === 'rebuild' && e.at === 'start').length === 1
    && !first.name.includes('trayL') && first.name.includes('headerSrc') && g.trayOn === false, first?.name);
  await g.setPage('langs', { header: 'EMAILS', body: ' ', langs: ['a'] });
  log.length = 0;
  await g.setPage('normal', { header: ' ', body: ' ', tray: true }); 
  const home = log.find((e) => e.kind === 'rebuild' && e.at === 'start');
  check('list -> home: one rebuild, straight to the home layout (its list rows + battery text)', log.filter((e) => e.kind === 'rebuild' && e.at === 'start').length === 1
    && home.name.includes('homeBattery') && home.name.includes('homeRow0') && g.trayOn === true, home?.name);
}

{
  const log = [];
  const g = new Glasses(slowBridge(log, { rebuild: 30, text: 1, image: 1 }));
  g.images = { idle: [1], blank: [0] };
  await g.create({ header: ' ', body: ' ' });
  log.length = 0;
  const toList = g.setPage('langs', { header: 'TOP NEWS', body: ' ', langs: ['a'] }, true);
  const trayFlip = g.setTray(true, { header: ' ', body: ' ' }); 
  await Promise.all([toList, trayFlip]);
  check('tray appears while a list opens: the list stays up (one rebuild)', g.page === 'langs' && log.filter((e) => e.kind === 'rebuild' && e.at === 'start').length === 1,
    `${g.page} ${log.filter((e) => e.at === 'start').map((e) => e.name).join(' / ')}`);
}

{
  const all = [...new Set([...FRAMES, ...ANIM_FRAMES, ...FADE_FRAMES, ...NAP_FRAMES, ...NAPFADE_FRAMES, 'blank'])];
  const missing = all.filter((f) => !existsSync(new URL(`../public/avatar48/${f}.png`, import.meta.url)));
  check('every frame has its picture file in public/avatar48', missing.length === 0, `missing: ${missing.join(', ')}`);
  const log = [];
  const g = new Glasses(slowBridge(log, { rebuild: 1, text: 1, image: 1 }));
  g.images = { idle: [1], blank: [0] };
  await g.create({ header: ' ', body: ' ' });
  await g.showAvatar('meeting'); 
  check('an unknown frame sends nothing', g.shown === '' || g.shown === undefined || g.shown === null, g.shown);
}

{
  let n = 0;
  const g = new Glasses({ rebuildPageContainer: async () => true, createStartUpPageContainer: async () => 0, updateImageRawData: async () => 'success',
    textContainerUpgrade: () => (++n === 1 ? new Promise(() => {}) : Promise.resolve(true)) });
  await g.create({ header: ' ', body: ' ' });
  void g.setText(IDS.body, 'never answered');
  const t0 = Date.now();
  await g.setText(IDS.bottomStatus, 'next');
  check('a text the glasses never answer: the next one still goes out (within ~6 s)', n === 2 && Date.now() - t0 < 7000, `${n} ${Date.now() - t0}`);
}

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
