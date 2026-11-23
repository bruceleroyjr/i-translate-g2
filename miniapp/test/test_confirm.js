import { validateEvenHubPageContainer } from '@evenrealities/even_hub_sdk';
import { pageSpec } from '../src/glasses.ts';
import { stopAsk, STOP_QUESTION, YES_NO, CONFIRM_MS, chosenIndex, doubleTapAction } from '../src/window.ts';

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${detail}`}`);
  if (!ok) fails++;
};
const m = (listening, meeting, translating) => ({ listening, meeting, translating });

check('translating -> asks "Stop translation?" (not pause: the 09:11 bug)', stopAsk(m(true, false, true)) === 'translation');
check('translating + meeting -> translation first', stopAsk(m(true, true, true)) === 'translation');
check('meeting only -> asks "Exit meeting mode?"', stopAsk(m(true, true, false)) === 'meeting');
check('just lifelogging -> asks "Pause lifelogging?"', stopAsk(m(true, false, false)) === 'pause');
check('paused -> no question (double tap resumes)', stopAsk(m(false, false, false)) === null);
check('questions read right', STOP_QUESTION.translation.startsWith('Stop translation?') && STOP_QUESTION.meeting.startsWith('Exit meeting mode?')
  && STOP_QUESTION.pause.startsWith('Pause lifelogging?'));
check('YES first (highlight starts there), NO second', YES_NO.join() === 'YES,NO');
check('YES / NO tap works when protobuf drops index 0', chosenIndex({ currentSelectItemName: 'NO' }, YES_NO) === 1
  && chosenIndex({ currentSelectItemName: 'YES' }, YES_NO) === 0 && chosenIndex({ currentSelectItemIndex: 1 }, YES_NO) === 1);
check('no answer closes it after 10 s', CONFIRM_MS === 10_000);
check('a card on screen is still closed first (no question)', doubleTapAction({ conversing: false, awaiting: false, canGoBack: false, cardShowing: true }) === 'close');
check('clear screen -> the question path', doubleTapAction({ conversing: false, awaiting: false, canGoBack: false, cardShowing: false }) === 'menu');

for (const kind of ['translation', 'meeting', 'pause']) {
  const c = pageSpec('confirm', { header: ' ', body: STOP_QUESTION[kind], rows: YES_NO }, { meeting: false, translating: false, listening: true });
  check(`${kind}: YES / NO page, list is the only input box, SDK accepts it`,
    c.listObject[0].itemContainer.itemName.join() === 'YES,NO'
    && [...c.imageObject, ...c.textObject, ...c.listObject].filter((x) => x.isEventCapture === 1).length === 1
    && validateEvenHubPageContainer(c).valid === true, JSON.stringify(validateEvenHubPageContainer(c)));
}
check('confirm without rows is still SEND / CANCEL', pageSpec('confirm', { header: 'h', body: 'b' }).listObject[0].itemContainer.itemName.join() === 'SEND,CANCEL');

console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
