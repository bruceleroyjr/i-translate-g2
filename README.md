# I-Translate

Live two-way translation for the **Even Realities G2** smart glasses, as an Even Hub app.
Their words show up translated on your glasses, and your phone can read them aloud (phone speaker or Bluetooth earbuds).

- **Live translation**: the other person's speech is transcribed and translated line by line on the glasses.
- **Your turn**: double tap, speak your own language, tap to send; the translation is spoken from the phone.
- **Reply ideas**: each translated line comes with a suggested reply and a question you can say with one tap.
- **Phone page**: the whole conversation with play buttons, a History tab, mic choice (glasses or iPhone) and language swap.
- 13 languages: English, Korean, Japanese, Chinese (Mandarin, Cantonese), Spanish, Portuguese, French, German, Thai, Vietnamese, Filipino, Hawaiian.

## How it works

Everything runs on the phone inside the Even app. There is no server of its own:

- Speech to text: [Soniox](https://soniox.com) real-time WebSocket API (`stt-rt`), with **your** Soniox key.
- Translation + reply ideas: the AI provider you pick, with **your** key: Claude (Anthropic SDK), or any of OpenAI, Gemini, DeepSeek, Grok, Mistral, Groq, OpenRouter (OpenAI-style `/chat/completions`).
- Keys, settings and history are kept in the Even app's storage on the phone.

Keys are entered on the phone page under **Settings › API keys** (Save & test).

## Build

```bash
cd miniapp
npm ci
npm run dev        # Vite dev server (open in the Even Hub simulator or the Even app dev mode)
npm run build      # typecheck + production build into dist/
npm run pack       # evenhub pack -> i-translate.ehpk
```

Before packing your own build, change `package_id` in `miniapp/app.json` (it is `com.example.itranslate` here) to an id of your own.

Add `?demo` to the page URL for a scripted Korean ↔ English conversation with a fake Soniox and a fake AI (no keys needed).

## Tests

Plain Node scripts (Node 22+, which runs the `.ts` imports directly):

```bash
cd miniapp
for f in test/test_*.js; do node "$f"; done
```

## Layout

- `miniapp/src/main.ts`: the app (glasses screens, gestures, the phone page)
- `miniapp/src/engine.ts`: the translation engine (Soniox stream, the AI calls, your turn, reply ideas)
- `miniapp/src/glasses.ts`: page layouts and the one-write-at-a-time link to the glasses
- `miniapp/src/window.ts`: the card on the glasses (timers, screen-off rules) and text-fitting helpers
- `miniapp/src/ai.ts`: the AI providers; `history.ts`: saved conversations; `readAloud.ts`: the phone's voices
- `store/` holds the store listing text, privacy notes, icon generator and simulator screenshots.

## License

MIT, see [LICENSE](LICENSE).
