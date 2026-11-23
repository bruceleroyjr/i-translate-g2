import { todayHtml, TODAY_SHOWN, TODAY_TABS, esc, feedRows, feedHtml, chipsHtml, sideOf, FEED_SHOWN } from '../src/phoneToday.ts';
let fails = 0;
const check = (name, ok, got) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  got: ${got}`}`); if (!ok) fails++; };
const e = (kind, i, extra = {}) => ({ id: `${kind}-${i}`, at: 1000 - i, time: `${9 + (i % 3)}:0${i % 10} AM`, title: `Title ${i}`, text: `Body ${i}`, ...extra });
const data = (items) => ({ day: '2026-11-12', rev: 1, counts: {}, items: { note: [], news: [], mail: [], chat: [], meeting: [], ...items } });
check('tabs: the five lists (translations are lifelog notes)', JSON.stringify(TODAY_TABS) === JSON.stringify({ lifelogs: 'note', news: 'news', emails: 'mail', chats: 'chat', meetings: 'meeting' }));
check('nothing today', todayHtml('mail', data({}), new Set(), false).includes('Nothing yet today.'));
const mails = Array.from({ length: 14 }, (_, i) => e('mail', i));
let h = todayHtml('mail', data({ mail: mails }), new Set(), false);
check('newest first, the first 10, then "Show all 14"', (h.match(/today-row/g) || []).length === TODAY_SHOWN && h.indexOf('Title 0') < h.indexOf('Title 1') && h.includes('Show all 14'), h.slice(0, 200));
check('the count in the heading', h.includes('14 emails'));
check('folded: no full text', !h.includes('today-text'));
h = todayHtml('mail', data({ mail: mails }), new Set(['mail-3']), true);
check('show all: every row + "Show fewer"', (h.match(/today-row/g) || []).length === 14 && h.includes('Show fewer'));
check('a tapped row unfolds its full text (the glasses opened text: time · email)', h.includes('class="today-text">9:03 AM  ·  Body 3</div>') && h.includes('aria-expanded="true"'), h.match(/today-text">[^<]*/)?.[0]);
h = todayHtml('note', data({ note: [e('note', 1, { title: '<b>Alex & me</b>', text: 'a "quote"', live: true })] }), new Set(['note-1']), false);
check('text is escaped (no HTML from a title or note)', h.includes('&lt;b&gt;Alex &amp; me&lt;/b&gt;') && !h.includes('<b>Alex'));
check('a note still being written says so', h.includes('still writing'));
check('one item: singular', h.includes('1 lifelog<'));
check('esc', esc(`<a href="x">'&'</a>`) === '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
{
  const at = (n) => ({ at: n });
  const d = data({
    note: [e('note', 1, { ...at(50), text: '9:00 AM – 9:40 AM  ·  Personal\nPancakes' }), e('note', 2, { ...at(10), seen: 'news' }),
      e('note', 3, { ...at(40), title: 'Translation Korean → English', text: '10:41 AM  ·  Personal' })],
    meeting: [e('meeting', 1, { ...at(60), text: '9:00 AM – 9:46 AM  ·  Work  ·  46 min\nSummary' })],
    news: [e('news', 1, at(30))], mail: [e('mail', 1, at(20))], chat: [e('chat', 1, at(70))],
  });
  const all = feedRows(d, 'all');
  check('feed: every kind, newest first, read copies left out', all.map((r) => r.key).join(',') === 'chat:chat-1,meeting:meeting-1,note:note-1,note:note-3,news:news-1,mail:mail-1', all.map((r) => r.key));
  check('feed: a filter keeps one kind', feedRows(d, 'note').length === 2 && feedRows(d, 'mail').length === 1);
  const ch = chipsHtml('note', d);
  check('chips: counts, the picked one is on', ch.includes('All <span class="chip-n">6</span>') && ch.includes('class="chip on" data-feed="note"') && ch.includes('Email <span class="chip-n">1</span>'), ch);
  check('side: Personal / Work from the first line', sideOf(d.items.note[0]) === 'Personal' && sideOf(d.items.meeting[0]) === 'Work' && sideOf(d.items.news[0]) === '');
  let f = feedHtml('all', d, new Set(), false);
  check('feed: tags on lifelogs and meetings only', (f.match(/class="tag tag-/g) || []).length === 3 && f.includes('tag-work">Work') && f.includes('tag-personal">Personal'), f.slice(0, 300));
  check('feed: a translation note says Translation', f.includes('· Translation'));
  check('feed: folded rows have no text', !f.includes('feed-text'));
  f = feedHtml('all', d, new Set(['meeting:meeting-1']), false);
  check('feed: an opened row shows its text, keyed by kind', f.includes('feed-item open') && f.includes('feed-text') && f.includes('aria-expanded="true"'));
  check('feed: nothing today', feedHtml('all', data({}), new Set(), false).includes('Nothing yet today.'));
  const many = data({ news: Array.from({ length: FEED_SHOWN + 5 }, (_, i) => e('news', i, { at: 100 - i })) });
  check('feed: first FEED_SHOWN rows, then Show all', (feedHtml('news', many, new Set(), false).match(/feed-row/g) || []).length === FEED_SHOWN && feedHtml('news', many, new Set(), false).includes(`Show all ${FEED_SHOWN + 5}`));
  check('feed: show all + Show fewer', feedHtml('news', many, new Set(), true).includes('Show fewer'));
  const x = data({ mail: [e('mail', 1, { title: '<img src=x onerror=1>' })] });
  check('feed: titles are escaped', feedHtml('all', x, new Set(), false).includes('&lt;img') && !feedHtml('all', x, new Set(), false).includes('<img'));
}
process.exit(fails ? 1 : 0);
