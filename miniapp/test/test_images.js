import { Glasses } from '../src/glasses.ts';
import './flush_now.js';

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) fails++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

{
  const sent = [], rebuilt = [];
  const g = new Glasses({ updateImageRawData: async (d) => { await wait(100); sent.push(d); return 'success'; },
    rebuildPageContainer: async (s) => { rebuilt.push(s); return true; } });
  g.images = { idle: [1], sleep1: [2], sleep2: [3], blank: [0] };
  const first = g.showAvatar('sleep1');
  await wait(10);
  g.showAvatar('sleep2'); g.showAvatar('sleep1'); g.showAvatar('sleep2'); 
  await first; await wait(250);
  check('no Hermes sprite: 4 asks for her frames -> no transfer at all', sent.length === 0 && g.shown !== 'sleep2', sent.length);
  const ok = await g.blank();
  check('screen off = a page with NO picture box and no text (no blank sprite to send first)', ok && rebuilt.length === 1 && sent.length === 0
    && !rebuilt[0].imageObject && rebuilt[0].textObject.every((t) => t.content.trim() === '') && g.page === 'dark');
  await g.setPage('normal', { header: 'h', body: ' ' });
  await g.showAvatar('idle');
  check('waking: the normal page comes back without a Hermes box, nothing is sent', g.page === 'normal' && sent.length === 0
    && !(rebuilt[1].imageObject || []).some((i) => i.containerName === 'avatar'));
}

{
  const rebuilt = [];
  const g = new Glasses({ updateImageRawData: () => new Promise(() => {}), rebuildPageContainer: async (s) => { rebuilt.push(s); return true; } });
  g.images = { sleep1: [2], blank: [0] };
  g.showAvatar('sleep1');
  const t0 = Date.now();
  const ok = await g.blank();
  check('stalled transfer: the screen still goes dark within ~4 s (the dark page doesn\'t wait for the picture)', ok && rebuilt.length === 1
    && !rebuilt[0].imageObject && Date.now() - t0 < 4600);
}
{
  const g = new Glasses({ updateImageRawData: () => new Promise(() => {}), rebuildPageContainer: async () => true });
  g.images = { sleep1: [2] };
  const t0 = Date.now();
  await g.showAvatar('sleep1');
  check('no Hermes box: her frame never starts a transfer, so nothing can stall', Date.now() - t0 < 1000 && g.imageStats.timeouts === 0 && g.shown !== 'sleep1');
}

{
  let tries = 0;
  const g = new Glasses({ updateImageRawData: async () => { tries++; return 'sendFailed'; }, rebuildPageContainer: async () => true });
  await g.setTray(true, { header: 'h', body: ' ' }); 
  for (let i = 0; i < 10; i++) { if (g.trayNeeds('trayL', 'x')) await g.showTray('trayL', 'x', [1]); await wait(20); }
  check('a failed picture box is not asked for again at once (back-off): 10 renders -> 1 try', tries === 1 && g.cooling('trayL'), tries);
  await g.setPage('chat', { header: 'h', body: ' ' }); await g.setPage('normal', { header: 'h', body: ' ' });
  check('a new page clears the back-off', !g.cooling('trayL'));
}

console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
