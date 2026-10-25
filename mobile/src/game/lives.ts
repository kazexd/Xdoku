import { protectGivens, type Mark, type Puzzle } from './engine.ts';

export const MAX_FISH = 3;
export type Round = { marks: Mark[]; fish: number };

/** 檢查新增貓咪是否屬於答案；錯誤轉為排除記號並每次扣一條魚。 */
export function applyMove(puzzle: Puzzle, round: Round, next: Mark[]): { round: Round; wrong: number | null } {
  if (round.fish === 0) return { round, wrong: null };
  const wrong = next.findIndex(/** 只有新放下的錯誤貓需要扣機會。 */ (mark, cell) => mark === 2 && round.marks[cell] !== 2 && !puzzle.solution.includes(cell));
  if (wrong < 0) return { round: { marks: protectGivens(puzzle, next), fish: round.fish }, wrong: null };
  // 一次操作只處理一隻新貓，避免批次輸入繞過逐次錯誤回饋。
  const marks = [...round.marks]; marks[wrong] = 1;
  return { round: { marks, fish: round.fish - 1 }, wrong };
}

/** 載入記號與剩餘魚數，兼容舊陣列存檔並移除舊版錯誤貓咪。 */
export function restoreRound(puzzle: Puzzle, saved: unknown): Round {
  const value = saved as Partial<Round> | null;
  const marks = Array.isArray(saved) ? saved : value?.marks;
  const fish = !Array.isArray(saved) && Number.isInteger(value?.fish) && value!.fish! >= 0 && value!.fish! <= MAX_FISH ? value!.fish! : MAX_FISH;
  if (!Array.isArray(marks) || marks.length !== puzzle.size * puzzle.size || !marks.every(/** 驗證記號值。 */ mark => mark === 0 || mark === 1 || mark === 2)) return { marks: protectGivens(puzzle), fish: MAX_FISH };
  return { marks: protectGivens(puzzle, marks.map(/** 舊版容許的錯誤貓改為排除記號。 */ (mark, cell) => mark === 2 && !puzzle.solution.includes(cell) ? 1 : mark)), fish };
}
