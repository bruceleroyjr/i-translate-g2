import { ImuProbe, PROBE_STEPS, probeCard } from '../src/imuProbe.ts';

let fails = 0;
const check = (name, ok) => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) fails++;
};

check('17 steps', PROBE_STEPS.map((s) => s.label).join() ===
  'still,left,hold_left,return,still,right,hold_right,return,still,up,hold_up,return,still,down,hold_down,return,still');
check('every step 3 s (the card needs a moment to show the next move)', PROBE_STEPS.every((s) => s.ms === 3000));

const p = new ImuProbe();
check('not running before start', !p.active && p.step(0) === null);
p.add(9, 9, 9, 0);
check('samples before start are not kept', p.drain().length === 0);
p.start(1000);
check('running after start', p.active && p.step(1000).label === 'still');
p.add(1, 2, 3, 1100);
p.add(4, 5, 6, 4100);
const rows = p.drain();
check('samples carry their step', rows.map((r) => r.step).join() === 'still,left');
check('samples carry time since start + values', rows[0].t === 100 && rows[1].t === 3100 && rows[1].x === 4 && rows[1].y === 5 && rows[1].z === 6);
check('drain empties', p.drain().length === 0);
check('seconds left in the step', p.step(1000).left === 3 && p.step(3500).left === 1);
check('turn left step text', p.step(4000).show === 'TURN LEFT 90°');
check('ends after the last step', p.step(1000 + 17 * 3000) === null && !p.active);
p.add(7, 7, 7, 1000 + 17 * 3000 + 50);
check('samples after the end are not kept', p.drain().length === 0);

check('card text', probeCard({ label: 'left', show: 'TURN LEFT 90°', left: 2 }) === 'IMU PROBE\nTURN LEFT 90°\n2s');
check('card when done', probeCard(null) === 'IMU PROBE\nPROBE SAVED');
check('card when the PC did not take the samples', probeCard(null, false) === 'IMU PROBE\nNOT SAVED\nPC not reachable');

process.exit(fails ? 1 : 0);
