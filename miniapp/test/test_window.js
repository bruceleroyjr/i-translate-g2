import { WindowState, WINDOW_MS, SPEAK_MS, COMPLETED_MS, FRAMES, CHOICES, chosenIndex, headerLine, ScreenSleep, PAUSED_SLEEP_MS, PAUSED_FADE_MS, FADE_FRAMES, IdleSleep, IDLE_SLEEP_MS, IDLE_SLEEP_STEP_MS, SLEEP_FRAMES, sleepFrame, capFirst, doubleTapAction, chatView, IdleCorner, IDLE_CORNER_MS, Boot, BOOT_MS, ANIM_FRAMES, decodeText, DECODE_SPAN, countdownText, scanBar, thinkingFrame, listeningFrame, lifelogFrame } from '../src/window.ts';
import { g0aAnswer, g0aCard, timingLine } from '../src/g0a.ts';
import { wrappedLines } from '../src/center.ts';

import { existsSync } from 'node:fs';
const require_exists = (n) => existsSync(`public/avatar48/${n}.png`);
let fails = 0;
const check = (name, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) fails++;
};
const types = (fx) => fx.map((f) => f.type);
const reply = (seq, text = 'hi') => ({ seq, kind: 'reply', title: 'Q', text });
const t = 1000;

let w = new WindowState();
check('reply -> render', types(w.offer(reply(1), t)).join() === 'render');
check('reply -> speaking frame first (test 5)', w.frame(t) === 'speaking' && w.frame(t + SPEAK_MS - 1) === 'speaking');
check('... then back to idle after ~2 s', w.frame(t + SPEAK_MS) === 'idle');
check('countdown starts at 15s', w.view(t).secondsLeft === 15);
check('still open at 14.9 s', !types(w.tick(t + WINDOW_MS - 100)).includes('clear'));
check('closes by itself at 15 s (test 6)', types(w.tick(t + WINDOW_MS)).includes('clear') && !w.item);
check('nothing open -> idle frame', w.frame(t + WINDOW_MS) === 'idle');

w = new WindowState();
w.offer(reply(1), t);
check('single press dismisses immediately (test 7)', types(w.press(t + 3000)).includes('clear') && !w.item);
check('tap with nothing showing -> nothing', w.press(t + 4000).length === 0);

w = new WindowState();
w.offer(reply(1), t);
w.keepOpen(t + 5000);
check('keepOpen (tray items): timer stops, window does not close', w.dueIn(t + 60_000) === null && !types(w.tick(t + 60_000)).includes('clear'));

w = new WindowState();
w.offer(reply(1, 'first'), t);
w.offer(reply(2, 'second'), t + 10_000);
check('new reply refreshes content and restarts the timer (test 8)', w.item.text === 'second' && w.view(t + 10_000).secondsLeft === 15);
check('new reply shows the speaking frame again', w.frame(t + 10_500) === 'speaking');

w = new WindowState();
w.offer({ seq: 1, kind: 'status', title: 'THINKING', text: 'what time is it' }, t);
check('THINKING -> thinking frame', w.frame(t) === 'thinking');
check('header scan bar Thinking ■□□ -> □■□ -> □□■ -> □■□ -> ■□□ (capital T)', ['■□□', '□■□', '□□■', '□■□', '■□□'].every((b, i) => w.title(t + i * 1000) === `Thinking ${b}`));
check('thinking bubbles pop once a second', w.frame(t) === 'thinking' && w.frame(t + 1000) === 'thinking2' && w.frame(t + 2000) === 'thinking');
w.offer(reply(2), t + 4000);
check('the answer ends thinking: speaking frame, title back to normal', w.frame(t + 4000) === 'speaking' && !w.busy && w.title(t + 4000) === '');

w = new WindowState();
w.offer(reply(1), t);
check('a cue never interrupts an open window', w.offer({ seq: 2, kind: 'cue', title: 'CUE', text: 'Ask: Q3?' }, t + 1000).length === 0 && w.item.kind === 'reply');
const after = w.press(t + 2000);
check('the queued cue shows when the window closes', types(after).includes('clear') && w.item?.kind === 'cue');
check('cue -> cue frame + CUE header (test 29)', w.frame(t + 2000) === 'cue' && w.title(t + 2000) === 'CUE');

