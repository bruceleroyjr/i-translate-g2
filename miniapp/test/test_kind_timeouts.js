import { WindowState, setTiming, windowMsFor, msgKindFor } from '../src/window.ts';
let fails = 0;
const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) fails++; };
const t = 1000;
setTiming({ messageS: 15, screenOffS: 10, kinds: { news: 5, mail: 30, lifelogs: 0, meetings: 0, translations: 10 } });
check('kinds map', msgKindFor({ kind: 'note' }) === 'lifelogs' && msgKindFor({ kind: 'reply', lifelog: true }) === 'lifelogs'
  && msgKindFor({ kind: 'cue' }) === 'meetings' && msgKindFor({ kind: 'reply' }) === null);
check('own time / default', windowMsFor({ kind: 'news' }) === 5000 && windowMsFor({ kind: 'mail' }) === 30000
  && windowMsFor({ kind: 'note' }) === 15000 && windowMsFor({ kind: 'reply' }) === 15000 && windowMsFor({ kind: 'translation' }) === 10000);
const pop = (kind) => { const w = new WindowState(); w.offer({ seq: 1, kind, title: 'T', text: 'x', pushed: true }, t); return w; };
let w = pop('news');
check('news card: countdown starts at 5 s', w.view(t).secondsLeft === 5);
w.tick(t + 4900); check('news still up at 4.9 s', !!w.item);
w.tick(t + 5000); check('news closes at 5 s', !w.item);
w = pop('mail');
w.tick(t + 15000); check('mail still up at 15 s (30 s setting)', !!w.item);
w.tick(t + 30000); check('mail closes at 30 s', !w.item);
w = pop('cue');
w.tick(t + 14900); check('cue uses the 15 s default', !!w.item);
w.tick(t + 15000); check('cue closes at 15 s', !w.item);
w = pop('translation');
check('translation dueIn = 10 s', w.dueIn(t) === 10000);
setTiming({ messageS: 15, screenOffS: 10 });
check('no kinds given: all default', windowMsFor({ kind: 'news' }) === 15000);
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
