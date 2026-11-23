import { validateEvenHubPageContainer } from '@evenrealities/even_hub_sdk';
import { pageSpec, AVATAR_X, AVATAR, IDS, Glasses } from '../src/glasses.ts';
import './flush_now.js';
import { TOPICS, TRANSLATE_FROM, LANGUAGES, CUE_MODES, NEWS_EVERY, LOCATION_SHARE, load, setPairSide, relaySettings } from '../src/settings.ts';
import { WindowState, pickedIndex, pickerOrder, approvalText, APPROVAL_MAX_CHARS, TapGuard, MENU_TAP_GUARD_MS, modeMenu, SEND_CHOICES, chosenIndex, newsRow, storyText, truncBytes, headerLine, chatView, HISTORY_CHARS, QUESTION_CHARS } from '../src/window.ts';
import { wrappedLines } from '../src/center.ts';
import { getTextWidth } from '@evenrealities/pretext';
import { ROW_PX } from '../src/window.ts';

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) fails++;
};
const store = (raw) => ({ get: async () => raw, set: async () => undefined });

check('topics: Market, Technology, Global economy, Sports, Local', TOPICS.join() === 'Market,Technology,Global economy,Sports,Local');
let s = await load(store(JSON.stringify({ topics: ['Market', 'Old local'], relayUrl: 'u' })));
check('old saved "Old local" -> Local, and Sports switched on once', s.topics.join() === 'Market,Local,Sports' && s.topicsV === 2);
s = await load(store(JSON.stringify({ topics: ['Market'], topicsV: 2 })));
check('after the migration, turning Sports off sticks', s.topics.join() === 'Market');
s = await load(store(''));
check('fresh install: every topic on', s.topics.length === 5);

check('cue styles: Work and Personal only', CUE_MODES.map(([k]) => k).join() === 'work,personal');
for (const old of ['family', 'friends', 'new']) {
  s = await load(store(JSON.stringify({ cueMode: old })));
  check(`saved cue style '${old}' -> personal`, s.cueMode === 'personal');
}
s = await load(store(JSON.stringify({ cueMode: 'work' })));
check('saved Work stays Work', s.cueMode === 'work');
s = await load(store(''));
check('news every: default 10 min, sent to the relay', s.newsEveryMin === 10 && relaySettings(s).news_every_min === 10);
s = await load(store(JSON.stringify({ newsEveryMin: 30 })));
check('news every: a saved 30 min stays', s.newsEveryMin === 30 && relaySettings(s).news_every_min === 30);
s = await load(store(JSON.stringify({ newsEveryMin: 7 })));
check('news every: an odd value falls back to 10', s.newsEveryMin === 10);
check('news every: choices 5 / 10 / 15 / 30 / 60', NEWS_EVERY.join() === '5,10,15,30,60');
s = await load(store(''));
check('location share: default approximate', s.locationShare === 'approx' && LOCATION_SHARE.map(([k]) => k).join() === 'approx,precise,off');
s = await load(store(JSON.stringify({ locationShare: 'precise' })));
check('location share: a saved choice stays', s.locationShare === 'precise');
s = await load(store(JSON.stringify({ locationShare: 'everywhere' })));
check('location share: a bad value falls back to approximate', s.locationShare === 'approx');
const order = pickerOrder(TRANSLATE_FROM, 'Japanese');
check('picker: the default language first (highlight starts there), all 13 (English too) listed once', order[0] === 'Japanese' && order.length === 13 && new Set(order).size === 13 && order.includes('English'));
check('picker: tapped row by index', pickedIndex({ currentSelectItemIndex: 3 }, order) === 3);
check('picker: protobuf drops index 0 -> the default', pickedIndex({}, order) === 0);
check('picker: by name when the index is missing', pickedIndex({ currentSelectItemName: 'Thai' }, order) === order.indexOf('Thai'));

const p = pageSpec('langs', { header: 'TRANSLATE FROM', body: ' ', langs: order });
const all = [...p.imageObject, ...p.textObject, ...p.listObject];
check('picker page: count matches, one input box (the list)', p.containerTotalNum === all.length && all.filter((c) => c.isEventCapture === 1).length === 1 && p.listObject[0].isEventCapture === 1);
check('picker page: list = the 13 languages, names fit 63 bytes, <= 20 rows',
  p.listObject[0].itemContainer.itemName.join() === order.join() && order.every((n) => Buffer.byteLength(n) <= 63));
