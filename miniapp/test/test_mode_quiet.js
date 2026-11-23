import { ModeQuiet } from '../src/window.ts';

let fails = 0;
const check = (name, ok, got) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${JSON.stringify(got)}`}`); if (!ok) fails++; };

const q = new ModeQuiet();
const t = 1_000_000;
q.activity(t); 
check('lit right after the mode starts', !q.quiet(t + 5_000, 10_000));
check('dark after the screen-off time with nothing happening', q.quiet(t + 10_000, 10_000));
q.heard(2, t + 12_000); 
check('speech heard wakes it: activity = when it was heard', !q.quiet(t + 12_000, 10_000) && q.quiet(t + 20_000, 10_000) && !q.quiet(t + 19_000, 10_000));
q.heard(30, t + 21_000); 
check('an older heard time never moves the activity back', q.quiet(t + 21_000, 10_000));
q.heard(null, t + 22_000);
check('nothing heard yet (null): no change', q.quiet(t + 22_000, 10_000));
q.activity(t + 30_000); 
check('a cue, line or gesture wakes it', !q.quiet(t + 35_000, 10_000) && q.quiet(t + 40_000, 10_000));
check('"never off" (Infinity / 0): never dark', !q.quiet(t + 10_000_000, Infinity) && !q.quiet(t + 10_000_000, 0));

console.log(fails ? `${fails} FAILED` : 'all passed');
process.exitCode = fails ? 1 : 0;
