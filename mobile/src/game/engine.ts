export type Difficulty = 'easy' | 'medium' | 'hard';
export type Rating = { difficulty: Difficulty; singles: number; deductions: number; solved: boolean };
export type Puzzle = { id: string; size: number; regions: number[]; solution: number[]; rating?: Rating };
export const GENERATOR_VERSION = 2;
export const BOARD_SIZES = [5, 6, 7] as const;
export type Mark = 0 | 1 | 2; // empty, excluded, cat

export function conflicts(p: Puzzle, a: number, b: number) {
  const ar = Math.floor(a / p.size), br = Math.floor(b / p.size);
  const ac = a % p.size, bc = b % p.size;
  return ar === br || ac === bc || p.regions[a] === p.regions[b] ||
    (Math.abs(ar - br) <= 1 && Math.abs(ac - bc) <= 1);
}

export function solve(p: Puzzle, limit = 2): number[][] {
  const results: number[][] = [];
  function visit(cats: number[]) {
    if (results.length >= limit) return;
    const row = cats.length;
    if (row === p.size) { results.push([...cats]); return; }
    for (let col = 0; col < p.size; col++) {
      const cell = row * p.size + col;
      if (cats.every(other => !conflicts(p, cell, other))) visit([...cats, cell]);
    }
  }
  visit([]);
  return results;
}

export function isComplete(p: Puzzle, marks: Mark[]) {
  if (marks.length !== p.size * p.size) return false;
  const cats = marks.flatMap((mark, i) => mark === 2 ? [i] : []);
  return cats.length === p.size && cats.every((a, i) => cats.slice(i + 1).every(b => !conflicts(p, a, b)));
}

function shuffled<T>(values: T[], random: () => number): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function randomSolution(size: number, random: () => number): number[] {
  const columns: number[] = [];
  function visit(): boolean {
    if (columns.length === size) return true;
    for (const col of shuffled(Array.from({ length: size }, (_, i) => i), random)) {
      if (columns.includes(col) || (columns.length > 0 && Math.abs(columns[columns.length - 1] - col) <= 1)) continue;
      columns.push(col);
      if (visit()) return true;
      columns.pop();
    }
    return false;
  }
  if (!visit()) throw new Error('No valid cat arrangement');
  return columns.map((col, row) => row * size + col);
}

// Simulate deductions without reading the solution or guessing.
export function ratePuzzle(p: Puzzle): Rating {
  const cats: number[] = [];
  const candidates = new Set(p.regions.map((_, i) => i));
  const groups = Array.from({ length: p.size * 3 }, (_, g) =>
    p.regions.flatMap((region, cell) =>
      (g < p.size ? Math.floor(cell / p.size) === g : g < p.size * 2 ? cell % p.size === g - p.size : region === g - p.size * 2) ? [cell] : []));
  let singles = 0, deductions = 0;
  while (cats.length < p.size) {
    const remaining = groups.filter(group => !cats.some(cat => group.includes(cat)))
      .map(group => group.filter(cell => candidates.has(cell)));
    if (remaining.some(group => group.length === 0)) break;
    const forced = remaining.find(group => group.length === 1);
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
      const eliminated = [...candidates].filter(cell => !group.includes(cell) && group.every(other => conflicts(p, cell, other)));
      if (eliminated.length) {
        eliminated.forEach(cell => candidates.delete(cell));
        deductions++; changed = true; break;
      }
    }
    if (!changed) break;
  }
  return { difficulty: deductions === 0 ? 'easy' : deductions <= 3 ? 'medium' : 'hard', singles, deductions, solved: cats.length === p.size };
}

// Normalize region labels and all eight square symmetries for duplicate checks.
export function canonicalKey(p: Puzzle): string {
  const variants: string[] = [];
  for (let mirror = 0; mirror < 2; mirror++) for (let rotation = 0; rotation < 4; rotation++) {
    const transformed = Array<number>(p.regions.length);
    p.regions.forEach((region, cell) => {
      let row = Math.floor(cell / p.size), col = cell % p.size;
      if (mirror) col = p.size - 1 - col;
      for (let i = 0; i < rotation; i++) [row, col] = [col, p.size - 1 - row];
      transformed[row * p.size + col] = region;
    });
    const labels = new Map<number, number>();
    variants.push(transformed.map(region => {
      if (!labels.has(region)) labels.set(region, labels.size);
      return labels.get(region);
    }).join(','));
  }
  return `${p.size}:${variants.sort()[0]}`;
}

// Seeded backtracking + connected region growth + uniqueness and logic checks.
export function makePuzzle(seed: number, size = 5, excluded: ReadonlySet<string> = new Set()): Puzzle {
  if (!BOARD_SIZES.some(value => value === size)) throw new RangeError('Supported sizes: 5, 6, 7');
  if (!Number.isSafeInteger(seed)) throw new RangeError('Seed must be a safe integer');
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  for (let attempt = 0; attempt < 5000; attempt++) {
    const solution = randomSolution(size, random);
    const regions = Array<number>(size * size).fill(-1);
    solution.forEach((cell, region) => { regions[cell] = region; });
    while (regions.includes(-1)) {
      const edges: [number, number][] = [];
      regions.forEach((region, cell) => {
        if (region < 0) return;
        for (const neighbor of [cell - size, cell + size, ...(cell % size ? [cell - 1] : []), ...(cell % size < size - 1 ? [cell + 1] : [])]) {
          if (neighbor >= 0 && neighbor < regions.length && regions[neighbor] === -1) edges.push([neighbor, region]);
        }
      });
      const [cell, region] = edges[Math.floor(random() * edges.length)];
      regions[cell] = region;
    }
    const puzzle: Puzzle = { id: `v${GENERATOR_VERSION}:${size}:${seed}`, size, regions, solution };
    if (excluded.has(canonicalKey(puzzle)) || solve(puzzle).length !== 1) continue;
    const rating = ratePuzzle(puzzle);
    if (rating.solved) return { ...puzzle, rating };
  }
  throw new Error('Could not generate a unique, logically solvable puzzle within 5000 attempts');
}

const catalogs = new Map<number, { puzzles: Puzzle[]; keys: Set<string> }>();
export function levelPuzzle(level: number, size = 5): Puzzle {
  if (!Number.isSafeInteger(level) || level < 1) throw new RangeError('Level must be a positive integer');
  let catalog = catalogs.get(size);
  if (!catalog) { catalog = { puzzles: [], keys: new Set() }; catalogs.set(size, catalog); }
  while (catalog.puzzles.length < level) {
    const puzzle = makePuzzle(catalog.puzzles.length + 1, size, catalog.keys);
    catalog.keys.add(canonicalKey(puzzle)); catalog.puzzles.push(puzzle);
  }
  return catalog.puzzles[level - 1];
}

export function dailySeed(date = new Date()) {
  return Number(date.toISOString().slice(0, 10).replaceAll('-', ''));
}
