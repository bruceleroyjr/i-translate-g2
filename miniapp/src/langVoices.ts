import { voiceGender, type VoiceInfo } from './readText.ts';

export type VoiceChoice = 'female' | 'male';
export const VOICE_CHOICES: [VoiceChoice, string][] = [['female', 'Female'], ['male', 'Male']];

export const LANG_BCP47: Record<string, string> = {
  English: 'en-US', Korean: 'ko-KR', Japanese: 'ja-JP', 'Chinese - Mandarin': 'zh-CN', 'Chinese - Cantonese': 'zh-HK', Spanish: 'es-ES',
  Portuguese: 'pt-BR', French: 'fr-FR', German: 'de-DE', Thai: 'th-TH', Vietnamese: 'vi-VN', Filipino: 'fil-PH', Hawaiian: 'haw-US',
};

export const LANG_SAMPLE: Record<string, string> = {
  English: 'Hello, this is the voice you picked.',
  Korean: '안녕하세요, 선택하신 목소리입니다.',
  Japanese: 'こんにちは、選んだ声です。',
  'Chinese - Mandarin': '你好，这是你选择的声音。',
  'Chinese - Cantonese': '你好，呢個係你揀嘅聲音。',
  Spanish: 'Hola, esta es la voz que elegiste.',
  Portuguese: 'Olá, esta é a voz que você escolheu.',
  French: 'Bonjour, voici la voix que vous avez choisie.',
  German: 'Hallo, das ist die Stimme, die Sie gewählt haben.',
  Thai: 'สวัสดี นี่คือเสียงที่คุณเลือก',
  Vietnamese: 'Xin chào, đây là giọng nói bạn đã chọn.',
  Filipino: 'Kumusta, ito ang boses na pinili mo.',
  Hawaiian: 'Aloha, this is the voice you picked.',
};

export const bases = (lang: string): string[] => (lang.toLowerCase().startsWith('fil') ? ['fil', 'tl'] : [lang.split(/[-_]/)[0].toLowerCase()]);
const rank = (v: VoiceInfo): number => (/premium/i.test(v.name) ? 0 : /enhanced/i.test(v.name) ? 1 : 2);

export function pickVoice(voices: VoiceInfo[], language: string, gender: VoiceChoice): { uri: string; name: string; matched: boolean } {
  const want = LANG_BCP47[language];
  if (!want) return { uri: '', name: '', matched: false };
  const same = voices.filter((v) => bases(want).includes((v.lang || '').split(/[-_]/)[0].toLowerCase()));
  const exact = same.filter((v) => (v.lang || '').replace('_', '-').toLowerCase() === want.toLowerCase());
  const pool = exact.length ? exact : same;
  const byRank = (a: VoiceInfo, b: VoiceInfo) => rank(a) - rank(b) || a.name.localeCompare(b.name);
  const sameGender = pool.filter((v) => voiceGender(v.name) === gender).sort(byRank);
  if (sameGender.length) return { uri: sameGender[0].voiceURI, name: sameGender[0].name, matched: true };
  const any = [...pool].sort(byRank)[0];
  return any ? { uri: any.voiceURI, name: any.name, matched: false } : { uri: '', name: '', matched: false };
}
