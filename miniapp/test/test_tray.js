import { validateEvenHubPageContainer } from '@evenrealities/even_hub_sdk';
import { Tray, trayRow, itemText, openStatus, listTitle, FOCUS_MS, homeEntries, homeRowText, HomeList, HOME_PER_PAGE, HOME_IDLE_MS, HOME_ROW_PX } from '../src/tray.ts';
import { pageSpec, centred, Glasses, HOME_AVATAR, HOME_AVATAR_X, HOME_AVATAR_Y, TRAY_Y, TRAY_H } from '../src/glasses.ts';
import { slotsIn, arcSpot, ROW_W, STRIP_W, STRIP_H, DIA } from '../src/trayImage.ts';
import { getTextWidth } from '@evenrealities/pretext';
import { ROW_PX } from '../src/window.ts';

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) fails++;
};

const entry = (id, at, title, extra = {}) => ({ id, at, time: '9:40 AM', title, text: `${title}\n\nbody`, ...extra });
const day = (d, items) => ({ day: d, rev: 1, counts: Object.fromEntries(Object.entries(items).map(([k, v]) => [k, v.length])), items });
const empty = { note: [], news: [], mail: [], chat: [], meeting: [] };

const t = new Tray();
t.update(day('2026-11-07', empty));
check('nothing today: the icons are still all there (Vision Pro Home Screen), no badges', t.shown() && t.slots().length === 5 && t.slots().every((s) => s.count === 0 && !s.dot && !s.bright));
check('nothing today: a swipe still moves the cursor', t.swipe(1, 0) === true && t.focus === 'note');
check('an empty icon opens no list', t.openList(1).length === 0 && t.list === null);
t.clearFocus();

t.update(day('2026-11-07', { ...empty, mail: [entry('m1', 100, 'Sam - lunch?')] }));
check('first email: Emails has the badge 1, the others none', JSON.stringify(t.slots().map((s) => s.count)) === '[0,0,1,0,0]');
check('label is just the name; the number is the badge', t.slots()[2].label === 'Emails' && t.slots()[2].count === 1);
check('new item: bright with a dot', t.slots()[2].bright && t.slots()[2].dot);

t.update(day('2026-11-07', { ...empty, mail: [entry('m2', 300, 'Power bill'), entry('m1', 100, 'Sam - lunch?')], news: [entry('n1', 200, 'Stocks rise')] }));
check('News joins: badge 1; Emails keeps its place with 2', JSON.stringify(t.slots().map((s) => s.count)) === '[0,1,2,0,0]');
check('labels are Lifelogs / News / Emails / Chats / Meetings', t.slots().map((s) => s.label).join('|') === 'Lifelogs|News|Emails|Chats|Meetings');

check('swipe forward picks the first icon', t.swipe(1, 1000) && t.focus === 'note');
t.swipe(1, 1100);
check('swipe forward again: the next icon (empty ones included)', t.focus === 'news');
t.swipe(1, 1150); t.swipe(1, 1160); t.swipe(1, 1170);
check('at the end it stays on the last icon', t.focus === 'meeting');
t.swipe(-1, 1300);
check('swipe back: previous icon', t.focus === 'chat');
check('the picked icon is drawn picked + bright', t.slots()[3].picked && t.slots()[3].bright);
check('cursor stays while the user is active', t.focused(1300 + FOCUS_MS - 1));
check('cursor goes away after 10 s without a gesture', !t.focused(1300 + FOCUS_MS + 1) && t.focus === null);
const t2 = new Tray();
t2.update(t.data);
t2.swipe(-1, 0);
check('first swipe backwards picks the last icon', t2.focus === 'meeting');

t.focus = 'mail'; t.focusAt = 5001; 
check('preview: count, new count and the newest title', t.preview() === 'Emails today: 2  ·  2 new\nNewest 9:40 AM · Power bill', t.preview());
const rows = t.openList(5002);
check('tap: the list opens, newest first', t.list === 'mail' && rows[0].id === 'm2' && t.rows()[0].includes('Power bill'));
check('opening the list marks Emails seen (dot gone, dimmed)', !t.slots()[2].dot && t.unseen('mail') === 0);
check('the open list keeps the cursor from timing out', t.focused(5002 + FOCUS_MS * 3));
const opened = t.pick(1);
check('tap a row: that item opens', opened?.id === 'm1' && t.open === opened);
check('status line: "Emails 2 of 2"', openStatus('mail', opened, t.data) === 'Emails 2 of 2');
check('double tap on an item: back to the list', t.back(6000) === 'list' && t.open === null && t.list === 'mail');
check('double tap on the list: back to the plain screen', t.back(6001) === 'closed' && t.list === null);
check('double tap with nothing open: nothing to go back to', t.back(6002) === 'none');

