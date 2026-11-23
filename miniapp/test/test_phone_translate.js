import { TrLog, TR_KEEP, linesHtml, turnControls, controlsHtml, composerHtml, ideasHtml } from '../src/phoneTranslate.ts';
let fails = 0;
const check = (name, ok, got) => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  got: ${JSON.stringify(got)}`}`); if (!ok) fails++; };
const log = new TrLog();
log.add({ who: 'them', original: '안녕하세요', text: 'Hello.', at: 1 });
log.add({ who: 'me', original: "What's good to eat here?", text: '여기 뭐가 맛있어요?', at: 2 });
log.add({ who: 'them', original: '', text: '   ', at: 3 });
check('their lines and their turns are kept apart; empty lines skipped', log.of('them').length === 1 && log.of('me').length === 1 && log.rev === 2);
for (let i = 0; i < 150; i++) log.add({ who: 'them', original: 'x', text: `line ${i}`, at: i });
check(`keeps the newest ${TR_KEEP}`, log.lines.length === TR_KEEP && log.lines[TR_KEEP - 1].text === 'line 149');
const h = linesHtml([{ who: 'them', original: '<i>hi</i>', text: 'A & B', at: 0 }], 'none');
check('escaped, original above the translation', h.includes('&lt;i&gt;hi&lt;/i&gt;') && h.includes('A &amp; B') && h.indexOf('tr-orig') < h.indexOf('tr-text'));
check('empty window says so', linesHtml([], 'Nothing yet.').includes('Nothing yet.'));
log.clear();
check('clear', log.lines.length === 0);
const base = { translating: 'Korean → English', myTurn: false, holding: false, sending: false, draft: '', from: 'Korean', to: 'English' };
const ids = (s) => turnControls(s).buttons.map((b) => b.id + (b.disabled ? '(off)' : '')).join(',');
check('not translating: My turn is off', ids({ ...base, translating: null }) === 'tr-myturn(off)');
check('translating: My turn (= double tap)', ids(base) === 'tr-myturn' && turnControls(base).buttons[0].label === 'My turn: speak English');
check('their turn, listening: Send (= tap) + Back (= double tap), their words so far', ids({ ...base, myTurn: true, holding: true, draft: 'where is' }) === 'tr-send,tr-back'
  && turnControls({ ...base, myTurn: true, holding: true, draft: 'where is' }).status.includes('where is'));