check('picker page: list clear of the avatar (above it) and on screen', p.listObject[0].yPosition + p.listObject[0].height <= 226 && p.listObject[0].xPosition + p.listObject[0].width <= 576);
check('picker page: SDK validator accepts it', validateEvenHubPageContainer(p).valid === true);
check('no page carries a glasses menu (tap and hold = hold to talk)', ['normal', 'chat', 'approval', 'confirm', 'langs', 'dark'].every((k) =>
  !('menuObject' in pageSpec(k, { header: 'h', body: 'b', langs: ['Korean'] }))));
const names = (st) => modeMenu(st).map((m) => m.label).join(' | ');
check('double tap list: Start Meeting Mode, Start Translation, Top News, Pause Listening',
  names({ listening: true, meeting: false, translating: false }) === 'Start Meeting Mode | Start Translation | Top News | Pause Listening');
check('meeting on -> Stop Meeting Mode', names({ listening: true, meeting: true, translating: false }) === 'Stop Meeting Mode | Start Translation | Top News | Pause Listening');
check('translating -> Stop Translation', names({ listening: true, meeting: false, translating: true }) === 'Start Meeting Mode | Stop Translation | Top News | Pause Listening');
check('paused -> Resume Listening first (the highlight starts there)',
  names({ listening: false, meeting: false, translating: false }) === 'Resume Listening | Start Meeting Mode | Start Translation | Top News');
check('each row does what its label says', modeMenu({ listening: true, meeting: true, translating: true }).map((r) => r.action).join() === 'lifelog,translate_off,news,pause');
for (const st of [{ listening: true, meeting: false, translating: false }, { listening: false, meeting: true, translating: true }]) {
  const labels = modeMenu(st).map((r) => r.label);
  check(`double tap list ${JSON.stringify(st)}: rows fit, SDK accepts the list page`,
    labels.every((l) => Buffer.byteLength(l) <= 63) && validateEvenHubPageContainer(pageSpec('langs', { header: 'MENU', body: ' ', langs: labels })).valid === true);
}
{
  const c = pageSpec('confirm', { header: 'SEND TO HERMES?', body: '“what time is it”' });
  check('confirm page: SEND / CANCEL list, SEND first, the only input box, SDK accepts it',
    c.listObject[0].itemContainer.itemName.join() === SEND_CHOICES.join() && SEND_CHOICES[0] === 'SEND'
    && [...c.imageObject, ...c.textObject, ...c.listObject].filter((x) => x.isEventCapture === 1).length === 1
    && validateEvenHubPageContainer(c).valid === true);
  check('approval page still APPROVE / DENY', pageSpec('approval', { header: 'h', body: 'b' }).listObject[0].itemContainer.itemName.join() === 'APPROVE,DENY');
  check('confirm tap by name works when protobuf drops index 0', chosenIndex({ currentSelectItemName: 'CANCEL' }, SEND_CHOICES) === 1
    && chosenIndex({ currentSelectItemName: 'SEND' }, SEND_CHOICES) === 0 && chosenIndex({}, SEND_CHOICES) === 0);
  const calls = [];
  const g = new Glasses({ rebuildPageContainer: async (spec) => { calls.push(spec); return true; }, textContainerUpgrade: async (x) => calls.push(x) });
  await g.setPage('confirm', { header: 'SEND TO HERMES?', body: 'b' });
  await g.setText(IDS.body, '“call mom”');
  await g.setText(IDS.footer, 'x');
  check('confirm page: body text updates, no footer box there', g.page === 'confirm' && calls.length === 2 && calls[1].content === '“call mom”');
}

