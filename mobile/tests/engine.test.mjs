import bank from '../src/data/puzzles.json' with { type: 'json' };
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOARD_SIZES, GenerationExhaustedError, boardSize, canonicalKey, levelPuzzle, ratePuzzle, makePuzzle, solve, conflicts, isComplete, dailySeed, regionLimit, protectGivens } from '../tools/generator.ts';

test('sample seeds have a unique solution, connected regions and a deduction path', /** 驗證測試情境：sample seeds have a unique solution, connected regions and a deduction path。 */ () => {
  for (const size of [7, 8, 9]) {
  for (let seed = 1; seed <= 1; seed++) {
    const p = makePuzzle(seed, size);
    assert.deepEqual(solve(p), [p.solution]);
    const regionSizes = Array(size).fill(0);
    for (const region of p.regions) regionSizes[region]++;
    assert.ok(regionSizes.every(/** 每一個色區都必須存在。 */ count => count >= 1));
    assert.ok(regionSizes.filter(/** 統計單格色區以驗證新增生成限制。 */ count => count === 1).length <= 1, `${size}×${size}, seed ${seed}: ${regionSizes}`);
    assert.ok(regionSizes.every(/** 每色不可超過指定面積上限。 */ count => count <= regionLimit(size)));
    assert.deepEqual(p.givens, []);
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

test('area limits use the agreed hard caps', /** 驗證各尺寸面積上限及 7×7 例外。 */ () => {
  assert.deepEqual(BOARD_SIZES.map(/** 取得各支援尺寸的上限。 */ size => regionLimit(size)), [11, 13, 15, 17]);
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
  const p = bank.classic.find(/** 舊題庫仍可保護預放線索。 */ p => p.size === 8);
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

test('invalid generator inputs fail explicitly', /** 驗證測試情境：invalid generator inputs fail explicitly。 */ () => {
  for (const size of [0, 4, 5, 6, 11, 7.5]) assert.throws(/** 呼叫待驗證的函式，確認無效輸入會拋出預期錯誤。 */ () => makePuzzle(1, size), RangeError);
  for (const seed of [NaN, Infinity, 1.5]) assert.throws(/** 呼叫待驗證的函式，確認無效輸入會拋出預期錯誤。 */ () => makePuzzle(seed), RangeError);
  assert.throws(/** 呼叫待驗證的函式，確認無效輸入會拋出預期錯誤。 */ () => levelPuzzle(0), RangeError);
});
test('row, column, region and diagonal conflicts are rejected', /** 驗證測試情境：row, column, region and diagonal conflicts are rejected。 */ () => {
  const p = makePuzzle(1, 7);
  assert.ok(conflicts(p, 0, 4));
  assert.ok(conflicts(p, 0, p.size * 2));
  assert.ok(conflicts(p, 0, p.size + 1));
  assert.ok(!isComplete(p, Array(25).fill(2)));
});


test('bounded generation fails explicitly and remains deterministic', /** 驗證有限預算不會放寬規則或補上貓咪。 */ () => {
  assert.throws(/** 十格棋盤的小預算必須明確失敗。 */ () => makePuzzle(1, 10, new Set(), 1), GenerationExhaustedError);
  assert.deepEqual(makePuzzle(1, 7), makePuzzle(1, 7));
  for (const attempts of [0, -1, 1.5, 10001]) assert.throws(/** 拒絕無效搜尋預算。 */ () => makePuzzle(1, 7, new Set(), attempts), RangeError);
  assert.equal(dailySeed(new Date('2026-10-24T20:00:00-04:00')), 20261025);
});
