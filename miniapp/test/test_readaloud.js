import { readableText, chunks, speakable, READ_MAX_CHARS, CHUNK_CHARS } from '../src/readText.ts';

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) fails++;
};
const R = (o) => readableText({ seq: 1, title: '', text: '', ...o });

check('reply: the reply text', R({ kind: 'reply', text: 'Sunny, 84 degrees.' }) === 'Sunny, 84 degrees');
check('news pop-up: headline + summary', R({ kind: 'news', text: 'Stocks rise\n\nS&P +0.6%.' }) === 'Stocks rise. S&P +0.6%', R({ kind: 'news', text: 'Stocks rise\n\nS&P +0.6%.' }));
check('news opened from the tray: headline + summary line', R({ kind: 'news', tray: true, text: 'Stocks rise\nS&P +0.6%, Nasdaq +0.9%.\n\n— AP' }) === 'Stocks rise. S&P +0.6%, Nasdaq +0.9%', R({ kind: 'news', tray: true, text: 'Stocks rise\nS&P +0.6%, Nasdaq +0.9%.\n\n— AP' }));
check('email pop-up: From sender. subject. first line', R({ kind: 'mail', title: 'MAIL — Mallory Lee', text: 'Plan numbers\n\nCan you send them before the 14th?\nThanks' }) === 'From Mallory Lee. Plan numbers. Can you send them before the 14th?',
  R({ kind: 'mail', title: 'MAIL — Mallory Lee', text: 'Plan numbers\n\nCan you send them before the 14th?\nThanks' }));
check('email opened from the tray: From sender. subject. first line', R({ kind: 'mail', tray: true, text: '9:40 AM  ·  From Mallory\nPlan?\n\nbody here\nmore' }) === 'From Mallory. Plan? body here', R({ kind: 'mail', tray: true, text: '9:40 AM  ·  From Mallory\nPlan?\n\nbody here\nmore' }));
check('lifelog: the entry text, bullets not spelled out', R({ kind: 'note', text: '9:40 AM – 10:05 AM  ·  Work\nTalked.\n• You promised: send it' }) === '9:40 AM, 10:05 AM Work. Talked. You promised: send it',
  R({ kind: 'note', text: '9:40 AM – 10:05 AM  ·  Work\nTalked.\n• You promised: send it' }));
check('live cue: the cue text', R({ kind: 'cue', title: 'CUE', text: 'Ask: who owns the Q3 review?' }) === 'Ask: who owns the Q3 review?');
check('past chat: title + snippet', R({ kind: 'reply', tray: true, title: 'Weather tomorrow', text: '10:12 AM · 2 questions\n\nYou: weather?\nHermes: Sunny.' }).startsWith('Weather tomorrow. '));
check('an opened lifelog (reply + lifelog flag) reads its text, not a chat title', R({ kind: 'reply', tray: true, lifelog: true, title: 'Coffee', text: 'Talked about the deck.' }) === 'Talked about the deck');
check('status / wake / approval: nothing to read', R({ kind: 'status', text: 'x' }) === null && R({ kind: 'wake', text: 'x' }) === null && R({ kind: 'approval', text: 'x' }) === null);
check('no window: nothing to read', readableText(null) === null && R({ kind: 'reply', text: '   ' }) === null);
check('capped at READ_MAX_CHARS', R({ kind: 'reply', text: 'word '.repeat(2000) }).length <= READ_MAX_CHARS);
check('speakable: line breaks become pauses, symbols dropped', speakable('A\n\nB • C — D') === 'A. B C, D', speakable('A\n\nB • C — D'));

const long = 'This is sentence number one. '.repeat(20) + 'and a very long run on part without any full stop ' + 'x'.repeat(10);
const parts = chunks(long);
check('chunks: every piece is short enough, nothing lost', parts.every((p) => p.length <= CHUNK_CHARS + 12) && parts.join(' ').replace(/\s+/g, '').length >= long.replace(/\s+/g, '').length - 2,
  JSON.stringify(parts.map((p) => p.length)));
check('chunks: a short text is one piece', chunks('Hello there. How are you?').length === 1);

import { load, READ_KINDS } from '../src/settings.ts';
{
  const mem = (v) => ({ get: async () => v, set: async () => undefined });
  const fresh = await load(mem(''));
  check('settings: every pop-up type starts switched off (my translated turn is on: it is the point of Conversate)', READ_KINDS.length === 7 && READ_KINDS.every((k) => fresh.readKinds[k] === (k === 'myturn')), JSON.stringify(fresh.readKinds));
  check('settings: translation voices start female', fresh.voiceSpoken === 'female' && fresh.voiceTranslated === 'female');
  const old = await load(mem(JSON.stringify({ readAloud: true, autoRead: true, readKinds: { news: true, mail: 'yes', bogus: true } })));
  check('settings: the 0.2.103 switches are dropped, only real true values count', old.readAloud === undefined && old.autoRead === undefined && old.readKinds.news === true && old.readKinds.mail === false && old.readKinds.myturn === true && !('bogus' in old.readKinds), JSON.stringify(old.readKinds));
}

