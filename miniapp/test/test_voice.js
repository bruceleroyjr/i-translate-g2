import { load, relaySettings } from '../src/settings.ts';
import { voiceView } from '../src/voice.ts';

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${JSON.stringify(detail)}`}`);
  if (!ok) fails++;
};
const store = (v) => ({ get: async () => v, set: async () => undefined });

const s = await load(store(''));
check('voice ID: on by default, sent to the relay', s.voiceId === true && relaySettings(s).voice_id === true);
const off = await load(store(JSON.stringify({ voiceId: false })));
check('voice ID: a saved OFF stays off', off.voiceId === false && relaySettings(off).voice_id === false);

let v = voiceView({ enrolled: false, on: true, enrolling: null });
check('not trained: says so, button = Train my voice', /not trained/i.test(v.state) && v.button === 'Train my voice' && !v.training, v);
v = voiceView({ enrolled: true, at: '2026-11-08T17:50:00+00:00', on: true, enrolling: null });
check('trained: says when, button = Retrain', /trained/i.test(v.state) && v.state.includes('Nov 8') && v.button === 'Retrain my voice', v);
v = voiceView({ enrolled: true, at: '2026-11-08T17:50:00+00:00', on: false, enrolling: null });
check('trained but switched off: says everyone counts', /off/i.test(v.state), v);
v = voiceView({ enrolled: false, on: true, enrolling: { step: 1, of: 5, sentence: 'Remind me to call my mom.', note: '' } });
check('training: step 2 of 5 + the sentence, Cancel button', v.training && v.step === 'Step 2 of 5 - read this out loud:'
  && v.sentence === '“Remind me to call my mom.”' && v.button === 'Cancel', v);
v = voiceView({ enrolled: false, on: true, enrolling: { step: 0, of: 5, sentence: 'x', note: 'Too short - read the whole sentence.' } });
check('training: the note (too short) shows', v.note === 'Too short - read the whole sentence.', v);
check('relay unreachable: says so, no button', voiceView(null).state.includes('relay') && voiceView(null).button === '', voiceView(null));

console.log(`\n${fails ? `${fails} FAILED` : 'ALL PASS'}`);
process.exit(fails ? 1 : 0);
