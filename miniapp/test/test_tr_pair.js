import { spokenPair, middlePair, TR_SPOKEN_LINES, TR_PAIR_LINES, TR_BIG } from '../src/window.ts';
import { wrappedLines } from '../src/center.ts';

let fails = 0;
const check = (name, ok, got) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${JSON.stringify(got)}`}`); if (!ok) fails++; };
const lead = (t) => t.length - t.replace(/^\n+/, '').length;

let r = spokenPair('역이 어디예요?', 'Where is the station?');
check('one line each: their words on top, the English one line down', r.origin === '역이 어디예요?' && r.question === '\nWhere is the station?', r);

const longKo = '가지고 가실 거예요, 아니면 여기서 드실 거예요? 오늘은 빵도 있고 커피도 있어요. 포장도 돼요.';
const rows = wrappedLines(longKo);
r = spokenPair(longKo, 'Would you like it to go, or will you eat here?');
check('their words wrap to 2 lines: the English starts under both', rows >= 2 && lead(r.question) === Math.min(rows, TR_SPOKEN_LINES) && wrappedLines(r.origin) <= TR_SPOKEN_LINES, { rows, r });

r = spokenPair(longKo.repeat(4), 'x');
check('their words longer than 2 lines: cut to 2 with …', wrappedLines(r.origin) === TR_SPOKEN_LINES && r.origin.endsWith('…'), r);

const longEn = 'This is a long translated sentence that keeps on going. '.repeat(8);
r = spokenPair('짧아요', longEn);
check('a long English line: at most 4 lines, cut with …, together inside the 6-line area', wrappedLines(r.question.replace(/^\n+/, '')) <= 4 && r.question.endsWith('…')
  && lead(r.question) + wrappedLines(r.question.replace(/^\n+/, '')) <= TR_PAIR_LINES, r);

r = spokenPair('', 'Listening…');
check('nothing said yet: no top line, the status at the top', r.origin === ' ' && r.question === 'Listening…', r);

r = spokenPair(longKo.repeat(4), 'x', TR_BIG);
check('big: their words cut to 3 lines', wrappedLines(r.origin) === 3 && r.origin.endsWith('…'), r);
r = spokenPair('짧아요', longEn.repeat(2), TR_BIG);
check('big: the English fills the rest - 8 lines under 1 line of theirs', lead(r.question) === 1 && wrappedLines(r.question.replace(/^\n+/, '')) === 8 && r.question.endsWith('…'), r);
r = spokenPair('짧아요', 'Short.', TR_BIG);
check('big: short lines unchanged', r.origin === '짧아요' && r.question === '\nShort.', r);

const rowsOf = (t) => t.split('\n').reduce((n, p) => n + (p.trim() ? wrappedLines(p) : 1), 0);
const top = (t) => lead(t);
r = middlePair('역이 어디예요?', 'Where is the station?');
check('middle: a 1+1 line pair starts 3 lines down (4 blank above... 9-2=7 -> 3 above, 4 below)', top(r.origin) === 3 && r.origin === '\n\n\n역이 어디예요?' && r.question === '\n\n\n\nWhere is the station?', r);
r = middlePair(longKo, longEn.repeat(2));
check('middle: a pair that fills the 9 lines starts at the top', top(r.origin) === 0 && rowsOf(r.question) <= 9, r);
const mid = middlePair('짧아요', 'This is a long translated sentence that keeps on going. '.repeat(2));
const eRows = wrappedLines(mid.question.replace(/^\n+/, ''));
check('middle: the English stays right under their words, the block centred', lead(mid.question) === lead(mid.origin) + 1
  && lead(mid.origin) === Math.floor((9 - 1 - eRows) / 2), { mid, eRows });
r = middlePair('', 'Listening…');
check('middle: nothing said yet - the status alone in the middle', r.origin.trim() === '' && lead(r.question) === 4 && r.question.endsWith('Listening…'), r);

console.log(fails ? `${fails} FAILED` : 'all passed');
process.exitCode = fails ? 1 : 0;