t.update(day('2026-11-07', { ...t.data.items, mail: [entry('m3', 400, 'New one'), ...t.data.items.mail] }));
check('a newer email brings the dot back', t.slots()[2].dot && t.unseen('mail') === 1);

t.swipe(1, 7000);
t.update(day('2026-11-08', empty));
check('midnight: the badges are gone, cursor gone, seen forgotten', t.shown() && t.slots().every((s) => s.count === 0) && t.focus === null && t.seen.mail === 0);

const mt = new Tray();
const meet = { id: 'meeting-1', at: 500, time: '2:05 PM', title: 'Vendor launch date · 36 min', text: '2:05 PM – 2:41 PM  ·  Work  ·  36 min\nThey moved the launch.' };
mt.update(day('2026-11-10', { ...empty, meeting: [meet] }));
mt.focus = 'meeting'; mt.focusAt = 1000;
check('meetings preview says today like the others', mt.preview().startsWith('Meetings today: 1  ·  1 new'), mt.preview());
mt.openList(1001);
check('meetings list title says TODAY', listTitle('meeting', 1) === 'MEETINGS · TODAY (1) · tap to open · double tap: back', listTitle('meeting', 1));
check('other lists still say TODAY', listTitle('mail', 2) === 'EMAILS · TODAY (2) · tap to open · double tap: back');
check('an opened meeting: no title in the body (it is in the header), just when + the summary', itemText('meeting', meet) === meet.text);
check('a meeting whose notes are still being written says so', itemText('meeting', { ...meet, live: true }).startsWith('(writing notes)\n'));
mt.back(1002);
mt.update(day('2026-11-11', empty));
check('next day: the meetings are gone and nothing is remembered as seen', mt.slots().every((s) => s.count === 0) && mt.seen.meeting === 0);

const longRow = trayRow(entry('x', 1, 'A very long subject line that does not fit in one row at all, really it is far too long'));
check('list row: time + title, cut to the row width', getTextWidth(longRow) <= ROW_PX && longRow.endsWith('…'), longRow);
check('list row: uses the full width (more than the old 38 characters)', longRow.length > 50, `${longRow.length}: ${longRow}`);
check('list row: a short row is not cut', trayRow(entry('x', 1, 'Budget sync')) === '9:40am  Budget sync');
check('list row: wide letters (W) still fit the width', getTextWidth(trayRow(entry('x', 1, 'W'.repeat(60)))) <= ROW_PX);
check('list row: a live note says (live)', trayRow(entry('x', 1, 'Budget sync', { live: true })).endsWith('(live)'));
check('list row stays under 63 UTF-8 bytes', new TextEncoder().encode(trayRow(entry('x', 1, '日本語のとても長いタイトルがここに入ります日本語のとても長いタイトル'))).length <= 63);
check('opened news: the headline once, not twice', itemText('news', { ...entry('n', 1, 'Stocks rise'), text: 'Stocks rise\n\nS&P +0.6%' }) === 'Stocks rise\nS&P +0.6%');
check('opened email: the subject only once', itemText('mail', { ...entry('m', 1, 'Sam - lunch?'), text: 'From Mallory\nPlan?\n\nbody' }) === '9:40 AM  ·  From Mallory\nPlan?\n\nbody');
check('opened live note says still writing (title is in the header)', itemText('note', entry('n', 1, 'Budget sync', { live: true })).startsWith('(still writing)\n'));
check('opened lifelog: no title in the body, just the note', itemText('note', entry('n', 1, 'Budget sync', { text: '9:40 AM  ·  Work\nTalked.' })) === '9:40 AM  ·  Work\nTalked.');

const tc = new Tray();
tc.update(day('2026-11-07', { ...empty, chat: [entry('c1', 50, "What's the weather tomorrow", { text: '9:40 AM  ·  1 question\n\nYou: weather?\nHermes: Sunny.' })] }));
check('first chat of the day: Chats (4th, after Emails) gets the badge', JSON.stringify(tc.slots().map((s) => s.count)) === '[0,0,0,1,0]' && tc.slots()[3].label === 'Chats');

