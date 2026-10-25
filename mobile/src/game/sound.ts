import type { Mark, Puzzle } from './engine.ts';

/** 只辨識本次新放下的正確貓，不把記號、錯誤或既有貓當作成功。 */
export function newlyFoundCat(puzzle: Puzzle, before: Mark[], after: Mark[]): number {
  return after.findIndex(/** 新貓必須屬於儲存的唯一答案。 */ (mark, cell) => mark === 2 && before[cell] !== 2 && puzzle.solution.includes(cell));
}

/** 從頭重播短音效；音訊不可用時安靜失敗，避免阻礙遊戲。 */
export async function replayCorrectSound(player: { seekTo: (seconds: number) => Promise<void>; play: () => void }): Promise<void> {
  try { await player.seekTo(0); player.play(); } catch { /* 裝置音訊中斷或播放器卸載時仍保留遊戲操作。 */ }
}