s = await load(store(''));
check('fresh install: Korean → English', s.translateFrom === 'Korean' && s.translateTo === 'English');
s = await load(store(JSON.stringify({ translateFrom: 'Japanese' })));
check('settings saved before the target existed -> English target', s.translateFrom === 'Japanese' && s.translateTo === 'English');
s = await load(store(JSON.stringify({ translateFrom: 'Spanish', translateTo: 'Spanish' })));
check('same language on both sides is repaired on load', s.translateFrom === 'Spanish' && s.translateTo === 'English');
s = await load(store(JSON.stringify({ translateFrom: 'English', translateTo: 'Klingon' })));
check('unknown target -> English, then repaired (English → Korean)', s.translateFrom === 'English' && s.translateTo === 'Korean');
const pair = { translateFrom: 'Korean', translateTo: 'English' };
check('pick target Spanish', setPairSide(pair, 'to', 'Spanish') && pair.translateFrom === 'Korean' && pair.translateTo === 'Spanish');
check('pick target = the spoken language -> the two swap', setPairSide(pair, 'to', 'Korean') && pair.translateFrom === 'Spanish' && pair.translateTo === 'Korean');
check('pick spoken = the target -> the two swap', setPairSide(pair, 'from', 'Korean') && pair.translateFrom === 'Korean' && pair.translateTo === 'Spanish');
check('unknown language is refused', !setPairSide(pair, 'to', 'Klingon') && pair.translateTo === 'Spanish');
check('relay settings carry both sides', relaySettings({ ...(await load(store(''))), translateFrom: 'Thai', translateTo: 'French' }).translate_to === 'French');
check('every language name fits a list row (63 bytes)', LANGUAGES.every((n) => Buffer.byteLength(n) <= 63));
check('picker uses its own container id', p.listObject[0].containerID === IDS.langs.containerID);

const w = new WindowState();
w.offer({ seq: 1, kind: 'news', title: 'NEWS — Local', text: 'Muni fares rise', topic: 'Local', place: 'San Francisco' }, 1000);
check('Local news header names the city', w.title(1000) === 'NEWS — San Francisco');
w.offer({ seq: 2, kind: 'news', title: 'NEWS — Sports', text: 'x', topic: 'Sports' }, 2000);
check('Sports news header', w.title(2000) === 'NEWS — Sports');

const w2 = new WindowState();
w2.offer({ seq: 1, kind: 'status', title: 'TRANSLATING', text: '' }, 1000);
w2.offer({ seq: 2, kind: 'status', title: 'IDLE', text: '' }, 2000);
check('0.2.2: IDLE (dropped half-heard word) ends the TRANSLATING header, no window', !w2.busy && !w2.item && w2.title(2000) === '');
const s2 = await load(store(JSON.stringify({ topicsV: 2, topics: ['Market'] })));
check('0.2.2: translation listens on the phone mic by default; live words on', s2.translateMic === 'phone' && s2.liveWords === true);

const w3 = new WindowState();
w3.offer({ seq: 1, kind: 'news', title: 'NEWS — Market', text: 'Stocks rally', topic: 'Market' }, 1000);
w3.press(2000);
check('0.2.4: double tap on the top-3 list goes back to the headline', w3.back(3000)?.[0].type === 'render' && !w3.expanded && w3.item.kind === 'news');
check('0.2.4: double tap on a plain window is not "back" (pauses listening as before)', w3.back(3500) === null);
const w4 = new WindowState();
w4.offer({ seq: 0, kind: 'news', title: 'NEWS — Market', text: '', topic: 'Market' }, 1000);
w4.press(1000);
check('0.2.4: top-3 list opened from the glasses menu closes on double tap', w4.back(2000)?.some((f) => f.type === 'clear') && !w4.item);

check('swipe-to-pin removed', typeof new WindowState().pinOnScroll === 'undefined' && typeof new WindowState().longPress === 'undefined');
check('0.2.5: approval text fits 4 lines above the buttons', approvalText('y'.repeat(500)).length === APPROVAL_MAX_CHARS && approvalText('short') === 'short');

const T1 = Date.UTC(2026, 10, 6, 23, 47, 52);
const g = new TapGuard();
check('0.2.7: a tap with no menu activity goes through', g.allows(0, T1));
g.menuActivity(T1); 
check('0.2.7: the plain tap 1 s after a menu choice is ignored (no "Listening, ask away")', !g.allows(0, T1 + 1000));
check('0.2.7: a double tap right after the menu is ignored too', !g.allows(3, T1 + 1200));
check('0.2.7: swipes / long press are never blocked', g.allows(1, T1 + 500) && g.allows(9, T1 + 500));
check('0.2.7: taps work again after 1.5 s', g.allows(0, T1 + MENU_TAP_GUARD_MS + 1) && g.ignored === 2);

