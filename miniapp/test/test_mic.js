import { MicStats, pcmPeak } from '../src/mic.ts';
import { headerLine, micCorner, micGlyph } from '../src/window.ts';

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) fails++;
};

const frame = (amp, n = 1600) => {
  const b = new Uint8Array(n * 2);
  const v = new DataView(b.buffer);
  for (let i = 0; i < n; i++) v.setInt16(i * 2, i % 2 ? amp : -amp, true);
  return b;
};

check('peak of silence = 0', pcmPeak(frame(0)) === 0);
check('peak of half scale = 0.5', Math.abs(pcmPeak(frame(16384)) - 0.5) < 0.001);
const odd = new Uint8Array(frame(16384).buffer.slice(0), 0).subarray(1); 
check('peak works on an odd byte offset', typeof pcmPeak(odd) === 'number');

const m = new MicStats();
m.armed(1000, true);
check('armed, no frames yet -> phone says waiting', m.phoneLine(2000, true).includes('waiting for the first frame'));
check('armed, no frames for 3+ s -> header shows "mic —"', m.headerLevel(5000) === -1 && micGlyph(-1) === ' mic —');
m.add(frame(16384), 'glasses', 'self', true, 5100);
m.add(frame(200), 'glasses', 'other', false, 5200);
check('frames counted by speaker role, dropped ones not sent', m.frames === 2 && m.kept === 1 && m.roles.self === 1 && m.roles.other === 1);
check('source remembered for the relay header', m.source === 'glasses');
check('phone line shows roles + source', m.phoneLine(5300, true).includes('self 1 / other 1') && m.phoneLine(5300, true).includes('source glasses'));
check('refused audioControl is shown on the phone', (() => { const x = new MicStats(); x.armed(0, false); return x.phoneLine(1, false).includes('refused'); })());

check('glyph: quiet -> "mic ·"', micGlyph(0) === ' mic ·');
check('glyph: loud -> "mic |||"', micGlyph(0.5) === ' mic |||');
check('glyph: mic off -> nothing', micGlyph(null) === '');
check('0.2.12: the header has no mic level any more', !headerLine({ online: true, listening: true, meeting: false, conversing: false, mic: 0.1 }).includes('mic'));
check('0.2.12: mic level in the bottom-right corner while listening', micCorner({ listening: true, mic: 0.1 }) === 'mic ||');
check('0.2.12: corner empty when paused or waiting for Hermes', micCorner({ listening: false, mic: 0.1 }) === ' ' && micCorner({ listening: true, awaiting: true, mic: 0.1 }) === ' ');
check('0.2.12: corner shows mic — when no audio arrives', micCorner({ listening: true, mic: -1 }) === 'mic —');

const T0 = Date.UTC(2026, 10, 6, 23, 0, 0); 
const wd = new MicStats();
wd.armed(T0, true);
wd.add(frame(1000), 'glasses', 'self', true, T0 + 1000);
check('watchdog: frames arriving -> no re-arm', !wd.needsRearm(T0 + 4000, true));
check('watchdog: mic on but no frame for 5 s -> re-arm', wd.needsRearm(T0 + 7000, true));
check('watchdog: at most once every 10 s', !wd.needsRearm(T0 + 9000, true) && wd.needsRearm(T0 + 17_500, true));
check('watchdog: mic off on purpose (paused) -> never', !new MicStats().needsRearm(T0 + 60_000, false));

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
