import { BOARD_SIZES, isComplete, type Puzzle } from './engine.ts';

export type PuzzleCatalog = {
  schemaVersion: 1; generatorVersion: number; dailyEpoch: string;
  classic: Puzzle[]; daily: Puzzle[];
};

/** 驗證隨 App 發佈的題庫結構與基本規則；不執行生成、搜尋或難度推理。 */
export function validateCatalog(value: unknown): PuzzleCatalog {
  const bank = value as PuzzleCatalog;
  if (!bank || bank.schemaVersion !== 1 || !Number.isInteger(bank.generatorVersion) || bank.dailyEpoch !== '2026-10-25') throw new Error('Unsupported puzzle catalog');
  const ids = new Set<string>();
  for (const pool of [bank.classic, bank.daily]) {
    if (!Array.isArray(pool) || pool.length === 0) throw new Error('Puzzle catalog must contain both pools');
    for (const p of pool) {
      if (!p || typeof p.id !== 'string' || !p.id || ids.has(p.id) || !BOARD_SIZES.some(/** 限制題庫為遊戲支援的尺寸。 */ size => size === p.size)) throw new Error('Invalid puzzle identity');
      ids.add(p.id);
      if (!Array.isArray(p.regions) || p.regions.length !== p.size * p.size || !p.regions.every(/** 每格必須指向有效色區。 */ region => Number.isInteger(region) && region >= 0 && region < p.size)) throw new Error('Invalid region data');
      if (!Array.isArray(p.solution) || p.solution.length !== p.size || !p.solution.every(/** 答案索引必須落在棋盤內。 */ cell => Number.isInteger(cell) && cell >= 0 && cell < p.regions.length)) throw new Error('Invalid solution data');
      if (!Array.isArray(p.givens) || p.givens.length > 2 || new Set(p.givens).size !== p.givens.length || !p.givens.every(/** 預放線索必須屬於原答案。 */ cell => p.solution.includes(cell))) throw new Error('Invalid clue data');
      const counts = Array<number>(p.size).fill(0);
      for (const region of p.regions) counts[region]++;
      const cap = p.size === 7 ? 7 : Math.floor(p.size * p.size * .14);
      if (counts.some(/** 保留面積及非空色區限制。 */ count => count < 1 || count > cap) || counts.filter(/** 最多允許一個單格色區。 */ count => count === 1).length > 1) throw new Error('Invalid region areas');
      const marks = Array.from({ length: p.regions.length }, /** 以已儲存答案檢查合法性，並非重新解題。 */ (_, cell) => p.solution.includes(cell) ? 2 as const : 0 as const);
      if (!isComplete(p, marks) || !p.rating || !p.rating.solved || !['easy', 'medium', 'hard'].includes(p.rating.difficulty) || !Number.isInteger(p.rating.singles) || p.rating.singles + p.givens.length !== p.size || !Number.isInteger(p.rating.deductions) || p.rating.deductions < 0) throw new Error('Invalid solution or rating');
    }
  }
  return bank;
}