check('their turn, translating: Send greyed out', ids({ ...base, myTurn: true, sending: true }) === 'tr-send(off),tr-back');
check('their turn, done: Speak again (= tap) + Back', ids({ ...base, myTurn: true }) === 'tr-again,tr-back');
check('buttons html escapes the draft', controlsHtml({ ...base, myTurn: true, holding: true, draft: '<b>' }).includes('&lt;b&gt;'));
{
  const both = [{ who: 'them', original: '안녕', text: 'Hi', at: 0 }, { who: 'me', original: 'Hello', text: '안녕하세요', at: 1000 }];
  const h = linesHtml(both, 'empty', true);
  check('feed: both sides in order, labeled', h.indexOf('Them') < h.indexOf('You') && h.includes('tr-line tr-me') && h.includes('tr-line tr-them'), h);
  check('feed: without labels as before', !linesHtml(both, 'empty').includes('tr-who'));
  const ph = linesHtml([{ who: 'them', original: '안녕', text: 'Hi', at: 0, origLang: 'Korean', textLang: 'English' },
    { who: 'me', original: '', text: '네', at: 1 }], 'empty', true);
  check('feed: one play button per line, beside the translation only', (ph.match(/class="tr-play"/g) || []).length === 2
    && ph.includes('data-i="0" data-part="text"') && ph.includes('data-i="1" data-part="text"') && !ph.includes('data-part="orig"') && ph.includes('aria-label="Play in English"'), ph);
  check('feed: the old windows (no labels) have no play buttons', !linesHtml(both, 'empty').includes('tr-play'));
}
{
  const off = composerHtml({ ...base, translating: null });
  check('bar: not translating -> the mic is off, the line says so', off.mic.includes('id="tr-myturn"') && off.mic.includes(' disabled') && off.line.includes('Start translating to speak or type'));
  const live = composerHtml(base);
  check('bar: translating -> mic = My turn, no Back', live.mic.includes('id="tr-myturn"') && !live.mic.includes('disabled') && !live.line.includes('tr-back') && live.line.includes('or type it'));
  const hold = composerHtml({ ...base, myTurn: true, holding: true, draft: '<b>hi' });
  check('bar: listening -> the mic is a stop square that sends, Back shows, draft escaped', hold.mic.includes('id="tr-send"') && hold.mic.includes('class="mic rec"')
    && hold.line.includes('data-turn="cancel"') && hold.line.includes('&lt;b&gt;hi') && !hold.line.includes('<b>hi'));
  const after = composerHtml({ ...base, myTurn: true });
  check('bar: after a turn -> mic = Speak again', after.mic.includes('id="tr-again"') && after.line.includes('data-turn="cancel"'));
  check('bar: translating their words -> mic greyed', composerHtml({ ...base, myTurn: true, sending: true }).mic.includes(' disabled'));
}
{
  const card = (s) => composerHtml({ ...base, myTurn: true, ...s }).line;
  const btns = (h) => [...h.matchAll(/data-turn="(\w+)"[^>]*>([^<]+)</g)].map((m) => `${m[1]}:${m[2]}`).join(',');
  let h = card({ holding: true, draft: '' });
  check('card: listening, nothing said yet -> "Speak English…", Send + Cancel', h.includes('turn-card listen') && h.includes('Speak English…') && btns(h).includes('send:Send') && btns(h).includes('cancel:Cancel'), h);
  check('card: header says whose turn and the direction', h.includes('YOUR TURN · EN → KO'), h);
  check('card: no old full-width Back button', !h.includes('id="tr-back"') && !h.includes('Back to live translation<'), h);
  h = card({ holding: true, draft: 'Two blocks that way' });
  check('card: their words as the user speaks', h.includes('Two blocks that way…'), h);
  h = card({ sending: true, said: 'Two blocks that way' });
  check('card: translating -> their words stay, "Translating into Korean…", Send greyed', h.includes('turn-card think') && h.includes('Two blocks that way') && h.includes('Translating into Korean…') && /data-turn="send"[^>]*disabled/.test(h), h);
  h = card({ said: 'Two blocks that way', saidTr: '저쪽으로 두 블록이요.' });
  check('card: sent -> their words + the translation, Speak again + Done', h.includes('turn-card done') && h.includes('저쪽으로 두 블록이요.') && btns(h).includes('again:Speak again') && btns(h).includes('cancel:Done'), h);
  h = card({ said: '<i>x', saidTr: '<b>y' });
  check('card: words escaped', h.includes('&lt;i&gt;x') && h.includes('&lt;b&gt;y') && !h.includes('<b>y'), h);
  check('not their turn: no card', !composerHtml(base).line.includes('turn-card'));
}
{
  const list = [{ kind: 'reply', text: 'Yes, <two> please' }, { kind: 'ask', text: 'How spicy is it?' }];
  const open = ideasHtml({ list, said: [], sending: false, canReplay: false });
  check('ideas: nothing to show -> empty', ideasHtml(null) === '' && ideasHtml({ list: [], said: [], sending: false, canReplay: false }) === '');
  check('ideas: reply then ask, tap targets 0 and 1, escaped', open.indexOf('REPLY') < open.indexOf('ASK') && open.includes('data-idea="0"')
    && open.includes('data-idea="1"') && open.includes('&lt;two&gt;') && !open.includes(' disabled'), open);
  const busy = ideasHtml({ list, said: [], sending: true, canReplay: false });
  check('ideas: while saying one, both cards off + note', (busy.match(/ disabled/g) || []).length === 2 && busy.includes('Saying it'), busy);
  const said = ideasHtml({ list, said: [1], sending: false, canReplay: true });
  check('ideas: after a pick only "Said" + play again, other card gone', said.includes('SAID · ASK') && said.includes('tr-idea-play')
    && !said.includes('data-idea') && !said.includes('spicy') === false && !said.includes('Yes,'), said);
  check('ideas: no play button until its translation is back', !ideasHtml({ list, said: [0], sending: false, canReplay: false }).includes('tr-idea-play'));
}
process.exit(fails ? 1 : 0);
