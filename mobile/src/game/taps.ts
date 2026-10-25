import type { Mark } from './engine';

export const DOUBLE_TAP_MS = 300;
export type LastTap = { cell: number; time: number; board: string; original: Mark };

// Show a single-tap mark immediately. A second tap replaces that same move.
export function resolveTap(mark: Mark, cell: number, time: number, board: string, last: LastTap | null) {
  const double = last !== null && last.cell === cell && last.board === board &&
    time >= last.time && time - last.time <= DOUBLE_TAP_MS;
  const next: Mark = double ? last.original === 2 ? 0 : 2 : mark === 0 ? 1 : 0;
  return {
    mark: next,
    replaceMove: double,
    lastTap: double ? null : { cell, time, board, original: mark },
  };
}
