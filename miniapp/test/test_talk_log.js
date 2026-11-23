import { talkBoxes, talkPast, TALK_LINES, TALK_WRAP_PX } from '../src/window.ts';
import { wrappedLines } from '../src/center.ts';

let fails = 0;
const check = (name, ok, got) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${JSON.stringify(got)}`}`); if (!ok) fails++; };
const rows = (t) => t.split('\n').flatMap((p) => (p.trim() ? Array.from({ length: wrappedLines(p, TALK_WRAP_PX) }, (_, i) => (i ? '…' : p)) : ['']));
const aligned = (r) => { const a = rows(r.you), b = rows(r.hermes); return a.every((x, i) => !x.trim() || !(b[i] || '').trim()); };
const total = (r) => Math.max(rows(r.you).length, rows(r.hermes).length);

check('talkPast: answered turns as You / Hermes lines, cancelled and unanswered left out',
  JSON.stringify(talkPast([{ q: 'weather?', a: 'Sunny.' }, { q: 'x', a: '', cancelled: true }, { q: 'time?', a: '3 PM.' }, { q: 'next', a: '' }]))
  === JSON.stringify(['You: weather?', 'Hermes: Sunny.', 'You: time?', 'Hermes: 3 PM.']));

let r = talkBoxes([], 'You: weather?\nHermes: Sunny and 82.');
check('first exchange: their question in the dim box, the answer in the bright box one line down', r.you === 'You: weather?' && r.hermes === '\nHermes: Sunny and 82.', r);

r = talkBoxes(['You: a?', 'Hermes: b.'], 'You: c?\nHermes: d.');
check('back and forth: questions dim, answers bright, interleaved line by line', r.you === 'You: a?\n\nYou: c?' && r.hermes === '\nHermes: b.\n\nHermes: d.', r);

const longQ = `You: ${'what about the long weekend forecast for the north shore beaches '.repeat(2)}`.trim();
r = talkBoxes([], `${longQ}\nHermes: Windy.`);
const qLines = wrappedLines(longQ, TALK_WRAP_PX);
check('a wrapped question: the answer starts below all of its lines', qLines >= 2 && r.hermes === `${'\n'.repeat(qLines)}Hermes: Windy.` && aligned(r), { qLines, r });

r = talkBoxes(['You: a?', 'Hermes: b.'], 'You: c?\nWaiting for Hermes…');
check('waiting: their question dim, the status bright', r.you === 'You: a?\n\nYou: c?' && r.hermes === '\nHermes: b.\n\nWaiting for Hermes…', r);
r = talkBoxes(['You: a?', 'Hermes: b.'], 'Listening…');
check('listening: the status bright under the conversation', r.you === 'You: a?' && r.hermes === '\nHermes: b.\nListening…', r);

const long = Array.from({ length: 10 }, (_, i) => [`You: question ${i}?`, `Hermes: answer ${i}.`]).flat();
r = talkBoxes(long, 'You: last one?\nHermes: Yes.');
check('long conversation: oldest lines off the top, newest kept, at most the frame', total(r) <= TALK_LINES && total(r) >= TALK_LINES - 1
  && r.hermes.endsWith('Hermes: Yes.') && r.you.endsWith('You: last one?') && !r.you.includes('question 0?') && aligned(r)
  && /^(You|Hermes): /.test([r.you, r.hermes].map((t) => t.split('\n')[0]).find((x) => x.trim()) || ''), r);

const bigAnswer = `Hermes: ${'A very long answer that keeps going. '.repeat(12)}`.trim();
r = talkBoxes(long, `You: tell me everything\n${bigAnswer}`);
check('a long answer: only the answer, bright, from its start; the question hidden (never bright), the dim box empty',
  r.you.trim() === '' && r.hermes === bigAnswer && !r.hermes.includes('You:'), r);
const hugeQ = `You: ${'tell me about the long weekend '.repeat(10)}`.trim();
r = talkBoxes([], `${hugeQ}\nHermes: ${'Sure, here is a long reply. '.repeat(6)}`);
check('a huge question + an answer that together overflow: the answer alone, no You: in the bright box', !r.hermes.includes('You:') && r.hermes.startsWith('Hermes:') && r.you.trim() === '', r);

r = talkBoxes([], 'You: list?\nHermes: one\n\ntwo');
check('an empty line inside an answer stays a line', r.you === 'You: list?' && r.hermes === '\nHermes: one\n\ntwo' && aligned(r), r);

console.log(fails ? `${fails} FAILED` : 'all passed');
process.exitCode = fails ? 1 : 0;
