import { LANGUAGES, load, save, setPairSide, relaySettings, SCREEN_OFF_CHOICES } from '../src/settings.ts';
import { pickedIndex, pickerOrder, TapGuard, MENU_TAP_GUARD_MS } from '../src/window.ts';

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${JSON.stringify(detail)}`}`);
  if (!ok) fails++;
};
const store = (v) => ({ get: async () => v, set: async () => undefined });

let s = await load(store(''));
check('fresh install: Korean → English, glasses mics, ideas on, screen off after 10 s', s.translateFrom === 'Korean' && s.translateTo === 'English'
  && s.translateMic === 'glasses' && s.myTurnMic === 'glasses' && s.replyIdeas && s.showOriginal && s.trFooter && s.screenOffS === 10 && s.liveWords);
s = await load(store(JSON.stringify({ translateFrom: 'Japanese' })));
check('settings saved before the target existed -> English target', s.translateFrom === 'Japanese' && s.translateTo === 'English');
s = await load(store(JSON.stringify({ translateFrom: 'Spanish', translateTo: 'Spanish' })));
check('same language on both sides is repaired on load', s.translateFrom === 'Spanish' && s.translateTo === 'English');
s = await load(store(JSON.stringify({ translateFrom: 'English', translateTo: 'Klingon' })));
check('unknown target -> English, then repaired (English → Korean)', s.translateFrom === 'English' && s.translateTo === 'Korean');
s = await load(store('{not json'));
check('broken saved settings -> the defaults', s.translateFrom === 'Korean' && s.aiProvider === 'anthropic');
s = await load(store(JSON.stringify({ anthropicKey: ' sk-old ', aiKeys: { openai: ' k ' } })));
check('0.3.0 Anthropic key moves into the AI keys; keys are trimmed', s.aiKeys.anthropic === 'sk-old' && s.aiKeys.openai === 'k' && s.anthropicKey === '');
s = await load(store(JSON.stringify({ screenOffS: 7, messageS: 99, translateMic: 'phone', micsV: 1 })));
check('odd timeouts fall back to the defaults; a saved iPhone mic stays', s.screenOffS === 10 && s.messageS === 15 && s.translateMic === 'phone');
s = await load(store(JSON.stringify({ translateMic: 'phone' })));
check('settings from before the glasses-mic default: both mics move to the glasses once', s.translateMic === 'glasses' && s.micsV === 1);
check('screen-off choices include Never (0)', SCREEN_OFF_CHOICES.some(([v]) => v === 0));
let saved = '';
await save({ get: async () => '', set: async (_k, v) => { saved = v; } }, await load(store(JSON.stringify({ relayUrl: 'x', topics: ['a'] }))));
check('settings of older versions are dropped on save', !saved.includes('relayUrl') && !saved.includes('topics') && saved.includes('translateFrom'));

const pair = { translateFrom: 'Korean', translateTo: 'English' };
check('pick target Spanish', setPairSide(pair, 'to', 'Spanish') && pair.translateFrom === 'Korean' && pair.translateTo === 'Spanish');
check('pick target = the spoken language -> the two swap', setPairSide(pair, 'to', 'Korean') && pair.translateFrom === 'Spanish' && pair.translateTo === 'Korean');
check('pick spoken = the target -> the two swap', setPairSide(pair, 'from', 'Korean') && pair.translateFrom === 'Korean' && pair.translateTo === 'Spanish');
check('unknown language is refused', !setPairSide(pair, 'to', 'Klingon') && pair.translateTo === 'Spanish');
const rs = relaySettings({ ...(await load(store(''))), translateFrom: 'Thai', translateTo: 'French', replyIdeas: false });
check('the engine gets both sides and the ideas switch (never a key)', rs.translate_from === 'Thai' && rs.translate_to === 'French' && rs.reply_ideas === false && !JSON.stringify(rs).includes('Key'));
check('every language name fits a list row (63 bytes)', LANGUAGES.every((n) => Buffer.byteLength(n) <= 63));

const order = pickerOrder(LANGUAGES, 'Japanese');
check('picker: the current language first (the highlight starts there), all 13 listed once', order[0] === 'Japanese' && order.length === 13 && new Set(order).size === 13);
check('picker: tapped row by index', pickedIndex({ currentSelectItemIndex: 3 }, order) === 3);
check('picker: protobuf drops index 0 -> row 0', pickedIndex({}, order) === 0);
check('picker: by name when the index is missing', pickedIndex({ currentSelectItemName: 'Thai' }, order) === order.indexOf('Thai'));

const g = new TapGuard();
const T1 = 5_000_000;
check('a tap with no menu activity goes through', g.allows(0, T1));
g.menuActivity(T1);
check('the plain tap 1 s after a menu pick is ignored', !g.allows(0, T1 + 1000));
check('a double tap right after the menu is ignored too', !g.allows(3, T1 + 1200));
check('swipes / long press are never blocked', g.allows(1, T1 + 500) && g.allows(9, T1 + 500));
check('taps work again after 1.5 s', g.allows(0, T1 + MENU_TAP_GUARD_MS + 1) && g.ignored === 2);

console.log(fails ? `${fails} FAILED` : 'ALL PASS');
process.exit(fails ? 1 : 0);
