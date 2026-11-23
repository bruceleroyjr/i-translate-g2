import { ScreenSleep, QUIET_GRACE_MS } from '../src/window.ts';

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) fails++;
};
const q = (busy = false, extra = {}) => ({ listening: true, needsScreen: false, quiet: true, busy, ...extra });

{
  const s = new ScreenSleep();
  s.activity(1000); 
  check('right after a gesture the screen stays on (grace)', s.update(1000 + QUIET_GRACE_MS - 1, q()) === null && !s.off);
  check('grace over, nothing on screen: the display goes dark', s.update(1000 + QUIET_GRACE_MS, q()) === 'sleep' && s.off && s.offBetweenPopups);
  check('dark stays dark (no repeated sleep)', s.update(60_000, q()) === null && s.off);
}

{
  const s = new ScreenSleep();
  s.activity(0);
  check('a card on screen keeps it on, however old the last gesture', s.update(60_000, q(true)) === null && !s.off);
  check('the card closes: dark right away (no extra wait)', s.update(60_100, q(false)) === 'sleep' && s.off);
  s.showForCard(); 
  check('a pop-up lights the display for its card', !s.off && !s.offBetweenPopups);
  check('card up: stays on', s.update(61_000, q(true)) === null && !s.off);
  check('card closed after its 15 s: dark again at once', s.update(76_000, q(false)) === 'sleep' && s.off && s.offBetweenPopups);
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
  check('showForCard does nothing unless the display-off mode put it to sleep (still off)', (() => { const p = new ScreenSleep(); p.update(1000, { listening: false, needsScreen: false }); p.update(30_000, { listening: false, needsScreen: false }); p.showForCard(); return p.off && !p.offBetweenPopups; })());
  check('the mode ends (quiet false): the display comes back', s.update(101_000, { listening: true, needsScreen: false, quiet: false, busy: false }) === 'wake' && !s.off);
}

{
  const s = new ScreenSleep();
  s.activity(0);
  s.update(100_000, q()); 
  check('an approval needs the screen: wakes even in the display-off mode', s.update(101_000, { listening: true, needsScreen: true, quiet: true, busy: true }) === 'wake' && !s.off);
}

{
  const s = new ScreenSleep();
  const p = { listening: false, needsScreen: false };
  s.update(1000, p);
  const steps = [s.update(12_000, p), s.update(30_000, p)];
  check('paused: fades, then the screen goes off (as before)', steps[0] === 'fade' && steps[1] === 'sleep' && s.off && !s.offBetweenPopups, steps.join());
  s.showForCard();
  check('paused: a pop-up does not light a paused screen', s.off);
  check('listening again with the display-off mode on: back on first, not stuck dark', s.update(31_000, q()) === 'wake' && !s.off);
}

{
  const s = new ScreenSleep();
  s.activity(0);
  s.update(100_000, q()); 
  s.showForCard();
  s.update(101_000, q(true, { popup: true })); 
  s.activity(114_000); 
  check('a pop-up that ends goes dark at once, with no wake-up grace', s.update(116_000, q(false, { popup: true })) === 'sleep' && s.off);
}

console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
