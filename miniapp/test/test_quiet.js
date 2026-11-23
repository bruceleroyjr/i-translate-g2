import { ScreenSleep, QUIET_GRACE_MS } from '../src/window.ts';

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) fails++;
};
const q = (busy = false, extra = {}) => ({ quiet: true, busy, popup: false, ...extra });

{
  const s = new ScreenSleep();
  s.activity(1000); 
  check('right after a gesture the screen stays on (grace)', s.update(1000 + QUIET_GRACE_MS - 1, q()) === null && !s.off);
  check('grace over, nothing on screen: the display goes dark', s.update(1000 + QUIET_GRACE_MS, q()) === 'sleep' && s.off);
  check('dark stays dark (no repeated sleep)', s.update(60_000, q()) === null && s.off);
}

{
  const s = new ScreenSleep();
  s.activity(0);
  check('a card on screen keeps it on, however old the last gesture', s.update(60_000, q(true)) === null && !s.off);
  check('the card closes: dark right away (no extra wait)', s.update(60_100, q(false)) === 'sleep' && s.off);
  s.showForCard(); 
  check('a card lights the display', !s.off);
  check('card up: stays on', s.update(61_000, q(true)) === null && !s.off);
  check('card closed after its time: dark again at once', s.update(76_000, q(false)) === 'sleep' && s.off);
}

{
  const s = new ScreenSleep();
  s.activity(0);
  s.update(100_000, q()); 
  s.showForCard();
  s.update(101_000, q(true)); 
  s.activity(105_000); 
  check('a gesture during the card: stays on after the card closes (grace from the gesture)', s.update(110_000, q(false)) === null && !s.off);
  check('... and goes dark once the grace has run out', s.update(105_000 + QUIET_GRACE_MS, q(false)) === 'sleep' && s.off);
}

{
  const s = new ScreenSleep();
  s.activity(0);
  s.update(100_000, q());
  check('not quiet any more (something to show): the display comes back', s.update(101_000, { quiet: false, busy: false, popup: false }) === 'wake' && !s.off);
  check('wake() reports whether it was off', !s.wake(102_000));
}

{
  const s = new ScreenSleep();
  s.activity(0);
  s.update(100_000, q()); 
  s.showForCard();
  s.update(101_000, q(true, { popup: true })); 
  s.activity(114_000); 
  check('a card that came by itself goes dark at once when it ends, with no grace', s.update(116_000, q(false, { popup: true })) === 'sleep' && s.off);
}

console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
