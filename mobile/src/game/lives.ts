import { protectGivens, type Mark, type Puzzle } from './engine.ts';

export const MAX_FISH = 3;
export type Round = { marks: Mark[]; fish: number; mistakes: number[] };

/** 檢查新增貓咪是否屬於答案；錯誤轉為排除記號並每次扣一條魚。 */
export function applyMove(puzzle: Puzzle, round: Round, next: Mark[]): { round: Round; wrong: number | null } {
  if (round.fish === 0) return { round, wrong: null };
  const protectedMarks = next.map(/** 保護已選錯的記號及已找到的正確貓咪。 */ (mark, cell) => round.mistakes.includes(cell) ? 1 as const : round.marks[cell] === 2 && puzzle.solution.includes(cell) ? 2 as const : mark);
  const wrong = protectedMarks.findIndex(/** 只有新放下的錯誤貓需要扣機會。 */ (mark, cell) => mark === 2 && round.marks[cell] !== 2 && !puzzle.solution.includes(cell));
  if (wrong < 0) return { round: { marks: protectGivens(puzzle, protectedMarks), fish: round.fish, mistakes: round.mistakes }, wrong: null };
  // 一次操作只處理一隻新貓，避免批次輸入繞過逐次錯誤回饋。
  const marks = [...round.marks]; marks[wrong] = 1;
  return { round: { marks, fish: round.fish - 1, mistakes: [...round.mistakes, wrong] }, wrong };
}

/** 載入記號與剩餘魚數，兼容舊陣列存檔並移除舊版錯誤貓咪。 */
export function restoreRound(puzzle: Puzzle, saved: unknown): Round {
  const value = saved as Partial<Round> | null;
  const marks = Array.isArray(saved) ? saved : value?.marks;
  const fish = !Array.isArray(saved) && Number.isInteger(value?.fish) && value!.fish! >= 0 && value!.fish! <= MAX_FISH ? value!.fish! : MAX_FISH;
  if (!Array.isArray(marks) || marks.length !== puzzle.size * puzzle.size || !marks.every(/** 驗證記號值。 */ mark => mark === 0 || mark === 1 || mark === 2)) return { marks: protectGivens(puzzle), fish: MAX_FISH, mistakes: [] };
  const mistakes = Array.isArray(value?.mistakes) ? [...new Set(value.mistakes.filter(/** 僅接受棋盤內且不是答案的鎖定格。 */ cell => Number.isInteger(cell) && cell >= 0 && cell < marks.length && !puzzle.solution.includes(cell)))] : [];
  return { marks: protectGivens(puzzle, marks.map(/** 舊版容許的錯誤貓改為排除記號。 */ (mark, cell) => mistakes.includes(cell) || (mark === 2 && !puzzle.solution.includes(cell)) ? 1 : mark)), fish, mistakes };
}
