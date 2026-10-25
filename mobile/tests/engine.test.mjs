import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_SIZES, GENERATOR_VERSION, boardSize, canonicalKey, levelPuzzle, ratePuzzle, makePuzzle, solve, conflicts, isComplete, dailySeed, regionLimit, protectGivens } from '../tools/generator.ts';

test('a new classic round has a different puzzle and starts with only its own clues', /** 驗證開新一局會更換棋盤並使用新題目的線索，不會繼承舊局記號或影響每日題目。 */ () => {
  const daily = makePuzzle(dailySeed(new Date('2026-10-25T00:00:00Z')));
  const before = JSON.stringify(daily);
  const first = levelPuzzle(1), next = levelPuzzle(2);
  assert.notEqual(first.id, next.id);
  assert.notEqual(canonicalKey(first), canonicalKey(next));
  const marks = protectGivens(next);
  assert.equal(marks.filter(/** 計算新局的貓咪，應僅包含題目線索。 */ mark => mark === 2).length, next.givens.length);
  assert.ok(!marks.includes(1));
  assert.deepEqual(protectGivens(next, Array(next.size * next.size).fill(0)), marks);
  assert.equal(JSON.stringify(daily), before);
});

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
    assert.ok(regionSizes.every(/** 每色不可超過指定面積上限。 */ count => count <= regionLimit(size)));
    assert.ok(p.givens.length <= 2);
    assert.equal(new Set(p.givens).size, p.givens.length);
    assert.ok(p.givens.every(/** 預放線索只能來自最初生成且不再更改的答案。 */ cell => p.solution.includes(cell)));
    assert.equal(p.rating.solved, true);
    assert.equal(p.rating.singles + p.givens.length, size);
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

test('area limits use floor at 14 percent with the agreed 7x7 exception', /** 驗證各尺寸面積上限及 7×7 例外。 */ () => {
  assert.deepEqual(BOARD_SIZES.map(/** 取得各支援尺寸的上限。 */ size => regionLimit(size)), [7, 8, 11, 14]);
});

test('optimized solver agrees with independent placement checks and clues are necessary', /** 以獨立回溯交叉檢查位元遮罩解題器，並確認兩隻線索不能直接減為一隻。 */ () => {
  /** 只使用公開衝突判斷逐列枚舉，作為不同實作的參考解題器。 */
  function reference(p, cats = []) {
    if (cats.length === p.size) return p.givens.every(/** 完整答案必須包含預放線索。 */ cell => cats.includes(cell)) ? [[...cats]] : [];
    const results = [];
    for (let col = 0; col < p.size; col++) {
      const cell = cats.length * p.size + col;
      if (cats.every(/** 參考實作逐一檢查既有貓咪衝突。 */ other => !conflicts(p, cell, other))) results.push(...reference(p, [...cats, cell]));
    }
    return results;
  }
  for (const size of [7, 8]) {
    const p = makePuzzle(1, size);
    assert.deepEqual(solve(p, 10000), reference(p));
    for (const cell of p.givens) {
      const fewer = { ...p, givens: [cell] };
      assert.ok(solve(fewer).length !== 1 || !ratePuzzle(fewer).solved);
    }
  }
});

test('fixed clues survive reset, saved-state repair, attempted clearing and undo snapshots', /** 驗證線索保護可用於開局、重玩、載入及所有編輯操作。 */ () => {
  const p = makePuzzle(1, 8);
  assert.ok(p.givens.length > 0);
  const empty = Array(64).fill(0);
  const snapshot = protectGivens(p);
  assert.equal(snapshot.filter(/** 計算開局預放的貓。 */ mark => mark === 2).length, p.givens.length);
  for (const marks of [empty, Array(64).fill(1), snapshot]) {
    const original = [...marks];
    const repaired = protectGivens(p, marks);
    for (const cell of p.givens) assert.equal(repaired[cell], 2);
    assert.deepEqual(marks, original);
  }
  assert.deepEqual(protectGivens(p, protectGivens(p, empty)), snapshot);
  const completed = p.regions.map(/** 建立正確完成狀態。 */ (_, cell) => p.solution.includes(cell) ? 2 : 0);
  assert.ok(isComplete(p, completed));
  completed[p.givens[0]] = 0;
  assert.ok(!isComplete(p, completed));
  const sample = { id: 'clue', size: 5, regions: Array.from({ length: 25 }, /** 建立每列一區的多解棋盤。 */ (_, cell) => Math.floor(cell / 5)), solution: [], givens: [0] };
  const answers = solve(sample, 100);
  assert.ok(answers.length > 0);
  assert.ok(answers.every(/** 所有答案均必須包含固定貓。 */ answer => answer.includes(0)));
  assert.ok(solve({ ...sample, givens: [] }, 100).length > answers.length);
  assert.deepEqual(solve({ ...sample, givens: [0, 1] }), []);
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
