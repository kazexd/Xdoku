import bundled from '../data/puzzles.json' with { type: 'json' };
import { validateCatalog } from './catalog-schema.ts';
import type { Puzzle } from './engine.ts';

const bank = validateCatalog(bundled);
export const CLASSIC_COUNT = bank.classic.length;
export const DAILY_COUNT = bank.daily.length;
const epoch = Date.parse(`${bank.dailyEpoch}T00:00:00Z`);

/** 從有限題庫取得一般關卡；題庫用盡時明確拒絕，不即時生成或偷偷重複題目。 */
export function classicPuzzle(level: number): Puzzle {
  if (!Number.isSafeInteger(level) || level < 1 || level > CLASSIC_COUNT) throw new RangeError('Classic catalog exhausted');
  return bank.classic[level - 1];
}

/** 依 UTC 日期載入共用每日題目；有限離線題池每 DAILY_COUNT 天循環一次。 */
export function dailyPuzzle(day: number): Puzzle {
  const digits = String(day);
  const timestamp = Date.parse(`${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}T00:00:00Z`);
  if (digits.length !== 8 || !Number.isFinite(timestamp) || Number(new Date(timestamp).toISOString().slice(0, 10).replaceAll('-', '')) !== day) throw new RangeError('Invalid daily date');
  const ordinal = Math.round((timestamp - epoch) / 86400000);
  return bank.daily[((ordinal % DAILY_COUNT) + DAILY_COUNT) % DAILY_COUNT];
}
