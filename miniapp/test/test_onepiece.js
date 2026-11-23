import { Glasses, IDS } from '../src/glasses.ts';

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${JSON.stringify(detail).slice(0, 300)}`}`);
  if (!ok) fails++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function make() {
  const calls = [];
  const g = new Glasses({
    createStartUpPageContainer: async (s) => { calls.push({ kind: 'page', spec: s }); return 0; },
    rebuildPageContainer: async (s) => { calls.push({ kind: 'page', spec: s }); return true; },
    textContainerUpgrade: async (d) => { calls.push({ kind: 'text', name: d.containerName, content: d.content }); return true; },
    updateImageRawData: async (d) => { calls.push({ kind: 'image', name: d.containerName }); return 'success'; },
  });
  g.images = { idle: [1], blank: [0] };
  return { g, calls };
}
const content = (spec, name) => spec.textObject.find((b) => b.containerName === name)?.content;

{ 
  const { g, calls } = make();
  await g.create({ header: ' ', body: ' ' });
  await g.setPage('chat', { header: ' ', body: ' ' }); 
  await g.flush();
  g.layoutFor = () => 'mail';
  const n = calls.length;
  await g.setPage('normal', { header: ' ', body: ' ', tray: false });
  check('nothing sent at the switch itself', calls.length === n);
  await g.setText(IDS.headerSrc, 'Mallory Lee');
  await g.setText(IDS.body, 'Can you send the Plan numbers?');
  await g.setText(IDS.bottomHint, 'double tap: close');
  await g.showCard('cardA', 'mail-a', [9]);
  check('no picture before the page is up', !calls.slice(n).some((c) => c.kind === 'image'));
  await g.flush();
  await wait(20);
  const after = calls.slice(n);
  check('ONE page build, no separate text writes', after.filter((c) => c.kind === 'page').length === 1 && !after.some((c) => c.kind === 'text'), after.map((c) => c.kind));
  const page = after.find((c) => c.kind === 'page').spec;
  check('the texts are inside the build', content(page, 'headerSrc') === 'Mallory Lee' && content(page, 'body') === 'Can you send the Plan numbers?' && content(page, 'bottomHint') === 'Double tap: close',
    page.textObject.map((b) => [b.containerName, b.content]));
  check('the picture goes right after the page', after.findIndex((c) => c.kind === 'image') > after.findIndex((c) => c.kind === 'page'), after.map((c) => c.kind));
  const k = calls.length;
  await g.setText(IDS.body, 'Can you send the Plan numbers?');
  check('the same text again writes nothing (the class knows it is up)', calls.length === k);
  await g.setText(IDS.body, 'changed');
  await wait(5);
  check('a later change is a normal text write', calls.slice(k).some((c) => c.kind === 'text' && c.content === 'changed'));
}
{ 
  const { g, calls } = make();
  await g.create({ header: ' ', body: ' ' });
  const n = calls.length;
  await g.setPage('chat', { header: ' ', body: ' ' });
  await g.setText(IDS.body, 'You: weather?');
  await wait(Glasses.FLUSH_MS + 40);
  const pages = calls.slice(n).filter((c) => c.kind === 'page');
  check('sent by the timer, with its text', pages.length === 1 && content(pages[0].spec, 'body') === 'You: weather?');
}
{ 
  const { g, calls } = make();
  await g.create({ header: ' ', body: ' ' });
  const n = calls.length;
  await g.setPage('chat', { header: ' ', body: ' ' });
  await g.setPage('normal', { header: ' ', body: 'card', tray: false });
  await g.flush();
  const pages = calls.slice(n).filter((c) => c.kind === 'page');
  check('two quick switches = one build (the last page)', pages.length === 1 && !pages[0].spec.textObject.some((b) => b.containerName === 'log0') && g.page === 'normal', pages.length);
}
{ 
  const { g, calls } = make();
  await g.create({ header: ' ', body: ' ' });
  const n = calls.length;
  await g.setPage('chat', { header: ' ', body: ' ' });
  await g.blank();
  await wait(Glasses.FLUSH_MS + 40);
  const pages = calls.slice(n).filter((c) => c.kind === 'page');
  check('only the dark page is built', pages.length === 1 && pages[0].spec.containerTotalNum === 1 && g.page === 'dark', pages.map((p) => p.spec.containerTotalNum));
}
{ 
  const { g, calls } = make();
  g.trayOn = true;
  await g.create({ header: ' ', body: ' ' });
  await g.setPage('normal', { header: ' ', body: ' ', tray: true });
  await g.setText(IDS.homeRow0, '▶ @ Mallory  Plan?', 4);
  await g.flush();
  const n = calls.length;
  await g.refreshMenu({ meeting: true, translating: false, listening: true });
  await g.flush();
  const after = calls.slice(n);
  const page = after.find((c) => c.kind === 'page')?.spec;
  check('menu change on Home: one build with the row text inside, no text writes', !!page && content(page, 'homeRow0') === '▶ @ Mallory  Plan?' && !after.some((c) => c.kind === 'text'), after.map((c) => c.kind));
}
{ 
  const { g, calls } = make();
  await g.create({ header: ' ', body: ' ' });
  await g.setPage('chat', { header: ' ', body: ' ' });
  await g.flush();
  g.layoutFor = () => 'mail';
  const n = calls.length;
  await g.setPage('normal', { header: ' ', body: ' ', tray: false });
  const long = 'VITURE 🏆 Sweeping #1 since day 1. '.repeat(40);
  await g.setText(IDS.headerSrc, 'From   VITURE');
  await g.setText(IDS.body, long);
  await g.flush();
  await wait(20);
  const after = calls.slice(n);
  const page = after.find((c) => c.kind === 'page').spec;
  check('long body: not inside the build', content(page, 'body') === ' ' && content(page, 'headerSrc') === 'From   VITURE', page.textObject.map((b) => [b.containerName, (b.content || '').length]));
  const bi = after.findIndex((c) => c.kind === 'text' && c.name === 'body');
  check('long body: written right after the page (before the pictures)', bi > after.findIndex((c) => c.kind === 'page') && after[bi].content.length > 1000
    && (after.findIndex((c) => c.kind === 'image') === -1 || after.findIndex((c) => c.kind === 'image') > bi), after.map((c) => c.kind + ':' + (c.name || '')));
  const k = calls.length;
  await g.setText(IDS.body, long);
  check('long body: the same text again writes nothing', calls.length === k);
}
{ 
  const calls = [];
  const g = new Glasses({
    createStartUpPageContainer: async () => 0,
    rebuildPageContainer: async (s) => { const has = (s.textObject || []).some((b) => (b.content || ' ').trim()); calls.push({ kind: 'page', has }); return !has; },
    textContainerUpgrade: async (d) => { calls.push({ kind: 'text', name: d.containerName, content: d.content }); return true; },
    updateImageRawData: async () => 'success',
  });
  g.images = { idle: [1], blank: [0] };
  await g.create({ header: ' ', body: ' ' });
  const n = calls.length;
  await g.setPage('chat', { header: ' ', body: ' ' });
  await g.setText(IDS.headerSrc, '● TALK WITH HERMES');
  await g.setText(IDS.body, 'Listening');
  await g.flush();
  const after = calls.slice(n);
  check('refused build: sent again without texts', after.filter((c) => c.kind === 'page').map((c) => c.has).join() === 'true,false', after);
  check('refused build: the texts follow one by one', ['headerSrc', 'body'].every((x) => after.some((c) => c.kind === 'text' && c.name === x)), after);
  check('refused build: noted for the relay log', g.writeFails.some((w) => w.includes('sent again without texts')), g.writeFails);
}
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
