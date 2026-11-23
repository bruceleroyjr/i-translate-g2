
export const TRANSLATE_TEMPLATE = "You are the translation step of a watch translation app.\nTranslate the following speech transcript from {{PAIR}}.\nOutput natural spoken {{TARGET}} ONLY — no explanations, no transliteration, no brackets, no preamble. One sentence per source sentence. Preserve intent and politeness level; do not translate honorifics literally.\nSource notes: {{REGISTER_NOTE}}\nTarget notes: {{TARGET_NOTE}}\nTranscript: {{TRANSCRIPT}}";

export const LANG_NOTES: Record<string, { prompt: string; source: string; target: string }> = {
  "English": {
    "prompt": "English",
    "source": "everyday spoken English: keep the speaker's politeness and tone (please, could you, would you mind) exactly as given.",
    "target": "natural spoken English; keep the speaker's politeness level."
  },
  "Chinese - Cantonese": {
    "prompt": "Cantonese (written in Traditional Chinese characters, as spoken)",
    "source": "你 vs 您 as in Mandarin. Sentence-final particles (啦, 呀, 喎, 㗎) carry mood, not content — shade or drop, never transliterate. The transcript is SPOKEN Cantonese, not Mandarin — translate what was said.",
    "target": "SPOKEN Cantonese written in Traditional Chinese characters (colloquial 喺, 唔, 係, 嘅, and sentence-final particles where natural), not Mandarin-style written Chinese."
  },
  "Chinese - Mandarin": {
    "prompt": "Mandarin Chinese (Simplified characters)",
    "source": "你 vs 您 (respectful). 您 → deferential English. Formal/written-style Mandarin → complete, clear English sentences. 吧/呢 soften — keep the softness.",
    "target": "Simplified Chinese characters; 您 for deferential speech, 你 otherwise."
  },
  "Filipino": {
    "prompt": "Filipino (Tagalog, as spoken in Manila, in Latin script)",
    "source": "po/opo and the plural 'kayo/ninyo' for one person signal respect, not content - render them as polite English, not as extra words. Taglish (English words mixed in) is normal; read it as ordinary speech.",
    "target": "write natural everyday Filipino (Tagalog) in Latin script; use po/opo and 'kayo' for polite or elders, plain 'ka'/'mo' for friends; keep common English loanwords as Filipinos say them."
  },
  "French": {
    "prompt": "French",
    "source": "tu vs vous (formal singular). Vous to one person = politeness/distance, NOT plural. Je voudrais / pourriez-vous are ordinary politeness → \"I'd like / could you\".",
    "target": "vous for formal or unknown relationships, tu only if clearly informal."
  },
  "German": {
    "prompt": "German",
    "source": "du vs Sie. Sie → measured, courteous English. Modal particles (doch, mal, ja, halt) carry tone, not content — shade the English (\"just…\", \"go ahead and…\"), never translate word-for-word.",
    "target": "Sie for formal or unknown relationships, du only if clearly informal."
  },
  "Hawaiian": {
    "prompt": "Hawaiian (ʻlelo Hawaiʻi, with the ʻokina and kahakō marked)",
    "source": "Hawaiian has no formal/informal speech levels like Korean or Japanese; keep the English tone neutral and friendly. The transcript may lack ʻokina and kahakō (speech recognition) - read it by sound.",
    "target": "write ʻŌlelo Hawaiʻi with the ʻokina (ʻ) and kahakō (ā ē ī ō ū) marked; plain everyday register; keep names and places as they are."
  },
  "Japanese": {
    "prompt": "Japanese",
    "source": "keigo — teineigo (polite), sonkeigo (respectful), kenjougo (humble) map to natural polite English, not literal forms. いらっしゃいませ = a greeting (\"Welcome!\"), not \"you have come\".",
    "target": "pick the register from the source: polite です/ます by default, casual only if the source is clearly casual. Natural Japanese in kanji and kana, never romaji."
  },
  "Korean": {
    "prompt": "Korean",
    "source": "speech levels — -습니다/-습니까 (formal) vs -요 (everyday polite) vs plain/intimate: same English words, different pragmatics; render formal as formal (\"Could you…\" vs \"Hey…\").",
    "target": "pick the speech level from the source: formal -습니다 for formal or distant speech, everyday polite -요 by default, plain only if clearly intimate. Hangul only."
  },
  "Portuguese": {
    "prompt": "Brazilian Portuguese",
    "source": "tu vs você — você is the everyday default in most of Brazil; tu varies by region (Portugal, southern Brazil). Treat as tone; o senhor / a senhora → distinctly formal.",
    "target": "Brazilian Portuguese; você by default, o senhor / a senhora for formal speech."
  },
  "Spanish": {
    "prompt": "Spanish",
    "source": "tú (informal) vs usted (formal, third-person forms). Usted → polite English; tú → everyday English; do not add \"sir/ma'am\" the source doesn't have. Voseo (vos) = informal.",
    "target": "usted if the source is formal, tú if clearly informal; vocabulary that works across Spanish-speaking countries."
  },
  "Thai": {
    "prompt": "Thai",
    "source": "politeness particles ครับ (male speaker) / ค่ะ/คะ (female speaker) mark courtesy, NOT content — they signal polite register and must not appear in the English. Pronoun level (ผม/ดิฉัน/คุณ vs intimate forms) maps to English tone.",
    "target": "neutral polite register in Thai script; add ครับ/ค่ะ only if the source is polite; use คุณ for you."
  },
  "Vietnamese": {
    "prompt": "Vietnamese",
    "source": "pronouns encode the relationship (anh, chị, em, cô, chú, ông, bà) and dạ/vâng/ạ mark deference. English \"you\" erases this: render neutral-to-polite English, keep the deference as courtesy, NEVER translate a kinship pronoun literally (\"older brother, could you…\" is WRONG).",
    "target": "neutral-polite Vietnamese; use bạn for you unless the relationship is clear; add dạ/ạ when the source is polite."
  }
};
