let fails = 0;
const check = (name, ok, got) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${JSON.stringify(got)}`}`); if (!ok) fails++; };
const { AiClient, PROVIDERS } = await import('../src/ai.ts');
const app = JSON.parse((await import('node:fs')).readFileSync(new URL('../app.json', import.meta.url), 'utf-8'));

const wl = app.permissions.find((p) => p.name === 'network').whitelist;
for (const p of PROVIDERS) {
  const host = p.base ? new URL(p.base).origin : 'https://api.anthropic.com';
  check(`whitelist has ${p.name}`, wl.includes(host), host);
}

const fake = (answer) => {
  const calls = [];
  const f = async (url, init) => {
    const body = init.body ? JSON.parse(init.body) : null;
    calls.push({ url, body, auth: init.headers.Authorization });
    const [status, json] = answer(url, body);
    return { status, text: async () => JSON.stringify(json) };
  };
  f.calls = calls;
  return f;
};
const reply = (text) => [200, { choices: [{ message: { content: text } }] }];

let f = fake(() => reply('Hello.'));
let ai = new AiClient('deepseek', 'sk-ds', '', f);
check('deepseek: answer', (await ai.ask('SYS', 'hi', 100)) === 'Hello.');
let c = f.calls[0];
check('deepseek: url, bearer key, default model, messages, max_tokens', c.url === 'https://api.deepseek.com/chat/completions' && c.auth === 'Bearer sk-ds'
  && c.body.model === 'deepseek-chat' && c.body.messages[0].role === 'system' && c.body.messages[1].content === 'hi' && c.body.max_tokens === 100, c);

f = fake((url, body) => (body.reasoning_effort ? [400, { error: { message: 'Unsupported value: reasoning_effort' } }] : reply('Hola.')));
ai = new AiClient('openai', 'sk-o', '', f);
check('openai: falls back to a plain request', (await ai.ask('S', 'hi', 64)) === 'Hola.' && f.calls[0].body.reasoning_effort === 'minimal'
  && f.calls[0].body.max_completion_tokens === 256 && !f.calls[1].body.reasoning_effort, f.calls.map((x) => x.body));

f = fake((url, body) => {
  if (url.endsWith('/models')) return [200, { data: [{ id: 'models/gemini-1.5-pro' }, { id: 'models/gemini-3.5-flash' }, { id: 'models/gemini-3.0-flash' }] }];
  return body.model === 'gemini-3.5-flash' ? reply('Bonjour.') : [404, { error: { message: 'model not found' } }];
});
ai = new AiClient('gemini', 'AIza', '', f);
check('gemini: default gone -> picks the newest flash', (await ai.ask('S', 'hi', 64)) === 'Bonjour.' && ai.model === 'gemini-3.5-flash', ai.model);

f = fake(() => [404, { error: { message: 'model not found' } }]);
ai = new AiClient('openai', 'sk-o', 'gpt-typo', f);
check('typed model not found: says so, no swap', (await ai.test()) === 'OpenAI (ChatGPT) model "gpt-typo" not found' && ai.model === 'gpt-typo' && f.calls.length === 1, await ai.test());

const said = async (status) => new AiClient('groq', 'k', '', fake(() => [status, {}])).test();
check('401 -> key refused', (await said(401)) === 'Groq (fast Llama) key refused');
check('429 -> rate limit or credits', (await said(429)) === 'Groq (fast Llama) rate limit or credits');
check('500 -> error 500', (await said(500)) === 'Groq (fast Llama) error 500');
const down = new AiClient('mistral', 'k', '', async () => { throw new TypeError('fetch failed'); });
check('network down -> couldn\'t reach', (await down.test()) === "couldn't reach Mistral");
check('test ok', (await new AiClient('xai', 'k', '', fake(() => reply('OK'))).test()) === 'ok');

check('<think> dropped', (await new AiClient('openrouter', 'k', 'deepseek/deepseek-r1', fake(() => reply('<think>hmm</think>Hi.'))).ask('S', 'x', 50)) === 'Hi.');

const sent = [];
const Anthropic = (await import('@anthropic-ai/sdk')).default;
const claude = { messages: { create: async (req) => {
  sent.push(req);
  if (req.thinking) throw new Anthropic.BadRequestError(400, { type: 'error', error: { message: 'thinking.type: disabled is not supported' } }, 'thinking.type: disabled is not supported', new Headers());
  return { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Hi.' }] };
} } };
ai = new AiClient('anthropic', 'sk-ant', 'claude-old', undefined, claude);
check('claude: options refused -> plain retry', (await ai.ask('S', 'x', 50)) === 'Hi.' && sent[0].thinking.type === 'disabled' && sent[0].output_config.effort === 'low' && !sent[1].thinking, sent);
check('claude default model', new AiClient('anthropic', 'k', '', undefined, claude).model === 'claude-haiku-5-5');

console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
