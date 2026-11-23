import { bottomV, centerV, wrappedLines } from '../src/center.ts';

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${JSON.stringify(detail)}`}`);
  if (!ok) fails++;
};
const pad = (s) => s.length - s.replace(/^\n+/, '').length;

check('one line in a 6-line box -> 2 blank lines above (middle)', pad(centerV("Where is the station? I'm lost.", 6)) === 2);
const three = 'The market is mostly higher this morning. QQQ is up 0.8% on a chip rebound led by Nvidia and AMD, SPY is up 0.4% and the Dow is flat.';
check('3 lines in a 6-line box -> 1 blank line above', wrappedLines(three) === 3 && pad(centerV(three, 6)) === 1, wrappedLines(three));
const long = three.repeat(3);
check('text that fills the box is not padded (starts at the top, scrolls)', wrappedLines(long) >= 6 && pad(centerV(long, 6)) === 0);
check('title + blank + answer counts all its lines', wrappedLines('Q\n\nshort answer') === 3 && pad(centerV('Q\n\nshort answer', 6)) === 1);
check('conversation box (4 lines): 2 lines -> 1 blank above', pad(centerV('You: hi\nThem: hello', 4)) === 1);
check('re-centering is stable (old padding is replaced, not added to)', centerV(centerV('one line', 6), 6) === centerV('one line', 6));
check('empty text untouched', centerV(' ', 6) === ' ');
check('bottomV: one line in a 4-line box -> 3 blank lines above', pad(bottomV('안녕하세요', 4)) === 3);
check('bottomV: 4 lines fill the box -> not padded', pad(bottomV(three.repeat(2), 4)) === 0);
check('bottomV: stable (old padding replaced)', bottomV(bottomV('one line', 4), 4) === bottomV('one line', 4));
check('bottomV: empty text untouched', bottomV(' ', 4) === ' ');
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