const story = { topic: 'Market', place: '', title: 'Tech stocks rebound as dip buyers return to the AI trade, Nvidia and AMD lead the way', summary: 'The Nasdaq rose 1.2%.', source: 'CNBC' };
check('0.2.164: news row = topic | headline, fits a 63-byte list row', newsRow(story).startsWith('Market | Tech stocks') && Buffer.byteLength(newsRow(story)) <= 63 && newsRow(story).endsWith('…'));
check('0.2.72: news row fills the row width (not 38 characters)', newsRow(story).length > 50 && getTextWidth(newsRow(story)) <= ROW_PX, newsRow(story));
check('0.2.72: wide-letter headlines still fit the width', getTextWidth(newsRow({ ...story, title: 'W'.repeat(60) })) <= ROW_PX);
check('0.2.10: Local rows show the city', newsRow({ ...story, topic: 'Local', place: 'Springfield', title: 'Rail opens' }) === 'Springfield | Rail opens');
const NOW = new Date(2026, 10, 13, 16, 0).getTime(); 
const at = (h, m, day = 13) => new Date(2026, 10, day, h, m).getTime() / 1000;
check('0.2.163: news row starts with the published time', newsRow({ ...story, at: at(15, 42) }, NOW).startsWith('3:42 PM | Market | Tech stocks'), newsRow({ ...story, at: at(15, 42) }, NOW));
check('0.2.163: a timed row still fits the list row', Buffer.byteLength(newsRow({ ...story, at: at(9, 5) }, NOW)) <= 63 && getTextWidth(newsRow({ ...story, at: at(9, 5) }, NOW)) <= ROW_PX && newsRow({ ...story, at: at(9, 5) }, NOW).startsWith('9:05 AM | '));
check('0.2.163: a story from yesterday shows its date', newsRow({ ...story, topic: 'Sports', title: 'Warriors win', at: at(23, 40, 12) }, NOW) === 'Nov 12 11:40 PM | Sports | Warriors win');
check('0.2.163: no time from the feed = no time on the row', newsRow({ ...story, topic: 'Sports', title: 'Warriors win', at: 0 }, NOW) === 'Sports | Warriors win');
const curly = { topic: 'Technology', title: 'Nvidia’s stock is on a losing streak not seen in 15 years — here’s why', at: at(12, 21) };
check('0.2.164: short topic names + ASCII quotes/dashes on the row', newsRow(curly, NOW).startsWith("12:21 PM | Tech | Nvidia's stock"), newsRow(curly, NOW));
check('0.2.164: rows use the full 63 bytes and the row width', Buffer.byteLength(newsRow(curly, NOW)) <= 63 && Buffer.byteLength(newsRow(curly, NOW)) >= 60 && getTextWidth(newsRow(curly, NOW)) <= ROW_PX, Buffer.byteLength(newsRow(curly, NOW)));
check('0.2.164: Global economy shows as Economy', newsRow({ topic: 'Global economy', title: 'Tariffs', at: 0 }, NOW) === 'Economy | Tariffs');
check('0.2.10: multi-byte text (Korean, →) never breaks the byte limit', Buffer.byteLength(truncBytes('역이 어디예요 → '.repeat(10), 60)) <= 60);
check('0.2.10: the story window = headline, summary, source', storyText(story) === `${story.title}

The Nasdaq rose 1.2%.

— CNBC`);
check('0.2.10: a story without a summary still reads cleanly', storyText({ topic: 'Sports', title: 'Warriors win' }) === 'Warriors win');
check('0.2.10: header says WAITING (no mic level) after tap to send',
  headerLine({ online: true, listening: true, meeting: false, conversing: true, mic: 0.5, awaiting: true }) === '◌ WAITING');

const t1 = [{ q: 'what is the Dow at?', a: 'Up 0.4% at 42,100.' }];
let cv = chatView(t1, { listening: true });
check('chat: their question in its own (dimmer) box, Hermes\' answer bright, nothing older yet',
  cv.question === 'You: what is the Dow at?' && cv.current === 'Hermes: Up 0.4% at 42,100.' && cv.history === ' ');
check('chat: answer on screen -> tap to ask more, double tap exits', cv.footer === 'tap: ask more  ·  double tap: exit');
cv = chatView(t1, { listening: true, draft: 'and the Nasdaq' });
check('chat: a new question pushes the last exchange up into the dim box', cv.history.includes('Hermes: Up 0.4%') && cv.current === 'You: “and the Nasdaq”'
  && cv.question === ' ' && cv.footer.startsWith('▶ TAP TO SEND'));
cv = chatView([...t1, { q: 'and the Nasdaq', a: '' }], { listening: true, waiting: true });
check('chat: sent and waiting -> question in the dim question box, … where the answer comes, older turn dimmest',
  cv.question === 'You: and the Nasdaq' && cv.current === '…' && cv.history.includes('Dow') && cv.footer === 'waiting for Hermes…  ·  double tap: cancel');
