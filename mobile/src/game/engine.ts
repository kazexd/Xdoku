export type Difficulty = 'easy' | 'medium' | 'hard';
export type Rating = { difficulty: Difficulty; singles: number; deductions: number; solved: boolean };
export type Puzzle = { id: string; size: number; regions: number[]; solution: number[]; givens?: number[]; rating?: Rating };
export const GENERATOR_VERSION = 5;
export const BOARD_SIZES = [7, 8, 9, 10] as const;
export type Mark = 0 | 1 | 2; // empty, excluded, cat

/** 依面積向下取整至 14%；7×7 依指定例外允許每色七格。 */
export function regionLimit(size: number): number { return size === 7 ? 7 : Math.floor(size * size * 14 / 100); }

/** 建立或修復棋盤記號，確保題目預放的貓永遠存在；不修改傳入陣列。 */
export function protectGivens(p: Puzzle, marks: Mark[] = []): Mark[] {
  return Array.from({ length: p.size * p.size }, /** 固定線索強制為貓，其餘保留合法記號或空白。 */ (_, cell) =>
    p.givens?.includes(cell) ? 2 : marks[cell] === 1 || marks[cell] === 2 ? marks[cell] : 0);
}

/** 將關卡或每日種子混合後均勻映射至四種尺寸，同一局重開時維持相同尺寸。 */
export function boardSize(seed: number): typeof BOARD_SIZES[number] {
  if (!Number.isSafeInteger(seed)) throw new RangeError('Seed must be a safe integer');
  let value = seed >>> 0;
  value = Math.imul(value ^ (value >>> 16), 0x85ebca6b);
  value = Math.imul(value ^ (value >>> 13), 0xc2b2ae35);
  return BOARD_SIZES[(value ^ (value >>> 16)) >>> 0 & 3];
}

/** 判斷兩格是否同列、同欄、同色區或八方向相鄰，任一條件成立即衝突。 */
export function conflicts(p: Puzzle, a: number, b: number) {
  const ar = Math.floor(a / p.size), br = Math.floor(b / p.size);
  const ac = a % p.size, bc = b % p.size;
  return ar === br || ac === bc || p.regions[a] === p.regions[b] ||
    (Math.abs(ar - br) <= 1 && Math.abs(ac - bc) <= 1);
}

/** 以欄及色區位元遮罩回溯搜尋答案；預先排除固定線索衝突，找到 limit 個解即停止。 */
export function solve(p: Puzzle, limit = 2): number[][] {
  const results: number[][] = [];
  const allowed = Array<number>(p.size).fill(0);
  for (let cell = 0; cell < p.size * p.size; cell++) {
    if (!p.givens?.some(/** 排除與預放線索衝突的候選，保留線索本身。 */ given => given !== cell && conflicts(p, cell, given))) {
      allowed[Math.floor(cell / p.size)] |= 1 << (cell % p.size);
    }
  }
  /** 使用已佔用欄、色區及上一列欄位剪枝，沿列收集合法貓咪索引。 */
  function visit(cats: number[], columns: number, regions: number, previous: number) {
    if (results.length >= limit) return;
    const row = cats.length;
    if (row === p.size) { results.push([...cats]); return; }
    for (let col = 0; col < p.size; col++) {
      const bit = 1 << col, cell = row * p.size + col, regionBit = 1 << p.regions[cell];
      if (!(allowed[row] & bit) || (columns & bit) || (regions & regionBit) || (row > 0 && Math.abs(col - previous) <= 1)) continue;
      visit([...cats, cell], columns | bit, regions | regionBit, col);
    }
  }
  visit([], 0, 0, -2);
  return results;
}

/** 確認記號陣列尺寸正確，且棋盤已放滿指定數量、彼此不衝突的貓咪。 */
export function isComplete(p: Puzzle, marks: Mark[]) {
  if (marks.length !== p.size * p.size) return false;
  if (p.givens?.some(/** 完成判定必須保留所有固定線索。 */ cell => marks[cell] !== 2)) return false;
  const cats = marks.flatMap(/** 篩選符合條件的格子並攤平成一維索引陣列。 */ (mark, i) => mark === 2 ? [i] : []);
  return cats.length === p.size && cats.every(/** 確認所有項目均符合此步驟的合法性或共同衝突條件。 */ (a, i) => cats.slice(i + 1).every(/** 確認所有項目均符合此步驟的合法性或共同衝突條件。 */ b => !conflicts(p, a, b)));
}