{
  const { relaySettings } = await import('../src/settings.ts');
  const mem = (v) => ({ get: async () => v, set: async () => undefined });
  const a = await load(mem(''));
  check('settings: coaching starts Active', a.coachStyle === 'active' && relaySettings(a).coach_style === 'active');
  const p = await load(mem(JSON.stringify({ coachStyle: 'passive' })));
  check('settings: Passive is kept and sent to the relay', p.coachStyle === 'passive' && relaySettings(p).coach_style === 'passive');
  const bad = await load(mem(JSON.stringify({ coachStyle: 'loud' })));
  check('settings: an unknown coaching value becomes Active', bad.coachStyle === 'active');
}

{
  const { voiceGender, groupVoices } = await import('../src/readText.ts');
  check('voice gender from the first name', voiceGender('Samantha') === 'female' && voiceGender('Daniel (Enhanced)') === 'male' && voiceGender('Karen (English (Australia))') === 'female' && voiceGender('Zorblax') === 'other' && voiceGender('Microsoft Zira - English (United States)') === 'female' && voiceGender('Microsoft David - English (United States)') === 'male');
  const v = (name, lang) => ({ name, lang, voiceURI: `uri:${name}` });
  const g = groupVoices([v('Daniel', 'en-GB'), v('Samantha', 'en-US'), v('Alex', 'en-US'), v('Karen', 'en-AU'), v('Yuna', 'ko-KR'), v('Zorblax', 'en-US')]);
  check('voices grouped: Female, Male, Other English, Other languages - each sorted', g.map((x) => x.label).join('|') === 'Female voices|Male voices|Other English voices|Other languages'
    && g[0].voices.map((x) => x.name).join() === 'Karen,Samantha' && g[1].voices.map((x) => x.name).join() === 'Alex,Daniel' && g[3].voices[0].name === 'Yuna', JSON.stringify(g.map((x) => x.voices.map((y) => y.name))));
  check('no voices -> no groups', groupVoices([]).length === 0);
  const ko = groupVoices([v('Yuna', 'ko-KR'), v('Minsu', 'ko-KR'), v('Samantha', 'en-US')], ['ko'], 'Korean');
  check('a language other than English: its voices first, the rest under Other languages',
    ko[ko.length - 1].label === 'Other languages' && ko[ko.length - 1].voices.map((x) => x.name).join() === 'Samantha'
    && ko.slice(0, -1).flatMap((g) => g.voices.map((x) => x.name)).sort().join() === 'Minsu,Yuna');
}

{
  const { pickVoice, LANG_BCP47, LANG_SAMPLE } = await import('../src/langVoices.ts');
  const v = (name, lang) => ({ name, lang, voiceURI: `uri:${name}` });
  const voices = [v('Samantha', 'en-US'), v('Daniel', 'en-GB'), v('Alex', 'en-US'), v('Yuna', 'ko-KR'), v('Kyoko', 'ja-JP'), v('Otoya', 'ja-JP'), v('Daniel (Premium)', 'en-US')];
  check('pick: female English', pickVoice(voices, 'English', 'female').name === 'Samantha' && pickVoice(voices, 'English', 'female').matched);
  check('pick: male English prefers the Premium voice, exact en-US first', pickVoice(voices, 'English', 'male').name === 'Daniel (Premium)', pickVoice(voices, 'English', 'male').name);
  check('pick: female Korean', pickVoice(voices, 'Korean', 'female').uri === 'uri:Yuna');
  check('pick: no male Korean voice -> still speaks Korean with the female one, matched=false', pickVoice(voices, 'Korean', 'male').uri === 'uri:Yuna' && pickVoice(voices, 'Korean', 'male').matched === false);
  check('pick: male Japanese', pickVoice(voices, 'Japanese', 'male').name === 'Otoya');
  check('pick: no voice for the language (Thai / Hawaiian) -> default voice (empty uri)', pickVoice(voices, 'Thai', 'female').uri === '' && pickVoice(voices, 'Hawaiian', 'male').uri === '');
  const langs = ['English', 'Korean', 'Japanese', 'Chinese - Mandarin', 'Chinese - Cantonese', 'Spanish', 'Portuguese', 'French', 'German', 'Thai', 'Vietnamese', 'Filipino', 'Hawaiian'];
  check('every translator language has a speech language and a sample sentence', langs.every((l) => LANG_BCP47[l] && LANG_SAMPLE[l]));
}

