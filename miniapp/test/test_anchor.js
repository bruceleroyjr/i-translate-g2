import { Anchor, direction, angleDeg, levelFor, FULL_DEG, DIM_DEG, SUSTAIN_MS, SMOOTH_MS, STALE_MS } from '../src/anchor.ts';

let fails = 0;
const check = (name, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail !== undefined ? `  (${JSON.stringify(detail)})` : ''}`);
  if (!ok) fails++;
};

const MAP = { yaw: { axis: 'x', degPerUnit: 1, sign: 1 }, pitch: { axis: 'y', degPerUnit: 1, sign: 1 }, sampleMs: 100, spikeDeg: 60 };
const PITCH_ONLY = { ...MAP, yaw: null };
const at = (v) => (typeof v === 'number' ? { yaw: v, pitch: 0 } : { yaw: 0, pitch: 0, ...v });

function facing(map = MAP) {
  const a = new Anchor(map);
  const s = { a, t: 0, levels: [] };
  feed(s, 0, 1000);
  a.capture(s.t);
  return s;
}
function feed(s, dir, ms, skip = []) {
  const d = at(dir);
  for (let i = 0; i < ms / 100; i++) {
    s.t += 100;
    if (skip.includes(i)) continue;
    s.a.feed(d.yaw, d.pitch, 0, s.t);
    s.levels.push(s.a.level(s.t));
  }
  return s;
}
const held = (dir, ms = 3000, map = MAP) => feed(facing(map), dir, ms); 
const levelAt = (dir, map = MAP) => { const s = held(dir, 600, map); return s.a.level(s.t); }; 
const angleAt = (dir) => { const s = held(dir, 600); return s.a.angle(s.t); };
const turned = () => held(40, 2000);

check('constants from the spec', FULL_DEG === 20 && DIM_DEG === 35 && SUSTAIN_MS === 1000 && SMOOTH_MS === 500 && STALE_MS === 3000);
check('levelFor: the five bands', [0, 20, 20.1, 25, 25.1, 30, 30.1, 35, 35.1, 180].map((d) => levelFor(d)).join() === '4,4,3,3,2,2,1,1,0,0');

check('gradient 0/19/22/27/32/40 deg -> 4,4,3,2,1,0', [0, 19, 22, 27, 32, 40].map((d) => levelAt(d)).join() === '4,4,3,2,1,0', [0, 19, 22, 27, 32, 40].map((d) => levelAt(d)));
check('all four directions dim alike', [{ yaw: 40 }, { yaw: -40 }, { pitch: 40 }, { pitch: -40 }].every((d) => levelAt(d) === 0));
check('30 left alone = level 2 (acceptance 9)', levelAt({ yaw: 30 }) === 2);
check('30 left + 30 up = ~41 deg, level 0 (ONE cone)', Math.round(angleAt({ yaw: 30, pitch: 30 })) === 41 && levelAt({ yaw: 30, pitch: 30 }) === 0, angleAt({ yaw: 30, pitch: 30 }));

check('a glance 0.8 s past 35 stays FACING (acceptance 7)', held(40, 800).a.state === 'FACING');
check('... and the screen is back at 4 after it', feed(held(40, 800), 0, 1000).a.level(2800) === 4);
check('1.1 s past 35 -> TURNED', held(40, 1100).a.state === 'TURNED');
check('2 dropped readings do not restart the second', feed(facing(), 40, 1200, [4, 5]).a.state === 'TURNED');
{
  const s = facing();
  for (let i = 0; i < 12; i++) feed(s, i === 4 || i === 5 ? 20 : 40, 100); 
  check('2 glitch readings do not restart the second', s.a.state === 'TURNED');
  const g = facing();
  for (let i = 0; i < 12; i++) feed(g, i >= 4 && i <= 6 ? 20 : 40, 100); 
  check('3 readings back inside restart it', g.a.state === 'FACING');
}
check('31 deg for 10 s never turns (inside 35)', held(31, 10000).a.state === 'FACING');

{
  const s = feed(turned(), 28, 2000);
  check('TURNED at 28 stays TURNED, text at level 2', s.a.state === 'TURNED' && s.a.level(s.t) === 2, [s.a.state, s.a.level(s.t)]);
  check('no capture while TURNED', s.a.capture(s.t) === false && s.a.state === 'TURNED');
  feed(s, 15, 1000);
  check('back within 20 -> FACING, level 4, anchor re-captured where the user crossed back in', s.a.state === 'FACING' && s.a.level(s.t) === 4 && s.a.angle(s.t) < 5, [s.a.state, s.a.level(s.t), s.a.angle(s.t)]);
  feed(s, 45, 600);
  check('... the new anchor is the one that counts (45 is 30 from it: level 2)', s.a.level(s.t) === 2, s.a.level(s.t));
}
{
  const s = held(60, 60000);
  check('standing still at 60 for 60 s never re-anchors (acceptance 19)', s.a.state === 'TURNED' && s.a.level(s.t) === 0);
  check('one press restores and re-captures; the press is swallowed', s.a.press(s.t) === true && s.a.state === 'FACING' && s.a.level(s.t) === 4 && s.a.angle(s.t) < 1);
  check('the next press passes through', s.a.press(s.t) === false);
}
check('a press while FACING passes through', facing().a.press(1000) === false);

{
  const s = held(15, 1000);
  check('capture while FACING moves the anchor', s.a.capture(s.t) === true && s.a.angle(s.t) < 1);
  const a = new Anchor(MAP);
  check('capture with no sample yet: not captured, taken from the first sample', a.capture(0) === false && a.angle(0) === null);
  a.feed(50, 0, 0, 100);
  check('... first sample is the anchor', a.angle(100) !== null && a.angle(100) < 1 && a.level(100) === 4);
}

{
  const a = facing();
  feed(a, 359, 600); a.a.capture(a.t); feed(a, 1, 600);
  check('yaw wrap: 359 -> 1 is 2 deg', Math.round(a.a.angle(a.t)) === 2, a.a.angle(a.t));
  const j = feed(facing(), 25, 1000);
  j.levels = [];
  for (let i = 0; i < 40; i++) feed(j, i % 2 ? 24.2 : 25.8, 100);
  check('band hysteresis: jitter around 25 keeps ONE level', new Set(j.levels).size === 1, [...new Set(j.levels)]);
  const k = feed(facing(), 35, 1500);
  let flips = 0, was = k.a.state;
  for (let i = 0; i < 100; i++) { feed(k, i % 2 ? 34.5 : 35.5, 100); if (k.a.state !== was) { flips++; was = k.a.state; } }
  check('jitter around 35: at most one change, no flapping', flips <= 1, flips);
  const sp = facing();
  feed(sp, 5, 500); feed(sp, 95, 100); feed(sp, 5, 500);
  check('one spike frame (90 deg off) is ignored', sp.a.state === 'FACING' && Math.min(...sp.levels) === 4, sp.levels);
  const fast = feed(facing(), 120, 2000);
  check('a real fast turn (it stays there) still counts', fast.a.state === 'TURNED' && fast.a.level(fast.t) === 0);
  const st = turned();
  check('IMU silent 3 s -> full brightness, FACING', st.a.level(st.t + STALE_MS + 1) === 4 && st.a.state === 'FACING');
  st.t += 10000; feed(st, 80, 500);
  check('... and the anchor is taken fresh when samples return', st.a.state === 'FACING' && st.a.angle(st.t) < 1 && st.a.level(st.t) === 4);
}

{
  const s = turned();
  check('IMU went silent while TURNED: the press still only restores (the screen is dark until redrawn)', s.a.press(s.t + STALE_MS + 1) === true && s.a.state === 'FACING');
  const w = turned();
  w.a.suspended = true; feed(w, 40, 20000); w.a.suspended = false;
  check('suspended while TURNED (screen asleep): still TURNED after, capture refuses', w.a.state === 'TURNED' && w.a.capture(w.t) === false);
}

{
  const off = turned();
  off.a.setEnabled(false, off.t);
  check('switched off while TURNED -> level 4, FACING, presses pass', off.a.level(off.t) === 4 && off.a.state === 'FACING' && off.a.press(off.t) === false);
  feed(off, 80, 3000);
  check('off: nothing dims', off.a.level(off.t) === 4 && off.a.state === 'FACING');
  off.a.setEnabled(true, off.t); feed(off, 80, 300);
  check('on again: anchored where the user looks now', off.a.angle(off.t) < 1 && off.a.level(off.t) === 4);
  const none = new Anchor(null);
  none.feed(1, 2, 3, 0);
  check('no mapping -> always 4, FACING, nothing swallowed', none.level(0) === 4 && none.state === 'FACING' && none.press(0) === false && none.angle(0) === null);
  check('pitch-only map: left/right never dims, up/down does', levelAt({ yaw: 80 }, PITCH_ONLY) === 4 && levelAt({ pitch: 40 }, PITCH_ONLY) === 0);
  const sus = facing();
  sus.a.suspended = true; feed(sus, 60, 3000);
  check('suspended (screen off): no state change, level 4, presses pass', sus.a.state === 'FACING' && sus.a.level(sus.t) === 4 && sus.a.press(sus.t) === false);
  sus.a.suspended = false; sus.a.reset(sus.t);
  check('reset (screen wakes): FACING, anchored where the user looks now', sus.a.state === 'FACING' && sus.a.angle(sus.t) < 1);
}

{
  const R = { yaw: { axis: 'z', degPerUnit: 180 / Math.PI, sign: -1 }, pitch: { axis: 'x', degPerUnit: 180 / Math.PI, sign: 1 }, sampleMs: 100, spikeDeg: 60 };
  check('direction(): scale + sign', Math.round(angleDeg(direction({ x: 0, y: 0, z: 0 }, R), direction({ x: 0, y: 0, z: -Math.PI / 6 }, R))) === 30
    && direction({ x: 0, y: 0, z: -Math.PI / 2 }, R)[0] > 0.99);
  const a = new Anchor(MAP);
  for (let t = 100; t <= 2000; t += 100) a.feed(0, 0, 0, t);
  check('hz: 10 samples a second', Math.round(a.hz(2000)) === 10, a.hz(2000));
}

const G = { kind: 'gravity', pitch: { axis: 'x', sign: 1 }, roll: { axis: 'y', sign: 1 }, g: 1, sampleMs: 91, spikeDeg: 60, cone: { full: 10, dim: 22 } };
const rad = (d) => d * Math.PI / 180;
const grav = (pitch, roll = 0, len = 1) => ({ x: len * Math.sin(rad(pitch)), y: len * Math.cos(rad(pitch)) * Math.sin(rad(roll)), z: len * Math.cos(rad(pitch)) * Math.cos(rad(roll)) });
function gfeed(s, pitch, ms, roll = 0, len = 1) {
  for (let i = 0; i < ms / 91; i++) {
    s.t += 91;
    const v = grav(pitch, roll, len);
    s.a.feed(v.x, v.y, v.z, s.t);
    s.levels.push(s.a.level(s.t));
  }
  return s;
}
function level0(map = G) {
  const s = { a: new Anchor(map), t: 0, levels: [] };
  gfeed(s, -3, 1000); 
  s.a.capture(s.t);
  return s;
}
{
  check('gravity: a nod of 25 deg reads as 25 deg', Math.abs(angleDeg(direction(grav(0), G), direction(grav(25), G)) - 25) < 0.01);
  check('gravity: the vector length does not matter (1 g or 9.8)', Math.abs(angleDeg(direction(grav(10, 0, 9.8), G), direction(grav(-10), G)) - 20) < 0.01);
  check('levelFor with its own cone 10 / 22: 10 -> 4, 12 -> 3, 16 -> 2, 20 -> 1, 23 -> 0', [10, 12, 16, 20, 23].map((d) => levelFor(d, 10, 22)).join() === '4,3,2,1,0');
  const lv = (pitch) => { const s = gfeed(level0(), pitch - 3, 700); return s.a.level(s.t); };
  check('gravity map uses its own cone: 8 / 12 / 16 / 20 / 24 deg of nod -> 4,3,2,1,0', [8, 12, 16, 20, 24].map(lv).join() === '4,3,2,1,0', [8, 12, 16, 20, 24].map(lv));
  check('nod up 26 deg held -> TURNED', gfeed(level0(), 23, 2000).a.state === 'TURNED');
  check('nod down 34 deg held -> TURNED', gfeed(level0(), -37, 2000).a.state === 'TURNED');
  const back = gfeed(gfeed(level0(), 23, 2000), -1, 1500);
  check('back level -> FACING, 4', back.a.state === 'FACING' && back.a.level(back.t) === 4);
  const jolt = gfeed(level0(), -3, 500);
  gfeed(jolt, 60, 91, 0, 1.6); gfeed(jolt, -3, 500);
  check('a jolt (the length is not 1 g) is not a head direction', jolt.a.state === 'FACING' && Math.min(...jolt.levels) === 4);
  const tilt = gfeed(level0(), -3, 2000, 25);
  check('tilting the head sideways 25 deg dims too (one cone)', tilt.a.state === 'TURNED');
}

{
  const { readFileSync } = await import('node:fs');
  const rows = readFileSync(new URL('./fixtures/imu-probe-2026-11-11T182834.csv', import.meta.url), 'utf8').trim().split(/\r?\n/).slice(1)
    .map((l) => l.split(',')).map(([, step, t, x, y, z]) => ({ step, t: +t, x: +x, y: +y, z: +z }));
  const { IMU_MAP } = await import('../src/anchor.ts');
  check('the recorded mapping is in the code: gravity, pitch on x (up +)', IMU_MAP?.kind === 'gravity' && IMU_MAP.pitch.axis === 'x' && IMU_MAP.pitch.sign === 1, IMU_MAP);
  const run = () => {
    const a = new Anchor(IMU_MAP);
    const end = {}; let captured = false, seg = 0, prev = '';
    for (const r of rows) {
      a.feed(r.x, r.y, r.z, r.t);
      if (r.step !== prev) { seg++; prev = r.step; }
      if (!captured && r.t > 1500) { a.capture(r.t); captured = true; }
      end[`${seg}:${r.step}`] = { state: a.state, level: a.level(r.t) };
    }
    return end;
  };
  const one = run();
  check('replay, one anchor: the 90 deg turns left and right do NOT dim', one['3:hold_left'].level === 4 && one['7:hold_right'].level === 4, [one['3:hold_left'], one['7:hold_right']]);
  check('replay, one anchor: nod up and nod down end dimmed away', one['11:hold_up'].state === 'TURNED' && one['15:hold_down'].state === 'TURNED', [one['11:hold_up'], one['15:hold_down']]);
  check('replay, one anchor: every return to level is bright again', ['5:still', '9:still', '13:still', '17:still'].every((k) => one[k].state === 'FACING' && one[k].level === 4), one);
}

{
  const off = () => { const s = facing(); s.a.fadeOff = true; return s; };
  const up = feed(off(), { pitch: 28 }, 300);
  check('fade off: 28 degrees up, under 0.4 s - still full (a glance does not blink it)', up.a.level(up.t) === 4 && up.a.state === 'FACING', up.levels);
  feed(up, { pitch: 28 }, 1100); 
  check('fade off: ... held about a second - off (TURNED, level 0), never a half level on the way', up.a.state === 'TURNED' && up.a.level(up.t) === 0 && up.levels.every((l) => l === 4 || l === 0), up.levels);
  const down = feed(off(), { pitch: -30 }, 1300);
  const glance = feed(off(), { pitch: 40 }, 700);
  check('fade off: a 0.7 s glance (even 40 degrees) does not switch it off', glance.a.state === 'FACING');
  check('fade off: looking down does the same', down.a.state === 'TURNED' && down.a.level(down.t) === 0);
  feed(down, { pitch: 0 }, 1500);
  check('fade off: looking back - full again', down.a.state === 'FACING' && down.a.level(down.t) === 4, down.levels.slice(-6));
  const near = feed(off(), { pitch: 15 }, 2000);
  check('fade off: inside the cone nothing changes', near.a.state === 'FACING' && near.levels.every((l) => l === 4));
}

process.exit(fails ? 1 : 0);
