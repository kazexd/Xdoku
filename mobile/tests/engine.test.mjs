import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_SIZES, GENERATOR_VERSION, boardSize, canonicalKey, levelPuzzle, ratePuzzle, makePuzzle, solve, conflicts, isComplete, dailySeed } from '../src/game/engine.ts';

test('automatic size selection covers 7–10, stays stable and matches generated boards', /** 驗證自動選題涵蓋四種尺寸，重開不改變棋盤，每日尺寸亦不受時區影響。 */ () => {
  const counts = new Map(BOARD_SIZES.map(/** 初始化各尺寸出現次數。 */ size => [size, 0]));
  for (let seed = 1; seed <= 1000; seed++) {
    const size = boardSize(seed);
    assert.ok(BOARD_SIZES.includes(size));
    assert.equal(size, boardSize(seed));
    counts.set(size, counts.get(size) + 1);
    if (seed <= 12) {
      assert.equal(makePuzzle(seed).size, size);
      assert.equal(levelPuzzle(seed).size, size);
    }
  }
  for (const count of counts.values()) assert.ok(count > 180 && count < 320);
  const date = dailySeed(new Date('2026-10-25T00:00:00Z'));
  assert.deepEqual(makePuzzle(date), makePuzzle(dailySeed(new Date('2026-10-24T20:00:00-04:00'))));
});

test('100 seeds per size have a unique solution, connected regions and a deduction path', /** 驗證測試情境：100 seeds per size have a unique solution, connected regions and a deduction path。 */ () => {
  for (const size of BOARD_SIZES) {
  for (let seed = 1; seed <= 100; seed++) {
    const p = makePuzzle(seed, size);
    assert.deepEqual(solve(p), [p.solution]);
    const regionSizes = Array(size).fill(0);
    for (const region of p.regions) regionSizes[region]++;
    assert.ok(regionSizes.every(/** 每一個色區都必須存在。 */ count => count >= 1));
    assert.ok(regionSizes.filter(/** 統計單格色區以驗證新增生成限制。 */ count => count === 1).length <= 1, `${size}×${size}, seed ${seed}: ${regionSizes}`);
    assert.equal(p.rating.solved, true);
    assert.equal(p.rating.singles, size);
    assert.deepEqual(p.rating, ratePuzzle({ ...p, solution: [] }));
    for (let region = 0; region < p.size; region++) {
      const cells = p.regions.flatMap(/** 篩選符合條件的格子並攤平成一維索引陣列。 */ (r, i) => r === region ? [i] : []);
      const seen = new Set([cells[0]]), queue = [cells[0]];
      while (queue.length) {
        const a = queue.pop();
        for (const b of cells) if (!seen.has(b) && Math.abs(Math.floor(a / size) - Math.floor(b / size)) + Math.abs(a % size - b % size) === 1) { seen.add(b); queue.push(b); }
      }
      assert.equal(seen.size, cells.length);
    }
    assert.ok(isComplete(p, p.regions.map(/** 將每個項目轉換為本步驟所需的格子、記號或呈現資料。 */ (_, i) => p.solution.includes(i) ? 2 : 0)));
    assert.ok(!isComplete(p, Array(size * size).fill(0)));
    assert.ok(!isComplete(p, p.solution.map(/** 將每個項目轉換為本步驟所需的格子、記號或呈現資料。 */ () => 2)));
  }
  }
});
test('generation is deterministic; UTC daily seed agrees across offsets', /** 驗證測試情境：generation is deterministic; UTC daily seed agrees across offsets。 */ () => {
  assert.deepEqual(makePuzzle(20261025), makePuzzle(20261025));
  assert.equal(dailySeed(new Date('2026-10-24T20:00:00-04:00')), 20261025);
});

test('answers vary beyond the old two fixed permutations', /** 驗證測試情境：answers vary beyond the old two fixed permutations。 */ () => {
  for (const size of BOARD_SIZES) {
    const answers = new Set(Array.from({ length: 40 }, /** 依索引建立此步驟所需的候選、群組或測試資料。 */ (_, i) => makePuzzle(i + 1, size).solution.join(',')));
    assert.ok(answers.size > 10, `${size}: only ${answers.size} distinct answers`);
  }
});

