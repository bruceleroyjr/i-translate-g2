
export interface VoiceStatus {
  enrolled: boolean;
  at?: string | null;
  on: boolean;
  enrolling: { step: number; of: number; sentence: string; note: string } | null;
}

export interface VoiceView {
  state: string; 
  training: boolean;
  step: string; 
  sentence: string; 
  note: string; 
  button: string; 
}

function when(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function voiceView(st: VoiceStatus | null): VoiceView {
  const none = { training: false, step: '', sentence: '', note: '' };
  if (!st) return { ...none, state: 'Voice ID: the PC relay isn\'t reachable right now.', button: '' };
  const e = st.enrolling;
  if (e) {
    return {
      state: 'Training: wear the glasses and read each sentence out loud, at your normal voice.',
      training: true,
      step: `Step ${e.step + 1} of ${e.of} - read this out loud:`,
      sentence: `“${e.sentence}”`,
      note: e.note || '',
      button: 'Cancel',
    };
  }
  if (!st.enrolled) {
    return { ...none, state: 'Not trained yet: until you train it, every voice counts.', button: 'Train my voice' };
  }
  const at = when(st.at);
  return {
    ...none,
    state: st.on
      ? `Trained${at ? ` ${at}` : ''}. When you talk to Hermes, only your voice counts.`
      : `Trained${at ? ` ${at}` : ''}, but switched off: every voice counts.`,
    button: 'Retrain my voice',
  };
}
