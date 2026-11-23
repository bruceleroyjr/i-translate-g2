import { TalkLog, talkFeedHtml, talkBarHtml } from '../src/phoneTalk.ts';
let fails = 0;
const check = (name, ok, got) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  got: ${JSON.stringify(got)}`}`); if (!ok) fails++; };
const view = (o = {}) => ({ msgs: [], listening: false, live: '', thinking: false, pending: '', canSpeak: true, translating: false, ...o });

const log = new TalkLog();
let turns = [{ q: 'weather tomorrow?', a: '' }];
log.sync(turns);
turns[0].a = 'Sunny, 84°F.';
log.sync(turns);
check('log: a late answer lands on the same message', log.msgs.length === 1 && log.msgs[0].a === 'Sunny, 84°F.');
turns = [];
log.sync(turns);
turns.push({ q: 'and Sunday?', a: '' });
log.sync(turns);
check('log: kept after the glasses page closed, the next exchange added', log.msgs.length === 2 && log.msgs[1].q === 'and Sunday?');
log.sync([{ q: '', a: '' }]);
check('log: empty turns are not added', log.msgs.length === 2);
for (let i = 0; i < 80; i++) log.sync([{ q: `q${i}`, a: 'a' }]);
check('log: keeps the last 60', log.msgs.length === TalkLog.KEEP && log.msgs.at(-1).q === 'q79');
log.clear();
check('log: New chat empties it', log.msgs.length === 0);

check('feed: empty -> how to start', talkFeedHtml(view()).includes('Ask Hermes anything'));
let h = talkFeedHtml(view({ msgs: [{ q: 'weather?', a: 'Sunny.' }, { q: 'remind me at 9', a: '', typed: true }], thinking: true }));
check('feed: their bubbles right, Hermes left, typed / spoken labels, thinking dots on the open question',
  h.indexOf('weather?') < h.indexOf('Sunny.') && (h.match(/bubble-row me/g) || []).length === 2 && (h.match(/bubble-row hermes/g) || []).length === 2
  && h.includes('>spoken<') && h.includes('>typed<') && h.includes('class="dots"'), h);
h = talkFeedHtml(view({ msgs: [{ q: '…', a: '' }], listening: false, thinking: true }));
check('feed: a placeholder question (…) is not shown as a bubble', !h.includes('>…<') && h.includes('class="dots"'), h);
h = talkFeedHtml(view({ listening: true, live: 'what is <b>open' }));
check('feed: listening -> their live words in the dashed bubble, escaped', h.includes('bubble live') && h.includes('what is &lt;b&gt;open') && !h.includes('<b>open'), h);
h = talkFeedHtml(view({ pending: 'is it a beach day?' }));
check('feed: typed and on its way -> "sending…" + thinking', h.includes('sending…') && h.includes('is it a beach day?') && h.includes('class="dots"'));
h = talkFeedHtml(view({ msgs: [{ q: 'x', a: '', cancelled: true }] }));
check('feed: a cancelled wait says so', h.includes('Stopped waiting.'));

let b = talkBarHtml(view());
check('bar: idle -> mic on, how-to line, no Cancel', b.mic.includes('id="talk-mic"') && !b.mic.includes('disabled') && b.line.includes('Tap the mic') && !b.line.includes('talk-cancel'));
b = talkBarHtml(view({ listening: true }));
check('bar: listening -> stop square (rec), Cancel', b.mic.includes('mic rec') && b.mic.includes('Stop and send') && b.line.includes('id="talk-cancel"'));
b = talkBarHtml(view({ thinking: true }));
check('bar: thinking -> mic greyed', b.mic.includes(' disabled') && b.line.includes('thinking'));
b = talkBarHtml(view({ canSpeak: false }));
check('bar: no glasses -> mic greyed, typing still works', b.mic.includes(' disabled') && b.line.includes('You can still type'));
b = talkBarHtml(view({ canSpeak: false, translating: true }));
check('bar: translating -> mic greyed, typed questions still go', b.mic.includes(' disabled') && b.line.includes('typed questions still go'));
process.exit(fails ? 1 : 0);
