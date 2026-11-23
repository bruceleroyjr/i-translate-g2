import { readableText, chunks, speakable, READ_MAX_CHARS, CHUNK_CHARS } from '../src/readText.ts';

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) fails++;
};
const R = (o) => readableText({ seq: 1, title: '', text: '', ...o });

check('translation: the translated text', R({ kind: 'translation', original: '안녕하세요', text: 'Hello there.' }) === 'Hello there');
check('a translation is read without symbols the voice would spell out', R({ kind: 'translation', text: 'A • B — C' }) === 'A B, C');
check('status / wake: nothing to read', R({ kind: 'status', text: 'x' }) === null && R({ kind: 'wake', text: 'x' }) === null);
check('no card: nothing to read', readableText(null) === null && R({ kind: 'translation', text: '   ' }) === null);
check('capped at READ_MAX_CHARS', R({ kind: 'translation', text: 'word '.repeat(2000) }).length <= READ_MAX_CHARS);
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
  check('settings: their lines start silent, your own turn is played (the other person must hear it)', READ_KINDS.join() === 'translations,myturn' && !fresh.readKinds.translations && fresh.readKinds.myturn);
  check('settings: translation voices start female', fresh.voiceSpoken === 'female' && fresh.voiceTranslated === 'female');
  const old = await load(mem(JSON.stringify({ readKinds: { translations: 'yes', myturn: false, bogus: true }, relayUrl: 'x' })));
  check('settings: only real true values count, unknown switches and old settings are dropped', old.readKinds.translations === false && old.readKinds.myturn === false && !('bogus' in old.readKinds) && !('relayUrl' in old));
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
console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
