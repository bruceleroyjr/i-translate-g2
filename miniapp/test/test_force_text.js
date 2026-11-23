import { Glasses, IDS } from '../src/glasses.ts';
import './flush_now.js';

let fails = 0;
const check = (name, ok, got) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${JSON.stringify(got)}`}`); if (!ok) fails++; };

const calls = [];
const g = new Glasses({
  createStartUpPageContainer: async () => 0,
  rebuildPageContainer: async () => true,
  textContainerUpgrade: async (d) => { calls.push(d); return true; },
  updateImageRawData: async () => 'success',
});
g.images = { idle: [1], speaking: [2], blank: [0] };
g.transitions = false;
await g.create({ header: ' ', body: 'hello' });

let n = calls.length;
await g.setText(IDS.body, 'You: weather?', 0);
check('a stated level goes out with the text', calls.length === n + 1 && calls[n].textColor === 0, calls.slice(n));
n = calls.length;
await g.setText(IDS.body, 'You: weather?', 0);
check('the same text at the same level again: nothing sent', calls.length === n, calls.slice(n));
n = calls.length;
await g.setText(IDS.body, 'You: weather?', 0, true);
check('force: sent again anyway, with its level', calls.length === n + 1 && calls[n].textColor === 0 && calls[n].content === 'You: weather?', calls.slice(n));

console.log(fails ? `${fails} FAILED` : 'all passed');
process.exitCode = fails ? 1 : 0;
