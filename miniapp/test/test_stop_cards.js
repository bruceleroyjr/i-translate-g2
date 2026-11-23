import { WindowState, staleModeItem } from '../src/window.ts';
let fails = 0;
const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) fails++; };
const it = (kind, extra = {}) => ({ seq: 1, kind, title: 'T', text: 'x', ...extra });

const off = { translating: undefined };
check('translation line after translation stopped = stale', staleModeItem(it('translation', { original: 'annyeong' }), off));
check('your own turn line is not stale', !staleModeItem(it('translation', { mine: true }), off));
check('translation line while translating is fine', !staleModeItem(it('translation', { original: 'a' }), { translating: 'Korean → English' }));
check('status cards never stale', !staleModeItem(it('status'), off));

const t = 1000;
const w = new WindowState();
w.offer(it('translation', { original: 'a', pushed: true }), t);
w.queue.push(it('translation', { original: 'b', pushed: true }), it('status', { pushed: true }));
const fx = w.endMode(off);
check('endMode closes the open translation card', !w.item || w.item.kind === 'status');
check('endMode drops waiting lines, keeps the status card', w.queue.every((q) => q.kind !== 'translation')
  && (w.item?.kind === 'status' || w.queue.some((q) => q.kind === 'status')));
check('endMode returns effects (clear) when it closed a card', fx.some((f) => f.type === 'clear'));
const w2 = new WindowState();
w2.offer(it('status', { pushed: true }), t);
check('endMode leaves a status card alone', w2.endMode(off).length === 0 && w2.item?.kind === 'status');

console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
