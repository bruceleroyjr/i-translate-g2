
export const ART = '8bit';

export interface G0aStep {
  passed: boolean;
  phone: string; 
}

export function g0aAnswer(recognizable: boolean): G0aStep {
  return recognizable
    ? { passed: true, phone: '✅ G0a passed: the 8-bit avatar reads as her on the glasses.' }
    : { passed: false, phone: '❌ Green blob. Hermes was told; the art gets bolder lines and a bigger face (same 72x72 size), then re-test.' };
}

export function g0aCard(): { title: string; text: string } {
  return {
    title: 'G0a avatar check',
    text: 'Bottom left: the 8-bit avatar.\nIs that clearly her (dark bob, suit), or a green blob?\nAnswer on your phone.',
  };
}

export function timingLine(ms: Record<string, number>): string {
  const vals = Object.values(ms);
  if (!vals.length) return '';
  const slow = Object.entries(ms).filter(([, v]) => v > 1000).map(([k]) => k);
  const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  return `Image transfers: avg ${avg} ms, max ${Math.max(...vals)} ms` + (slow.length ? ` · over 1 s: ${slow.join(', ')}` : ' · all under 1 s');
}
