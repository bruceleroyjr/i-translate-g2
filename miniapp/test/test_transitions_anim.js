import { Glasses } from '../src/glasses.ts';
import './flush_now.js';

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${JSON.stringify(detail).slice(0, 300)}`}`);
  if (!ok) fails++;
};

function make() {
  const calls = [];
  const g = new Glasses({
    createStartUpPageContainer: async (s) => { calls.push({ kind: 'page', spec: s }); return 0; },
    rebuildPageContainer: async (s) => { calls.push({ kind: 'page', spec: s }); return true; },
    textContainerUpgrade: async (d) => { calls.push({ kind: 'text', ...d }); return true; },
    updateImageRawData: async () => 'success',
  });
  g.images = { idle: [1], blank: [0] };
  return { g, calls };
}
const idx = (calls, kind, from = 0) => calls.findIndex((c, i) => i >= from && c.kind === kind);

{
  const { g, calls } = make();
  await g.create({ header: ' ', body: ' ' });
  await g.setPage('normal', { header: ' ', body: ' ', tray: false });
  await g.setText({ containerID: 4, containerName: 'body' }, 'An email from Mallory');
  await g.setText({ containerID: 19, containerName: 'headerSrc' }, 'Email · Mallory Lee');
  const n = calls.length;
  await g.setPage('chat', { header: ' ', body: ' ' });
  const after = calls.slice(n);
  const page = idx(after, 'page');
  check('T1 off: nothing written before the page change', page === 0, after.map((c) => c.kind));
  const built = after[page].spec.textObject;
  check('T1 off: the new page is built at its own levels', built.some((t) => t.textColor >= 3), built.map((t) => [t.containerName, t.textColor]));
  check('T1 off: no brightening pass after it', !after.slice(page + 1).some((c) => c.kind === 'text'), after.slice(page + 1).map((c) => c.kind));
  check('T1: the level ends at full (fade 4)', g.fade === 4);
}
{
  const { g, calls } = make();
  await g.create({ header: ' ', body: ' ' });
  await g.setPage('chat', { header: ' ', body: ' ' });
  await g.setText({ containerID: 4, containerName: 'body' }, 'answer');
  const n = calls.length;
  await g.refreshMenu({ meeting: true, translating: false, listening: true });
  const after = calls.slice(n);
  check('T1: a menu refresh does not dip (nothing written before its rebuild)', idx(after, 'page') === 0, after.map((c) => c.kind));
}
{
  const { g, calls } = make();
  await g.create({ header: ' ', body: ' ' });
  await g.setPage('normal', { header: ' ', body: ' ', tray: false });
  await g.setText({ containerID: 4, containerName: 'body' }, 'card');
  const n = calls.length;
  await g.setPage('langs', { header: 'News', body: ' ', langs: ['one', 'two'] }, true);
  check('T1: no dip into a list page (lists have no brightness)', idx(calls.slice(n), 'page') === 0);
}
{
  const { g, calls } = make();
  await g.create({ header: ' ', body: ' ' });
  await g.setPage('normal', { header: ' ', body: ' ', tray: false });
  await g.setText({ containerID: 4, containerName: 'body' }, 'card');
  await g.setText({ containerID: 23, containerName: 'bottomStatus' }, 'EMAIL');
  let n = calls.length;
  await g.setFade(3);
  const f3 = calls.slice(n).filter((c) => c.kind === 'text');
  check('T5: 2 s left - the boxes above 3 step down to 3, the dimmer ones stay', f3.length >= 1 && f3.every((c) => c.textColor === 3), f3.map((c) => [c.containerName, c.textColor]));
  n = calls.length;
  await g.setFade(2);
  check('T5: 1 s left - down to 2', calls.slice(n).filter((c) => c.kind === 'text').every((c) => c.textColor === 2));
  n = calls.length;
  await g.setText({ containerID: 4, containerName: 'body' }, 'still fading');
  check('T5: text written while fading goes out at the faded level', calls.slice(n).filter((c) => c.kind === 'text').every((c) => c.textColor <= 2));
  n = calls.length;
  await g.setTray(true, { header: ' ', body: ' ' }); 
  check('T5: the next page ends the fade (full again)', g.fade === 4, g.fade);
  n = calls.length;
  await g.setFade(4);
  check('T5: the same level again sends nothing', calls.slice(n).length === 0);
}
{
  const { g, calls } = make();
  g.transitions = false;
  await g.create({ header: ' ', body: ' ' });
  await g.setPage('normal', { header: ' ', body: ' ', tray: false });
  await g.setText({ containerID: 4, containerName: 'body' }, 'card');
  const n = calls.length;
  await g.setPage('chat', { header: ' ', body: ' ' });
  check('transitions off: the page change goes straight out', idx(calls.slice(n), 'page') === 0);
}

console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
