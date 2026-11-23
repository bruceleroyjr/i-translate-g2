# I-Translate - privacy

Checked against the app's code (version 0.4.8, 2026-11-22).

## Summary
I-Translate has no account, no server of its own, no ads, no analytics and no tracking. The developer receives no data
from the app. While you translate, speech goes to the speech-to-text and AI services you set up, using your own API
keys. Everything else stays on your phone.

## What the app uses

| What | Used? | When and why |
|---|---|---|
| Glasses microphones (G2) | Yes | Only while translating: to hear your turn, and the other person unless you pick the iPhone mic. Streamed live to Soniox, never recorded or stored. |
| iPhone microphone | Yes, if you pick it | Only while translating: to hear the person across from you. Streamed live to Soniox, never recorded or stored. |
| Network | Yes | Only to Soniox (speech to text) and to the ONE AI provider you pick (Claude, OpenAI, Gemini, DeepSeek, Grok, Mistral, Groq or OpenRouter), with your own keys. No other servers. |
| Speaker / Bluetooth earbuds | Yes | Reads translations aloud with the phone's built-in text-to-speech. Speech is made on the phone. |
| Phone storage | Yes | Settings, your API keys, and your translation History, kept in the Even app's storage on your phone only. |
| Location / GPS | No | Never used. |
| Camera | No | Never used. |
| Contacts, photos, calendar | No | Never used. |
| Glasses head-motion sensor (IMU) | No | Switched off in I-Translate. |

## Data sent to other services
- **Soniox** (soniox.com): the live audio while you translate, to turn speech into text. Covered by Soniox's own privacy policy.
- **Your AI provider**: the text of what was said, to translate it, suggest a reply and a question, and give each History entry a short title and summary. Covered by that provider's privacy policy.
- Both use YOUR keys and accounts. I-Translate never sees or forwards the data anywhere else.

## Data kept on the phone
- API keys: stored on your phone only, sent only to the service they belong to.
- History: past conversations (original lines + translations), on your phone only. You can delete them in the History tab, or delete everything by removing the app.

## Data collected by the developer
None. No personal data, usage data, crash reports or identifiers.

## Children
Not directed at children under 13.

## Contact
Through the developer contact on the Even Hub listing.
