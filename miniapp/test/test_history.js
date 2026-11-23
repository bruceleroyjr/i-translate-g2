import { History, INDEX_KEY, recKey, MAX_RECORDS, MAX_LINES, parseSummary, summaryPrompt, listHtml, stamp, length, UNTITLED } from '../src/history.ts';

let fails = 0;
const check = (name, ok, got) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${JSON.stringify(got)}`}`); if (!ok) fails++; };

const mem = () => { const m = new Map(); return { m, get: async (k) => m.get(k) ?? '', set: async (k, v) => { m.set(k, v); } }; };
const line = (who, original, text, at) => ({ who, original, text, at });
const rec = (id, at, lines = [line('them', '역이 어디예요?', 'Where is the station?', at)]) =>
  ({ id, at, end: at + 60000, from: 'Korean', to: 'English', title: '', summary: '', lines, n: lines.length, seen: false });

{
  const s = mem();
  const h = new History(s);
  await h.load();
  check('empty phone: no records', h.list.length === 0, h.list);
  await h.save(rec('a', 1000));
  await h.save(rec('b', 2000));
  check('two saved: two in the list', h.list.length === 2, h.list);
  check('the list is one small key, each recording its own key', JSON.parse(s.m.get(INDEX_KEY)).length === 2 && JSON.parse(s.m.get(recKey('a'))).lines.length === 1, [...s.m.keys()]);
  const h2 = new History(s);
  await h2.load();
  check('reopening the app: the list is still there', h2.list.map((m) => m.id).join() === 'a,b', h2.list);
  check('a recording comes back whole', (await h2.get('a'))?.lines[0].text === 'Where is the station?');

  const r = await h2.get('a');
  r.title = 'Train Station Help'; r.summary = 'They asked where the station is.';
  await h2.save(r);
  check('a title updates its row, not a new one', h2.list.length === 2 && h2.list.find((m) => m.id === 'a').title === 'Train Station Help', h2.list);
  check('untitled = only the ones the AI still has to name', h2.untitled().map((m) => m.id).join() === 'b', h2.untitled());
  check('untitled skips the live one', h2.untitled('b').length === 0);

  await h2.markSeen('b');
  check('opened: the yellow dot goes', h2.list.find((m) => m.id === 'b').seen === true && (await h2.get('b')).seen === true);

  await h2.remove('a');
  check('delete one: gone from the list and its key emptied', h2.list.map((m) => m.id).join() === 'b' && s.m.get(recKey('a')) === '' && (await h2.get('a')) === null);
  await h2.clear();
  check('delete all: nothing left', h2.list.length === 0 && s.m.get(recKey('b')) === '' && JSON.parse(s.m.get(INDEX_KEY)).length === 0);
}

{
  const s = mem();
  const h = new History(s);
  await h.load();
  for (let i = 0; i < MAX_RECORDS + 2; i++) await h.save(rec(`r${i}`, 1000 + i));
  check(`more than ${MAX_RECORDS}: the oldest go`, h.list.length === MAX_RECORDS && !h.list.some((m) => m.id === 'r0' || m.id === 'r1') && s.m.get(recKey('r0')) === '', h.list.length);
  const long = rec('long', 1e12, Array.from({ length: MAX_LINES + 50 }, (_, i) => line('them', `${i}`, `line ${i}`, i)));
  await h.save(long);
  const back = await h.get('long');
  check(`a very long session keeps its last ${MAX_LINES} lines`, back.lines.length === MAX_LINES && back.lines.at(-1).text === `line ${MAX_LINES + 49}`, back.lines.length);
}

{
  const s = mem();
  await s.set(INDEX_KEY, '{not json');
  const h = new History(s);
  await h.load();
  check('a damaged list does not break the app', h.list.length === 0);
}

let p = parseSummary('{"title": "Train Station Help", "summary": "They asked where the station is."}');
check('AI JSON -> title + summary', p.title === 'Train Station Help' && p.summary === 'They asked where the station is.', p);
p = parseSummary('Sure! Here it is:\n```json\n{"title": "\\"Ordering Coffee.\\"", "summary": "Two lattes to go."}\n```');
check('JSON inside chatter / fences, quotes and the full stop come off the title', p.title === 'Ordering Coffee' && p.summary === 'Two lattes to go.', p);
p = parseSummary('Ordering coffee at a cafe');
check('plain text: its first line is the title', p.title === 'Ordering coffee at a cafe' && p.summary === '', p);
p = parseSummary('{"summary": "x"}');
check('no title in the JSON: none (it stays New translation)', p.title === '', p);
check('a long title is cut', parseSummary(`{"title": "${'word '.repeat(40)}"}`).title.length <= 60);

const prompt = summaryPrompt({ from: 'Korean', to: 'English', lines: [line('them', '역이 어디예요?', 'Where is the station?', 1), line('me', 'Two blocks that way', '두 블록 가세요', 2)] });
check('prompt: their lines translated, their own words as the user said them, answer in their language',
  prompt.includes('Them: Where is the station?') && prompt.includes('Me: Two blocks that way') && prompt.includes('Write in English') && !prompt.includes('역이'), prompt);
const big = summaryPrompt({ from: 'Korean', to: 'English', lines: Array.from({ length: 400 }, (_, i) => line('them', '', `sentence number ${i} of a long talk`, i)) });
check('a long session: the prompt keeps the start and the end, not everything', big.length < 7000 && big.includes('number 0 ') && big.includes('number 399 '), big.length);

const at = new Date(2026, 10, 18, 9, 31).getTime();
check('time like Even: 09:31 AM 11/18/2026', stamp(at) === '09:31 AM 11/18/2026', stamp(at));
check('PM time', stamp(new Date(2026, 10, 14, 21, 34).getTime()) === '09:34 PM 11/14/2026');
check('length: seconds, minutes', length({ at: 0, end: 45000 }) === '45 s' && length({ at: 0, end: 12 * 60000 }) === '12 min');
const metas = [
  { id: 'old', at: 1000, end: 2000, from: 'Japanese', to: 'English', title: 'Naruto & J-Music', n: 3, seen: true },
  { id: 'new', at: 5000, end: 6000, from: 'Korean', to: 'English', title: '', n: 2, seen: false },
  { id: 'x<y', at: 3000, end: 4000, from: 'Korean', to: 'English', title: '<b>hi</b>', n: 1, seen: false },
];
let html = listHtml(metas, true);
check('newest first', html.indexOf('data-rec="new"') < html.indexOf('data-rec="old"'), html);
check('oldest first', listHtml(metas, false).indexOf('data-rec="old"') < listHtml(metas, false).indexOf('data-rec="new"'));
check('no AI title yet: New translation', html.includes(`>${UNTITLED}<`));
check('codes like JA / KO / EN', html.includes('JA ') && html.includes('KO ') && html.includes(' EN'));
check('yellow dot only on the ones not opened yet', (html.match(/class="h-new"/g) || []).length === 2, html);
check('titles are escaped', html.includes('&lt;b&gt;hi&lt;/b&gt;') && !html.includes('<b>hi'));
html = listHtml(metas, true, 'new');
check('the session being recorded now says Recording…', html.includes('>Recording…<') && html.includes('h-new rec'));
check('empty: says how to make one', listHtml([], true).includes('No translations yet'));

console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
