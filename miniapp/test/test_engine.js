let fails = 0;
const check = (name, ok, got) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${JSON.stringify(got)}`}`); if (!ok) fails++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sockets = [];
class FakeWS {
  static OPEN = 1;
  constructor(url, protocols) { this.url = url; this.protocols = protocols; this.sent = []; this.readyState = 0; sockets.push(this); setTimeout(() => { this.readyState = 1; this.onopen?.(); }, 5); }
  send(x) { this.sent.push(x); }
  close() { this.readyState = 3; this.closed = true; }
  emit(msg) { this.onmessage?.({ data: JSON.stringify(msg) }); }
}
globalThis.WebSocket = FakeWS;

const { LocalRelay, cleanTranslation, parseIdeas, cutNow, similarity, buildTranslatePrompt } = await import('../src/engine.ts');

check('clean: drops a lead-in and quotes', cleanTranslation('Here is the translation: "Where is the station?"') === 'Where is the station?', cleanTranslation('Here is the translation: "Where is the station?"'));
check('clean: drops trailing notes', cleanTranslation('Hello.\n\nNote: casual tone') === 'Hello.');
check('ideas: one reply + one question', JSON.stringify(parseIdeas('```json\n{"replies":["Sure, let\'s go."],"questions":["What time?"]}\n```')) === JSON.stringify([{ kind: 'reply', text: "Sure, let's go." }, { kind: 'ask', text: 'What time?' }]));
check('ideas: junk -> none', parseIdeas('sorry').length === 0);
check('cut: a finished sentence', cutNow('This is a whole sentence.') && !cutNow('Short.'));
check('similarity: same / different', similarity('abc', 'abc') === 1 && similarity('abc', 'xyz') === 0);
const prompt = buildTranslatePrompt('안녕하세요', 'Korean', 'English');
check('prompt: pair, target notes, transcript', prompt.includes('Korean-to-English') && prompt.includes('Transcript: 안녕하세요') && prompt.includes('smart-glasses'), prompt.slice(0, 200));

const eng = new LocalRelay();
let res = await eng.control({ action: 'translate', from: 'Korean', to: 'English' }).catch((e) => String(e));
check('no keys: translation refused (409 keys)', String(res).includes('409'), res);

eng.configure('SONIOX-KEY', { provider: 'anthropic', key: 'sk-ant-test', model: '' });
const calls = [];
const { AiClient } = await import('../src/ai.ts');
const fakeClaude = { messages: { create: async (req) => {
  calls.push(req);
  const text = req.messages[0].content;
  if (req.system.startsWith('You suggest')) return { stop_reason: 'end_turn', content: [{ type: 'text', text: '{"replies":["Nice to meet you."],"questions":["Where are you from?"]}' }] };
  const t = text.match(/Transcript: (.*)$/s)[1];
  const out = { '안녕하세요.': 'Hello.', 'Where is the station?': '역이 어디예요?', 'Thank you very much.': '정말 감사합니다.' }[t] ?? `[${t}]`;
  await sleep(t.startsWith('slow') ? 60 : 5);
  return { stop_reason: 'end_turn', content: [{ type: 'text', text: out }] };
} } };
eng.ai = new AiClient('anthropic', 'sk-ant-test', '', undefined, fakeClaude);
check('ready with both keys', eng.ready());
await eng.control({ action: 'settings', translate_from: 'Korean', translate_to: 'English', reply_ideas: true });
res = await eng.control({ action: 'translate', from: 'Korean', to: 'English' });
check('translating: mode says Korean → English', res.mode.translating === 'Korean → English', res.mode);
await sleep(20);
const ws = sockets.at(-1);
check('soniox: key in the protocols list', JSON.stringify(ws.protocols) === JSON.stringify(['soniox-api-key', 'SONIOX-KEY']), ws.protocols);
const cfg = JSON.parse(ws.sent[0]);
check('soniox: config (model, pcm, hints en+ko, endpoints, language id)', cfg.model === 'stt-rt-v6' && cfg.audio_format === 'pcm_s16le' && cfg.sample_rate === 16000
  && JSON.stringify(cfg.language_hints) === '["en","ko"]' && cfg.enable_endpoint_detection && cfg.enable_language_identification && !cfg.api_key, cfg);
await eng.audio(new Uint8Array(640));
check('audio goes to Soniox as binary', ws.sent.some((x) => x instanceof Uint8Array));

let seq = (await eng.replies(-1)).seq;
const newItems = async () => { const r = await eng.replies(seq); seq = r.seq; return r.items; };

