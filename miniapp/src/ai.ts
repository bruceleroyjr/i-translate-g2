import Anthropic from '@anthropic-ai/sdk';

export interface Provider {
  id: string;
  name: string;
  base: string;
  keys: string;
  model: string;
  prefer: RegExp[];
  placeholder: string;
}

export const PROVIDERS: Provider[] = [
  { id: 'anthropic', name: 'Claude (Anthropic)', base: '', keys: 'console.anthropic.com › API keys', model: 'claude-haiku-5-5', prefer: [/haiku/], placeholder: 'sk-ant-…' },
  { id: 'openai', name: 'OpenAI (ChatGPT)', base: 'https://api.openai.com/v1', keys: 'platform.openai.com › API keys', model: 'gpt-5-mini',
    prefer: [/^gpt-\d+(\.\d+)?-mini$/, /^gpt-4\.1-mini$/, /^gpt-4o-mini$/, /mini$/], placeholder: 'sk-…' },
  { id: 'gemini', name: 'Google Gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai', keys: 'aistudio.google.com › Get API key', model: 'gemini-2.5-flash',
    prefer: [/gemini-\d+(\.\d+)?-flash$/, /flash-lite$/, /flash/], placeholder: 'AIza…' },
  { id: 'deepseek', name: 'DeepSeek', base: 'https://api.deepseek.com', keys: 'platform.deepseek.com › API keys', model: 'deepseek-chat', prefer: [/chat/], placeholder: 'sk-…' },
  { id: 'xai', name: 'Grok (xAI)', base: 'https://api.x.ai/v1', keys: 'console.x.ai › API keys', model: 'grok-3-mini', prefer: [/mini/, /fast/], placeholder: 'xai-…' },
  { id: 'mistral', name: 'Mistral', base: 'https://api.mistral.ai/v1', keys: 'console.mistral.ai › API keys', model: 'mistral-small-latest', prefer: [/small-latest/, /small/], placeholder: '' },
  { id: 'groq', name: 'Groq (fast Llama)', base: 'https://api.groq.com/openai/v1', keys: 'console.groq.com › API keys', model: 'llama-3.3-70b-versatile',
    prefer: [/llama.*versatile/, /llama-4/, /gpt-oss-120b/, /gpt-oss/, /qwen/, /kimi/, /llama.*instant/], placeholder: 'gsk_…' },
  { id: 'openrouter', name: 'OpenRouter (any model)', base: 'https://openrouter.ai/api/v1', keys: 'openrouter.ai › Keys', model: 'anthropic/claude-haiku-4.5',
    prefer: [/^anthropic\/claude-haiku/, /^openai\/gpt-.*mini$/, /^google\/gemini-.*flash$/], placeholder: 'sk-or-…' },
];

const NOT_CHAT = /guard|whisper|tts|orpheus|playai|embed|moderation|transcri|audio|realtime|image|vision-only|rerank|distil/i;

export const provider = (id: string): Provider => PROVIDERS.find((p) => p.id === id) ?? PROVIDERS[0];

export class AiError extends Error {}

type Fetch = typeof fetch;

export class AiClient {
  readonly p: Provider;
  model: string;
  private picked: boolean;
  private plain = false; 
  private anthropic: Anthropic | null = null;
  private key: string;
  private fetcher: Fetch;

