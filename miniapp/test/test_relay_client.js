import { Relay } from '../src/relay.ts';

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  (${detail})`}`);
  if (!ok) fails++;
};

const calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url, init });
  return { ok: true, status: 200, json: async () => ({ seq: 5, sig: 'abcd1234' }) };
};
const r = new Relay();
r.configure('https://pc.example.ts.net:8456/', 'tok');

await r.replies(4);
check('quick /reply has no wait (as before)', calls.at(-1).url === 'https://pc.example.ts.net:8456/reply?after=4', calls.at(-1).url);
await r.replies(4, 'abcd1234', 1500);
check('live /reply long-polls with the sig the phone already shows',
  calls.at(-1).url === 'https://pc.example.ts.net:8456/reply?after=4&wait=1500&sig=abcd1234', calls.at(-1).url);
check('bearer token sent', calls.at(-1).init.headers.Authorization === 'Bearer tok');
await r.replies(4, '', 0);
check('wait 0 -> quick /reply', !calls.at(-1).url.includes('wait='), calls.at(-1).url);

globalThis.fetch = (url, init) => new Promise((resolve, reject) => {
  const t = setTimeout(() => resolve({ ok: true, status: 200, json: async () => ({ seq: 6 }) }), 1200);
  init.signal.addEventListener('abort', () => { clearTimeout(t); reject(new Error('aborted')); });
});
const got = await r.replies(5, 'x', 1500).catch((e) => ({ error: String(e) }));
check('a slow long-poll answer is waited for, not aborted', got.seq === 6, JSON.stringify(got));

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