tc.focus = 'chat'; tc.focusAt = 0;
tc.openList(1);
check('Chats list row: time + first question', tc.rows()[0].includes("What's the weather"));
check('opened chat: the whole conversation (You / Hermes turns)', itemText('chat', tc.pick(0)).includes('You: weather?\nHermes: Sunny.'));
check('the left picture shows icons 0-2, the right 2-4 (the middle one straddles both)', JSON.stringify(slotsIn(0)) === '[0,1,2]' && JSON.stringify(slotsIn(1)) === '[2,3,4]');

{
  const spots = [0, 1, 2, 3, 4].map((i) => arcSpot(i, 5));
  check('arc: the middle icon is highest and centred', spots[2].x === ROW_W / 2 && spots.every((s) => s.y >= spots[2].y));
  check('arc: symmetric (left mirrors right)', spots[0].y === spots[4].y && spots[1].y === spots[3].y && spots[0].x + spots[4].x === ROW_W && spots[1].x + spots[3].x === ROW_W);
  check('arc: the outer icons are lower than the inner ones', spots[0].y > spots[1].y && spots[1].y > spots[2].y);
  check('arc: circle, name and picture edge all fit the 144 px picture', Math.max(...spots.map((s) => s.y)) + DIA / 2 + 3 + 14 <= STRIP_H && Math.min(...spots.map((s) => s.y)) - DIA / 2 >= 0);
  const seven = [0, 1, 2, 3, 4, 5, 6].map((i) => arcSpot(i, 7));
  check('arc with 7 icons (later): still inside the row and the picture, neighbours do not touch', seven.every((s) => s.x - 34 >= 0 && s.x + 34 <= ROW_W && s.y + DIA / 2 + 3 + 14 <= STRIP_H) && seven[1].x - seven[0].x >= 70);
  check('arc: two 280 px halves of a 560 x 144 row', STRIP_W * 2 === ROW_W && STRIP_H === 144);
}

const p = pageSpec('normal', { header: 'h', body: 'b', tray: true }, { meeting: false, translating: false, listening: true });
const all = [...p.imageObject, ...p.textObject];
check('home: no Hermes box, the battery as text, 3 item boxes', !p.imageObject.some((i) => i.containerName === 'avatar') && p.textObject.some((c) => c.containerName === 'homeBattery') && p.textObject.filter((c) => c.containerName.startsWith('homeRow')).length === 3 && p.containerTotalNum === all.length);
check('unique zOrderIndex', new Set(all.map((c) => c.zOrderIndex)).size === all.length);
const v = validateEvenHubPageContainer(p);
check('SDK validator accepts the Home Screen page', v === true || v?.valid === true || v?.ok === true, JSON.stringify(v).slice(0, 300));
const noTray = pageSpec('normal', { header: 'h', body: 'b' });
check('without the list (a card): no Hermes sprite picture, body at y=36', !noTray.imageObject.some((i) => i.containerName === 'avatar') && noTray.textObject.find((c) => c.containerName === 'body').yPosition === 36);