test('canonical identity ignores relabeling, rotations and reflections', /** 驗證測試情境：canonical identity ignores relabeling, rotations and reflections。 */ () => {
  const p = makePuzzle(1, 8);
  const identity = canonicalKey(p);
  for (let mirror = 0; mirror < 2; mirror++) for (let rotation = 0; rotation < 4; rotation++) {
    const regions = Array(p.regions.length);
    p.regions.forEach(/** 依序處理各項資料，更新目前轉換、色區或候選集合。 */ (region, cell) => {
      let r = Math.floor(cell / p.size), c = cell % p.size;
      if (mirror) c = p.size - 1 - c;
      for (let k = 0; k < rotation; k++) [r, c] = [c, p.size - 1 - r];
      regions[r * p.size + c] = 100 - region;
    });
    assert.equal(canonicalKey({ ...p, regions }), identity);
  }
});

test('an excluded candidate is regenerated instead of being returned', /** 驗證測試情境：an excluded candidate is regenerated instead of being returned。 */ () => {
  for (const size of BOARD_SIZES) {
    const first = makePuzzle(17, size);
    const excluded = new Set([canonicalKey(first)]);
    const replacement = makePuzzle(17, size, excluded);
    const regionSizes = Array(size).fill(0);
    for (const region of replacement.regions) regionSizes[region]++;
    assert.ok(regionSizes.filter(/** 重新生成的候選亦須符合最多一個單格色區的限制。 */ count => count === 1).length <= 1);
    assert.ok(!excluded.has(canonicalKey(replacement)));
    assert.deepEqual(solve(replacement), [replacement.solution]);
    assert.equal(replacement.rating.solved, true);
  }
});

test('classic catalog excludes repeats including symmetry and preserves deterministic identity', /** 驗證測試情境：classic catalog excludes repeats including symmetry and preserves deterministic identity。 */ () => {
  for (const size of BOARD_SIZES) {
    const keys = new Set();
    for (let level = 1; level <= 40; level++) {
      const p = levelPuzzle(level, size);
      assert.ok(!keys.has(canonicalKey(p)));
      assert.deepEqual(p, makePuzzle(level, size, keys));
      keys.add(canonicalKey(p));
    }
    assert.equal(levelPuzzle(1, size).id, `v${GENERATOR_VERSION}:${size}:1`);
  }
});

test('difficulty grades are based on deduction work', /** 驗證測試情境：difficulty grades are based on deduction work。 */ () => {
  const ratings = Array.from({ length: 100 }, /** 依索引建立此步驟所需的候選、群組或測試資料。 */ (_, i) => makePuzzle(i + 1).rating);
  assert.deepEqual(new Set(ratings.map(/** 將每個項目轉換為本步驟所需的格子、記號或呈現資料。 */ r => r.difficulty)), new Set(['easy', 'medium', 'hard']));
  for (const rating of ratings) {
    assert.equal(rating.difficulty, rating.deductions === 0 ? 'easy' : rating.deductions <= 3 ? 'medium' : 'hard');
  }
  const unconstrained = { id: 'ambiguous', size: 5, regions: Array.from({ length: 25 }, /** 依索引建立此步驟所需的候選、群組或測試資料。 */ (_, i) => Math.floor(i / 5)), solution: [] };
  assert.equal(solve(unconstrained).length, 2);
  assert.equal(ratePuzzle(unconstrained).solved, false);
});

test('invalid generator inputs fail explicitly', /** 驗證測試情境：invalid generator inputs fail explicitly。 */ () => {
  for (const size of [0, 4, 5, 6, 11, 7.5]) assert.throws(/** 呼叫待驗證的函式，確認無效輸入會拋出預期錯誤。 */ () => makePuzzle(1, size), RangeError);
  for (const seed of [NaN, Infinity, 1.5]) assert.throws(/** 呼叫待驗證的函式，確認無效輸入會拋出預期錯誤。 */ () => makePuzzle(seed), RangeError);
  assert.throws(/** 呼叫待驗證的函式，確認無效輸入會拋出預期錯誤。 */ () => levelPuzzle(0), RangeError);
});
test('row, column, region and diagonal conflicts are rejected', /** 驗證測試情境：row, column, region and diagonal conflicts are rejected。 */ () => {
  const p = makePuzzle(1);
  assert.ok(conflicts(p, 0, 4));
  assert.ok(conflicts(p, 0, p.size * 2));
  assert.ok(conflicts(p, 0, p.size + 1));
  assert.ok(!isComplete(p, Array(25).fill(2)));
});
