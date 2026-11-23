import { Glasses } from '../src/glasses.ts';
for (const m of ['setPage', 'setTray', 'syncBare', 'syncHomeSleep', 'refreshMenu']) {
  const f = Glasses.prototype[m];
  Glasses.prototype[m] = async function (...a) { const r = await f.apply(this, a); await this.flush(); return r; };
}