ws.emit({ tokens: [{ text: '안녕하세요.', is_final: true, language: 'ko' }, { text: '<end>', is_final: true }] });
await sleep(40);
let items = await newItems();
const line = items.find((i) => i.kind === 'translation' && i.original);
check('their line translated (original + English, speak_in English, not mine)', line && line.text === 'Hello.' && line.original === '안녕하세요.' && line.speak_in === 'English' && !line.mine, items);
const ideas = items.find((i) => i.kind === 'ideas') ?? (await (async () => { await sleep(20); return (await newItems()).find((i) => i.kind === 'ideas'); })());
check('reply ideas after their line', ideas && ideas.ideas.length === 2 && ideas.for_seq === line.seq, ideas);
check('claude: Haiku 5.5, thinking off, low effort', calls.every((c) => c.model === 'claude-haiku-5-5' && c.thinking.type === 'disabled' && c.output_config.effort === 'low'), calls[0]);

ws.emit({ tokens: [{ text: 'okay', is_final: true, language: 'en' }, { text: '<end>', is_final: true }] });
await sleep(20);
check('their English is not translated', !(await newItems()).some((i) => i.kind === 'translation'));

await eng.control({ action: 'my_turn', on: true });
ws.emit({ tokens: [{ text: '안녕', is_final: true, language: 'ko' }, { text: '<end>', is_final: true }] });
await sleep(20);
check('their turn, before their tap: their words are not translated', !(await newItems()).some((i) => i.kind === 'translation'));
await eng.control({ action: 'hold' });
ws.emit({ tokens: [{ text: '여기', is_final: true, language: 'ko' }] }); 
ws.emit({ tokens: [{ text: 'Where is the station?', is_final: true, language: 'en' }] });
let r = await eng.replies(seq);
check('their live words show', r.live.text === 'Where is the station?' && r.mode.conversing, r.live);
ws.emit({ tokens: [{ text: '<end>', is_final: true }] });
await eng.control({ action: 'release' });
r = await eng.replies(seq);
check('draft = what the user said during the hold', r.draft === 'Where is the station?', r.draft);
res = await eng.control({ action: 'send' });
await sleep(30);
items = await newItems();
const mine = items.find((i) => i.kind === 'translation' && i.mine);
check('their turn translated into Korean, speak_in Korean', mine && mine.text === '역이 어디예요?' && mine.speak_in === 'Korean', items);
res = await eng.control({ action: 'hold' });
await eng.control({ action: 'release' });
res = await eng.control({ action: 'send' }).catch((e) => String(e));
check('nothing said: 409 silence + NOTHING HEARD', String(res).includes('409 silence') && (await newItems()).some((i) => i.title === 'NOTHING HEARD'), res);
await eng.control({ action: 'my_turn', on: false });

await eng.control({ action: 'my_turn_text', text: 'Thank you very much.', idea: true });
await sleep(20);
items = await newItems();
check('idea said: mine + idea', items.some((i) => i.kind === 'translation' && i.mine && i.idea && i.text === '정말 감사합니다.'), items);
ws.emit({ tokens: [{ text: '정말 감사합니다.', is_final: true, language: 'ko' }, { text: '<end>', is_final: true }] });
await sleep(20);
check('the phone playing it, heard back by the mic: dropped', !(await newItems()).some((i) => i.kind === 'translation'));

ws.emit({ tokens: [{ text: 'slow one.', is_final: true, language: 'ko' }, { text: '<end>', is_final: true }] });
ws.emit({ tokens: [{ text: '안녕하세요.', is_final: true, language: 'ko' }, { text: '<end>', is_final: true }] });
await sleep(120);
const order = (await newItems()).filter((i) => i.kind === 'translation').map((i) => i.text);
check('lines shown in the order they were said', JSON.stringify(order) === JSON.stringify(['[slow one.]', 'Hello.']), order);

const t0 = Date.now();
const wait = eng.replies(seq, (await eng.replies(seq)).sig, 1500);
setTimeout(() => ws.emit({ tokens: [{ text: '감사', is_final: false, language: 'ko' }] }), 50);
await eng.control({ action: 'my_turn', on: true });
await wait;
check('long-poll wakes on a change (not the full 1.5 s)', Date.now() - t0 < 1000, Date.now() - t0);
await eng.control({ action: 'my_turn', on: false });

ws.emit({ error_code: 401, error_message: 'Invalid API key' });
items = await newItems();
check('refused Soniox key: says so on the glasses', items.some((i) => i.title === 'SONIOX KEY') && (await eng.health()).mode.stt === 'Soniox key refused', items);

await eng.control({ action: 'translate_off' });
items = await newItems();
check('stop: TRANSLATION OFF, not translating', items.some((i) => i.title === 'TRANSLATION OFF') && !(await eng.health()).mode.translating);
res = await eng.control({ action: 'my_turn_text', text: 'hi' }).catch((e) => String(e));
check('typed turn after stop: 409', String(res).includes('409'), res);

console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
