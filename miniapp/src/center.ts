
import { measureTextWrap } from '@evenrealities/pretext';

export const LINE_PX = 27; 
export const BODY_WRAP_PX = 552; 

export function wrappedLines(text: string, widthPx = BODY_WRAP_PX): number {
  return text.trim() ? measureTextWrap(text, widthPx).lineCount : 0;
}

export function bottomV(text: string, boxLines: number, widthPx = BODY_WRAP_PX): string {
  const t = text.replace(/^\n+/, '').trimEnd();
  if (!t.trim()) return text;
  const lines = wrappedLines(t, widthPx);
  if (lines >= boxLines) return t;
  return '\n'.repeat(boxLines - lines) + t;
}

export function centerV(text: string, boxLines: number, widthPx = BODY_WRAP_PX): string {
  const t = text.replace(/^\n+/, '').trimEnd();
  if (!t.trim()) return text;
  const lines = wrappedLines(t, widthPx);
  if (lines >= boxLines) return t;
  return '\n'.repeat(Math.floor((boxLines - lines) / 2)) + t;
}
