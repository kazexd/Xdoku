export type Difficulty = 'easy' | 'medium' | 'hard';
export type Rating = { difficulty: Difficulty; singles: number; deductions: number; solved: boolean };
export type Puzzle = { id: string; size: number; regions: number[]; solution: number[]; rating?: Rating };
export const GENERATOR_VERSION = 4;
export const BOARD_SIZES = [7, 8, 9, 10] as const;
export type Mark = 0 | 1 | 2; // empty, excluded, cat

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

/** 逐列回溯搜尋合法答案；達到 limit 即停止，預設找到第二個解便可判定非唯一解。 */
export function solve(p: Puzzle, limit = 2): number[][] {
  const results: number[][] = [];
  /** 逐列嘗試與已放貓咪不衝突的位置，收集答案並在達到數量上限時剪枝。 */
  function visit(cats: number[]) {
    if (results.length >= limit) return;
    const row = cats.length;
    if (row === p.size) { results.push([...cats]); return; }
    for (let col = 0; col < p.size; col++) {
      const cell = row * p.size + col;
      if (cats.every(/** 確認所有項目均符合此步驟的合法性或共同衝突條件。 */ other => !conflicts(p, cell, other))) visit([...cats, cell]);
    }
  }
  visit([]);
  return results;
}

/** 確認記號陣列尺寸正確，且棋盤已放滿指定數量、彼此不衝突的貓咪。 */
export function isComplete(p: Puzzle, marks: Mark[]) {
  if (marks.length !== p.size * p.size) return false;
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
  const cats: number[] = [];
  const candidates = new Set(p.regions.map(/** 將每個項目轉換為本步驟所需的格子、記號或呈現資料。 */ (_, i) => i));
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

// Seeded backtracking + connected region growth + uniqueness and logic checks.
/** 由種子生成連通色區，最多一個單格色區；只接受未重複、唯一解且可推理解完的棋盤。 */
export function makePuzzle(seed: number, size = boardSize(seed), excluded: ReadonlySet<string> = new Set()): Puzzle {
  if (!BOARD_SIZES.some(/** 檢查是否存在符合條件的項目，以判斷衝突、變更或候選狀態。 */ value => value === size)) throw new RangeError('Supported sizes: 7, 8, 9, 10');
  if (!Number.isSafeInteger(seed)) throw new RangeError('Seed must be a safe integer');
  let state = seed >>> 0;
  const random = /** 推進固定參數的 32 位元線性同餘亂數狀態，確保相同種子可重現生成結果。 */ () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  for (let attempt = 0; attempt < 5000; attempt++) {
    const solution = randomSolution(size, random);
    // 保留隨機的小色區作為推理起點，避免大型棋盤的均勻擴張產生大量多解候選。
    const smallRegions = new Set(shuffled(Array.from({ length: size }, /** 建立可保留為小色區的編號。 */ (_, i) => i), random).slice(0, size - 2));
    const singletonRegion = Math.floor(random() * size);
    smallRegions.add(singletonRegion);
    const regionSizes = Array<number>(size).fill(1);
    const regions = Array<number>(size * size).fill(-1);
    solution.forEach(/** 依序處理各項資料，更新目前轉換、色區或候選集合。 */ (cell, region) => { regions[cell] = region; });
    while (regions.includes(-1)) {
      const edges: [number, number][] = [];
      regions.forEach(/** 依序處理各項資料，更新目前轉換、色區或候選集合。 */ (region, cell) => {
        if (region < 0) return;
        for (const neighbor of [cell - size, cell + size, ...(cell % size ? [cell - 1] : []), ...(cell % size < size - 1 ? [cell + 1] : [])]) {
          if (neighbor >= 0 && neighbor < regions.length && regions[neighbor] === -1) edges.push([neighbor, region]);
        }
      });
      // 先讓其餘色區至少長至兩格，再保留小色區作為推理起點。
      const undersized = edges.filter(/** 優先擴張尚未達到兩格且不是唯一允許單格的色區。 */ edge => edge[1] !== singletonRegion && regionSizes[edge[1]] < 2);
      const expanding = edges.filter(/** 其餘階段優先擴張非保留色區；被包圍時允許小色區繼續擴張。 */ edge => !smallRegions.has(edge[1]));
      const choices = undersized.length ? undersized : expanding.length ? expanding : edges;
      const [cell, region] = choices[Math.floor(random() * choices.length)];
      regions[cell] = region;
      regionSizes[region]++;
    }
    if (regionSizes.filter(/** 計算單格色區，防止被包圍而無法擴張的色區繞過限制。 */ count => count === 1).length > 1) continue;
    const puzzle: Puzzle = { id: `v${GENERATOR_VERSION}:${size}:${seed}`, size, regions, solution };
    if (excluded.has(canonicalKey(puzzle)) || solve(puzzle).length !== 1) continue;
    const rating = ratePuzzle(puzzle);
    if (rating.solved) return { ...puzzle, rating };
  }
  throw new Error('Could not generate a unique, logically solvable puzzle within 5000 attempts');
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