w = new WindowState();
w.offer({ seq: 1, kind: 'wake', title: 'LISTENING', text: '' }, t);
check('wake -> listening frame', w.frame(t) === 'listening');
check('wake window has no countdown and never times out', w.view(t).secondsLeft === 0 && !types(w.tick(t + 120_000)).includes('clear'));
w.offer({ seq: 2, kind: 'status', title: 'THINKING', text: 'what time is it' }, t);
check('THINKING shows the question in the wake window + thinking frame', w.item.kind === 'wake' && w.item.text.includes('what time') && w.frame(t) === 'thinking');
w.offer(reply(3), t + 5000);
check('the answer replaces the wake window', w.item.kind === 'reply');
w = new WindowState();
w.offer({ seq: 1, kind: 'wake', title: 'LISTENING', text: '' }, t);
check('conversation ends (empty status) -> wake window closes', types(w.offer({ seq: 2, kind: 'status', title: 'LIFELOG', text: '' }, t)).includes('clear'));

w = new WindowState();
w.offer({ seq: 1, kind: 'news', title: 'NEWS — Market', text: 'Stocks rally', topic: 'Market' }, t);
check('news -> news frame + NEWS — topic header', w.frame(t) === 'news' && w.title(t) === 'NEWS — Market');
const fx = w.press(t + 2000);
check('press on news opens the top-3 list', fx[0].type === 'expandNews' && fx[0].topic === 'Market' && w.view(t + 2000).expanded);
check('press on the list dismisses', types(w.press(t + 4000)).includes('clear'));

w = new WindowState();
w.offer({ seq: 1, kind: 'mail', title: 'MAIL — Mallory Lee', text: 'Q3 deck\nCan you send the final by Friday?' }, t);
check('mail -> mail frame + "MAIL — sender" header, 15 s window', w.frame(t) === 'mail' && w.title(t) === 'MAIL — Mallory Lee' && w.dueIn(t) === WINDOW_MS);
w = new WindowState();
w.offer({ seq: 1, kind: 'done', title: 'DONE', text: 'Hologram build complete — ready to install' }, t);
check('done -> completed frame + DONE header, 15 s window', w.frame(t) === 'completed' && w.title(t) === 'DONE' && w.dueIn(t) === WINDOW_MS);
w = new WindowState();
w.offer({ seq: 1, kind: 'status', title: 'TRANSLATING', text: '' }, t);
check('TRANSLATING -> translation frame + header scan bar Translating □□■', w.frame(t) === 'translation' && w.title(t + 2000) === 'Translating □□■');
w.offer({ seq: 2, kind: 'translation', title: 'KO → EN', text: 'Where is the station?' }, t + 3000);
check('translation shown with "KO → EN" header, frame stays translation', w.title(t + 3000) === 'KO → EN' && w.frame(t + 3000) === 'translation' && !w.busy);
check('translation window times out like a reply', types(w.tick(t + 3000 + WINDOW_MS)).includes('clear'));