{
  const at = (h, m) => new Date(2026, 10, 12, h, m).getTime() / 1000;
  const d = { day: '2026-11-12', rev: 1, counts: { note: 3, news: 1, mail: 1, chat: 1, meeting: 1 }, items: {
    note: [
      { id: 'note-1', at: at(9, 0), time: '9:00 AM', title: 'Morning walk', text: '9:00 AM · Personal' },
      { id: 'translation-1', at: at(15, 20), time: '3:20 PM', title: 'Translation Korean → English', text: '3:20 PM  ·  14 lines translated\nPlaces: Springfield\nWhere is the station?\nThank you' },
      { id: 'read-news-1', at: at(16, 0), time: '4:00 PM', title: 'News · Fed holds', text: 'x', seen: 'news' },
    ],
    news: [{ id: 'news-1', at: at(15, 58), time: '3:58 PM', title: 'Singtel says it is insulated from Nvidia', topic: 'Technology', text: 't' }],
    mail: [{ id: 'mail-1', at: at(16, 12), time: '4:12 PM', title: 'Mallory Lee - Plan numbers for Q3', text: 'From Mallory Lee' }],
    chat: [{ id: 'chat-1', at: at(16, 26), time: '4:26 PM', title: "What's the weather tomorrow?", text: 'You: …' }],
    meeting: [{ id: 'meeting-1', at: at(15, 45), time: '3:45 PM', title: 'Vendor review sync · 27 min', text: '3:45 PM – 4:12 PM  ·  Work  ·  27 min\nnotes' }],
  } };
  const list = homeEntries(d);
  check('home list: news, email, meeting, chat, translation and the lifelog - no read copy', list.length === 6 && list.some((h) => h.e.id === 'note-1') && !list.some((h) => h.e.id === 'read-news-1'), list.map((h) => h.e.id).join());
  check('home list: newest first', list.map((h) => h.e.id).join() === 'chat-1,mail-1,news-1,meeting-1,translation-1,note-1', list.map((h) => h.e.id).join());
  const lg = list.find((h) => h.e.id === 'note-1');
  check('home list: a lifelog is "Lifelog" with its title', lg.cat === 'Lifelog' && lg.title === 'Morning walk', lg);
  const withCal = homeEntries({ ...d, items: { ...d.items, calendar: [
    { id: 'cal-1', at: at(17, 0), time: '5:00 PM', title: 'Dinner with Sam', text: '5:00 PM – 6:30 PM', where: 'Nobu' },
    { id: 'rem-1', at: at(16, 50), time: '4:50 PM', title: 'Dinner with Sam', text: 'In 10 min', reminder: true, soon: 'In 10 min' },
  ] } });
  const ev = withCal.find((h) => h.e.id === 'cal-1'), rm = withCal.find((h) => h.e.id === 'rem-1');
  check('home list: a calendar event at its start time ("Calendar · Nobu"), its reminder as "Reminder · In 10 min"',
    ev.cat === 'Calendar' && ev.source === 'Nobu' && rm.cat === 'Reminder' && rm.source === 'In 10 min' && withCal[0].e.id === 'cal-1' && withCal[1].e.id === 'rem-1', withCal.map((h) => `${h.e.id}:${h.cat}:${h.source}`));
  const by = Object.fromEntries(list.map((h) => [h.e.id, h]));
  check('home list: email = sender as source, subject as title', by['mail-1'].cat === 'Email' && by['mail-1'].source === 'Mallory Lee' && by['mail-1'].title === 'Plan numbers for Q3');
  check('home list: meeting = "Work · 27 min" as source, its name as title', by['meeting-1'].source === 'Work · 27 min' && by['meeting-1'].title === 'Vendor review sync');
  check('home list: translation = the language pair as source, its first line as title', by['translation-1'].cat === 'Translation' && by['translation-1'].source === 'Korean → English' && by['translation-1'].title === 'Where is the station?', JSON.stringify(by['translation-1'].title));
  check('home list: news = its topic as source; chat = Hermes', by['news-1'].source === 'Technology' && by['chat-1'].source === 'Hermes');
  const t = homeRowText(by['mail-1'], true);
  const [l1, l2] = t.split('\n');
  check('home row: @ + the sender, the time right; the picked one starts with ▶; a short title = 2 lines',
    /^ ▶ @ Mallory Lee {2,}4:12 PM$/.test(l1) && !l1.includes('Email') && l2.trim() === 'Plan numbers for Q3' && t.split('\n').length === 2
    && getTextWidth(l1) <= HOME_ROW_PX && getTextWidth(l1) > HOME_ROW_PX - 12, JSON.stringify(t));
  const c1 = homeRowText(by['chat-1'], false).split('\n')[0];
  check('home row: a chat keeps its category ("🙂 Chat · Hermes"), the time right', /🙂 Chat · Hermes {2,}\S/.test(c1) && getTextWidth(c1) <= HOME_ROW_PX, JSON.stringify(c1));
  const n1 = homeRowText(by['news-1'], false).split('\n')[0];
  check('home row: news = 🔥 + its topic, no "News"', n1.includes('🔥 Technology') && !n1.includes('News'), JSON.stringify(n1));
  check('home row: translation = ↔', homeRowText(by['translation-1'], false).includes('↔ Translation'));
  const { HOME_EMOJI } = await import('../src/tray.ts');
  const font = (await import('node:fs')).readFileSync('node_modules/@evenrealities/pretext/dist/font_measure.js', 'utf8');
  const missing = Object.values(HOME_EMOJI).filter((e) => !font.includes(`"${e.codePointAt(0)}":`));
  check('home emoji: all 8 are in the glasses\' font', Object.keys(HOME_EMOJI).length === 8 && missing.length === 0, missing.join(' '));
  const narrow = Object.values(HOME_EMOJI).filter((e) => e.codePointAt(0) > 0x2400 && getTextWidth(e) < 24);
  check('home emoji: only the 24 px glyphs (the 20 px ones drew as boxes)', narrow.length === 0, narrow.join(' '));
  const long = homeRowText({ ...by['news-1'], title: 'A very long headline that keeps going and going well past the edge of the row box and then some more words' }, false);
  const ll = long.split('\n');
  check('home row: a long title wraps onto a 3rd line at a word, the 3rd line cut with …', ll.length === 3 && !ll[1].trim().endsWith('…') && ll[2].trim().endsWith('…') && ll.every((l) => getTextWidth(l) <= HOME_ROW_PX + 30), JSON.stringify(ll));
  check('home row: the wrap keeps every word of line 2 whole', 'A very long headline that keeps going and going well past the edge of the row box and then some more words'.startsWith(ll[1].trim()));
  const mid = homeRowText({ ...by['news-1'], title: 'Fed holds rates steady as inflation cools again in October numbers' }, false).split('\n');
  check('home row: a title that fits two lines is not cut', mid.length === 3 && !mid[2].includes('…') && `${mid[1].trim()} ${mid[2].trim()}` === 'Fed holds rates steady as inflation cools again in October numbers', JSON.stringify(mid));
  check('home row: not picked = no ▶, lined up with the picked one', !long.includes('▶') && long.startsWith('  '));
  const many = Array.from({ length: 10 }, (_, i) => ({ ...list[0], e: { ...list[0].e, id: `x${i}`, at: 100 - i } }));
  const hl = new HomeList();
  let now = 1000;
  check('cursor: starts on the newest, page 1 of 4 (3 a page)', HOME_PER_PAGE === 3 && hl.view(many, now).picked.e.id === 'x0' && hl.view(many, now).pages === 4 && hl.view(many, now).rows.length === 3);
  for (let i = 0; i < 3; i++) hl.move(many, 1, now);
  const v2 = hl.view(many, now);
  check('cursor: 3 swipes down = the 4th item, on page 2, first row picked', v2.picked.e.id === 'x3' && v2.page === 1 && v2.rows[0].picked && !v2.rows[1].picked);
  hl.move(many, -1, now);
  check('cursor: swipe up = back to page 1, last row', hl.view(many, now).page === 0 && hl.view(many, now).rows[2].picked);
  for (let i = 0; i < 20; i++) hl.move(many, 1, now);
  check('cursor: stops at the last item', hl.view(many, now).picked.e.id === 'x9');
  const added = [{ ...many[0], e: { ...many[0].e, id: 'new', at: 200 } }, ...many];
  check('cursor: a new item on top does not move it to another item', hl.view(added, now).picked.e.id === 'x9');
  now += HOME_IDLE_MS + 1;
  check('cursor: left alone for a minute = back to the newest', hl.view(added, now).picked.e.id === 'new');
  check('cursor: an empty list has nothing to pick or move', !hl.move([], 1, now) && hl.view([], now).picked === null && hl.view([], now).pages === 1);
}

