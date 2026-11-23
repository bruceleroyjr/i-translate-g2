import type { Item } from './window';

export const READ_MAX_CHARS = 1500;
export const CHUNK_CHARS = 180; 

export function speakable(text: string): string {
  return text
    .replace(/[•·●■□◆◇▲▼※≡∴]/g, ' ')
    .replace(/\s*[—–]\s*/g, ', ')
    .split(/\n+/)
    .map((l) => l.trim().replace(/[.,;:]+$/, '')) 
    .filter(Boolean)
    .reduce((acc, l) => (acc ? acc + (/[?!]$/.test(acc) ? ' ' : '. ') + l : l), '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function readableText(it: Item | null | undefined): string | null {
  if (!it || it.kind !== 'translation') return null;
  const out = speakable((it.text || '').trim()).slice(0, READ_MAX_CHARS).trim();
  return out || null;
}

const FEMALE = new Set(['samantha', 'karen', 'moira', 'tessa', 'fiona', 'victoria', 'allison', 'ava', 'susan', 'zoe', 'nicky', 'serena', 'kate',
  'stephanie', 'martha', 'catherine', 'joanna', 'emma', 'amy', 'jamie', 'sandy', 'shelley', 'flo', 'grandma', 'nora', 'anna', 'ellen', 'alice',
  'amelie', 'audrey', 'aurelie', 'carmit', 'damayanti', 'joana', 'kanya', 'kyoko', 'laura', 'lekha', 'lesya', 'luciana', 'mariska', 'mei-jia', 'melina',
  'milena', 'monica', 'paulina', 'sara', 'satu', 'sin-ji', 'ting-ting', 'yelda', 'yuna', 'zosia', 'zuzana', 'ioana', 'sinji', 'tingting', 'meijia', 'claire', 'veena', 'petra', 'o-ren', 'oren', 'linh', 'zira', 'aria', 'jenny', 'michelle', 'libby', 'sonia', 'natasha', 'clara', 'mia', 'ana']);
const MALE = new Set(['alex', 'daniel', 'fred', 'aaron', 'arthur', 'oliver', 'tom', 'rishi', 'evan', 'gordon', 'nathan', 'reed', 'lee', 'albert', 'ralph',
  'junior', 'bruce', 'eddy', 'grandpa', 'rocko', 'jorge', 'diego', 'luca', 'thomas', 'yuri', 'xander', 'maged', 'magnus', 'jacques', 'markus', 'felipe',
  'henrik', 'ivan', 'jorge', 'juan', 'luciano', 'majed', 'otoya', 'reed', 'neel', 'nikos', 'ralf', 'sangeeta', 'li-mu', 'limu', 'mikhail', 'rocko', 'david', 'mark', 'guy', 'ryan', 'eric', 'roger', 'steffan', 'william', 'liam', 'connor', 'brian', 'christopher', 'hattori', 'minh', 'hoang']);
export type VoiceGender = 'female' | 'male' | 'other';

export function voiceGender(name: string): VoiceGender {
  const first = (name || '').toLowerCase().replace(/^(microsoft|google|apple)\s+/, '').replace(/\(.*/, '').trim().split(/[\s-]+/)[0] || '';
  return FEMALE.has(first) ? 'female' : MALE.has(first) ? 'male' : 'other';
}

export interface VoiceInfo { name: string; lang: string; voiceURI: string }
export interface VoiceGroup { label: string; voices: VoiceInfo[] }

export function groupVoices(voices: VoiceInfo[], bases: string[] = ['en'], name = 'English'): VoiceGroup[] {
  const byName = (a: VoiceInfo, b: VoiceInfo) => a.name.localeCompare(b.name);
  const mine = (v: VoiceInfo) => bases.includes((v.lang || '').split(/[-_]/)[0].toLowerCase());
  const en = voices.filter(mine);
  const rest = voices.filter((v) => !en.includes(v));
  const pick = (g: VoiceGender) => en.filter((v) => voiceGender(v.name) === g).sort(byName);
  return [
    { label: 'Female voices', voices: pick('female') },
    { label: 'Male voices', voices: pick('male') },
    { label: `Other ${name} voices`, voices: pick('other') },
    { label: 'Other languages', voices: rest.sort(byName) },
  ].filter((g) => g.voices.length);
}

export function chunks(text: string, max = CHUNK_CHARS): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) || [text];
  const out: string[] = [];
  let cur = '';
  for (const s of sentences) {
    if (cur && (cur + s).length > max) { out.push(cur.trim()); cur = ''; }
    if (s.length > max) { 
      for (const part of s.match(new RegExp(`.{1,${max}}(?:\\s|$)`, 'g')) || [s]) out.push(part.trim());
    } else cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.filter(Boolean);
}
