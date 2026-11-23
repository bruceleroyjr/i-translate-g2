import { MicWatchdog } from '../src/mic.ts';

let fails = 0;
const check = (name, ok) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`); if (!ok) fails++; };

const T0 = Date.UTC(2026, 10, 6, 23, 0, 0); 
const wd = new MicWatchdog();
wd.armed(T0);
wd.frame(T0 + 1000);
check('frames arriving -> no re-arm', !wd.needsRearm(T0 + 4000, true));
check('mic on but no frame for 5 s -> re-arm', wd.needsRearm(T0 + 7000, true));
check('at most once every 10 s', !wd.needsRearm(T0 + 9000, true) && wd.needsRearm(T0 + 17_500, true));
check('mic off on purpose -> never', !new MicWatchdog().needsRearm(T0 + 60_000, false));
const fresh = new MicWatchdog();
fresh.armed(T0);
check('armed, no frame at all for 5 s -> re-arm', fresh.needsRearm(T0 + 5000, true));

console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