cv = chatView(t1, { ended: true });
check('chat: plain answer, conversation closed -> the log stays: hold: ask more, double tap: exit', cv.footer.startsWith('tap: ask more'));
cv = chatView(t1, { listening: true, held: true });
check('chat: holding, nothing heard yet -> Listening (animated dots), last exchange moves into the log',
  cv.current === 'Listening' && cv.footer === 'tap to send  ·  double tap: cancel' && cv.history.includes('Hermes: Up 0.4%') && cv.question === ' ');
cv = chatView(t1, { listening: true, held: true, draft: 'and the Nasdaq' });
check('chat: listening with words -> tap to send (no SEND / CANCEL step)', cv.current === 'You: “and the Nasdaq”' && cv.footer === 'tap to send  ·  double tap: cancel');
const many = Array.from({ length: 6 }, (_, i) => ({ q: `question number ${i}`, a: `answer number ${i} with some words` }));
cv = chatView(many, { listening: true, draft: 'next' });
check('chat: the log keeps the newest exchanges in 3 lines, oldest cut with …', wrappedLines(cv.history, 552) <= 3 && cv.history.startsWith('…')
  && cv.history.includes('answer number 5') && cv.history.includes('answer number 4') && !cv.history.includes('question number 0'));
check('chat: one exchange per log line', chatView(t1, { listening: true, draft: 'x' }).history === 'You: what is the Dow at?  ·  Hermes: Up 0.4% at 42,100.');
cv = chatView(t1, { listening: true, held: true, live: 'and what about the Nasdaq composite and the Russell two thousand and also the ten year treasury yield and oil prices and gold and bitcoin and the euro against the dollar and the yen this morning please' });
check('chat: long live words keep the NEWEST words in the 3 bright lines', cv.current.startsWith('…') && cv.current.endsWith('morning please”') && wrappedLines(cv.current, 552) <= 3);
cv = chatView(t1, { listening: true, held: true, live: 'and the Nasdaq' });
check('chat: live words show bright while holding', cv.current === 'You: “and the Nasdaq”' && cv.footer === 'tap to send  ·  double tap: cancel');
cv = chatView([{ q: 'x'.repeat(300), a: 'ok' }], { listening: true });
check('chat: a long question is cut to fit its 1-line box', wrappedLines(cv.question, 552) === 1 && cv.question.endsWith('…'));
cv = chatView([], { listening: true });
check('chat: empty conversation -> Tap to talk', cv.current === 'Tap to talk.' && cv.footer === 'tap, speak, tap to send');

cv = chatView([...t1, { q: 'and the Nasdaq', a: '', cancelled: true }], { ended: true });
check('cancelled: question shown, "Cancelled.", hold for more / double tap exits', cv.question === 'You: and the Nasdaq' && cv.current === 'Cancelled.'
  && cv.footer === 'tap: ask more  ·  double tap: exit');
cv = chatView([...t1, { q: 'and the Nasdaq', a: '', cancelled: true }], { listening: true, held: true });
check('cancelled: the next hold pushes it into the log as "(cancelled)"', cv.history.endsWith('You: and the Nasdaq  ·  (cancelled)') && cv.current === 'Listening');

cv = chatView([], { nothingHeard: true, ended: true });
check('no speech: middle says "No speech detected", hint tap to talk again / double tap cancel', cv.current === 'No speech detected'
  && cv.footer === 'tap to talk again  •  double tap: cancel' && cv.question === ' ');
cv = chatView(t1, { nothingHeard: true, ended: true });
check('no speech over a conversation: the earlier exchange stays in the log', cv.current === 'No speech detected' && cv.history.includes('Hermes: Up 0.4%'));

{
  const w = new WindowState();
  w.holdPopups = true;
  check('log up: mail waits in the queue', w.offer({ seq: 1, kind: 'mail', title: 'MAIL — A', text: 'hi' }, 1000).length === 0 && !w.item && w.queue.length === 1);
  check('log up: replies still come in', w.offer({ seq: 2, kind: 'reply', title: '', text: 'answer' }, 1000).length === 1 && w.item?.kind === 'reply');
  check('log up: the tick does not release the mail', w.tick(1000 + 16_000).every((f) => f.type !== 'render') && w.queue.length === 1 && !w.item);
  w.holdPopups = false;
  w.next(40_000);
  check('log gone: the mail shows', w.item?.kind === 'mail');
}

console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
