export type Puzzle = { id: string; size: number; regions: number[]; solution: number[] };
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
  const cats = marks.flatMap((mark, i) => mark === 2 ? [i] : []);
  return cats.length === p.size && cats.every((a, i) => cats.slice(i + 1).every(b => !conflicts(p, a, b)));
}

// Seeded region growth preserves connected regions; only unique boards are accepted.
export function makePuzzle(seed: number): Puzzle {
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const size = 5;
  for (let attempt = 0; attempt < 2000; attempt++) {
    const columns = [0, 2, 4, 1, 3];
    if (random() < .5) columns.reverse();
    const solution = columns.map((c, r) => r * size + c);
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
    const puzzle = { id: String(seed), size, regions, solution };
    if (solve(puzzle).length === 1) return puzzle;
  }
  throw new Error('Could not generate a unique puzzle');
}

export function dailySeed(date = new Date()) {
  return Number(date.toISOString().slice(0, 10).replaceAll('-', ''));
}
