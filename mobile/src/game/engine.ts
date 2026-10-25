export type Difficulty = 'easy' | 'medium' | 'hard';
export type Rating = { difficulty: Difficulty; singles: number; deductions: number; solved: boolean };
export type Puzzle = { id: string; size: number; regions: number[]; solution: number[]; givens?: number[]; rating?: Rating };
export const BOARD_SIZES = [7, 8, 9, 10] as const;
export type Mark = 0 | 1 | 2;

/** 建立或修復棋盤記號，確保題目預放的貓永遠存在；不修改傳入陣列。 */
export function protectGivens(p: Puzzle, marks: Mark[] = []): Mark[] {
  return Array.from({ length: p.size * p.size }, /** 固定線索強制為貓，其餘保留合法記號或空白。 */ (_, cell) =>
    p.givens?.includes(cell) ? 2 : marks[cell] === 1 || marks[cell] === 2 ? marks[cell] : 0);
}

/** 判斷兩格是否同列、同欄、同色區或八方向相鄰，任一條件成立即衝突。 */
export function conflicts(p: Puzzle, a: number, b: number) {
  const ar = Math.floor(a / p.size), br = Math.floor(b / p.size);
  const ac = a % p.size, bc = b % p.size;
  return ar === br || ac === bc || p.regions[a] === p.regions[b] ||
    (Math.abs(ar - br) <= 1 && Math.abs(ac - bc) <= 1);
}

/** 確認記號陣列尺寸正確，且棋盤已放滿指定數量、彼此不衝突的貓咪。 */
export function isComplete(p: Puzzle, marks: Mark[]) {
  if (marks.length !== p.size * p.size) return false;
  if (p.givens?.some(/** 完成判定必須保留所有固定線索。 */ cell => marks[cell] !== 2)) return false;
  const cats = marks.flatMap(/** 篩選符合條件的格子並攤平成一維索引陣列。 */ (mark, i) => mark === 2 ? [i] : []);
  return cats.length === p.size && cats.every(/** 確認所有項目均符合此步驟的合法性或共同衝突條件。 */ (a, i) => cats.slice(i + 1).every(/** 確認所有項目均符合此步驟的合法性或共同衝突條件。 */ b => !conflicts(p, a, b)));
}

/** 將日期轉為 UTC 的 YYYYMMDD 整數，讓不同時區在同一時刻取得相同每日種子。 */
export function dailySeed(date = new Date()) {
  return Number(date.toISOString().slice(0, 10).replaceAll('-', ''));
}
