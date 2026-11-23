
export interface NeuralVoice { id: string; label: string; gender: 'female' | 'male' }

const V = (id: string, label: string, gender: 'female' | 'male'): NeuralVoice => ({ id, label, gender });

export const NEURAL_VOICES: Record<string, NeuralVoice[]> = {
  English: [
    V('en-US-JennyNeural', 'Jenny (US)', 'female'), V('en-US-AriaNeural', 'Aria (US)', 'female'), V('en-US-AvaNeural', 'Ava (US)', 'female'),
    V('en-US-EmmaNeural', 'Emma (US)', 'female'), V('en-US-MichelleNeural', 'Michelle (US)', 'female'), V('en-GB-SoniaNeural', 'Sonia (UK)', 'female'),
    V('en-GB-LibbyNeural', 'Libby (UK)', 'female'), V('en-AU-NatashaNeural', 'Natasha (Australia)', 'female'),
    V('en-US-GuyNeural', 'Guy (US)', 'male'), V('en-US-AndrewNeural', 'Andrew (US)', 'male'), V('en-US-BrianNeural', 'Brian (US)', 'male'),
    V('en-US-ChristopherNeural', 'Christopher (US)', 'male'), V('en-US-EricNeural', 'Eric (US)', 'male'), V('en-GB-RyanNeural', 'Ryan (UK)', 'male'),
    V('en-GB-ThomasNeural', 'Thomas (UK)', 'male'),
  ],
  Korean: [V('ko-KR-SunHiNeural', 'SunHi', 'female'), V('ko-KR-InJoonNeural', 'InJoon', 'male'), V('ko-KR-HyunsuMultilingualNeural', 'Hyunsu', 'male')],
  Japanese: [V('ja-JP-NanamiNeural', 'Nanami', 'female'), V('ja-JP-KeitaNeural', 'Keita', 'male')],
  'Chinese - Mandarin': [V('zh-CN-XiaoxiaoNeural', 'Xiaoxiao', 'female'), V('zh-CN-XiaoyiNeural', 'Xiaoyi', 'female'),
    V('zh-CN-YunxiNeural', 'Yunxi', 'male'), V('zh-CN-YunjianNeural', 'Yunjian', 'male'), V('zh-CN-YunyangNeural', 'Yunyang', 'male')],
  'Chinese - Cantonese': [V('zh-HK-HiuMaanNeural', 'HiuMaan', 'female'), V('zh-HK-HiuGaaiNeural', 'HiuGaai', 'female'), V('zh-HK-WanLungNeural', 'WanLung', 'male')],
  Spanish: [V('es-ES-ElviraNeural', 'Elvira (Spain)', 'female'), V('es-ES-XimenaNeural', 'Ximena (Spain)', 'female'), V('es-MX-DaliaNeural', 'Dalia (Mexico)', 'female'),
    V('es-ES-AlvaroNeural', 'Alvaro (Spain)', 'male'), V('es-MX-JorgeNeural', 'Jorge (Mexico)', 'male')],
  Portuguese: [V('pt-BR-FranciscaNeural', 'Francisca', 'female'), V('pt-BR-ThalitaMultilingualNeural', 'Thalita', 'female'), V('pt-BR-AntonioNeural', 'Antonio', 'male')],
  French: [V('fr-FR-DeniseNeural', 'Denise', 'female'), V('fr-FR-EloiseNeural', 'Eloise', 'female'), V('fr-FR-VivienneMultilingualNeural', 'Vivienne', 'female'),
    V('fr-FR-HenriNeural', 'Henri', 'male'), V('fr-FR-RemyMultilingualNeural', 'Remy', 'male')],
  German: [V('de-DE-KatjaNeural', 'Katja', 'female'), V('de-DE-AmalaNeural', 'Amala', 'female'), V('de-DE-SeraphinaMultilingualNeural', 'Seraphina', 'female'),
    V('de-DE-ConradNeural', 'Conrad', 'male'), V('de-DE-KillianNeural', 'Killian', 'male'), V('de-DE-FlorianMultilingualNeural', 'Florian', 'male')],
  Thai: [V('th-TH-PremwadeeNeural', 'Premwadee', 'female'), V('th-TH-NiwatNeural', 'Niwat', 'male')],
  Vietnamese: [V('vi-VN-HoaiMyNeural', 'HoaiMy', 'female'), V('vi-VN-NamMinhNeural', 'NamMinh', 'male')],
  Filipino: [V('fil-PH-BlessicaNeural', 'Blessica', 'female'), V('fil-PH-AngeloNeural', 'Angelo', 'male')],
};

export function naturalVoice(language: string, picked?: Record<string, string>): string {
  const list = NEURAL_VOICES[language];
  if (!list?.length) return '';
  const want = picked?.[language];
  return list.some((v) => v.id === want) ? want! : list[0].id;
}

export function cleanNaturalVoices(saved: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (saved && typeof saved === 'object') {
    for (const [lang, id] of Object.entries(saved as Record<string, unknown>)) {
      if (NEURAL_VOICES[lang]?.some((v) => v.id === id)) out[lang] = id as string;
    }
  }
  return out;
}

export function neuralOptions(language: string): string {
  const list = NEURAL_VOICES[language] || [];
  const group = (g: 'female' | 'male', label: string) => {
    const xs = list.filter((v) => v.gender === g);
    return xs.length ? `<optgroup label="${label}">${xs.map((v) => `<option value="${v.id}">${v.label}</option>`).join('')}</optgroup>` : '';
  };
  return group('female', 'Female') + group('male', 'Male');
}
