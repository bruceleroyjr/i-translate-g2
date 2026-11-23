import { Glasses, IDS } from '../src/glasses.ts';

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${JSON.stringify(detail).slice(0, 300)}`}`);
  if (!ok) fails++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
function make(imageMs = 30) {
  const calls = [];
  const g = new Glasses({
    createStartUpPageContainer: async (s) => { calls.push({ kind: 'page', spec: s }); return 0; },
    rebuildPageContainer: async (s) => { calls.push({ kind: 'page', spec: s }); return true; },
    textContainerUpgrade: async (d) => { calls.push({ kind: 'text', name: d.containerName, content: d.content }); return true; },
    updateImageRawData: async (d) => { await wait(imageMs); calls.push({ kind: 'image', name: d.containerName }); return 'success'; },
  });
  g.images = { idle: [1], blank: [0] };
  return { g, calls };
}

{ 
  const { g } = make();
  await g.create({ header: ' ', body: ' ' });
  await g.setPage('chat', { header: ' ', body: ' ' });
  await g.flush();
  await wait(300); 
  g.screenTimes.length = 0;
  g.layoutFor = () => 'mail';
  await g.setPage('normal', { header: ' ', body: ' ', tray: false });
  await g.setText(IDS.body, 'Can you send the Plan numbers?');
  await g.showCard('cardA', 'mail-a', [9]);
  await g.showCard('cardB', 'mail-b', [9]);
  await g.flush();
  await wait(400);
  check('one timing line for the build', g.screenTimes.length === 1, g.screenTimes);
  check('line names the page, layout, both pictures and the last picture',
    /normal\/mail build \d+ms, pictures cardA \d+ms, cardB \d+ms, last picture \+\d+ms$/.test(g.screenTimes[0] ?? ''), g.screenTimes);
}
{ 
  const { g } = make();
  await g.create({ header: ' ', body: ' ' });
  g.screenTimes.length = 0;
  await g.setPage('chat', { header: ' ', body: ' ' });
  await g.setText(IDS.body, 'You: weather?');
  await g.flush();
  await wait(300);
  check('a page without pictures says so', /chat\/- build \d+ms, no pictures$/.test(g.screenTimes.at(-1) ?? ''), g.screenTimes);
}
{ 
  const { g } = make();
  await g.create({ header: ' ', body: ' ' });
  for (let i = 0; i < 10; i++) {
    await g.setPage(i % 2 ? 'chat' : 'normal', { header: ' ', body: ' ', tray: false });
    await g.flush();
    await wait(30);
  }
  check('at most 8 lines kept', g.screenTimes.length === 8, g.screenTimes.length);
}
process.exit(fails ? 1 : 0);