const appr = { seq: 5, kind: 'approval', title: 'APPROVAL NEEDED', text: 'Text Jordan: running 10 min late', id: 'a1' };
w = new WindowState();
w.offer(reply(1), t);
check('approval opens the APPROVE / DENY page', types(w.offer(appr, t + 1000)).join() === 'approvalOpen,render');
check('approval -> approval frame + APPROVAL NEEDED header', w.frame(t + 1000) === 'approval' && w.title(t + 1000) === 'APPROVAL NEEDED');
check('approval never times out (no countdown)', w.view(t + 1000).secondsLeft === 0 && w.dueIn(t + 1000) === null && !types(w.tick(t + 600_000)).includes('clear'));
check('a plain press does nothing on the approval card', w.press(t + 2000).length === 0 && w.item.kind === 'approval');
check('keepOpen does nothing on an approval', w.keepOpen(t + 2000).length === 0 && !w.pinned);
check('new replies/cues/news queue behind the approval', w.offer(reply(9), t + 3000).length === 0 && w.offer({ seq: 10, kind: 'cue', title: 'CUE', text: 'x' }, t + 3000).length === 0 && w.item.kind === 'approval');
check('awaitingDecision() while the card is up', w.awaitingDecision());
let d = w.decide(true, t + 4000);
check('APPROVE -> decide approve + back to the normal page', d[0].type === 'decide' && d[0].decision === 'approve' && d[0].id === 'a1' && types(d).includes('approvalClose'));
check('APPROVE -> completed frame briefly, then idle', w.frame(t + 4000) !== 'approval' && w.completedUntil === t + 4000 + COMPLETED_MS);
check('queued items show after the decision', w.item?.kind === 'reply' && w.item.seq === 9);
w = new WindowState();
w.offer(appr, t);
d = w.decide(false, t + 1000);
check('DENY -> decide deny, idle (no completed frame)', d[0].decision === 'deny' && w.frame(t + 1000) === 'idle');
w = new WindowState();
w.offer(appr, t);
d = w.background();
check('app to background with an approval open -> dismissed, NOT approved', d[0].type === 'decide' && d[0].decision === 'dismissed' && types(d).includes('approvalClose') && !w.item);
check('list rows: APPROVE first, DENY second', CHOICES.join() === 'APPROVE,DENY');
check('tapped row index 0 is dropped by protobuf -> still APPROVE', chosenIndex({}) === 0 && chosenIndex({ currentSelectItemIndex: 1 }) === 1);
check('tapped row by name when the index is missing', chosenIndex({ currentSelectItemName: 'DENY' }) === 1);

w = new WindowState();
w.offer(reply(1), t);
check('app to background dismisses', types(w.background()).includes('clear') && !w.item);

const on = { online: true, listening: true, meeting: false, conversing: false };
check('corner: idle -> ● HERMES', headerLine(on) === '● HERMES');
check('corner: translating / meeting -> not LIFELOGGING', headerLine({ ...on, translating: true }) === '● TRANSLATING'
  && headerLine({ ...on, meeting: true }) === '● MEETING' && headerLine({ ...on, meeting: true, translating: true }) === '● TRANSLATING');
check('corner: paused -> ○ PAUSED, battery says so', headerLine({ ...on, listening: false }) === '○ PAUSED'
  && headerLine({ ...on, listening: false, pauseReason: 'battery' }) === '○ PAUSED (BATTERY)');
check('corner: meeting with nothing showing -> ● MEETING', headerLine({ ...on, meeting: true }) === '● MEETING');
check('corner: talking to Hermes -> ● TALK WITH HERMES (0.2.64)', headerLine({ ...on, conversing: true }) === '● TALK WITH HERMES');
check('corner: news replaces the word, in capitals', headerLine({ ...on, status: 'NEWS — Market' }) === '● NEWS — MARKET');
check('corner: thinking while waiting -> ◌ THINKING..', headerLine({ ...on, awaiting: true, status: 'thinking..' }) === '◌ THINKING..');
check('corner: translation pair', headerLine({ ...on, status: 'KO → EN' }) === '● KO → EN');
check('corner: approval', headerLine({ ...on, status: 'APPROVAL NEEDED' }) === '● APPROVAL NEEDED');
check('corner: paused + a window keeps the paused circle', headerLine({ ...on, listening: false, status: 'DONE' }) === '○ DONE');
check('corner: PC out of reach overrides everything -> ○ OFFLINE', headerLine({ ...on, online: false, status: 'NEWS — Market' }) === '○ OFFLINE');
check('status: a normal sender fits in full now (32 chars)', headerLine({ ...on, status: 'MAIL — Bartholomew Richardson' }) === '● MAIL — BARTHOLOMEW RICHARDSON');
check('status: a very long one is cut to 32 chars + …', headerLine({ ...on, status: 'MAIL — Bartholomew Richardson-Smythe III' }).length === 2 + 32
  && headerLine({ ...on, status: 'MAIL — Bartholomew Richardson-Smythe III' }).endsWith('…'));
