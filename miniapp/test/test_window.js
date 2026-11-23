import { WindowState, WINDOW_MS, setTiming, countdownText, scanBar, listeningDots, capFirst, turnView, fitHead, fitTail, fitRow, ROW_PX } from '../src/window.ts';
import { wrappedLines } from '../src/center.ts';
import { getTextWidth } from '@evenrealities/pretext';

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${JSON.stringify(detail)}`}`);
  if (!ok) fails++;
};
const types = (fx) => fx.map((f) => f.type);
const line = (seq, extra = {}) => ({ seq, kind: 'translation', title: 'KO → EN', text: `line ${seq}`, original: `원문 ${seq}`, ...extra });
setTiming({ messageS: 15, screenOffS: 10 });
const t = 1_000_000;

{
  const w = new WindowState();
  check('a line -> render', types(w.offer(line(1), t)).join() === 'render');
  check('countdown starts at 15s', w.view(t).secondsLeft === 15);
  check('the header shows the language pair', w.title(t) === 'KO → EN');
  check('still open at 14.9 s', !types(w.tick(t + WINDOW_MS - 100)).includes('clear'));
  check('closes by itself at 15 s', types(w.tick(t + WINDOW_MS)).includes('clear') && !w.item);
  w.offer(line(2), t);
  check('a tap closes the card', types(w.press(t + 3000)).includes('clear') && !w.item);
  check('a tap with nothing showing -> nothing', w.press(t + 4000).length === 0);
  w.offer(line(3), t);
  check('a new line replaces the old one and restarts the timer', types(w.offer(line(4), t + 10_000)).join() === 'render' && w.item.seq === 4 && w.view(t + 10_000).secondsLeft === 15);
  check('dueIn = 15000 ms right after a line (the exact close timer)', w.dueIn(t + 10_000) === WINDOW_MS);
  check('dueIn counts down', w.dueIn(t + 14_200) === WINDOW_MS - 4200);
  w.keepOpen(t + 12_000);
  check('keepOpen (choosing a reply idea): no timer, it does not close', w.dueIn(t + 60_000) === null && !types(w.tick(t + 60_000)).includes('clear') && w.view(t + 60_000).pinned);
  w.close();
  check('nothing showing -> no close timer', w.dueIn(t) === null);
}

{
  const w = new WindowState();
  check('TRANSLATING -> busy, no card', types(w.offer({ seq: 1, kind: 'status', title: 'TRANSLATING', text: '' }, t)).join() === 'render' && !!w.busy && !w.item);
  check('the header scan bar bounces ■□□ -> □■□ -> □□■', w.title(t) === 'Translating ■□□' && w.title(t + 1000) === 'Translating □■□' && w.title(t + 2000) === 'Translating □□■');
  w.offer(line(2), t + 2500);
  check('the line ends the busy state', !w.busy && w.title(t + 2500) === 'KO → EN');
  w.offer({ seq: 3, kind: 'status', title: 'TRANSLATING', text: '' }, t + 3000);
  w.offer({ seq: 4, kind: 'status', title: 'IDLE', text: '' }, t + 3500);
  check('IDLE (a dropped half-heard word) ends the busy state, the card stays', !w.busy && w.item?.seq === 2);
}

{
  const w = new WindowState();
  w.offer({ seq: 1, kind: 'wake', title: 'LISTENING', text: '' }, t);
  check('the Listening card has no countdown and never times out', w.view(t).secondsLeft === 0 && !types(w.tick(t + 120_000)).includes('clear'));
  check('an empty status closes the Listening card', types(w.offer({ seq: 2, kind: 'status', title: 'X', text: '' }, t)).includes('clear') && !w.item);
  check('an empty status with nothing up does nothing', w.offer({ seq: 3, kind: 'status', title: 'X', text: '' }, t).length === 0);
  w.offer({ seq: 4, kind: 'status', title: 'API keys', text: 'Add your keys.' }, t);
  check('a status card with text shows, with a countdown', w.item?.title === 'API keys' && w.view(t).secondsLeft === 15);
}

{
  const w = new WindowState();
  w.holdPopups = true; 
  check('turn screen up: their lines wait in the queue', w.offer(line(1), t).length === 0 && !w.item && w.queue.length === 1);
  check('turn screen up: a status card still shows', w.offer({ seq: 2, kind: 'status', title: 'S', text: 'x' }, t).length === 1 && w.item?.kind === 'status');
  check('turn screen up: the tick does not release the waiting line', w.tick(t + 16_000).every((f) => f.type !== 'render') && w.queue.length === 1);
  w.holdPopups = false;
  w.next(t + 17_000);
  check('turn screen gone: the waiting line shows', w.item?.seq === 1);
}

check('countdown: 15 s -> "15s"', countdownText(15) === '15s');
check('countdown: 5.2 s left -> "6s" (rounds up, never 0s)', countdownText(5.2) === '6s' && countdownText(0.1) === '1s');
check('countdown: 0 -> blank', countdownText(0) === ' ');
check('scan bar bounces', scanBar(0) === '■□□' && scanBar(2000) === '□□■' && scanBar(3000) === '□■□' && scanBar(4000) === '■□□');
const seq = [0, 400, 800, 1200, 1600, 2000, 2400].map((ms) => listeningDots(ms));
check('listening dots: in . .. ... then out .. . and again', seq.join('|') === 'Listening|Listening.|Listening..|Listening...|Listening..|Listening.|Listening', seq);
check('capFirst: hints start with a capital, symbols kept', capFirst('double tap: close') === 'Double tap: close' && capFirst('▶ tap to send') === '▶ Tap to send');

check('turn: listening, nothing yet -> Listening dots', turnView([], { held: true, sinceHold: 0 }) === 'Listening');
check('turn: your words as you speak', turnView([], { held: true, live: 'where is the station' }) === 'You: “where is the station”');
check('turn: draft + newer live words', turnView([], { draft: 'where is', live: 'the station' }) === 'You: “where is the station”');
check('turn: sent, not translated yet -> …', turnView([{ q: 'where is the station', a: '' }], {}) === '…');
check('turn: nothing heard', turnView([], { nothingHeard: true }) === 'No speech detected');
check('turn: answered -> the translation', turnView([{ q: 'hi', a: '안녕하세요' }], {}) === '안녕하세요');
check('turn: nothing at all -> Tap to talk.', turnView([], {}) === 'Tap to talk.');
const long = turnView([], { live: 'one two three four five six seven eight nine ten '.repeat(10) + 'last words', held: true });
check('turn: long live words keep the NEWEST words in 3 lines', long.startsWith('…') && long.endsWith('last words”') && wrappedLines(long, 552) <= 3, long);

check('fitHead: cut at the end with …', fitHead('word '.repeat(200), 2).endsWith('…') && wrappedLines(fitHead('word '.repeat(200), 2), 552) <= 2);
check('fitTail: cut at the front with …', fitTail('word '.repeat(200) + 'end', 2).startsWith('…') && fitTail('word '.repeat(200) + 'end', 2).endsWith('end'));
check('fitHead / fitTail leave short text alone', fitHead('short', 2) === 'short' && fitTail('short', 2) === 'short');
const row = fitRow('W'.repeat(80));
check('fitRow: fits the row width and 60 bytes, ends with …', getTextWidth(row) <= ROW_PX && Buffer.byteLength(row) <= 60 && row.endsWith('…'));
check('fitRow: multi-byte text (Korean, →) never breaks the byte limit', Buffer.byteLength(fitRow('역이 어디예요 → '.repeat(20))) <= 60);

console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