{
  const { NEURAL_VOICES, naturalVoice, cleanNaturalVoices, neuralOptions } = await import('../src/neuralVoices.ts');
  const langs = ['English', 'Korean', 'Japanese', 'Chinese - Mandarin', 'Chinese - Cantonese', 'Spanish', 'Portuguese', 'French', 'German', 'Thai', 'Vietnamese', 'Filipino'];
  check('every language (not Hawaiian) has a female AND a male natural voice', langs.every((l) => NEURAL_VOICES[l]?.some((v) => v.gender === 'female') && NEURAL_VOICES[l]?.some((v) => v.gender === 'male')) && !NEURAL_VOICES.Hawaiian);
  check('every voice id looks like a neural voice name (the worker only accepts those)', Object.values(NEURAL_VOICES).flat().every((v) => /^[a-z]{2,3}-[A-Z]{2}-[A-Za-z]+Neural$/.test(v.id)));
  check('defaults = the default voices', naturalVoice('English') === 'en-US-JennyNeural' && naturalVoice('Korean') === 'ko-KR-SunHiNeural' && naturalVoice('Hawaiian') === '');
  check('a picked voice is used, an unknown one falls back to the default', naturalVoice('Korean', { Korean: 'ko-KR-InJoonNeural' }) === 'ko-KR-InJoonNeural' && naturalVoice('Korean', { Korean: 'x' }) === 'ko-KR-SunHiNeural');
  check('saved picks are cleaned', JSON.stringify(cleanNaturalVoices({ Korean: 'ko-KR-InJoonNeural', English: 'evil', Klingon: 'x' })) === JSON.stringify({ Korean: 'ko-KR-InJoonNeural' }));
  check('options: Female and Male groups', neuralOptions('Korean').includes('label="Female"') && neuralOptions('Korean').includes('label="Male"') && neuralOptions('Korean').includes('InJoon'));
  const st = await load({ get: async () => '', set: async () => undefined });
  check('settings: the iPhone voice is the default engine (speed first), natural voices are an option', st.voiceEngine === 'iphone' && JSON.stringify(st.naturalVoices) === '{}'
    && (await load({ get: async () => JSON.stringify({ voiceEngine: 'natural' }), set: async () => undefined })).voiceEngine === 'natural');
}

console.log(fails ? `${fails} FAILED` : 'ALL PASS');

{
  const { ReadAloud, silentWav, LEAD_IN_MS } = await import('../src/readAloud.ts');
  const w = silentWav(350);
  const txt = (a, b) => String.fromCharCode(...w.slice(a, b));
  check('silent wav: a valid 8 kHz 8-bit mono WAV of the right length, all silence', txt(0, 4) === 'RIFF' && txt(8, 12) === 'WAVE' && w.length === 44 + 2800 && w.slice(44).every((x) => x === 128));
  check('lead-in is about a third of a second', LEAD_IN_MS >= 250 && LEAD_IN_MS <= 500, LEAD_IN_MS);
  const events = [];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  globalThis.Audio = class { constructor() { this.src = ''; }
    play() { const src = this.src; events.push(src.startsWith('blob:') && this.isSilence ? 'silence' : `play:${src}`);
      setTimeout(() => this.onended && this.onended(), src === this.silence ? 30 : 30); return Promise.resolve(); }
    pause() {} };
  const realCreate = URL.createObjectURL.bind(URL);
  const wavs = new Set(); 
  URL.createObjectURL = (blob) => { const u = realCreate(blob); if (blob.type === 'audio/wav') wavs.add(u); return u; };
  const origPlay = globalThis.Audio.prototype.play;
  globalThis.Audio.prototype.play = function () { this.isSilence = wavs.has(this.src); return origPlay.call(this); };
  const r = new ReadAloud();
  r.leadInMs = 40;
  r.fetchAudio = async (text) => new Blob([text]);
  r.speakNatural('Hello there.', 'voice', () => events.push('fallback'));
  await sleep(250);
  check('natural voice: the silence plays first, then the speech', events[0] === 'silence' && events.length >= 2 && events[1].startsWith('play:blob:') && !events.includes('fallback'), JSON.stringify(events));
  events.length = 0;
  const spoken = [];
  globalThis.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  globalThis.speechSynthesis = { speaking: false, cancel() {}, getVoices: () => [], speak(u) { spoken.push(u.text); events.push('speak'); setTimeout(() => u.onend && u.onend(), 10); } };
  const p = new ReadAloud();
  p.leadInMs = 40;
  p.speak('Good morning.');
  check('iPhone voice: nothing spoken during the lead-in', spoken.length === 0);
  await sleep(200);
  check('iPhone voice: the silence plays first, then it speaks', events[0] === 'silence' && events.includes('speak') && spoken[0] === 'Good morning.', JSON.stringify(events));
  spoken.length = 0;
  const q = new ReadAloud();
  q.leadInMs = 60;
  q.speak('Never said.');
  q.stop();
  await sleep(250);
  check('a stop during the lead-in cancels the reading', spoken.length === 0, JSON.stringify(spoken));
  delete globalThis.Audio;
  spoken.length = 0;
  const n = new ReadAloud();
  n.leadInMs = 40;
  n.speak('Still said.');
  await sleep(150);
  check('no audio player: it still speaks after the pause', spoken[0] === 'Still said.', JSON.stringify(spoken));
}
process.exit(fails ? 1 : 0);
