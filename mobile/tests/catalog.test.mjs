import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import bank from '../src/data/puzzles.json' with { type: 'json' };
import { CLASSIC_COUNT, DAILY_COUNT, classicPuzzle, dailyPuzzle } from '../src/game/catalog.ts';
import { validateCatalog } from '../src/game/catalog-schema.ts';
import { canonicalKey, solve, ratePuzzle } from '../tools/generator.ts';
import { buildCatalog } from '../tools/build-puzzles.mjs';

test('every bundled puzzle is unique, connected, bounded and deductively solvable offline', /** 驗證發佈題庫中的每一題，而非只抽樣生成器。 */ () => {
  assert.equal(validateCatalog(bank), bank);
  assert.equal(CLASSIC_COUNT, 200);
  assert.equal(DAILY_COUNT, 365);
  const identities = new Set();
  for (const p of [...bank.classic, ...bank.daily]) {
    assert.deepEqual(solve(p), [p.solution]);
    assert.deepEqual(ratePuzzle(p), p.rating);
    const key = canonicalKey(p);
    assert.ok(!identities.has(key)); identities.add(key);
    for (let region = 0; region < p.size; region++) {
      const cells = p.regions.flatMap(/** 取得該色區格子。 */ (value, cell) => value === region ? [cell] : []);
      const visited = new Set([cells[0]]), queue = [cells[0]];
      while (queue.length) {
        const cell = queue.pop();
        for (const next of cells) if (!visited.has(next) && Math.abs(Math.floor(cell / p.size) - Math.floor(next / p.size)) + Math.abs(cell % p.size - next % p.size) === 1) { visited.add(next); queue.push(next); }
      }
      assert.equal(visited.size, cells.length);
    }
  }
});

test('classic lookup returns stored data with explicit exhaustion', /** 一般模式僅按索引讀題，越界不會即時生成或靜默循環。 */ () => {
  assert.deepEqual(classicPuzzle(1), bank.classic[0]);
  assert.deepEqual(classicPuzzle(CLASSIC_COUNT), bank.classic.at(-1));
  assert.notEqual(classicPuzzle(1).id, classicPuzzle(2).id);
  for (const level of [0, -1, 1.5, CLASSIC_COUNT + 1]) assert.throws(/** 驗證題庫邊界。 */ () => classicPuzzle(level), RangeError);
});

test('daily lookup is UTC based and explicitly cycles after 365 days', /** 驗證日期映射、年度循環、負日期偏移及錯誤日期。 */ () => {
  assert.deepEqual(dailyPuzzle(20261025), bank.daily[0]);
  assert.deepEqual(dailyPuzzle(20261026), bank.daily[1]);
  assert.deepEqual(dailyPuzzle(20261024), bank.daily.at(-1));
  assert.deepEqual(dailyPuzzle(20271025), dailyPuzzle(20261025));
  for (const day of [20260229, 20261301, 0, NaN]) assert.throws(/** 驗證無效日期不會落入題池。 */ () => dailyPuzzle(day), RangeError);
});

test('malformed catalogs fail without silently switching to generation', /** 驗證題庫損壞時不接受錯誤身份、面積、答案或線索。 */ () => {
  for (const mutate of [
    /** 模擬不相容的資料格式。 */ b => { b.schemaVersion = 99; },
    /** 模擬空題池。 */ b => { b.daily = []; },
    /** 模擬重複身份。 */ b => { b.daily[0].id = b.classic[0].id; },
    /** 模擬遺失格子。 */ b => { b.classic[0].regions.pop(); },
    /** 模擬答案不足。 */ b => { b.classic[0].solution = []; },
    /** 模擬偽造線索。 */ b => { b.classic[0].givens = [-1]; },
  ]) {
    const copy = structuredClone(bank); mutate(copy);
    assert.throws(/** 拒絕修改後的錯誤題庫。 */ () => validateCatalog(copy));
  }
});

test('build tool is reproducible and validates its input', /** 驗證生成是獨立開發步驟，且相同參數會產生相同題庫。 */ () => {
  assert.deepEqual(buildCatalog(2, 2, 1, undefined, { sizes: [7] }), buildCatalog(2, 2, 1, undefined, { sizes: [7] }));
  for (const count of [0, -1, 1.5]) assert.throws(/** 無效題庫數量不得寫入檔案。 */ () => buildCatalog(count, 2), RangeError);
});

test('app source only loads catalog data and generator lives outside runtime source', /** 防止未來把即時生成或解題器重新接回 App。 */ () => {
  const screen = readFileSync(new URL('../src/app/index.tsx', import.meta.url), 'utf8');
  const rules = readFileSync(new URL('../src/game/engine.ts', import.meta.url), 'utf8');
  assert.ok(!/makePuzzle|levelPuzzle|boardSize|generator/.test(screen));
  assert.ok(!/function (makePuzzle|solve|ratePuzzle|randomSolution)/.test(rules));
});


test('checkpoint resumes without changing deterministic output or accepting clues', /** 驗證用盡預算後可續跑，且新版本拒絕預放貓。 */ () => {
  const dir = mkdtempSync(join(tmpdir(), 'xdoku-generation-'));
  try {
    const checkpoint = join(dir, 'checkpoint.json');
    assert.throws(/** 只搜尋一個種子不足以填滿兩題。 */ () => buildCatalog(1, 1, 1, undefined, { sizes: [7], checkpoint, maxSeeds: 1 }));
    const resumed = buildCatalog(1, 1, 1, undefined, { sizes: [7], checkpoint, maxSeeds: 20 });
    assert.deepEqual(resumed, buildCatalog(1, 1, 1, undefined, { sizes: [7], maxSeeds: 20 }));
    assert.equal(resumed.generatorVersion, 6);
    for (const p of [...resumed.classic, ...resumed.daily]) assert.deepEqual(p.givens, []);
    const bad = structuredClone(resumed); bad.classic[0].givens = [bad.classic[0].solution[0]];
    assert.throws(/** 新題庫不可偷加線索。 */ () => validateCatalog(bad));
    assert.throws(/** 更改搜尋設定不能混用舊斷點。 */ () => buildCatalog(1, 1, 2, undefined, { checkpoint, sizes: [7] }));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