check('corner: idle shows HERMES title', headerLine(on).includes('HERMES'));
check('capFirst: hints start with a capital, symbols kept', capFirst('press: more headlines') === 'Press: more headlines'
  && capFirst('waiting for Hermes…') === 'Waiting for Hermes…' && capFirst('▶ TAP TO SEND') === '▶ TAP TO SEND' && capFirst('') === '' && capFirst('PINNED') === 'PINNED');
for (const st of ['Thinking.', 'Translating..', 'NEWS — Market', 'KO → EN', 'CUE', 'MAIL — Mallory Lee', 'APPROVAL NEEDED', 'DONE'])
  check(`corner: "${st}" starts with a capital`, /^[●◌○] [A-Z]/.test(headerLine({ ...on, status: st })));
for (const st of [{}, { listening: false }, { meeting: true }, { conversing: true }, { awaiting: true }, { online: false }])
  check(`corner idle state ${JSON.stringify(st)} starts with a capital`, /^[●◌○] [A-Z]/.test(headerLine({ ...on, ...st })));

w = new WindowState();
w.offer(reply(1), t);
check('dueIn = 15000 ms right after a reply (exact close timer)', w.dueIn(t) === WINDOW_MS);
check('dueIn counts down', w.dueIn(t + 4200) === WINDOW_MS - 4200);
check('timer firing at dueIn closes within 0.5 s of 15 s', types(w.tick(t + w.dueIn(t) + 5)).includes('clear'));
w.offer(reply(2), t);
w.keepOpen(t + 1000);
check('kept open -> no close timer', w.dueIn(t + 1000) === null);
w = new WindowState();
check('nothing showing -> no close timer', w.dueIn(t) === null);
w.offer(reply(1, 'old answer'), t);
check('reply with no content clears the old window', types(w.offer({ seq: 2, kind: 'reply', title: '', text: '  ' }, t + 2000)).includes('clear') && !w.item);

check('11 frames, the v7 set', FRAMES.length === 11 && ['idle', 'thinking', 'speaking', 'listening', 'mail', 'news', 'cue', 'meeting', 'translation', 'approval', 'completed'].every((f) => FRAMES.includes(f)));
check('G0a pass', g0aAnswer(true).passed);
check('G0a blob -> simpler art, same size', !g0aAnswer(false).passed && g0aAnswer(false).phone.includes('same 72x72'));
const card = g0aCard();
check('G0a card fits the window and asks the question', card.text.length <= 800 && card.text.includes('green blob'));
check('timing line flags transfers over 1 s', timingLine({ idle: 600, mail: 1400 }).includes('over 1 s: mail') && timingLine({ idle: 600 }).includes('all under 1 s'));