/** 使用傳入的亂數來源進行 Fisher–Yates 洗牌，回傳新陣列而不改動輸入。 */
function shuffled<T>(values: T[], random: () => number): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** 隨機回溯產生每列、每欄各一隻且不斜角相鄰的貓咪位置，結果使用一維格子索引。 */
function randomSolution(size: number, random: () => number): number[] {
  const columns: number[] = [];
  /** 以隨機欄位順序遞迴放置貓咪；遇到死路便移除末項並回溯。 */
  function visit(): boolean {
    if (columns.length === size) return true;
    for (const col of shuffled(Array.from({ length: size }, /** 依索引建立此步驟所需的候選、群組或測試資料。 */ (_, i) => i), random)) {
      if (columns.includes(col) || (columns.length > 0 && Math.abs(columns[columns.length - 1] - col) <= 1)) continue;
      columns.push(col);
      if (visit()) return true;
      columns.pop();
    }
    return false;
  }
  if (!visit()) throw new Error('No valid cat arrangement');
  return columns.map(/** 將每個項目轉換為本步驟所需的格子、記號或呈現資料。 */ (col, row) => row * size + col);
}

// Simulate deductions without reading the solution or guessing.
/** 不讀取答案，以單一候選與群組共同衝突排除模擬推理；回報是否解完及啟發式難度。 */
export function ratePuzzle(p: Puzzle): Rating {
  const cats: number[] = [...(p.givens ?? [])];
  const candidates = new Set(p.regions.map(/** 將每個項目轉換為本步驟所需的格子、記號或呈現資料。 */ (_, i) => i));
  for (const cat of cats) for (const cell of candidates) if (conflicts(p, cat, cell)) candidates.delete(cell);
  const groups = Array.from({ length: p.size * 3 }, /** 依索引建立此步驟所需的候選、群組或測試資料。 */ (_, g) =>
    p.regions.flatMap(/** 篩選符合條件的格子並攤平成一維索引陣列。 */ (region, cell) =>
      (g < p.size ? Math.floor(cell / p.size) === g : g < p.size * 2 ? cell % p.size === g - p.size : region === g - p.size * 2) ? [cell] : []));
  let singles = 0, deductions = 0;
  while (cats.length < p.size) {
    const remaining = groups.filter(/** 保留符合目前候選、群組或衝突條件的項目。 */ group => !cats.some(/** 檢查是否存在符合條件的項目，以判斷衝突、變更或候選狀態。 */ cat => group.includes(cat)))
      .map(/** 將每個項目轉換為本步驟所需的格子、記號或呈現資料。 */ group => group.filter(/** 保留符合目前候選、群組或衝突條件的項目。 */ cell => candidates.has(cell)));
    if (remaining.some(/** 檢查是否存在符合條件的項目，以判斷衝突、變更或候選狀態。 */ group => group.length === 0)) break;
    const forced = remaining.find(/** 取得第一個符合條件的候選格或群組。 */ group => group.length === 1);
    if (forced) {
      const cat = forced[0];
      cats.push(cat); singles++;
      for (const cell of candidates) if (conflicts(p, cat, cell)) candidates.delete(cell);
      continue;
    }
    // A required group must contain a cat. Eliminate any outside cell that
    // conflicts with every candidate in that group (locked/common exclusions).
    let changed = false;
    for (const group of remaining) {
      const eliminated = [...candidates].filter(/** 保留符合目前候選、群組或衝突條件的項目。 */ cell => !group.includes(cell) && group.every(/** 確認所有項目均符合此步驟的合法性或共同衝突條件。 */ other => conflicts(p, cell, other)));
      if (eliminated.length) {
        eliminated.forEach(/** 依序處理各項資料，更新目前轉換、色區或候選集合。 */ cell => candidates.delete(cell));
        deductions++; changed = true; break;
      }
    }
    if (!changed) break;
  }
  return { difficulty: deductions === 0 ? 'easy' : deductions <= 3 ? 'medium' : 'hard', singles, deductions, solved: cats.length === p.size };
}

// Normalize region labels and all eight square symmetries for duplicate checks.
/** 正規化八種旋轉／鏡像及色區編號，產生不受方向和配色編號影響的去重識別。 */
export function canonicalKey(p: Puzzle): string {
  const variants: string[] = [];
  for (let mirror = 0; mirror < 2; mirror++) for (let rotation = 0; rotation < 4; rotation++) {
    const transformed = Array<number>(p.regions.length);
    p.regions.forEach(/** 依序處理各項資料，更新目前轉換、色區或候選集合。 */ (region, cell) => {
      let row = Math.floor(cell / p.size), col = cell % p.size;
      if (mirror) col = p.size - 1 - col;
      for (let i = 0; i < rotation; i++) [row, col] = [col, p.size - 1 - row];
      transformed[row * p.size + col] = region;
    });
    const labels = new Map<number, number>();
    variants.push(transformed.map(/** 將每個項目轉換為本步驟所需的格子、記號或呈現資料。 */ region => {
      if (!labels.has(region)) labels.set(region, labels.size);
      return labels.get(region);
    }).join(','));
  }
  return `${p.size}:${variants.sort()[0]}`;
}

/** 取得上下左右鄰格，避免左右邊界跨列。 */
function neighbors(cell: number, size: number): number[] {
  const col = cell % size;
  return [cell - size, cell + size, ...(col ? [cell - 1] : []), ...(col < size - 1 ? [cell + 1] : [])]
    .filter(/** 移除棋盤外的格子。 */ value => value >= 0 && value < size * size);
}