{
  const sp = getTextWidth(' ');
  const lead = (s) => s.length - s.trimStart().length;
  const wide = centred('● LIFELOGGING');
  const w = getTextWidth('● LIFELOGGING');
  check('centred: leading spaces put the text in the middle of the 560 px box (within one space)', Math.abs(lead(wide) * sp + w / 2 - (560 - 8) / 2) <= sp + 1, `${lead(wide)} ${w}`);
  check('centred: empty stays one space; too wide gets no padding', centred('') === ' ' && lead(centred('W'.repeat(80))) === 0);
}

{
  const sent = [];
  const g = new Glasses({ updateImageRawData: async (d) => { sent.push(d.imageData[0]); return 'success'; }, rebuildPageContainer: async () => true });
  g.images = { idle: [72], blank: [0] };
  g.images48 = { idle: [48], blank: [0] };
  await g.setPage('normal', { header: 'h', body: ' ', tray: false });
  await g.showAvatar('idle');
  await g.setTray(true, { header: 'h', body: ' ' }); 
  await g.showAvatar('idle');
  await g.setPage('chat', { header: 'h', body: ' ' });
  await g.showAvatar('idle');
  check('no page sends the old Hermes sprite any more - not the Home Screen, a card or the conversation page', sent.join() === '', sent.join());
}

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