{
  const sc = new ScreenSleep();
  const on = { listening: true, needsScreen: false }, paused = { listening: false, needsScreen: false };
  check('pause: listening -> screen stays on', sc.update(0, on) === null && sc.update(60_000, on) === null && !sc.off && !sc.fading);
  check('pause: paused 9 s -> still there', sc.update(61_000, paused) === null && sc.update(69_000, paused) === null && !sc.fading);
  check('pause: paused 10 s -> the fade starts, once', PAUSED_FADE_MS === 10_000 && sc.update(70_000, paused) === 'fade' && sc.fading && !sc.off
    && sc.update(71_000, paused) === null);
  check('pause: fade frames fade1 -> fade2 -> fade3 -> blank, one a second', FADE_FRAMES.join() === 'fade1,fade2,fade3,blank'
    && sc.fadeFrame(70_000) === 'fade1' && sc.fadeFrame(71_000) === 'fade2' && sc.fadeFrame(72_000) === 'fade3' && sc.fadeFrame(73_000) === 'blank');
  check('pause: dark once the fade has played (14 s), once', PAUSED_SLEEP_MS === 14_000 && sc.update(74_000, paused) === 'sleep' && sc.off
    && !sc.fading && sc.update(75_000, paused) === null);
  check('pause: listening again (phone / menu) -> wake', sc.update(85_000, on) === 'wake' && !sc.off && !sc.fading);
  sc.update(99_000, on);
  sc.update(100_000, paused);
  check('pause: fading at 110 s', sc.update(110_000, paused) === 'fade');
  sc.activity(111_000);
  check('pause: a gesture while she fades brings her back and restarts the timer', sc.update(111_500, paused) === 'wake' && !sc.fading
    && sc.update(120_000, paused) === null && sc.update(121_000, paused) === 'fade' && sc.update(125_000, paused) === 'sleep');
  sc.activity(126_000);
  check('pause: a gesture while dark does NOT turn it on (only double tap / listening)', sc.update(127_000, paused) === null && sc.off);
  check('pause: double tap wake() reports it was off', sc.wake(128_000) === true && !sc.off && sc.wake(128_500) === false);
  check('pause: still paused after a wake -> fade + dark again on the same timer', sc.update(138_500, paused) === 'fade' && sc.update(142_500, paused) === 'sleep');
  check('pause: an approval waiting wakes it and keeps it on', sc.update(143_000, { listening: false, needsScreen: true }) === 'wake'
    && sc.update(200_000, { listening: false, needsScreen: true }) === null && !sc.off);
  check('pause: approval answered -> fade 10 s later, dark at 14 s', sc.update(209_000, paused) === null && sc.update(210_000, paused) === 'fade'
    && sc.update(214_000, paused) === 'sleep');
  check('sleep frames alternate (paused: 1 s; idle: every 2 s)', sleepFrame(4000) === 'sleep1' && sleepFrame(5000) === 'sleep2'
    && sleepFrame(4000, IDLE_SLEEP_STEP_MS) === 'sleep1' && sleepFrame(5000, IDLE_SLEEP_STEP_MS) === 'sleep1' && sleepFrame(6000, IDLE_SLEEP_STEP_MS) === 'sleep2'
    && SLEEP_FRAMES.join() === 'sleep1,sleep2');
}

{
  const s = new IdleSleep();
  check('idle: awake while something goes on', s.update(0, false) === false && s.update(60_000, false) === false);
  check('idle: quiet 14 s -> still awake', s.update(61_000, true) === false && s.update(74_999, true) === false);
  check('idle: quiet 15 s -> asleep (and stays)', IDLE_SLEEP_MS === 15_000 && s.update(75_000, true) === true && s.update(500_000, true) === true);
  s.activity(500_500);
  check('idle: asleepAt = 15 s after the last gesture', s.asleepAt === 515_500);
  check('idle: a gesture wakes her at once, 15 s more to fall asleep', !s.asleep && s.update(501_000, true) === false && s.update(515_499, true) === false
    && s.update(515_500, true) === true);
  check('idle: a card / conversation wakes her and restarts the 15 s', s.update(516_000, false) === false && s.update(520_000, true) === false
    && s.update(530_999, true) === false && s.update(531_000, true) === true);
}

{
  const base = { conversing: false, awaiting: false, canGoBack: false, cardShowing: false };
  check('double tap, nothing on screen -> the list (Meeting, Translation, News, Pause)', doubleTapAction(base) === 'menu');
  check('double tap on a card (reply, mail, cue, done, translation) -> close it, NOT pause', doubleTapAction({ ...base, cardShowing: true }) === 'close');
  check('double tap on expanded news -> back to the headline', doubleTapAction({ ...base, cardShowing: true, canGoBack: true }) === 'back');
  check('double tap while Hermes listens (nothing said) -> cancel the conversation, NOT pause', doubleTapAction({ ...base, conversing: true, cardShowing: true }) === 'cancel-conversation');
  check('double tap while waiting for the answer -> close the card (no pause)', doubleTapAction({ ...base, conversing: true, awaiting: true, cardShowing: true }) === 'close');
  const listening = chatView([{ q: 'what is the Dow at?', a: 'Up 0.4%.' }], { listening: true, ended: false });
  check('answer hint: hold to ask more, double tap exits', listening.footer === 'tap: ask more  ·  double tap: exit');
  check('empty conversation hint: tap, speak, tap to send', chatView([], { listening: true }).footer === 'tap, speak, tap to send');
}

