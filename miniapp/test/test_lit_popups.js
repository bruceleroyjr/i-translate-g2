import { WindowState, mutedWhileLit, staleModeItem } from '../src/window.ts';
let fails = 0;
const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) fails++; };
const it = (kind, extra = {}) => ({ seq: 1, kind, title: 'T', text: 'x', ...extra });

check('mail / news / lifelog muted while lit', mutedWhileLit(it('mail')) && mutedWhileLit(it('news')) && mutedWhileLit(it('note')) && mutedWhileLit(it('reply', { lifelog: true })));
check('reply / approval / calendar / cue / translation / meeting notes not muted',
  !mutedWhileLit(it('reply')) && !mutedWhileLit(it('approval')) && !mutedWhileLit(it('calendar')) && !mutedWhileLit(it('cue'))
  && !mutedWhileLit(it('translation')) && !mutedWhileLit(it('meeting')));

const off = { meeting: false, translating: undefined };
check('translation line after translation stopped = stale', staleModeItem(it('translation', { original: 'annyeong' }), off));
check('their own turn line is not stale', !staleModeItem(it('translation', { mine: true }), off));
check('translation line while translating is fine', !staleModeItem(it('translation', { original: 'a' }), { translating: 'Korean → English' }));
check('cue after meeting stopped = stale', staleModeItem(it('cue'), off));
check('cue in meeting mode is fine', !staleModeItem(it('cue'), { meeting: true }));
check('mail / meeting notes never stale', !staleModeItem(it('mail'), off) && !staleModeItem(it('meeting'), off));

const t = 1000;
const w = new WindowState();
w.offer(it('translation', { original: 'a', pushed: true }), t);
w.queue.push(it('translation', { original: 'b', pushed: true }), it('mail', { pushed: true }), it('cue', { pushed: true }));
const fx = w.endMode(off, t + 10);
check('endMode closes the open translation card', !w.item || w.item.kind === 'mail');
check('endMode drops waiting mode cards, keeps the mail', w.queue.every((q) => q.kind !== 'translation' && q.kind !== 'cue')
  && (w.item?.kind === 'mail' || w.queue.some((q) => q.kind === 'mail')));
check('endMode returns effects (clear) when it closed a card', fx.some((f) => f.type === 'clear'));
const w2 = new WindowState();
w2.offer(it('reply', { pushed: true }), t);
check('endMode leaves a reply alone', w2.endMode(off, t).length === 0 && w2.item?.kind === 'reply');

console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