  constructor(providerId: string, key: string, model = '', fetcher?: Fetch, anthropicClient?: unknown) {
    this.p = provider(providerId);
    this.key = key;
    this.fetcher = fetcher ?? ((...a) => fetch(...a));
    this.model = model.trim() || this.p.model;
    this.picked = !!model.trim(); 
    if (!this.p.base) {
      this.anthropic = (anthropicClient as Anthropic) ?? new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true, timeout: 20_000, maxRetries: 1 });
    }
  }

  async ask(system: string, prompt: string, maxTokens: number): Promise<string> {
    if (this.anthropic) return this.askClaude(system, prompt, maxTokens);
    try {
      return await this.askChat(system, prompt, maxTokens);
    } catch (e) {
      if (e instanceof AiError && /model/i.test(e.message) && !this.picked) { 
        this.picked = true;
        if (await this.pickModel()) return this.askChat(system, prompt, maxTokens);
      }
      throw e;
    }
  }

  async test(): Promise<string> {
    try {
      await this.ask('Reply with OK.', 'OK?', 16);
      return 'ok';
    } catch (e) {
      return e instanceof AiError ? e.message : 'failed';
    }
  }

  private async askClaude(system: string, prompt: string, maxTokens: number): Promise<string> {
    try {
      const r = await this.anthropic!.messages.create({
        model: this.model, max_tokens: maxTokens, system,
        ...(this.plain ? {} : { thinking: { type: 'disabled' as const }, output_config: { effort: 'low' as const } }),
        messages: [{ role: 'user', content: prompt }],
      });
      if (r.stop_reason === 'refusal') return '';
      return r.content.map((b) => (b.type === 'text' ? b.text : '')).join('').trim();
    } catch (e) {
      if (e instanceof Anthropic.BadRequestError && !this.plain && /thinking|effort|output_config/i.test(e.message)) { 
        this.plain = true;
        return this.askClaude(system, prompt, maxTokens);
      }
      if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) throw new AiError('Claude key refused');
      if (e instanceof Anthropic.RateLimitError) throw new AiError('Claude rate limit or credits');
      if (e instanceof Anthropic.NotFoundError) throw new AiError(`Claude model "${this.model}" not found`);
      if (e instanceof Anthropic.APIConnectionError) throw new AiError("couldn't reach Claude");
      if (e instanceof Anthropic.APIError) throw new AiError(`Claude error ${e.status ?? ''}`.trim());
      throw new AiError('failed');
    }
  }

  private speedOptions(): Record<string, unknown> {
    if (this.plain) return {};
    if (this.p.id === 'openai' && /^(gpt-5|o\d)/.test(this.model)) return { reasoning_effort: 'minimal' }; 
    if (this.p.id === 'gemini' && /2\.5-flash/.test(this.model)) return { reasoning_effort: 'none' };
    return {};
  }

  private async askChat(system: string, prompt: string, maxTokens: number): Promise<string> {
    const limit = this.p.id === 'openai' ? { max_completion_tokens: Math.max(maxTokens, 256) } : { max_tokens: maxTokens }; 
    const body = { model: this.model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }], ...limit, ...this.speedOptions() };
    const r = await this.call('/chat/completions', body);
    if (r.status === 400 && !this.plain && Object.keys(this.speedOptions()).length && /reasoning|effort|unsupported|unrecognized/i.test(r.text)) {
      this.plain = true;
      return this.askChat(system, prompt, maxTokens);
    }
    this.raise(r);
    let j: { choices?: { message?: { content?: unknown } }[] };
    try { j = JSON.parse(r.text); } catch { throw new AiError(`${this.p.name}: unreadable answer`); }
    const c = j.choices?.[0]?.message?.content;
    const text = typeof c === 'string' ? c : Array.isArray(c) ? c.map((x: { text?: string }) => x?.text ?? '').join('') : '';
    return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim(); 
  }

  private async call(path: string, body?: unknown): Promise<{ status: number; text: string }> {
    let res: Response;
    try {
      res = await this.fetcher(this.p.base + path, {
        method: body ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${this.key}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new AiError(`couldn't reach ${this.p.name}`);
    }
    return { status: res.status, text: await res.text().catch(() => '') };
  }

  private raise(r: { status: number; text: string }): void {
    if (r.status >= 200 && r.status < 300) return;
    const n = this.p.name;
    if (r.status === 401 || r.status === 403) throw new AiError(`${n} key refused`);
    if (r.status === 402 || r.status === 429) throw new AiError(`${n} rate limit or credits`);
    if (r.status === 404 || /model/i.test(r.text) && r.status === 400) throw new AiError(`${n} model "${this.model}" not found`);
    throw new AiError(`${n} error ${r.status}`);
  }

  private async pickModel(): Promise<boolean> {
    const r = await this.call('/models');
    if (r.status !== 200) return false;
    let ids: string[] = [];
    try { ids = (JSON.parse(r.text).data ?? []).map((m: { id?: string }) => String(m.id ?? '').replace(/^models\//, '')).filter(Boolean); } catch { return false; }
    ids = ids.filter((id) => !NOT_CHAT.test(id)); 
    for (const re of this.p.prefer) {
      const hit = ids.filter((id) => re.test(id)).sort().reverse()[0]; 
      if (hit) { this.model = hit; return true; }
    }
    return false;
  }
}