{ 
  const c = new IdleCorner();
  check('idle corner: HERMES shows at first', c.line('● HERMES', 0) === '● HERMES');
  check('idle corner: still shows just before 15 s', c.line('● HERMES', IDLE_CORNER_MS - 1) === '● HERMES');
  check('idle corner: blank at 15 s', c.line('● HERMES', IDLE_CORNER_MS) === ' ');
  c.activity(20_000);
  check('idle corner: a gesture brings it back', c.line('● HERMES', 20_000) === '● HERMES');
  check('idle corner: and it fades 15 s after the gesture', c.line('● HERMES', 20_000 + IDLE_CORNER_MS) === ' ');
  check('idle corner: THINKING… always shows', c.line('● THINKING…', 99_000) === '● THINKING…');
  check('idle corner: back to HERMES starts a fresh 15 s', c.line('● HERMES', 100_000) === '● HERMES' && c.line('● HERMES', 100_000 + IDLE_CORNER_MS) === ' ');
  check('idle corner: MEETING never fades', c.line('● MEETING', 0) === '● MEETING' && c.line('● MEETING', 10 * IDLE_CORNER_MS) === '● MEETING');
  check('idle corner: PAUSED never fades', c.line('○ PAUSED', 10 * IDLE_CORNER_MS) === '○ PAUSED');
}

{
  const w = new WindowState();
  w.offer({ seq: 1, kind: 'note', title: 'Coffee', text: 'x' }, 1000);
  check('a lifelog card: the photo develops once a second (lifelog <-> lifelog2)', w.frame(1000) === 'lifelog' && w.frame(2000) === 'lifelog2' && w.frame(3000) === 'lifelog' && lifelogFrame(500, 0) === 'lifelog');
  { const t = new WindowState(); t.offer({ seq: 0, kind: 'reply', title: 'Coffee', text: 'x', tray: true, lifelog: true }, 1000);
  check('an opened lifelog (from the tray) animates too', t.frame(1000) === 'lifelog' && t.frame(2000) === 'lifelog2'); }
  check('lifelog frames have picture files', ['lifelog', 'lifelog2'].every((n) => require_exists(n)));
}

console.log(fails ? `${fails} FAILED` : 'ALL PASS');
{
  const b = new Boot();
  check('boot: idle before start', !b.active(5000) && b.line(5000) === null && b.frame(5000) === null);
  b.start(10_000);
  check('boot: link line + boot1 at once', b.line(10_000) === '▶ HERMES LINK □□□□' && b.frame(10_000) === 'boot1');
  check('boot: half way ■■□□ + boot2', b.line(10_000 + 1000) === '▶ HERMES LINK ■■□□' && b.frame(10_000 + BOOT_MS / 2) === 'boot2');
  check('boot: SYNCED at the end', b.line(10_000 + BOOT_MS - 1).endsWith('■■■■ SYNCED'));
  check('boot: over after BOOT_MS', b.line(10_000 + BOOT_MS) === null && b.frame(10_000 + BOOT_MS) === null);
  check('anim frames listed', ANIM_FRAMES.join() === 'boot1,boot2,thinking2,listening2,lifelog,lifelog2,calendar,calendar2');
  const txt = '\n\nThe market is up 0.8% today.';
  check('decode: p=1 -> the text itself', decodeText(txt, 1) === txt && decodeText(txt, 5) === txt);
  const d0 = decodeText(txt, 0);
  check('decode: start keeps the centering lines + shows only noise', d0.startsWith('\n\n') && !d0.includes('The') && [...d0.trim()].length === 3);
  const dh = decodeText(txt, 0.5);
  const n = Math.floor((txt.length - 2) * 0.5);
  check('decode: half way = revealed prefix + 3 noise glyphs', dh.startsWith(txt.slice(0, 2 + n)) && [...dh].length === 2 + n + 3 && dh !== txt.slice(0, 2 + n + 3));
  check('decode: noise only uses font glyphs', [...decodeText('abcdefgh', 0.25)].slice(2).every((c) => 'アカサタナハマヤラワ■□※≡∴'.includes(c)));
  const long = 'x'.repeat(600);
  check('decode: long text decodes over the first DECODE_SPAN chars only', [...decodeText(long, 0.99)].length <= DECODE_SPAN + 3);
  check('decode: empty stays empty', decodeText(' ', 0) === ' ');
  check('countdown: 15 s -> "15s"', countdownText(15) === '15s');
  check('countdown: 5.2 s left -> "6s" (rounds up, never shows 0s)', countdownText(5.2) === '6s' && countdownText(0.1) === '1s');
  check('countdown: 0 -> blank', countdownText(0) === ' ');
  check('scan bar bounces', scanBar(0) === '■□□' && scanBar(2000) === '□□■' && scanBar(3000) === '□■□' && scanBar(4000) === '■□□');
  check('think/listen loops alternate per second', thinkingFrame(1500, 0) === 'thinking2' && listeningFrame(500, 0) === 'listening' && listeningFrame(1500, 0) === 'listening2');
}