/** 確認指定色區可由正交鄰格走遍，避免交換後產生分離色塊。 */
function connected(regions: number[], size: number, region: number): boolean {
  const cells = regions.flatMap(/** 收集此色區的格子。 */ (value, cell) => value === region ? [cell] : []);
  const seen = new Set([cells[0]]), queue = [cells[0]];
  while (queue.length) {
    const cell = queue.pop()!;
    for (const next of neighbors(cell, size)) if (regions[next] === region && !seen.has(next)) { seen.add(next); queue.push(next); }
  }
  return seen.size === cells.length;
}

/** 優先不放線索，再檢查一隻及兩隻線索；只回傳唯一解且可推理解完的題目。 */
function withClues(p: Puzzle, order: number[]): Puzzle | null {
  const choices: number[][] = [[]];
  for (const cell of order) choices.push([cell]);
  for (let a = 0; a < order.length; a++) for (let b = a + 1; b < order.length; b++) choices.push([order[a], order[b]]);
  for (const givens of choices) {
    const candidate = { ...p, givens };
    if (solve(candidate).length !== 1) continue;
    const rating = ratePuzzle(candidate);
    if (rating.solved) return { ...candidate, rating };
  }
  return null;
}

/** 先產生答案，再交換連通色區邊界；面積受限，必要時最多預放兩隻貓以確保唯一且可推理。 */
export function makePuzzle(seed: number, size = boardSize(seed), excluded: ReadonlySet<string> = new Set()): Puzzle {
  if (!BOARD_SIZES.some(/** 僅支援目前遊戲尺寸。 */ value => value === size)) throw new RangeError('Supported sizes: 7, 8, 9, 10');
  if (!Number.isSafeInteger(seed)) throw new RangeError('Seed must be a safe integer');
  let state = seed >>> 0;
  const random = /** 以固定參數推進種子，讓題目及線索可重現。 */ () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const solution = randomSolution(size, random);
  const roots = new Set(solution);
  const regions = Array.from({ length: size * size }, /** 起始每列一個連通色區，每區包含恰好一個答案。 */ (_, cell) => Math.floor(cell / size));
  const regionSizes = Array<number>(size).fill(size);
  const cap = regionLimit(size);
  for (let attempt = 0; attempt < 500; attempt++) {
    for (let step = 0; step < size * size * 20; step++) {
      const a = Math.floor(random() * regions.length), b = Math.floor(random() * regions.length);
      const ra = regions[a], rb = regions[b];
      if (ra === rb || roots.has(a) || roots.has(b)) continue;
      if (!neighbors(a, size).some(/** 交換後必須與新色區相接。 */ cell => regions[cell] === rb) ||
          !neighbors(b, size).some(/** 另一格亦必須與新色區相接。 */ cell => regions[cell] === ra)) continue;
      // 9×9、10×10 允許在上限內改變面積；7×7、8×8 以交換保持精確等面積。
      const transfer = random() < .35 && regionSizes[rb] < cap && regionSizes[ra] > 2;
      regions[a] = rb;
      if (!transfer) regions[b] = ra;
      if (!connected(regions, size, ra) || !connected(regions, size, rb)) {
        regions[a] = ra; regions[b] = rb; continue;
      }
      if (transfer) { regionSizes[ra]--; regionSizes[rb]++; }
    }
    const puzzle: Puzzle = { id: `v${GENERATOR_VERSION}:${size}:${seed}`, size, regions: [...regions], solution };
    if (excluded.has(canonicalKey(puzzle))) continue;
    const result = withClues(puzzle, shuffled(solution, random));
    if (result) return result;
  }
  throw new Error('Could not generate a bounded-area puzzle with at most two given cats');
}

const catalogs = new Map<number, { puzzles: Puzzle[]; keys: Set<string> }>();
/** 依編號重建並快取指定尺寸的關卡庫，排除包含旋轉與鏡像的重複棋盤。 */
export function levelPuzzle(level: number, size = boardSize(level)): Puzzle {
  if (!Number.isSafeInteger(level) || level < 1) throw new RangeError('Level must be a positive integer');
  let catalog = catalogs.get(size);
  if (!catalog) { catalog = { puzzles: [], keys: new Set() }; catalogs.set(size, catalog); }
  while (catalog.puzzles.length < level) {
    const puzzle = makePuzzle(catalog.puzzles.length + 1, size, catalog.keys);
    catalog.keys.add(canonicalKey(puzzle)); catalog.puzzles.push(puzzle);
  }
  return catalog.puzzles[level - 1];
}

/** 將日期轉為 UTC 的 YYYYMMDD 整數，讓不同時區在同一時刻取得相同每日種子。 */
export function dailySeed(date = new Date()) {
  return Number(date.toISOString().slice(0, 10).replaceAll('-', ''));
}