{ 
  const g = new WindowState();
  g.offer({ seq: 1, kind: 'reply', title: '', text: 'Systems green, Alex.', greeting: true }, 1000);
  const fx = types(g.press(2000));
  check('greeting card: tap = close + talk', fx.includes('clear') && fx[fx.length - 1] === 'talk' && !g.item);
}

{ 
  const { napFrame, NAP_FRAMES } = await import('../src/window.ts');
  check('nap frames: nap1 / nap2 every 2 s', NAP_FRAMES.join() === 'nap1,nap2' && napFrame(0) === 'nap1' && napFrame(2000) === 'nap2' && napFrame(4000) === 'nap1');
}

{ 
  const { LOG_SHADE } = await import('../src/window.ts');
  const turns = [{ q: 'what is the Dow at?', a: 'Up 0.4%.' }, { q: 'and the Nasdaq?', a: 'Up 0.9%.' }];
  const cv = chatView(turns, { ended: true });
  check('log lines: the earlier exchange, question dim / answer brighter', cv.log.map((l) => l.who).join() === ',you,hermes'
    && cv.log[1].text === 'You: what is the Dow at?' && cv.log[2].text === 'Hermes: Up 0.4%.' && LOG_SHADE.you === 1 && LOG_SHADE.hermes === 3);
  const cv2 = chatView(turns, { listening: true, held: true });
  check('log lines: a new question pushes the last exchange in; oldest drop off the top', cv2.log.map((l) => l.text).join('|')
    === 'Hermes: Up 0.4%.|You: and the Nasdaq?|Hermes: Up 0.9%.');
  const long = chatView([{ q: 'x '.repeat(200), a: 'y '.repeat(200) }, { q: 'next', a: '' }], { waiting: true });
  check('log lines: each is cut to one line', long.log.every((l) => !l.text.trim() || wrappedLines(l.text, 552) <= 1));
}

{ 
  const { listeningDots, LISTEN_DOTS_MS } = await import('../src/window.ts');
  const seq = [0, 1, 2, 3, 4, 5, 6].map((i) => listeningDots(i * LISTEN_DOTS_MS));
  check('listening dots: in . .. ... then out .. . and again', seq.join('|') === 'Listening|Listening.|Listening..|Listening...|Listening..|Listening.|Listening', seq.join('|'));
}

{
  const { windowMsFor } = await import('../src/window.ts');
  check('reading time: extraMs adds to the pop-up time', windowMsFor({ kind: 'news', extraMs: 12000 }) === windowMsFor({ kind: 'news' }) + 12000);
  check('reading time: none -> unchanged', windowMsFor({ kind: 'mail' }) === windowMsFor({ kind: 'mail', extraMs: 0 }));
  const w = new WindowState();
  w.offer({ seq: 1, kind: 'news', title: 'NEWS', text: 'x', extraMs: 20000, pushed: true }, 0);
  const still = w.tick(WINDOW_MS + 5000);
  check('reading time: still up after its 15 s', !!w.item && w.item.seq === 1, w.item);
  w.tick(WINDOW_MS + 21000);
  check('reading time: closes after 15 s + its reading time', !w.item || w.item.seq !== 1, w.item);
}

process.exit(fails ? 1 : 0);
